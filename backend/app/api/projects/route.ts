import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { addMessage, createProject, getProject, listProjects } from "@/lib/data/projects";
import { StartOptionsSchema, hasStartOptions } from "@/lib/start-options";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ data: listProjects() });
}

const CreateBody = z.object({
  prompt: z.string().trim().min(3, "Describe the video you want").max(6000),
  /** start-screen options (template, audience, slide count, mood, language) */
  options: StartOptionsSchema.optional(),
});

/** Prompt mode: create a project from a text prompt (outline is generated next via /outline). */
export async function POST(req: Request) {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  const { prompt } = parsed.data;
  const options = parsed.data.options ?? {};
  const title = prompt.split(/[.\n!?]/)[0].slice(0, 70) || "Untitled video";
  const id = createProject({ title, mode: "prompt", prompt, stage: "outline", options, ...(options.mood ? { mood: options.mood } : {}) });
  addMessage(id, "user", "text", prompt, hasStartOptions(options) ? { options } : undefined);
  return NextResponse.json(getProject(id), { status: 201 });
}
