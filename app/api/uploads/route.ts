import { NextResponse } from "next/server";
import path from "node:path";
import { apiError } from "@/lib/api";
import { addMessage, createProject, getProject, replaceSlides } from "@/lib/data/projects";
import { parseUpload, SUPPORTED } from "@/lib/parsers";
import { mediaMime, saveAsset } from "@/lib/assets";
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

  // Images / video clips WITH a request: a new prompt-mode video whose slides present the files, written from the
  // request (the client then runs the Director agent, which plans the outline around the media).
  const instructions = String(form.get("instructions") ?? "").trim().slice(0, 2000);
  const allMedia = files.every((f) => mediaMime(f.name));
  const hasVideo = files.some((f) => mediaMime(f.name)?.startsWith("video/"));
  if (allMedia && (instructions || hasVideo)) {
    if (instructions.length < 3) return apiError(400, "need_prompt", "Type what the video should be about, then attach the clips");
    const title = instructions.split(/[.\n!?]/)[0].slice(0, 70) || "Untitled video";
    const id = createProject({ title, mode: "prompt", prompt: instructions, stage: "outline" });
    const media = await Promise.all(files.slice(0, 20).map(async (f) => saveAsset(id, Buffer.from(await f.arrayBuffer()), mediaMime(f.name)!, f.name)));
    addMessage(id, "user", "text", instructions, { media });
    return NextResponse.json(getProject(id), { status: 201 });
  }
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
