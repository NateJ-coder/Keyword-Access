import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

import type { Citation, KnowledgeBase, KnowledgeSection, SourceDocument, TopicSummary } from "@/lib/types";

const DOC_DIRECTORIES = [process.cwd(), path.join(process.cwd(), "knowledge-base")];
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "are",
  "any",
  "been",
  "being",
  "can",
  "did",
  "does",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "has",
  "have",
  "had",
  "how",
  "if",
  "i",
  "im",
  "is",
  "it",
  "its",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "paid",
  "person",
  "someone",
  "somebody",
  "will",
  "your",
  "about",
  "would",
  "there",
  "their",
  "them",
  "they",
  "then",
  "what",
  "when",
  "where",
  "which",
  "who",
  "under",
  "could",
  "should",
  "legal",
  "south",
  "african",
  "africa",
  "real",
  "estate"
]);

const QUERY_EXPANSIONS: Record<string, string[]> = {
  levy: ["levies", "contribution", "contributions", "arrear", "arrears", "due"],
  levies: ["levy", "contribution", "contributions", "arrear", "arrears", "due"],
  contribution: ["contributions", "levy", "levies", "arrear"],
  contributions: ["contribution", "levy", "levies", "arrear"],
  unpaid: ["arrear", "arrears", "due", "outstanding"],
  arrear: ["arrears", "unpaid", "overdue", "outstanding", "levy", "contribution"],
  arrears: ["arrear", "unpaid", "overdue", "outstanding", "levy", "contribution"],
  owner: ["member", "trustee", "unit", "section"],
  tenant: ["occupier", "lessee", "lease"],
  dispute: ["complaint", "adjudication", "application", "ombud"],
  fine: ["penalty", "sanction"],
  rules: ["rule", "conduct", "management"],
  trustees: ["trustee", "body", "corporate"],
  body: ["corporate", "scheme", "association"]
};

const TOPIC_RULES: Array<{ label: string; sampleQuestion: string; keywords: string[] }> = [
  {
    label: "Body Corporate",
    sampleQuestion: "Can a body corporate fine or restrict an owner for disruptive behaviour?",
    keywords: ["body corporate", "trustee", "sectional title", "conduct rule", "management rule", "scheme"]
  },
  {
    label: "Lease & Tenancy",
    sampleQuestion: "What remedies does a landlord have if a tenant breaches occupation rules?",
    keywords: ["lease", "tenant", "landlord", "occupation", "rental", "lessor", "lessee"]
  },
  {
    label: "Disputes & Enforcement",
    sampleQuestion: "What is the proper escalation path for a property-related dispute?",
    keywords: ["dispute", "complaint", "breach", "enforcement", "sanction", "penalty", "warning"]
  },
  {
    label: "Ownership & Transfer",
    sampleQuestion: "What requirements apply before ownership or transfer can proceed?",
    keywords: ["owner", "ownership", "transfer", "title deed", "sale", "purchaser", "seller"]
  },
  {
    label: "Compliance & Governance",
    sampleQuestion: "Which governance rules control conduct, approvals, and compliance in the property?",
    keywords: ["compliance", "governance", "approval", "consent", "rule", "regulation", "policy"]
  },
  {
    label: "Municipal & Planning",
    sampleQuestion: "Does municipal approval or zoning affect the legality of the intended property use?",
    keywords: ["municipal", "zoning", "planning", "by-law", "building plan", "local authority"]
  }
];

let cachedKnowledgeBase: Promise<KnowledgeBase> | null = null;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
}

function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function buildQueryTerms(query: string) {
  const baseTerms = tokenize(query);
  const expandedTerms = new Set<string>(baseTerms);

  for (const term of baseTerms) {
    const expansions = QUERY_EXPANSIONS[term] ?? [];

    for (const expansion of expansions) {
      expandedTerms.add(normalizeToken(expansion));
    }
  }

  return Array.from(expandedTerms);
}

function isHeading(line: string) {
  if (line.length < 5 || line.length > 110) {
    return false;
  }

  if (/^(chapter|part|section|article|annexure|schedule|clause)\b/i.test(line)) {
    return true;
  }

  if (/^\d+(\.\d+){0,3}\s+[A-Z]/.test(line)) {
    return true;
  }

  if (/^[A-Z][A-Z\s,&/()-]{5,}$/.test(line)) {
    return true;
  }

  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,7}$/.test(line)) {
    return true;
  }

  return false;
}

function inferTopics(title: string, content: string) {
  const combined = `${title} ${content}`.toLowerCase();
  const matches = TOPIC_RULES.filter((rule) => rule.keywords.some((keyword) => combined.includes(keyword))).map((rule) => rule.label);
  return matches.length > 0 ? matches : ["General Property Law"];
}

function splitIntoChunks(content: string, maxCharacters = 1400) {
  const paragraphs = content.split(/\n{2,}/).map(normalizeWhitespace).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length > maxCharacters && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
      continue;
    }

    currentChunk = candidate;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [content];
}

async function findDocxFiles() {
  const discovered = new Map<string, string>();

  for (const directory of DOC_DIRECTORIES) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".docx")) {
          const absolutePath = path.join(directory, entry.name);
          discovered.set(absolutePath, path.relative(process.cwd(), absolutePath));
        }
      }
    } catch {
      // Ignore missing knowledge-base directory.
    }
  }

  return Array.from(discovered.entries()).map(([absolutePath, relativePath]) => ({ absolutePath, relativePath }));
}

async function parseDocument(filePath: string, relativePath: string) {
  const result = await mammoth.extractRawText({ path: filePath });
  const rawLines = result.value
    .split(/\r?\n/)
    .map(normalizeWhitespace)
    .filter(Boolean);
  const documentName = path.basename(relativePath, path.extname(relativePath));
  const sections: KnowledgeSection[] = [];

  let currentTitle = documentName;
  let buffer: string[] = [];
  let sectionNumber = 0;

  const flushSection = () => {
    const content = buffer.join("\n\n").trim();

    if (!content) {
      return;
    }

    const chunks = splitIntoChunks(content);

    chunks.forEach((chunk, chunkIndex) => {
      const topics = inferTopics(currentTitle, chunk);
      sections.push({
        id: `${slugify(documentName)}-${sectionNumber}-${chunkIndex + 1}`,
        documentName,
        title: currentTitle,
        content: chunk,
        preview: `${chunk.slice(0, 220).trim()}${chunk.length > 220 ? "..." : ""}`,
        topics,
        scoreTerms: Array.from(new Set([...tokenize(currentTitle), ...tokenize(chunk).slice(0, 20)]))
      });
    });

    sectionNumber += 1;
    buffer = [];
  };

  for (const line of rawLines) {
    if (isHeading(line)) {
      flushSection();
      currentTitle = line;
      continue;
    }

    buffer.push(line);
  }

  flushSection();

  if (sections.length === 0 && rawLines.length > 0) {
    const fallbackContent = rawLines.join("\n\n");
    const topics = inferTopics(documentName, fallbackContent);
    sections.push({
      id: `${slugify(documentName)}-fallback`,
      documentName,
      title: documentName,
      content: fallbackContent,
      preview: `${fallbackContent.slice(0, 220).trim()}${fallbackContent.length > 220 ? "..." : ""}`,
      topics,
      scoreTerms: Array.from(new Set([...tokenize(documentName), ...tokenize(fallbackContent).slice(0, 20)]))
    });
  }

  const topics = Array.from(new Set(sections.flatMap((section) => section.topics))).sort();
  const documentSummary: SourceDocument = {
    name: documentName,
    relativePath,
    sectionCount: sections.length,
    topics
  };

  return { documentSummary, sections };
}

function buildTopicSummaries(sections: KnowledgeSection[]) {
  const byTopic = new Map<string, KnowledgeSection[]>();

  for (const section of sections) {
    for (const topic of section.topics) {
      const entries = byTopic.get(topic) ?? [];
      entries.push(section);
      byTopic.set(topic, entries);
    }
  }

  const fallbackQuestion = "Which sections in the knowledge base speak directly to this property issue?";

  return Array.from(byTopic.entries())
    .map(([label, topicSections]) => {
      const rule = TOPIC_RULES.find((entry) => entry.label === label);
      const uniqueSections = Array.from(new Map(topicSections.map((section) => [section.id, section])).values()).slice(0, 6);

      return {
        slug: slugify(label),
        label,
        count: topicSections.length,
        sections: uniqueSections,
        sampleQuestion: rule?.sampleQuestion ?? fallbackQuestion
      } satisfies TopicSummary;
    })
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export async function getKnowledgeBase() {
  if (!cachedKnowledgeBase) {
    cachedKnowledgeBase = (async () => {
      const files = await findDocxFiles();
      const parsed = await Promise.all(files.map((file) => parseDocument(file.absolutePath, file.relativePath)));
      const documents = parsed.map((entry) => entry.documentSummary).sort((left, right) => left.name.localeCompare(right.name));
      const sections = parsed.flatMap((entry) => entry.sections);
      const topics = buildTopicSummaries(sections);

      return {
        documents,
        sections,
        topics,
        generatedAt: new Date().toISOString()
      } satisfies KnowledgeBase;
    })();
  }

  return cachedKnowledgeBase;
}

export async function getFeaturedCitations(query: string, maxResults = 6) {
  const knowledgeBase = await getKnowledgeBase();
  const queryTerms = buildQueryTerms(query);
  const rawQuery = normalizeWhitespace(query).toLowerCase();
  const significantPhrases = [
    "body corporate",
    "sectional title",
    "conduct rule",
    "management rule",
    "special levy",
    "ordinary levy",
    "exclusive use",
    "community scheme",
    "trustee meeting"
  ].filter((phrase) => rawQuery.includes(phrase));

  const ranked = knowledgeBase.sections
    .map((section) => {
      const titleText = `${section.title} ${section.documentName}`.toLowerCase();
      const contentText = section.content.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (titleText.includes(term)) {
          score += 6;
        }

        if (section.topics.some((topic) => topic.toLowerCase().includes(term))) {
          score += 4;
        }

        if (contentText.includes(term)) {
          score += 2;
        }

        if (section.scoreTerms.includes(term)) {
          score += 1;
        }
      }

      for (const phrase of significantPhrases) {
        if (titleText.includes(phrase)) {
          score += 12;
        }

        if (contentText.includes(phrase)) {
          score += 8;
        }
      }

      if (rawQuery.includes("levy") || rawQuery.includes("levies") || rawQuery.includes("contribution")) {
        if (/lev(y|ies)|contribution|arrear|outstanding|due/.test(titleText)) {
          score += 14;
        }

        if (/lev(y|ies)|contribution|arrear|outstanding|due/.test(contentText)) {
          score += 10;
        }
      }

      if (queryTerms.length === 0) {
        score = 1;
      }

      return { section, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults)
    .map((entry) => entry.section);

  if (ranked.length > 0) {
    return ranked;
  }

  return knowledgeBase.sections.slice(0, maxResults);
}

export function toCitations(sections: KnowledgeSection[]): Citation[] {
  return sections.map((section) => ({
    id: section.id,
    documentName: section.documentName,
    title: section.title,
    topics: section.topics,
    excerpt: section.preview
  }));
}