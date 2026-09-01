import type { WebResult } from "@/lib/types";

// Google Programmable Search Engine, restricted (in the Google console, not
// here) to a small whitelist of authoritative South African legal sources —
// e.g. gov.za, saflii.org, csos.org.za, derebus.org.za. This file never
// decides which sites are searched; that boundary lives entirely in the
// engine configuration behind GOOGLE_SEARCH_ENGINE_ID, so it can be tightened
// or widened without a code change.
const SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

export async function searchWeb(query: string, maxResults = 3): Promise<WebResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  const trimmedQuery = query.trim();

  if (!apiKey || !engineId || !trimmedQuery) {
    return [];
  }

  try {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", engineId);
    url.searchParams.set("q", trimmedQuery);
    url.searchParams.set("num", String(Math.min(Math.max(maxResults, 1), 10)));

    const response = await fetch(url.toString());
    const payload = (await response.json()) as {
      items?: Array<{ title?: string; link?: string; snippet?: string }>;
      error?: { message?: string };
    };

    if (!response.ok || !payload.items) {
      return [];
    }

    return payload.items
      .filter((item): item is { title: string; link: string; snippet?: string } => Boolean(item.title && item.link))
      .slice(0, maxResults)
      .map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet ?? ""
      }));
  } catch {
    // A search outage should never break the chat answer itself.
    return [];
  }
}
