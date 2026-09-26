const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(relativePath, mocks, globals = {}) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    process: { cwd: () => process.cwd(), env: {} },
    console,
    ...globals
  }, { filename });
  return loadedModule.exports;
}

function loadIndex(globals = {}) {
  return loadModule("src/lib/document-index.ts", {
    "node:fs/promises": {
      readdir: async (directory) => directory === process.cwd()
        ? [{ name: "Key access.docx", isFile: () => true }]
        : []
    },
    mammoth: { extractRawText: async () => ({ value: "The service must establish a national head office.\n\nLEVY PAYMENTS\n\nOwners must pay contributions to the body corporate.\n\nTRUSTEE MEETINGS\n\nTrustees must keep minutes of meetings under management rules." }) }
  }, globals);
}

test("unmatched queries do not receive arbitrary citations", async () => {
  const result = await loadIndex().getFeaturedCitations("astronaut spaceship");
  assert.equal(result.sections.length, 0);
  assert.equal(result.topScore, 0);
});

test("a legal question still retrieves the relevant passage", async () => {
  const result = await loadIndex().getFeaturedCitations("Who must pay contributions?");
  assert.equal(result.sections[0].title, "LEVY PAYMENTS");
});

test("filenames, inferred topics, and partial words alone do not establish relevance", async () => {
  for (const query of ["Key access", "compliance", "min"]) {
    const result = await loadIndex().getFeaturedCitations(query);
    assert.equal(result.sections.length, 0, query);
  }
});

test("weak semantic similarity alone does not produce citations", async () => {
  const index = loadIndex({
    process: { cwd: () => process.cwd(), env: { GEMINI_API_KEY: "test-only-key" } },
    fetch: async (_url, options) => {
      const { requests } = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          embeddings: requests.map((entry) => ({ values: entry.taskType === "RETRIEVAL_QUERY" ? [1, 0] : [0.1, 0.99] }))
        })
      };
    }
  });
  const result = await index.getFeaturedCitations("astronaut spaceship");
  assert.equal(result.sections.length, 0);
});

test("strong semantic similarity can retrieve passages without shared keywords", async () => {
  const index = loadIndex({
    process: { cwd: () => process.cwd(), env: { GEMINI_API_KEY: "test-only-key" } },
    fetch: async (_url, options) => {
      const { requests } = JSON.parse(options.body);
      return { ok: true, json: async () => ({ embeddings: requests.map(() => ({ values: [1, 0] })) }) };
    }
  });
  const result = await index.getFeaturedCitations("financial obligations");
  assert.ok(result.sections.length > 0);
});

test("failed document embeddings are retried and reported without provider details", async () => {
  let documentAttempts = 0;
  const warnings = [];
  const index = loadIndex({
    process: { cwd: () => process.cwd(), env: { GEMINI_API_KEY: "test-only-key" } },
    console: { warn: (message) => warnings.push(message) },
    fetch: async (_url, options) => {
      const { requests } = JSON.parse(options.body);
      if (requests[0].taskType === "RETRIEVAL_DOCUMENT" && ++documentAttempts === 1) {
        return { ok: false, json: async () => ({ error: { message: "private provider details" } }) };
      }
      return { ok: true, json: async () => ({ embeddings: requests.map(() => ({ values: [1, 0] })) }) };
    }
  });
  await index.getFeaturedCitations("contributions");
  await index.getFeaturedCitations("contributions");
  assert.equal(documentAttempts, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /keyword search/);
  assert.doesNotMatch(warnings[0], /private provider details|test-only-key/);
});

function loadChat(documents = [{ name: "Key access" }]) {
  let retrievalCalls = 0;
  const route = loadModule("src/app/api/chat/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/document-index": {
      getKnowledgeBase: async () => ({ documents, sections: documents.length ? [{}, {}] : [] }),
      getFeaturedCitations: async () => { retrievalCalls += 1; return { sections: [], topScore: 0 }; },
      toCitations: () => []
    },
    "@/lib/web-search": { searchWeb: async () => [] }
  }, { process: { env: { GEMINI_API_KEY: "test-only-key" } } });
  return { route, retrievalCalls: () => retrievalCalls };
}

function request(content, mode = "ask") {
  return { json: async () => ({ messages: [{ role: "user", content }], mode }) };
}

test("the screenshot question gets an app overview and actual inventory without legal citations", async () => {
  const chat = loadChat();
  const response = await chat.route.POST(request("What is the KeyWord Access and what does it cover?"));
  assert.equal(response.status, 200);
  assert.match(response.body.answer, /Fuzio's South African property-law research assistant/);
  assert.match(response.body.answer, /Key access \(2 indexed sections\)/);
  assert.equal(response.body.citations.length, 0);
  assert.equal(chat.retrievalCalls(), 0);
});

test("app overview does not claim documents are loaded when the inventory is empty", async () => {
  const response = await loadChat([]).route.POST(request("What can you do?"));
  assert.match(response.body.answer, /No source documents are currently loaded/);
});

test("legal questions mentioning the app and draft requests still use legal retrieval", async () => {
  const chat = loadChat();
  await chat.route.POST(request("What does Keyword Access say about unpaid levies?"));
  await chat.route.POST(request("What is Keyword Access?", "draft"));
  assert.equal(chat.retrievalCalls(), 2);
});