"use client";

import { useMemo, useState } from "react";

import type { SourceDocument } from "@/lib/types";

type SourceIndexProps = {
  documents: SourceDocument[];
};

export function SourceIndex({ documents }: SourceIndexProps) {
  const [filter, setFilter] = useState("");

  const filteredDocuments = useMemo(() => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return documents;
    }

    return documents.filter((document) => {
      return (
        document.name.toLowerCase().includes(query) ||
        document.relativePath.toLowerCase().includes(query) ||
        document.topics.some((topic) => topic.toLowerCase().includes(query))
      );
    });
  }, [documents, filter]);

  return (
    <section className="surface-panel page-panel">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Knowledge Sources</p>
          <h1>Track the Word documents feeding the app.</h1>
        </div>
        <input
          className="filter-input"
          type="search"
          placeholder="Filter source documents"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      <div className="source-grid">
        {filteredDocuments.map((document) => (
          <article key={document.relativePath} className="source-card">
            <p className="article-metadata">{document.relativePath}</p>
            <h2>{document.name}</h2>
            <p>{document.sectionCount} extracted sections</p>
            <div className="tag-row">
              {document.topics.map((topic) => (
                <span key={`${document.name}-${topic}`} className="topic-tag">
                  {topic}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}