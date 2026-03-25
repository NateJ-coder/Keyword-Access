import { NextResponse } from "next/server";

import { getFeaturedCitations, toCitations } from "@/lib/document-index";
import type { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    const sourcesBlock = relevantSections
      .map((section, index) => {
        return [`Source ${index + 1}`, `Document: ${section.documentName}`, `Title: ${section.title}`, `Topics: ${section.topics.join(", ")}`, section.content].join("\n");
      })
      .join("\n\n---\n\n");

    const prompt = [
      "You are a South African real-estate law research assistant.",
      "Answer only from the supplied source material. If the sources do not support a point, say so explicitly.",
      "Do not present yourself as a lawyer and do not give definitive legal advice.",
      "Be practical: identify what appears legally supported, what appears unsupported, and what factual gaps remain.",
      "Cite the relevant source titles exactly as provided in a final section named Sources used.",
      "If the user asks whether something is legal, distinguish between what the indexed material appears to allow and what would still require legal counsel.",
      context ? `Additional user context: ${context}` : "",
      `Conversation so far:\n${formatConversation(safeMessages)}`,
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