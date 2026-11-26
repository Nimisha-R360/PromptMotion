import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { deleteProject, getProject, setVoiceover, updateProject } from "@/lib/data/projects";
import { VOICE_IDS } from "@/lib/voice/voices";
import { warmUp as warmUpVoice } from "@/lib/voice/tts";
import { deleteProjectAssets } from "@/lib/assets";
import { THEME_IDS } from "@/runtime/themes";
import { MOODS } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const project = getProject((await params).id);
  if (!project) return apiError(404, "not_found", "Project not found");
  return NextResponse.json(project);
}

const PatchBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  theme: z.enum(THEME_IDS as [string, ...string[]]).optional(),
  mood: z.enum(MOODS as [string, ...string[]]).optional(),
  /** voiceover settings (merged): on/off, voice, speed, captions */
  voiceover: z
    .object({ on: z.boolean(), voice: z.enum(VOICE_IDS), speed: z.number().min(0.8).max(1.2), captions: z.boolean() })
    .partial()
    .optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getProject(id)) return apiError(404, "not_found", "Project not found");
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  const { voiceover, ...rest } = parsed.data;
  updateProject(id, rest as Parameters<typeof updateProject>[1]);
  if (voiceover) {
    const next = setVoiceover(id, voiceover);
    // load the voice model now, so the first recording doesn't wait for it
    if (next.on) warmUpVoice();
  }
  return NextResponse.json(getProject(id));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!deleteProject(id)) return apiError(404, "not_found", "Project not found");
  deleteProjectAssets(id);
  return new Response(null, { status: 204 });
}
