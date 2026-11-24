import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getProject, patchSlideSpec, updateSlideBrief } from "@/lib/data/projects";
import { getComponent } from "@/runtime/registry";
import { LAYOUTS, STYLES, SLOT_CATEGORY, type SlideSpec, type Slot } from "@/runtime/types";
import { normalizeSpec } from "@/lib/designer/normalize";
import { CARD_IDS } from "@/runtime/cards";

export const runtime = "nodejs";

const line = (max: number) => z.string().max(max).transform((s) => s.replace(/\s+/g, " ").trim());

/** Text typed by the user in the editor: replaces the slide's words exactly (empty = remove, except the title). */
const Text = z.object({
  title: line(160).refine((s) => s.length > 0, "The title can't be empty").optional(),
  subtitle: line(240).optional(),
  body: line(800).optional(),
  bullets: z.array(line(200)).max(6).optional(),
  items: z.array(z.object({ heading: line(80), text: line(240) })).max(5).optional(),
  stats: z.array(z.object({ value: line(24), label: line(80) })).max(6).optional(),
});

const Body = z.object({
  text: Text.optional(),
  animations: z.record(z.string(), z.string()).optional(),
  layout: z.enum(LAYOUTS).optional(),
  duration: z.number().min(3).max(20).optional(),
  style: z.enum(STYLES).optional(),
  /** an Onda card id to draw on the slide, or null to remove it */
  card: z.enum(CARD_IDS).nullable().optional(),
});

/** Manual edit: change the text, apply a library component to a slot, change layout, style or duration. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: idxStr } = await params;
  const index = Number(idxStr);
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  const slide = project.slides[index];
  if (!slide?.spec) return apiError(404, "not_found", "Slide has no design yet");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");

  const animations = { ...slide.spec.animations };
  for (const [slot, compId] of Object.entries(parsed.data.animations ?? {})) {
    const cat = SLOT_CATEGORY[slot as Slot];
    if (!cat) return apiError(400, "invalid_slot", `Unknown slot "${slot}"`);
    if (getComponent(compId)?.category !== cat) return apiError(400, "invalid_component", `${compId} cannot be used for ${slot}`);
    animations[slot as Slot] = compId;
  }
  let spec: SlideSpec = { ...slide.spec, animations, duration: parsed.data.duration ?? slide.spec.duration, style: parsed.data.style ?? slide.spec.style };
  // undefined drops the key when saved (card removed)
  if (parsed.data.card !== undefined) spec = { ...spec, card: parsed.data.card ?? undefined };
  const text = parsed.data.text;
  if (text) {
    // apply to the design and to the slide content, so a later redesign keeps the user's words
    const brief = { ...slide.brief };
    const set = <K extends "title" | "subtitle" | "body" | "bullets" | "items" | "stats">(key: K, value: SlideSpec[K]) => {
      spec = { ...spec, [key]: value };
      Object.assign(brief, { [key]: value });
    };
    if (text.title !== undefined) set("title", text.title);
    if (text.subtitle !== undefined) set("subtitle", text.subtitle || undefined);
    if (text.body !== undefined) set("body", text.body || undefined);
    if (text.bullets !== undefined) {
      const list = text.bullets.filter(Boolean);
      set("bullets", list.length ? list : undefined);
    }
    if (text.items !== undefined) {
      const list = text.items.filter((it) => it.heading || it.text);
      set("items", list.length ? list : undefined);
    }
    if (text.stats !== undefined) {
      const list = text.stats.filter((st) => st.value || st.label);
      set("stats", list.length ? list : undefined);
    }
    updateSlideBrief(id, index, brief);
  }
  // a remocn scene ("Use it" in the library) is the whole slide: it needs the showcase layout
  const layout = parsed.data.animations?.scene && !parsed.data.layout ? "showcase" : parsed.data.layout;
  if (layout && layout !== spec.layout) {
    // an uploaded clip keeps a slide on split-image — unless the user explicitly picked a scene for it
    const video = !parsed.data.animations?.scene && project.media.find((m) => m.ref === slide.brief.image)?.kind === "video";
    spec = normalizeSpec({ ...spec, layout } as never, { ...slide.brief, ...(slide.brief.locked ? {} : { layout }) }, { index, mood: project.mood, video });
    spec.animations = animations;
    spec.style = parsed.data.style ?? slide.spec.style;
  }
  patchSlideSpec(id, index, spec);
  return NextResponse.json(getProject(id));
}
