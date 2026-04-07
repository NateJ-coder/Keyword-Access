# Keyword Access

Chat-first South African real estate law research app powered by Gemini 2.5 Flash and `.docx` source indexing.

## What it does

- Extracts text from Word documents found in the project root and optional `knowledge-base/` folder.
- Builds a searchable index of topics, articles, and source files.
- Opens on a blank chat so users can ask fact-pattern questions in plain language.
- Uses hybrid retrieval: keyword scoring plus Gemini embeddings, then reranks likely matches.
- Retrieves relevant source chunks and sends only those chunks to Gemini for grounded answers.

## Environment

Create a `.env.local` file with:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Knowledge base

- Keep `.docx` files in the project root, or place more files in `knowledge-base/`.
- The current workspace already includes `Key access.docx`, which will be indexed automatically.
- The parser uses heading heuristics to create smaller headed chunks for retrieval.
- Semantic retrieval depends on `GEMINI_API_KEY`, because Gemini embeddings are used for meaning-based matching.

## App structure

- `Home`: blank chat with optional context and surfaced citations.
- `Topics`: filter the legal index by subject area.
- `Articles`: browse extracted sections and short previews.
- `Sources`: see which Word documents are feeding the knowledge base.

## Notes

- Responses are research support and should not be treated as legal advice.
- The Gemini call currently runs through a Next.js API route. You can later move this behind Vercel or another bridge without changing the UI.