import { ChatWorkspace } from "@/components/ChatWorkspace";
import { getKnowledgeBase } from "@/lib/document-index";

export default async function HomePage() {
  const knowledgeBase = await getKnowledgeBase();

  return (
    <ChatWorkspace
      documents={knowledgeBase.documents}
      featuredTopics={knowledgeBase.topics.slice(0, 6)}
      featuredSections={knowledgeBase.sections.slice(0, 5)}
      totalSections={knowledgeBase.sections.length}
    />
  );
}