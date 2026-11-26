import path from "node:path";
import type { NextConfig } from "next";

// The repo root holds node_modules and ../agents, which the API routes import.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // native / heavy server-only modules are loaded from node_modules at runtime
  // (kokoro-js reads its voice files next to itself; onnxruntime-node is a native addon)
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist", "jszip", "@strands-agents/sdk", "kokoro-js", "phonemizer", "onnxruntime-node", "@breezystack/lamejs"],
  // the runtime bundle is read from disk by lib/compose.ts
  outputFileTracingIncludes: { "/api/**/*": ["./runtime-dist/**/*", "./db/migrations/**/*"] },
  outputFileTracingRoot: repoRoot,
  // API only: the UI lives in ../client (Vite), so no CSS pipeline is needed here.
  turbopack: { root: repoRoot },
};

export default nextConfig;
