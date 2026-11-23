import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Next.js only reads .env files in apps/web. Also read the repo-root .env (for
// NEXT_PUBLIC_API_URL). Values that are already set win.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

const nextConfig: NextConfig = {
  // Stop `next dev` from writing an AGENTS.md into the app.
  agentRules: false,
  // Workspace packages: @promptmotion/video ships TypeScript source.
  transpilePackages: ["@promptmotion/shared", "@promptmotion/video"],
};

export default nextConfig;
