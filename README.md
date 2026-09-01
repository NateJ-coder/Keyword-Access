# Keyword Access

Fuzio's chat-first South African property-law research tool, built for staff handling live disputes. It indexes `.docx` source documents (currently the CSOS Act, Sectional Titles Management Act, and management rules) and answers plain-language questions with short, direct responses plus the exact indexed articles used.

## What it does

- Extracts text from Word documents found in the project root and optional `knowledge-base/` folder.
- Builds a searchable index of topics, articles, and source files, including a dedicated **CSOS & Community Schemes** topic covering homeowners associations (HOAs) as well as sectional title schemes.
- Opens on a blank chat so staff can ask fact-pattern questions in plain language.
- Uses hybrid retrieval: keyword scoring plus Gemini embeddings, combined into one relevance score per section (no separate reranking call, so answers come back faster).
- Retrieves relevant source chunks and sends only those chunks to Gemini for a short, grounded answer.
- Two response modes:
  - **Get an answer** — a 2 to 5 sentence direct answer, no headings or long quotes.
  - **Draft a message** — a ready-to-send message to an owner, tenant, or trustee, in a chosen tone (Formal, Firm, Friendly), based only on the indexed material.
- Every answer surfaces its source articles as citation cards; clicking a citation jumps straight to that clause on the Articles page and highlights it.
- Quick topic chips (CSOS & HOA, Body Corporate, Levies & Arrears, Conduct Breaches, Lease & Tenancy) give staff a one-click starting question during a live dispute.
- When the indexed documents don't cover a question well, it automatically runs a live, domain-restricted web search and shows the results in a clearly separate "From the web" section — see **Live web search** below.

## Branding

The UI uses Fuzio's brand palette (from `Fuzio Staff Hub`): primary blue `#004A99`, charcoal `#2D2D2D`, gold accent `#F5A623`, plus status green/red and neutral greys, on Inter typography. The Fuzio logo lives at `public/fuzio-logo.jpg`.

## Environment

Create a `.env.local` file with:

```bash
GEMINI_API_KEY=your_gemini_api_key_here

# Shared access code staff enter once. Leave unset for local dev if you
# don't want a login screen; set it before deploying anywhere reachable
# by staff or the public internet.
SITE_PASSWORD=choose_a_shared_staff_access_code

# Optional — only needed for the live web search fallback, see below.
GOOGLE_SEARCH_API_KEY=your_google_search_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_programmable_search_engine_id_here
```

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Knowledge base

- Keep `.docx` files in the project root, or place more files in `knowledge-base/`.
- The current workspace already includes `Key access.docx`, which is indexed automatically.
- The parser uses heading heuristics to create smaller headed chunks for retrieval.
- Semantic retrieval depends on `GEMINI_API_KEY`, because Gemini embeddings power meaning-based matching. Without a key, retrieval falls back to keyword scoring alone.
- To add a new source document (e.g. an HOA-specific constitution or municipal by-law), drop the `.docx` into the project root or `knowledge-base/` and restart the dev server — it will be parsed, chunked, and topic-tagged automatically.

## App structure

- `Home`: chat with mode toggle (answer or draft), quick topic chips, optional context, and citations.
- `Topics`: filter the legal index by subject area.
- `Articles`: browse extracted sections and short previews; deep-linked from chat citations.
- `Sources`: see which Word documents are feeding the knowledge base.

## Live web search

When the indexed documents return a weak or empty match for a question (see `LOW_CONFIDENCE_THRESHOLD` in `src/app/api/chat/route.ts`), the app runs one live search through Google's **Custom Search JSON API**, restricted to a whitelist of sites you control. This only ever searches sites you've explicitly added — nothing in the code decides that, so you can tighten or widen the list at any time without a deploy.

**One-time setup (about 10 minutes):**

1. Go to [programmablesearchengine.google.com](https://programmablesearchengine.google.com/) and create a new search engine.
2. Under "Sites to search," add only trusted South African legal/government sources. A sensible starting list for this app:
   - `gov.za` (South African Government / Government Gazette)
   - `csos.org.za` (Community Schemes Ombud Service)
   - `saflii.org` (Southern African Legal Information Institute — case law and legislation)
   - `justice.gov.za` (Department of Justice)
   - `derebus.org.za` (De Rebus — the South African attorneys' journal)
   You can add or remove sites here at any time; the app will pick up the change immediately since it isn't cached.
3. Copy the **Search engine ID** (this is `GOOGLE_SEARCH_ENGINE_ID`).
4. Go to the [Custom Search JSON API page](https://developers.google.com/custom-search/v1/overview), enable it on a Google Cloud project, and create an API key (this is `GOOGLE_SEARCH_API_KEY`).
5. Add both values to `.env.local` and restart the dev server.

Without these two variables, the app works exactly as before — it just skips the web-search fallback and answers from the indexed documents alone. The free tier covers 100 searches/day; above that it's billed per 1,000 queries (see Google's Custom Search JSON API pricing page for current rates).

Web results are shown to staff in their own "From the web just now — verify before relying on these" section, kept visually and structurally separate from the indexed-document citations, and the assistant is instructed to treat them as background only, never as settled law.

## Deploying so staff can actually reach it

Running `npm run dev` only serves the app on your own machine at `localhost:3000` — nobody else can open that. To give staff (across offices) a real link:

1. Push this repo to GitHub (it's already connected to `origin`).
2. Create a free [Vercel](https://vercel.com) account (or use an existing one) and "Import Project" from that GitHub repo.
3. In the Vercel project's Environment Variables, set `GEMINI_API_KEY`, `SITE_PASSWORD`, and (if you set them up) `GOOGLE_SEARCH_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID`. `.env.local` never leaves your machine, so these have to be re-entered there.
4. Deploy. Vercel gives you a stable `https://...vercel.app` URL — that's what you share with staff, along with the `SITE_PASSWORD` value out of band (Slack/WhatsApp/etc., not in the app itself).

Because of `SITE_PASSWORD` (see above) and `outputFileTracingIncludes` in `next.config.ts` (which makes sure the `.docx` knowledge base actually gets bundled into the deployment — Vercel doesn't include plain data files by default), the app is safe to put on a public URL: nobody gets past the login screen without the access code, and the knowledge base still loads correctly once deployed, not just in local dev.

## Notes

- Responses are research support and should not be treated as legal advice.
- The access gate (`SITE_PASSWORD`) is a shared-passphrase cookie, not real per-person authentication — fine for a small internal team, but if you need to know *who* asked what, or revoke one person's access without changing it for everyone, that would need real accounts later.
- The Gemini call currently runs through a Next.js API route. You can later move this behind Vercel or another bridge without changing the UI.
