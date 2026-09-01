import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Without this, a Vercel (or any traced/serverless) deployment can silently
  // drop the .docx knowledge base — Next only bundles files it can trace
  // through imports, and a runtime fs.readdir/readFile over plain data files
  // isn't traced automatically. This keeps every page and the chat API able
  // to read the indexed documents in production, not just in local dev.
  outputFileTracingIncludes: {
    "/*": ["./*.docx", "./knowledge-base/**/*"]
  }
};

export default nextConfig;
