"use client";

import { useMemo, useState } from "react";

import type { KnowledgeSection } from "@/lib/types";

type ArticleIndexProps = {
  sections: KnowledgeSection[];
};

export function ArticleIndex({ sections }: ArticleIndexProps) {
  const [filter, setFilter] = useState("");

  const filteredSections = useMemo(() => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return sections;
    }

    return sections.filter((section) => {
      return (
        section.title.toLowerCase().includes(query) ||
        section.documentName.toLowerCase().includes(query) ||
        section.preview.toLowerCase().includes(query) ||
        section.topics.some((topic) => topic.toLowerCase().includes(query))
      );
    });
  }, [filter, sections]);

  return (
    <section className="surface-panel page-panel">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Article Index</p>
          <h1>Review extracted articles and clauses.</h1>
        </div>
        <input
          className="filter-input"
          type="search"
          placeholder="Filter by article title, topic, or document"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      <div className="article-stack large">
        {filteredSections.map((section) => (
          <article key={section.id} className="article-card detailed">
            <div className="article-card-topline">
              <p className="article-metadata">{section.documentName}</p>
              <div className="tag-row">
                {section.topics.map((topic) => (
                  <span key={`${section.id}-${topic}`} className="topic-tag">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <h2>{section.title}</h2>
            <p>{section.preview}</p>
          </article>
        ))}
      </div>
    </section>
  );
}