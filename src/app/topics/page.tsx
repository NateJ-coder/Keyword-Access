import { TopicIndex } from "@/components/TopicIndex";
import { getKnowledgeBase } from "@/lib/document-index";

export default async function TopicsPage() {
  const knowledgeBase = await getKnowledgeBase();

  return <TopicIndex topics={knowledgeBase.topics} />;
}