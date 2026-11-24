import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getLlmSettings, LLM_PROVIDERS, publicLlmSettings, saveLlmSettings, type LlmProvider } from "@/lib/llm-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which model the agents use (local / Claude / ChatGPT). API keys are write-only: only `hasXKey` flags are returned. */
export async function GET() {
  return NextResponse.json(publicLlmSettings());
}

const PatchBody = z.object({
  provider: z.enum(LLM_PROVIDERS as [LlmProvider, ...LlmProvider[]]).optional(),
  /** "" removes the stored key */
  anthropicApiKey: z.string().max(400).optional(),
  anthropicModel: z.string().max(120).optional(),
  openaiApiKey: z.string().max(400).optional(),
  openaiModel: z.string().max(120).optional(),
});

const envKey = (p: LlmProvider) => (p === "anthropic" ? process.env.ANTHROPIC_API_KEY : p === "openai" ? process.env.OPENAI_API_KEY : undefined);

export async function PATCH(req: Request) {
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  const cur = getLlmSettings();
  const d = parsed.data;
  const provider = d.provider ?? cur.provider;
  const hasKey = (patch: string | undefined, stored: string | null) => (patch === undefined ? !!stored : !!patch.trim() || !!envKey(provider));
  if (provider === "anthropic" && !hasKey(d.anthropicApiKey, cur.anthropicApiKey)) return apiError(400, "missing_key", "Add an Anthropic API key to use Claude.");
  if (provider === "openai" && !hasKey(d.openaiApiKey, cur.openaiApiKey)) return apiError(400, "missing_key", "Add an OpenAI API key to use ChatGPT.");
  return NextResponse.json(publicLlmSettings(saveLlmSettings(d)));
}
