import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Same env files as the API: apps/api/.env first, then the repo-root .env.
for (const path of [".env", "../../.env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
