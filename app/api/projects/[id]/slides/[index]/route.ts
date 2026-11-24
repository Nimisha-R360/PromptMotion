import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getProject, patchSlideSpec } from "@/lib/data/projects";
import { getComponent } from "@/runtime/registry";
import { LAYOUTS, STYLES, SLOT_CATEGORY, type SlideSpec, type Slot } from "@/runtime/types";
import { normalizeSpec } from "@/lib/designer/normalize";

export const runtime = "nodejs";

const Body = z.object({
  animations: z.record(z.string(), z.string()).optional(),
  layout: z.enum(LAYOUTS).optional(),
  duration: z.number().min(3).max(20).optional(),
  style: z.enum(STYLES).optional(),
});

/** Manual edit: apply a library component to a slot, change layout, style or duration. */
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
  if (parsed.data.layout && parsed.data.layout !== spec.layout) {
    spec = normalizeSpec({ ...spec, layout: parsed.data.layout } as never, { ...slide.brief, ...(slide.brief.locked ? {} : { layout: parsed.data.layout }) }, { index, mood: project.mood });
    spec.animations = animations;
    spec.style = parsed.data.style ?? slide.spec.style;
  }
  patchSlideSpec(id, index, spec);
  return NextResponse.json(getProject(id));
}
