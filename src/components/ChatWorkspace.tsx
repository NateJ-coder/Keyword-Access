"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

import type { Citation, ChatMessage, KnowledgeSection, SourceDocument, TopicSummary } from "@/lib/types";

type ChatWorkspaceProps = {
  featuredTopics: TopicSummary[];
  featuredSections: KnowledgeSection[];
  documents: SourceDocument[];
  totalSections: number;
};

type AssistantMessage = ChatMessage & {
  citations?: Citation[];
};

const SUGGESTED_PROMPTS = [
  "A resident in a sectional title building keeps breaching conduct rules. What remedies are normally available?",
  "Can an owner dispute a body corporate decision if the trustees acted outside the rules?",
  "What should I check before assuming a property-use restriction is legally enforceable?"
];

export function ChatWorkspace({ featuredTopics, featuredSections, documents, totalSections }: ChatWorkspaceProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptChips = useMemo(() => {
    const topicQuestions = featuredTopics.slice(0, 2).map((topic) => topic.sampleQuestion);
    return [...SUGGESTED_PROMPTS, ...topicQuestions].slice(0, 5);
  }, [featuredTopics]);

  async function submitPrompt(content: string) {
    const trimmedQuestion = content.trim();
    const trimmedContext = context.trim();

    if (!trimmedQuestion || isLoading) {
      return;
    }

    const nextMessages = [...messages, { role: "user", content: trimmedQuestion } satisfies AssistantMessage];
    setMessages(nextMessages);
    setQuestion("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessages,
          context: trimmedContext
        })
      });

      const payload = (await response.json()) as { answer?: string; citations?: Citation[]; error?: string };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "The assistant could not generate a response.");
      }

      const answer = payload.answer;

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: answer,
          citations: payload.citations ?? []
        }
      ]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitPrompt(question);
    }
  }

  return (
    <div className="chat-shell">
      <section className="chat-column surface-panel">
        <div className="chat-header">
          <div className="chat-title-block">
            <p className="eyebrow">South African Property Research</p>
            <h1>Ask a property-law question.</h1>
            <p className="subtle-copy lead-copy">
              Ask in plain English. The assistant searches the indexed legal documents first, then answers with citations and gaps.
            </p>
          </div>
          <p className="subtle-copy">
            Start with the facts: the scheme, the conduct, what has happened already, and what you want to challenge or enforce.
          </p>
        </div>

        <div className="utility-row">
          <div className="knowledge-bar">
            <div className="knowledge-bar-copy">
              <p className="knowledge-bar-title">Active knowledge base</p>
              <p className="knowledge-bar-text">
                {documents.length} source document{documents.length === 1 ? "" : "s"} loaded, {totalSections} indexed sections.
              </p>
            </div>
            <div className="knowledge-file-list">
              {documents.slice(0, 3).map((document) => (
                <span key={document.relativePath} className="knowledge-file-pill">
                  {document.relativePath}
                </span>
              ))}
            </div>
          </div>

          <div className="quick-guide surface-panel compact-panel">
            <p className="knowledge-bar-title">Ask better questions</p>
            <p className="knowledge-bar-text">Include the scheme type, the rule issue, money involved, and who has already been notified.</p>
          </div>
        </div>

        <form className="composer top-composer" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            className="composer-input primary"
            rows={4}
            placeholder="Example: An owner in a sectional title scheme has not paid levies for several months. What remedies appear to be available to the body corporate under the indexed documents?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
          />

          <label className="field-label" htmlFor="context">
            Optional context
          </label>
          <textarea
            id="context"
            className="composer-input secondary"
            rows={2}
            placeholder="Add dates, arrears, whether notices were sent, and whether this is a tenant, owner, trustee, or body corporate dispute."
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />

          <div className="chip-row">
            {promptChips.map((prompt) => (
              <button key={prompt} type="button" className="prompt-chip" onClick={() => setQuestion(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="composer-actions">
            <p className="subtle-copy">This is research support, not legal advice. Answers should identify supporting provisions and what still needs legal judgment.</p>
            <button type="submit" className="primary-button" disabled={isLoading || !question.trim()}>
              {isLoading ? "Thinking..." : "Ask Gemini"}
            </button>
          </div>
        </form>

        <div className="message-stack live-chat">
          {messages.length === 0 ? (
            <div className="empty-chat-state">
              <p className="empty-title">Open chat</p>
              <p className="empty-copy">
                Describe the facts, include the building or scheme context, and ask what the indexed documents appear to allow, prohibit, or leave unresolved.
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <article key={`${message.role}-${index}-${message.content.slice(0, 16)}`} className={`message-bubble ${message.role}`}>
              <p className="message-role">{message.role === "user" ? "You" : "Gemini"}</p>
              <div className="message-content">
                {message.content.split(/\n{2,}/).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {message.role === "assistant" && message.citations && message.citations.length > 0 ? (
                <div className="citation-grid">
                  {message.citations.map((citation) => (
                    <article key={citation.id} className="citation-card">
                      <p className="article-metadata">{citation.documentName}</p>
                      <strong>{citation.title}</strong>
                      <p>{citation.excerpt}</p>
                      <div className="citation-list">
                        {citation.topics.map((topic) => (
                          <span key={`${citation.id}-${topic}`} className="citation-pill">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          {isLoading ? (
            <article className="message-bubble assistant pending">
              <p className="message-role">Gemini</p>
              <p className="subtle-copy">Reviewing the indexed source material and drafting a citation-first answer.</p>
            </article>
          ) : null}

          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </section>

      <aside className="insight-column">
        <section className="surface-panel insight-panel">
          <p className="eyebrow">Indexed Topics</p>
          <div className="topic-grid compact">
            {featuredTopics.map((topic) => (
              <article key={topic.slug} className="topic-card compact">
                <div className="topic-card-header">
                  <h2>{topic.label}</h2>
                  <span>{topic.count}</span>
                </div>
                <p>{topic.sampleQuestion}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-panel insight-panel">
          <p className="eyebrow">Retrieved from documents</p>
          <div className="article-stack">
            {featuredSections.map((section) => (
              <article key={section.id} className="article-card">
                <div>
                  <p className="article-metadata">{section.documentName}</p>
                  <h3>{section.title}</h3>
                </div>
                <p>{section.preview}</p>
                <div className="tag-row">
                  {section.topics.map((topic) => (
                    <span key={`${section.id}-${topic}`} className="topic-tag">
                      {topic}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}