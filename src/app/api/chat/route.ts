import { NextResponse } from "next/server";

import { getFeaturedCitations, getKnowledgeBase, toCitations } from "@/lib/document-index";
import { searchWeb } from "@/lib/web-search";
import type { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

type ChatMode = "ask" | "draft";

const APP_DESCRIPTION = "Keyword Access is Fuzio's South African property-law research assistant for CSOS, sectional title and body corporate disputes. It searches the loaded documents, answers questions with source excerpts, and drafts messages. It provides research support, not legal advice.";

// Below this combined relevance score, the indexed CSOS Act / STSMA / rules
// material is treated as too thin to be the whole answer, and a live,
// domain-restricted web search is used to find current supporting reading
// (see src/lib/web-search.ts for the site whitelist boundary).
const LOW_CONFIDENCE_THRESHOLD = 10;

const ASK_SYSTEM_INSTRUCTION = [
  "You are the Keyword Access assistant, used by Fuzio staff who are in the middle of a live dispute and need a fast, plain-language answer.",
  APP_DESCRIPTION,
  "You are not a law firm and this is not legal advice.",
  "For questions about the application itself, use the application description above. For legal claims, use only the supplied retrieved source material as authority. If the passages do not cover the legal question, say that the retrieved passages do not establish the answer; do not claim the entire knowledge base lacks it. Answer any supported part and ask one specific clarifying question when useful instead of guessing.",
  "Keep the whole answer short: 2 to 5 short sentences, plain conversational language, no headings, no markdown, no bullet lists.",
  "Lead with the direct answer to the question first. Add a caveat only if it changes what the person should do next.",
  "Do not quote long passages or restate full clause text: the exact source excerpts are already shown to the user separately as citation cards, so just reference the relevant rule or section briefly by name if useful.",
  "If the scenario involves a homeowners association rather than a sectional title scheme, say briefly whether the CSOS Act still applies to that type of community scheme based on the retrieved material.",
  "If web sources are supplied below, they are unverified live search results, not part of the indexed knowledge base. You may mention in one short clause that further reading is available, but never state their contents as settled fact, and never treat them as higher authority than the indexed documents. The links themselves are already shown to the user separately, so do not list URLs in your answer."
].join(" ");

const DRAFT_SYSTEM_INSTRUCTION = [
  "You are drafting a short, ready-to-send message on behalf of Fuzio staff to a resident, owner, tenant, or trustee involved in a property dispute.",
  "Base the content only on the supplied retrieved source material; treat any web sources as background only, never as something to cite in the message itself.",
  "Output ONLY the message itself: a brief greeting, 2 to 4 short paragraphs, a clear next step or request, and a sign-off placeholder like 'Kind regards,' followed by a line for the staff member's name.",
  "Do not add analysis, headings, citations lists, or explanations outside the message. Mention a specific rule or section number inline only if it strengthens the point.",
  "Keep it concise enough that staff can send it with little or no editing."
].join(" ");

const TONE_INSTRUCTIONS: Record<string, string> = {
  Formal: "Use a formal, neutral tone.",
  Firm: "Use a firm, direct tone that makes the expectation and consequence of inaction clear, while staying professional.",
  Friendly: "Use a warm, friendly reminder tone appropriate for a first, low-conflict nudge."
};

function formatConversation(messages: ChatMessage[]) {
  return messages.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`).join("\n\n");
}

function isAppOverviewQuestion(question: string) {
  const normalized = question.toLowerCase().replace(/[?.!]+$/g, "").replace(/\s+/g, " ").trim();
  return /^(?:what is|what's|tell me about|explain) (?:the )?keyword\s*access(?: (?:app|application))?(?: and what does it cover)?$/.test(normalized)
    || /^(?:what (?:does (?:keyword\s*access|this app) (?:do|cover)|can you do)|how does keyword\s*access work|who are you)$/.test(normalized);
}

export async function POST(request: Request) {
  try {
    const { messages, context, mode, tone } = (await request.json()) as {
      messages?: ChatMessage[];
      context?: string;
      mode?: ChatMode;
      tone?: string;
    };

    const safeMessages = Array.isArray(messages) ? messages.slice(-10) : [];
    const latestUserMessage = [...safeMessages].reverse().find((message) => message.role === "user")?.content?.trim();

    if (!latestUserMessage) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    const chatMode: ChatMode = mode === "draft" ? "draft" : "ask";

    if (chatMode === "ask" && isAppOverviewQuestion(latestUserMessage)) {
      const knowledgeBase = await getKnowledgeBase();
      const inventory = knowledgeBase.documents.length > 0
        ? `Currently loaded: ${knowledgeBase.documents.map((document) => document.name).join(", ")} (${knowledgeBase.sections.length} indexed sections). Coverage depends on those documents.`
        : "No source documents are currently loaded, so document-based legal answers are not available yet.";
      return NextResponse.json({ answer: `${APP_DESCRIPTION} ${inventory}`, citations: [], webResults: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Set GEMINI_API_KEY in the environment before using chat." }, { status: 503 });
    }

    const { sections: relevantSections, topScore } = await getFeaturedCitations(`${latestUserMessage}\n${context ?? ""}`);
    const isLowConfidence = relevantSections.length === 0 || topScore < LOW_CONFIDENCE_THRESHOLD;
    const webResults = isLowConfidence ? await searchWeb(`${latestUserMessage} South Africa community scheme`) : [];

    if (relevantSections.length === 0 && webResults.length === 0) {
      return NextResponse.json(
        {
          answer:
            chatMode === "draft"
              ? "I could not find indexed source material to draft this message from. Try naming the scheme type and the specific rule or conduct issue involved."
              : "I could not find anything in the indexed documents (or in a web search) to support an answer yet. Try naming the scheme type, the dispute, and the specific rule or conduct issue involved.",
          citations: [],
          webResults: []
        },
        { status: 200 }
      );
    }

    const sourcesBlock = relevantSections
      .map((section, index) => {
        return [`Source ${index + 1}`, `Document: ${section.documentName}`, `Title: ${section.title}`, `Topics: ${section.topics.join(", ")}`, section.content].join("\n");
      })
      .join("\n\n---\n\n");

    const webBlock = webResults
      .map((result, index) => [`Web result ${index + 1}`, `Title: ${result.title}`, `Link: ${result.link}`, result.snippet].join("\n"))
      .join("\n\n---\n\n");

    const toneInstruction = chatMode === "draft" ? TONE_INSTRUCTIONS[tone ?? "Formal"] ?? TONE_INSTRUCTIONS.Formal : "";

    const prompt = [
      chatMode === "draft" ? `Tone: ${toneInstruction}` : "",
      "User question:",
      latestUserMessage,
      context ? `Additional context:\n${context}` : "",
      safeMessages.length > 1 ? `Conversation so far:\n${formatConversation(safeMessages)}` : "",
      sourcesBlock ? `Retrieved source material:\n${sourcesBlock}` : "No indexed source material matched this question well.",
      webBlock ? `Unverified live web search results (background only, not part of the indexed knowledge base):\n${webBlock}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: chatMode === "draft" ? DRAFT_SYSTEM_INSTRUCTION : ASK_SYSTEM_INSTRUCTION
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: chatMode === "draft" ? 0.4 : 0.2,
            topP: 0.9
          }
        })
      }
    );

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message ?? "Gemini request failed." }, { status: 502 });
    }

    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();

    if (!answer) {
      return NextResponse.json({ error: "Gemini returned an empty response." }, { status: 502 });
    }

    return NextResponse.json({
      answer,
      citations: toCitations(relevantSections),
      webResults
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to complete the chat request."
      },
      { status: 500 }
    );
  }
}
