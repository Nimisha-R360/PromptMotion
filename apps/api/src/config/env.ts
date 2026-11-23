import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  /** Origins allowed to call the API (comma-separated). */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  // Empty values count as unset. Without a key, the Anthropic SDK falls back to other credentials.
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  /** true: skip Claude and use samplePlan. For trying the pipeline without an API key. */
  MOCK_LLM: z.stringbool().default(false),
  // Not used yet: the voiceover step needs it.
  TTS_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
});

export type Env = z.infer<typeof EnvSchema>;

/** apps/api/.env first, then the repo-root .env. Earlier files win. */
export const envFilePaths = [join(process.cwd(), ".env"), join(process.cwd(), "../../.env")];

/** Used by NestJS's ConfigModule: the app refuses to start with a bad environment. */
export const validateEnv = (raw: Record<string, unknown>): Env => {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};

/** For plain scripts (seed) that run outside NestJS. Existing variables are never overwritten. */
export const loadEnv = (): Env => {
  for (const path of envFilePaths) {
    if (existsSync(path)) process.loadEnvFile(path);
  }
  return validateEnv(process.env);
};
