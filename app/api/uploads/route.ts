import { NextResponse } from "next/server";
import path from "node:path";
import { apiError } from "@/lib/api";
import { addMessage, createProject, getProject, replaceSlides } from "@/lib/data/projects";
import { parseUpload, SUPPORTED } from "@/lib/parsers";
import { saveAsset } from "@/lib/assets";
import type { SlideBrief } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 40 * 1024 * 1024;

/** Upload mode: slides (pptx / pdf / md / txt / images) → project whose outline = the uploaded slides. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return apiError(400, "invalid_body", "Expected multipart/form-data");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return apiError(400, "no_files", "Attach a file");
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return apiError(413, "too_large", "Upload is larger than 40 MB");
  const bad = files.find((f) => !SUPPORTED.includes(path.extname(f.name).toLowerCase()));
  if (bad) return apiError(400, "unsupported", `Unsupported file: ${bad.name}. Supported: ${SUPPORTED.join(" ")}`);

  let deck;
  try {
    deck = await parseUpload(await Promise.all(files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))));
  } catch (e) {
    console.error("[upload]", e);
    return apiError(422, "parse_failed", `Could not read the file: ${(e as Error).message}`);
  }
  if (!deck.slides.length) return apiError(422, "empty", "No slides with content were found in the upload");

  const instructions = String(form.get("instructions") ?? "").trim().slice(0, 2000);
  const sourceName = files.map((f) => f.name).join(", ").slice(0, 200);
  const id = createProject({ title: deck.title, mode: "upload", prompt: instructions, stage: "outline_review", sourceName });
  const briefs: SlideBrief[] = deck.slides.slice(0, 40).map((s) => ({ ...s.brief, locked: true, image: s.image ? saveAsset(id, s.image.data, s.image.mime) : undefined }));
  replaceSlides(id, briefs);
  addMessage(id, "user", "text", `Uploaded ${sourceName}${instructions ? `\n\n${instructions}` : ""}`);
  addMessage(id, "assistant", "outline", `I found **${briefs.length} slides** in ${sourceName}. I'll keep your content and design each slide with animated components. Approve to start with slide 1.`, {
    slides: briefs.map((b) => ({ title: b.title, goal: [b.subtitle, ...(b.bullets ?? [])].filter(Boolean).join(" · ").slice(0, 140) || (b.image ? "Image slide" : ""), layout: undefined })),
    usedLlm: false,
  });
  return NextResponse.json(getProject(id), { status: 201 });
}
