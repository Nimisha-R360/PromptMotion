import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getProject } from "@/lib/data/projects";
import { mediaMime, saveAsset } from "@/lib/assets";

export const runtime = "nodejs";

const MAX_BYTES = 40 * 1024 * 1024;

/** Attach images / video clips to a project; the Director agent places them on slides (see lib/actions.ts placeMedia). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProject(id)) return apiError(404, "not_found", "Project not found");
  const form = await req.formData().catch(() => null);
  if (!form) return apiError(400, "invalid_body", "Expected multipart/form-data");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return apiError(400, "no_files", "Attach an image or video clip");
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return apiError(413, "too_large", "Attachments are larger than 40 MB");
  const bad = files.find((f) => !mediaMime(f.name));
  if (bad) return apiError(400, "unsupported", `Unsupported file: ${bad.name}. Attach images (.png .jpg .webp .gif .svg) or video clips (.mp4 .webm .mov)`);
  const refs = await Promise.all(files.map(async (f) => saveAsset(id, Buffer.from(await f.arrayBuffer()), mediaMime(f.name)!, f.name)));
  return NextResponse.json({ refs, project: getProject(id) }, { status: 201 });
}
