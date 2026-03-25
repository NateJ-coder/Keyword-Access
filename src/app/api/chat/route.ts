import { NextResponse } from "next/server";

import { getFeaturedCitations, toCitations } from "@/lib/document-index";
import type { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM_INSTRUCTION = [
  "You are Keyword Access, a South African property-law research assistant.",
  "You are not a law firm and you do not provide legal advice.",
  "Use only the supplied retrieved source material from the indexed Word documents.",
  "If the source material does not support a proposition, say that clearly and do not infer beyond the text.",
  "When the user asks if something is legal, separate what appears supported by the documents from what remains uncertain or fact-dependent.",
  "Prefer clear, practical writing over academic prose.",
  "Always structure the answer under these exact headings: Short answer, What the documents support, What is unclear or missing, Practical next step, Sources used.",
  "In Sources used, cite only the exact document and section titles provided in the retrieved material."
].join(" ");

function formatConversation(messages: ChatMessage[]) {
  return messages.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`).join("\n\n");
}

export async function POST(request: Request) {
  try {
    const { messages, context } = (await request.json()) as {
      messages?: ChatMessage[];
      context?: string;
    };

    const safeMessages = Array.isArray(messages) ? messages.slice(-10) : [];
    const latestUserMessage = [...safeMessages].reverse().find((message) => message.role === "user")?.content?.trim();

    if (!latestUserMessage) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Set GEMINI_API_KEY in the environment before using chat." }, { status: 503 });
    }

    const relevantSections = await getFeaturedCitations(`${latestUserMessage}\n${context ?? ""}`);

    if (relevantSections.length === 0) {
      return NextResponse.json(
        {
          answer:
            "Short answer\n\nI could not find any indexed source material to support an answer yet.\n\nWhat the documents support\n\nNo matching sections were retrieved from the current Word-document knowledge base.\n\nWhat is unclear or missing\n\nThe question may need more factual detail, or the relevant document may not have been indexed yet.\n\nPractical next step\n\nTry naming the scheme type, the dispute, and the rule or conduct issue involved.\n\nSources used\n\nNone retrieved.",
          citations: []
        },
        { status: 200 }
      );
    }

    const sourcesBlock = relevantSections
      .map((section, index) => {
        return [`Source ${index + 1}`, `Document: ${section.documentName}`, `Title: ${section.title}`, `Topics: ${section.topics.join(", ")}`, section.content].join("\n");
      })
      .join("\n\n---\n\n");

    const prompt = [
      "User question:",
      latestUserMessage,
      context ? `Additional context:\n${context}` : "",
      safeMessages.length > 1 ? `Conversation so far:\n${formatConversation(safeMessages)}` : "",
      `Retrieved source material:\n${sourcesBlock}`
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_INSTRUCTION
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9
          }
        })
      }
    );

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message ?? "Gemini request failed." }, { status: 502 });
    }

    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();

    if (!answer) {
      return NextResponse.json({ error: "Gemini returned an empty response." }, { status: 502 });
    }

    return NextResponse.json({
      answer,
      citations: toCitations(relevantSections)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to complete the chat request."
      },
      { status: 500 }
    );
  }
}