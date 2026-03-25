import { ArticleIndex } from "@/components/ArticleIndex";
import { getKnowledgeBase } from "@/lib/document-index";

export default async function ArticlesPage() {
  const knowledgeBase = await getKnowledgeBase();

  return <ArticleIndex sections={knowledgeBase.sections} />;
}