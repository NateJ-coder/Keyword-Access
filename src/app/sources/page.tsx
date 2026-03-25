import { SourceIndex } from "@/components/SourceIndex";
import { getKnowledgeBase } from "@/lib/document-index";

export default async function SourcesPage() {
  const knowledgeBase = await getKnowledgeBase();

  return <SourceIndex documents={knowledgeBase.documents} />;
}