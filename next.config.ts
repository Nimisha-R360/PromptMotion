import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native / heavy server-only modules are loaded from node_modules at runtime
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist", "jszip", "@strands-agents/sdk"],
  // the runtime bundle is read from disk by lib/compose.ts
  outputFileTracingIncludes: { "/api/**/*": ["./runtime-dist/**/*", "./db/migrations/**/*"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
