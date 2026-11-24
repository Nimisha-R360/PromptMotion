import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { addMessage, getProject } from "@/lib/data/projects";
import { ActionError, approveOutline } from "@/lib/actions";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProject(id)) return apiError(404, "not_found", "Project not found");
  try {
    approveOutline(id);
  } catch (e) {
    if (e instanceof ActionError) return apiError(409, "invalid_stage", e.message);
    throw e;
  }
  addMessage(id, "user", "text", "Outline approved ✓");
  return NextResponse.json(getProject(id));
}
