import "server-only";
import { addMessage, getProject, insertSlideAfter, patchSlideSpec, replaceSlides, saveSlideSpec, setSlideStatus, updateProject, updateSlideBrief } from "@backend/lib/data/projects";
import { generateOutline, generateSlide, themeFromFeedback } from "@agents/designer";
import { DESIGNER_SYSTEM, slotsFor } from "@agents/designer/schema";
import { isWarm, type LlmPhase } from "@agents/llm";
import { getComponent } from "@backend/runtime/registry";
import { isChartId, isCounterId, isTextRevealId } from "@backend/runtime/cards";
import { deleteAsset, saveAsset } from "@backend/lib/assets";
import { speak } from "@backend/lib/voice/tts";
import { voiceCoversText, voiceoverLanguageOk } from "@backend/lib/voice/voices";
import { writeNarration } from "@agents/narration";
import { getTheme } from "@backend/runtime/themes";
import { SLOT_CATEGORY, STYLES, type SlideSpec, type Slot } from "@backend/runtime/types";
import type { Project, SlideBrief } from "@backend/lib/types";

/**
 * Project actions shared by the REST routes (buttons) and the Director agent's tools,
 * so both paths behave identically. Every design-changing action leaves the slide in
 * "review" — the human-in-the-loop gate — and posts a review card in the chat.
 */
export interface Reporter {
  status: (phase: LlmPhase, text: string) => void;
  progress?: (tokens: number) => void;
}
export class ActionError extends Error {}

/** feedback about the slide's motion ("change the title animation", "a different effect") */
const ASKS_FOR_MOTION = /\b(animat\w*|effects?|motion|decod\w*|count(?:er|ing|s)?|scrambl\w*|reveal\w*)\b/i;

const COLD = " (first run: the model is loading its design guide, ~40s extra)";
const need = (id: string): Project => {
  const p = getProject(id);
  if (!p) throw new ActionError("Project not found");
  return p;
};

function reviewCard(projectId: string, index: number, note: string, extra: Record<string, unknown> = {}) {
  const spec = getProject(projectId)!.slides[index].spec!;
  const components = slotsFor(spec.layout).map((s) => ({ slot: s, id: spec.animations[s], name: getComponent(spec.animations[s] ?? "")?.name }));
  addMessage(projectId, "assistant", "slide_review", note, { index, layout: spec.layout, components, ...extra });
}

// ─────────────── planning ───────────────

export async function planOutline(projectId: string, feedback: string | undefined, r: Reporter) {
  const project = need(projectId);
  if (project.mode !== "prompt") throw new ActionError("Uploaded projects use their own slides as the outline.");
  if (project.stage !== "outline" && project.stage !== "outline_review") throw new ActionError("The outline is already approved; redesign individual slides instead.");
  // before an outline exists, the request itself is the input — there is nothing to revise yet
  if (project.stage === "outline" || !project.slides.length) feedback = undefined;
  r.status(feedback ? "revising" : "planning", (feedback ? "Revising the outline with your feedback…" : "Planning the video outline…") + (isWarm(DESIGNER_SYSTEM) ? "" : COLD));
  const out = await generateOutline(project, feedback, ({ tokens }) => {
    r.progress?.(tokens);
    r.status("validating", "Checking the outline…");
  });
  replaceSlides(projectId, out.briefs);
  updateProject(projectId, { title: out.title, theme: out.theme, mood: out.mood, stage: "outline_review", currentIndex: 0 });
  addMessage(
    projectId,
    "assistant",
    "outline",
    `Here's the plan for **${out.title}**: ${out.briefs.length} slides, ${getTheme(out.theme).name} theme, ${out.mood} mood. Approve it to start designing slide 1, or tell me what to change.`,
    { slides: out.briefs.map((b) => ({ layout: b.layout, title: b.title, goal: b.goal })), usedLlm: out.usedLlm, warning: out.warning },
  );
  return { slides: out.briefs.length, title: out.title, theme: out.theme, mood: out.mood };
}

export function approveOutline(projectId: string) {
  const project = need(projectId);
  if (project.stage !== "outline_review") throw new ActionError("There is no outline waiting for approval.");
  if (!project.slides.length) throw new ActionError("The outline is empty.");
  updateProject(projectId, { stage: "designing", currentIndex: 0 });
}

// ─────────────── slide design ───────────────

export async function designSlide(projectId: string, index: number, feedback: string | undefined, r: Reporter) {
  let project = need(projectId);
  if (!project.slides[index]) throw new ActionError(`Slide ${index + 1} does not exist (the video has ${project.slides.length} slides).`);
  if (project.stage !== "designing" && project.stage !== "complete") throw new ActionError("Approve the outline first.");
  if (feedback) {
    const theme = themeFromFeedback(feedback);
    if (theme && theme !== project.theme) {
      updateProject(projectId, { theme });
      project = need(projectId);
    }
  }
  const of = `slide ${index + 1} of ${project.slides.length}`;
  r.status(feedback ? "redesigning" : "designing", (feedback ? `Redesigning ${of} with your feedback…` : `Designing ${of}…`) + (isWarm(DESIGNER_SYSTEM) ? "" : COLD));
  const res = await generateSlide(project, index, feedback, ({ tokens }) => {
    r.progress?.(tokens);
    r.status("validating", `Checking and composing ${of}…`);
  });
  if (res.brief) updateSlideBrief(projectId, index, res.brief);
  // an Onda card the user added stays when the AI redesigns the slide
  const prevCard = project.slides[index].spec?.card;
  if (prevCard && !res.spec.card) res.spec.card = prevCard;
  // … and so does an Onda chart, while the slide is still a chart
  const prevChart = project.slides[index].spec?.animations.chart;
  if (isChartId(prevChart) && res.spec.layout === "chart") res.spec.animations = { ...res.spec.animations, chart: prevChart };
  // … and an Onda title effect or counter, unless the feedback asks for different motion
  const prev = project.slides[index].spec?.animations;
  if (prev && !(feedback && ASKS_FOR_MOTION.test(feedback))) {
    if (isTextRevealId(prev.title)) res.spec.animations = { ...res.spec.animations, title: prev.title };
    if (isCounterId(prev.number) && slotsFor(res.spec.layout).includes("number")) res.spec.animations = { ...res.spec.animations, number: prev.number };
  }
  // the voiceover script the user typed stays; an AI-written one is rewritten for the new design (below)
  const prevSpec = project.slides[index].spec;
  if (prevSpec?.narrationEdited && prevSpec.narration) {
    res.spec.narration = prevSpec.narration;
    res.spec.narrationEdited = true;
  }
  saveSlideSpec(projectId, index, res.spec, feedback);
  // the old recording belongs to the old design
  deleteAsset(projectId, prevSpec?.voice?.src);
  // voiceover on: write and record this slide's voiceover too (a failure leaves the slide designed, just silent)
  if (project.voiceover.on && voiceoverLanguageOk(project.options.language)) {
    try {
      await voiceSlide(projectId, index, r);
    } catch (e) {
      addMessage(projectId, "assistant", "error", `Slide ${index + 1} is designed, but its voiceover couldn't be recorded: ${(e as Error).message}`, { index });
    }
  }
  if (project.stage === "complete") updateProject(projectId, { stage: "designing" });
  updateProject(projectId, { currentIndex: index });
  reviewCard(projectId, index, res.spec.note || `Slide ${index + 1} is ready.`, { usedLlm: res.usedLlm, warning: res.warning });
  return { slide: index + 1, layout: res.spec.layout, style: res.spec.style, title: res.spec.title, usedLlm: res.usedLlm };
}

// ─────────────── voiceover ───────────────

/**
 * Slide `index`'s voiceover: write its narration (when it has none, or `rewrite`) and record it with the project's
 * voice. A recording that already matches the narration, voice and speed is kept.
 */
export async function voiceSlide(projectId: string, index: number, r: Reporter, opts: { rewrite?: boolean } = {}) {
  const project = need(projectId);
  const slide = project.slides[index];
  if (!slide?.spec) throw new ActionError(`Slide ${index + 1} has no design yet.`);
  if (!voiceoverLanguageOk(project.options.language)) throw new ActionError(`The voice speaks English only, and this video is in ${project.options.language}.`);
  const n = index + 1;
  const { voice, speed } = project.voiceover;
  let spec = slide.spec;
  if (opts.rewrite || !spec.narration?.trim()) {
    r.status("narrating", `Writing the voiceover for slide ${n}…`);
    const { text } = await writeNarration(project, index, spec);
    spec = { ...spec, narration: text, narrationEdited: undefined };
    patchSlideSpec(projectId, index, spec);
  }
  const text = spec.narration!.trim();
  const old = spec.voice;
  if (old && old.text === text && old.voice === voice && old.speed === speed && voiceCoversText(old)) return { slide: n, seconds: old.duration, upToDate: true };
  r.status("recording", `Recording the voiceover for slide ${n}…`);
  const speech = await speak(text, voice, speed);
  const src = saveAsset(projectId, speech.mp3, "audio/mpeg", `voiceover-slide-${n}.mp3`);
  // the slide may have changed while recording (e.g. its narration was edited): store on top of the latest design
  const latest = need(projectId).slides[index].spec ?? spec;
  patchSlideSpec(projectId, index, { ...latest, voice: { src, duration: speech.duration, text, voice, speed, captions: speech.captions } });
  deleteAsset(projectId, old?.src);
  return { slide: n, seconds: speech.duration, upToDate: false };
}

/** Voiceover for every designed slide (writes missing narrations, records missing or out-of-date ones). */
export async function voiceVideo(projectId: string, r: Reporter) {
  const todo = need(projectId).slides.filter((s) => s.spec).map((s) => s.index);
  if (!todo.length) throw new ActionError("Design a slide first.");
  let recorded = 0;
  for (const i of todo) if (!(await voiceSlide(projectId, i, r)).upToDate) recorded++;
  return { slides: todo.length, recorded };
}

/** Approve a slide; returns the next slide that still needs work (or null when the video is complete). */
export function approveSlide(projectId: string, index: number) {
  const project = need(projectId);
  const slide = project.slides[index];
  if (!slide) throw new ActionError(`Slide ${index + 1} does not exist.`);
  if (!slide.spec) throw new ActionError(`Slide ${index + 1} has not been designed yet.`);
  setSlideStatus(projectId, index, "approved");
  const next = need(projectId).slides.find((s) => s.status !== "approved");
  if (next) {
    updateProject(projectId, { currentIndex: next.index, stage: "designing" });
    return { next: next.index, needsDesign: !next.spec };
  }
  updateProject(projectId, { stage: "complete", currentIndex: index });
  addMessage(projectId, "assistant", "complete", `All ${project.slides.length} slides are approved 🎬 Your video is ready — play it in the preview or export the standalone HTML.`);
  return { next: null, needsDesign: false };
}

// ─────────────── direct edits (no LLM: instant, exact) ───────────────

const designed = (projectId: string, index: number) => {
  const project = need(projectId);
  const slide = project.slides[index];
  if (!slide) throw new ActionError(`Slide ${index + 1} does not exist (the video has ${project.slides.length} slides).`);
  if (!slide.spec) throw new ActionError(`Slide ${index + 1} has not been designed yet — design it first.`);
  return { project, slide, spec: slide.spec };
};

export type TextField = "title" | "subtitle" | "body" | "bullets";

/** Exact wording change requested by the user — applied verbatim to the design and the slide content. */
export function editText(projectId: string, index: number, field: TextField, text: string, mode: "replace" | "add", r: Reporter) {
  const { slide, spec } = designed(projectId, index);
  r.status("editing", `Editing the ${field} of slide ${index + 1}…`);
  const clean = text.replace(/\s+/g, " ").trim();
  const next: SlideSpec = { ...spec };
  const brief: SlideBrief = { ...slide.brief };
  if (field === "bullets") {
    const items = clean.split(/\s*[;\n•]\s*|\s+\|\s+/).map((s) => s.trim()).filter(Boolean);
    const list = mode === "add" ? [...(spec.bullets ?? []), ...items] : items;
    next.bullets = list.slice(0, 6);
    brief.bullets = next.bullets;
    // bullets only render on list-style layouts
    if (!["title-bullets", "split-image", "hero", "closing"].includes(next.layout) && !next.items?.length) next.layout = next.image ? "split-image" : "title-bullets";
  } else {
    const value = mode === "add" && spec[field] ? `${spec[field]} ${clean}` : clean;
    if (field === "title") {
      next.title = value || spec.title; // a slide always keeps a title
      brief.title = next.title;
    } else {
      next[field] = value || undefined;
      brief[field] = value || undefined;
    }
  }
  patchSlideSpec(projectId, index, next);
  updateSlideBrief(projectId, index, brief);
  setSlideStatus(projectId, index, "review");
  updateProject(projectId, { currentIndex: index });
  reviewCard(projectId, index, `Updated the ${field} of slide ${index + 1}: “${clean.slice(0, 80)}”.`);
  return { slide: index + 1, field, value: field === "bullets" ? next.bullets : next[field] };
}

/** Put a specific library component on a slide; the slot is derived from the component's category. */
export function applyComponent(projectId: string, index: number, componentId: string, r: Reporter) {
  const { spec } = designed(projectId, index);
  const meta = getComponent(componentId);
  if (!meta) throw new ActionError(`Unknown component ${componentId}.`);
  if (meta.category === "card") {
    // Onda cards are content blocks, not an animation slot
    patchSlideSpec(projectId, index, { ...spec, card: componentId });
    setSlideStatus(projectId, index, "review");
    updateProject(projectId, { currentIndex: index });
    reviewCard(projectId, index, `Added the Onda ${meta.name} to slide ${index + 1}.`);
    return { slide: index + 1, slot: "card", component: componentId };
  }
  const slot = (Object.keys(SLOT_CATEGORY) as Slot[]).find((s) => SLOT_CATEGORY[s] === meta.category)!;
  // a chart needs a chart slide: a slide with numbers becomes one
  const toChart = slot === "chart" && spec.layout !== "chart" && !!spec.stats?.length;
  r.status("applying", `Applying ${meta.name} (${meta.framework}) to slide ${index + 1}…`);
  // a remocn scene is the whole slide: it needs the showcase layout; a chart on a slide with numbers makes it a chart slide
  const layout = slot === "scene" ? "showcase" : toChart ? "chart" : spec.layout;
  patchSlideSpec(projectId, index, { ...spec, layout, animations: { ...spec.animations, [slot]: componentId } });
  setSlideStatus(projectId, index, "review");
  updateProject(projectId, { currentIndex: index });
  reviewCard(projectId, index, `Applied ${meta.name} to the ${slot} of slide ${index + 1}${toChart ? " (it is now a chart slide)" : ""}.`);
  return { slide: index + 1, slot, component: componentId };
}

/**
 * Put the user's uploaded image(s) / video clip on a slide and (re)design it around them: pictures go into a remocn
 * scene that shows them (showcase layout), a clip plays in the split-image media block; the text is written from the
 * user's request. `refs` are `asset:<id>` of the project's media.
 */
export async function placeMedia(projectId: string, index: number, refs: string[], feedback: string | undefined, r: Reporter) {
  const project = need(projectId);
  const slide = project.slides[index];
  if (!slide) throw new ActionError(`Slide ${index + 1} does not exist (the video has ${project.slides.length} slides).`);
  if (project.stage !== "designing" && project.stage !== "complete") throw new ActionError("Approve the outline first.");
  const media = refs.map((ref) => project.media.find((m) => m.ref === ref)).filter((m): m is NonNullable<typeof m> => !!m);
  if (!media.length) throw new ActionError("That media file was not found — attach it again.");
  // one clip, or a set of pictures (a clip can't share a scene with pictures)
  const pick = media[0].kind === "video" ? [media[0]] : media.filter((m) => m.kind === "image");
  updateSlideBrief(projectId, index, { ...slide.brief, image: pick[0].ref, images: pick.length > 1 ? pick.map((m) => m.ref) : undefined });
  const names = pick.map((m) => m.name).join(", ");
  return { ...(await designSlide(projectId, index, feedback?.trim() || `Present the uploaded ${pick[0].kind === "video" ? "clip" : "image"} ${names} with an animated scene.`, r)), media: names };
}

export function changeTheme(projectId: string, theme: string, r: Reporter) {
  const project = need(projectId);
  const t = getTheme(theme);
  if (t.id !== theme) throw new ActionError(`Unknown theme ${theme}.`);
  r.status("theming", `Switching the video to the ${t.name} theme…`);
  updateProject(projectId, { theme });
  const index = project.currentIndex;
  if (project.slides[index]?.spec) {
    setSlideStatus(projectId, index, "review");
    reviewCard(projectId, index, `Switched the whole video to the ${t.name} theme — here is slide ${index + 1} with it.`);
  } else addMessage(projectId, "assistant", "text", `Switched the whole video to the **${t.name}** theme.`);
  return { theme, applied: "all slides" };
}

/** Split an overloaded slide: its list content is divided across this slide and a new one right after it. */
export function splitSlide(projectId: string, index: number, r: Reporter) {
  const { slide, spec } = designed(projectId, index);
  const key = spec.items?.length && spec.items.length > 1 ? "items" : spec.stats?.length && spec.stats.length > 1 ? "stats" : spec.bullets?.length && spec.bullets.length > 1 ? "bullets" : null;
  if (!key) throw new ActionError(`Slide ${index + 1} has no list content to split.`);
  r.status("splitting", `Splitting slide ${index + 1} into two slides…`);
  const list = spec[key] as unknown[];
  const half = Math.ceil(list.length / 2);
  const first = { ...spec, [key]: list.slice(0, half) } as SlideSpec;
  const nextStyle = STYLES[(STYLES.indexOf(spec.style ?? STYLES[0]) + 1) % STYLES.length];
  const second = { ...spec, [key]: list.slice(half), title: `${spec.title} (continued)`, subtitle: undefined, body: undefined, style: nextStyle } as SlideSpec;
  const briefList = (slide.brief[key as "bullets"] as unknown[] | undefined) ?? list;
  const bHalf = Math.ceil(briefList.length / 2);
  updateSlideBrief(projectId, index, { ...slide.brief, [key]: briefList.slice(0, bHalf) });
  patchSlideSpec(projectId, index, first);
  setSlideStatus(projectId, index, "review");
  insertSlideAfter(projectId, index, { ...slide.brief, title: second.title, subtitle: undefined, body: undefined, [key]: briefList.slice(bHalf) }, second);
  updateProject(projectId, { currentIndex: index, stage: "designing" });
  reviewCard(projectId, index, `Split slide ${index + 1}: the first ${half} ${key} stay here, the rest moved to a new slide ${index + 2}.`);
  return { slide: index + 1, newSlide: index + 2, moved: list.length - half };
}
