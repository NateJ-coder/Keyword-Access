"use client";

import { useMemo, useState } from "react";

import type { TopicSummary } from "@/lib/types";

type TopicIndexProps = {
  topics: TopicSummary[];
};

export function TopicIndex({ topics }: TopicIndexProps) {
  const [filter, setFilter] = useState("");

  const filteredTopics = useMemo(() => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return topics;
    }

    return topics.filter((topic) => {
      return (
        topic.label.toLowerCase().includes(query) ||
        topic.sampleQuestion.toLowerCase().includes(query) ||
        topic.sections.some(
          (section) =>
            section.title.toLowerCase().includes(query) ||
            section.preview.toLowerCase().includes(query) ||
            section.documentName.toLowerCase().includes(query)
        )
      );
    });
  }, [filter, topics]);

  return (
    <section className="surface-panel page-panel">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Topic Index</p>
          <h1>Browse by legal subject.</h1>
        </div>
        <input
          className="filter-input"
          type="search"
          placeholder="Filter topics, clauses, or document names"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      <div className="topic-grid">
        {filteredTopics.map((topic) => (
          <article key={topic.slug} className="topic-card">
            <div className="topic-card-header">
              <h2>{topic.label}</h2>
              <span>{topic.count} indexed sections</span>
            </div>
            <p>{topic.sampleQuestion}</p>
            <div className="mini-list">
              {topic.sections.slice(0, 4).map((section) => (
                <div key={section.id} className="mini-list-item">
                  <strong>{section.title}</strong>
                  <span>
                    {section.documentName} · {section.preview}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}