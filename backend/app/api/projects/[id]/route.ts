import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { deleteProject, getProject, updateProject } from "@/lib/data/projects";
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
});

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getProject(id)) return apiError(404, "not_found", "Project not found");
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  updateProject(id, parsed.data as Parameters<typeof updateProject>[1]);
  return NextResponse.json(getProject(id));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!deleteProject(id)) return apiError(404, "not_found", "Project not found");
  deleteProjectAssets(id);
  return new Response(null, { status: 204 });
}
