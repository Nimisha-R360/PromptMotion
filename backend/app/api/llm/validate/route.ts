import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { resolveCloud, validateCloud } from "@agents/llm-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  provider: z.enum(["anthropic", "openai", "groq"]),
  /** empty → the stored key */
  apiKey: z.string().max(400).optional(),
  /** empty → the stored / default model */
  model: z.string().max(120).optional(),
});

/** "Test key": validates an API key + model with one tiny real request, without saving anything. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  const cloud = resolveCloud(parsed.data.provider, parsed.data);
  const check = await validateCloud(cloud);
  return NextResponse.json({ ...check, model: cloud.model });
}
