export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type KnowledgeSection = {
  id: string;
  documentName: string;
  title: string;
  content: string;
  preview: string;
  topics: string[];
  scoreTerms: string[];
};

export type TopicSummary = {
  slug: string;
  label: string;
  count: number;
  sections: KnowledgeSection[];
  sampleQuestion: string;
};

export type SourceDocument = {
  name: string;
  relativePath: string;
  sectionCount: number;
  topics: string[];
};

export type KnowledgeBase = {
  documents: SourceDocument[];
  sections: KnowledgeSection[];
  topics: TopicSummary[];
  generatedAt: string;
};

export type Citation = {
  id: string;
  documentName: string;
  title: string;
  topics: string[];
};