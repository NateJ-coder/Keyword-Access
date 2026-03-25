import { ChatWorkspace } from "@/components/ChatWorkspace";
import { getKnowledgeBase } from "@/lib/document-index";

export default async function HomePage() {
  const knowledgeBase = await getKnowledgeBase();

  return (
    <ChatWorkspace
      featuredTopics={knowledgeBase.topics.slice(0, 6)}
      featuredSections={knowledgeBase.sections.slice(0, 5)}
    />
  );
}