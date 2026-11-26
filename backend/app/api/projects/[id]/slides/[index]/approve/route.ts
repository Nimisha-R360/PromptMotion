import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { addMessage, getProject } from "@/lib/data/projects";
import { ActionError, approveSlide } from "@agents/actions";

export const runtime = "nodejs";

/** Approve a slide; moves on to the next one (or completes the video). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: idxStr } = await params;
  const index = Number(idxStr);
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  if (!project.slides[index]) return apiError(404, "not_found", "Slide not found");
  if (!project.slides[index].spec) return apiError(409, "invalid_stage", "Slide has not been designed yet");
  addMessage(id, "user", "text", `Slide ${index + 1} approved ✓`, { index });
  try {
    approveSlide(id, index);
  } catch (e) {
    if (e instanceof ActionError) return apiError(e.message.includes("does not exist") ? 404 : 409, "invalid_stage", e.message);
    throw e;
  }
  return NextResponse.json(getProject(id));
}
