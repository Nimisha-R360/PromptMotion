import "server-only";
import { chatJson, LlmUnavailableError } from "@/lib/llm";
import { THEMES } from "@/runtime/themes";
import { LAYOUTS, STYLES, type Layout, type SlideSpec } from "@/runtime/types";
import { MOODS, type Mood, type Project, type SlideBrief } from "@/lib/types";
import { DESIGNER_SYSTEM, GROUP_LAYOUTS, LAYOUT_GROUP, designOnlySchema, outlineSchema, slideSchema, slotsFor } from "./schema";
import { compatibleLayouts, engineForIndex, normalizeSpec, pickAnimations } from "./normalize";

export type Progress = (info: { tokens: number; stage: string }) => void;

export interface OutlineResult {
  title: string;
  theme: string;
  mood: Mood;
  briefs: SlideBrief[];
  usedLlm: boolean;
  warning?: string;
}

const ENGINE_NAME = { gsap: "GSAP", anime: "anime.js", motion: "Motion", remotion: "Remotion" } as const;

// ───────────────────────── outline (prompt mode) ─────────────────────────

export async function generateOutline(project: Project, feedback: string | undefined, onProgress?: Progress): Promise<OutlineResult> {
  const prev = project.slides.map((s, i) => `${i + 1}. [${s.brief.layout}] ${s.brief.title} — ${s.brief.goal ?? ""}`).join("\n");
  const m = project.prompt.match(/\b(\d{1,2})\s*[- ]?\s*(?:slides?|scenes?|parts?)\b/i);
  const count = m ? Math.min(12, Math.max(2, Number(m[1]))) : undefined;
  // grayscale / light themes look flat — only offer them when the request asks for that look
  const themeIds = THEMES.map((t) => t.id).filter(
    (id) =>
      (id !== "mono" || /\b(mono|monochrome|black and white|black & white|minimal|grayscale)\b/i.test(project.prompt)) &&
      (id !== "paper" || /\b(light|paper|print|white background|bright)\b/i.test(project.prompt)),
  );
  const user = [
    `VIDEO REQUEST:\n${project.prompt}`,
    feedback && prev ? `\nCURRENT OUTLINE:\n${prev}\n\nUSER FEEDBACK ON THE OUTLINE: "${feedback}"\nRewrite the outline applying the feedback.` : "",
    `\nPlan the video as an outline of ${count ? `exactly ${count}` : "3-7"} slides. Slide 1 should be "hero", the last slide "closing".`,
    `Choose layouts that fit each message (stats/chart/big-number for numbers, cards/timeline for features or steps, quote for testimonials).`,
    `"goal" = what the slide must communicate, including the concrete facts/numbers from the request.`,
    `Pick a visual theme id and a mood that suit the topic. Theme ids are only visual styles: never mention them in titles or goals.`,
    `Theme ids: ${themeIds.join(", ")}.`,
  ].join("\n");
  try {
    const out = await chatJson<{ title: string; theme: string; mood: Mood; slides: { layout: Layout; title: string; goal: string }[] }>({
      system: DESIGNER_SYSTEM,
      user,
      schema: outlineSchema(count, themeIds),
      maxTokens: 900,
      temperature: 0.6,
      onProgress: (tokens) => onProgress?.({ tokens, stage: "outline" }),
    });
    const briefs = (out.slides ?? [])
      .filter((s) => s?.title)
      .slice(0, 12)
      .map((s) => ({ layout: (LAYOUTS as readonly string[]).includes(s.layout) ? s.layout : "title-bullets", title: s.title.trim(), goal: s.goal?.trim() }));
    if (briefs.length < 2) throw new Error("outline too short");
    return {
      title: out.title?.trim() || project.title,
      theme: themeIds.includes(out.theme) ? out.theme : "midnight",
      mood: MOODS.includes(out.mood) ? out.mood : "energetic",
      briefs,
      usedLlm: true,
    };
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[outline] LLM failed, using fallback", e);
    return { ...fallbackOutline(project.prompt), usedLlm: false, warning: (e as Error).message };
  }
}

function fallbackOutline(prompt: string): Omit<OutlineResult, "usedLlm"> {
  const sentences = prompt
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  const topic =
    (sentences[0] ?? prompt)
      .replace(/^(please\s+)?(make|create|build|generate|design)\s+/i, "")
      .replace(/^(a|an|the)\s+/i, "")
      .replace(/^\d+[-\s]slides?\s+/i, "")
      .replace(/^([\w-]+\s+){0,2}(video|presentation|deck|explainer)\s+(about|on|for|explaining)\s+/i, "")
      .split(/[:,;]/)[0]
      .slice(0, 60)
      .trim() || "Your story";
  const t = topic.charAt(0).toUpperCase() + topic.slice(1);
  const briefs: SlideBrief[] = [
    { layout: "hero", title: t, goal: "Introduce the topic" },
    { layout: "title-bullets", title: "Why it matters", goal: sentences.slice(1, 4).join(" ") || `Key reasons behind ${topic}` },
    { layout: "cards", title: "Key ideas", goal: `Three core ideas about ${topic}` },
    { layout: "stats", title: "By the numbers", goal: `Highlight figures related to ${topic}` },
    { layout: "closing", title: "Thank you", goal: "Call to action" },
  ];
  return { title: t, theme: "midnight", mood: "energetic", briefs };
}

// ───────────────────────── slide design ─────────────────────────

const LAYOUT_KEYWORDS: [RegExp, Layout][] = [
  [/\b(bar ?chart|chart|graph|bars)\b/i, "chart"],
  [/\bbig number|single number|one number\b/i, "big-number"],
  [/\b(stat|stats|statistics|numbers|metrics|kpi)\b/i, "stats"],
  [/\b(card|cards|grid)\b/i, "cards"],
  [/\b(timeline|steps|process|roadmap)\b/i, "timeline"],
  [/\b(quote|testimonial)\b/i, "quote"],
  [/\b(image|picture|photo|split)\b/i, "split-image"],
  [/\b(bullet|bullets|list)\b/i, "title-bullets"],
  [/\b(hero|cover|title slide)\b/i, "hero"],
  [/\b(closing|thank you|cta|call to action|ending)\b/i, "closing"],
];

export function layoutFromFeedback(feedback: string | undefined): Layout | undefined {
  if (!feedback) return undefined;
  for (const [re, l] of LAYOUT_KEYWORDS) if (re.test(feedback)) return l;
  return undefined;
}

export function themeFromFeedback(feedback: string | undefined): string | undefined {
  if (!feedback) return undefined;
  const f = feedback.toLowerCase();
  return THEMES.find((t) => f.includes(t.id) || f.includes(t.name.toLowerCase()))?.id;
}

const KEEP_RE = /\b(keep|same|retain)\b.*\b(animation|motion|effect|transition|background)/i;

export interface SlideResult {
  spec: SlideSpec;
  usedLlm: boolean;
  warning?: string;
  /** updated slide content when the feedback asked for a text change on an uploaded slide */
  brief?: SlideBrief;
}

/** Feedback that asks to change the words on the slide (e.g. `add text "Don't dare me"`, "change the title to …"). */
const CONTENT_EDIT_RE =
  /\b(add|change|replace|put|write|insert|rename|set|remove|delete|update|edit|fix|reword|rewrite|use the (?:text|words?))\b[\s\S]*\b(text|title|heading|headline|subtitle|caption|bullet|bullets|point|points|line|word|words|label|tagline|quote|sentence)\b|["“”'‘’][^"“”'‘’]{2,}["“”'‘’]/i;
const REMOVE_RE = /\b(remove|delete|drop|without)\b/i;
export const isContentEdit = (feedback: string | undefined) => !!feedback && CONTENT_EDIT_RE.test(feedback);

export async function generateSlide(project: Project, index: number, feedback: string | undefined, onProgress?: Progress): Promise<SlideResult> {
  const slide = project.slides[index];
  const brief = { ...slide.brief };
  const total = project.slides.length;
  const prevSpec = slide.spec;
  const neighbour = index > 0 ? project.slides[index - 1].spec : null;
  const prefer = engineForIndex(index + (slide.revision ?? 0));

  // Feedback may ask for a different layout explicitly.
  const wanted = layoutFromFeedback(feedback);
  let allowed: Layout[];
  if (brief.locked) {
    allowed = compatibleLayouts(brief, index, total);
    if (wanted && allowed.includes(wanted)) allowed = [wanted];
  } else {
    const layout = wanted ?? prevSpec?.layout ?? brief.layout ?? "title-bullets";
    brief.layout = layout;
    allowed = GROUP_LAYOUTS(LAYOUT_GROUP[layout]);
  }

  // Components to avoid: neighbour's title/transition, and on redesign the previous picks (unless asked to keep).
  // hard: the rejected design's own picks (the user asked for change); soft: the neighbour's title/transition.
  const hardAvoid = new Set<string>();
  if (prevSpec && feedback && !KEEP_RE.test(feedback)) {
    for (const s of slotsFor(prevSpec.layout)) hardAvoid.add(prevSpec.animations[s]);
  }
  const avoid = new Set<string>(hardAvoid);
  if (neighbour) avoid.add(neighbour.animations.title).add(neighbour.animations.transition);

  const context = [
    `VIDEO: "${project.title}" — mood: ${project.mood}, theme: ${project.theme}.`,
    project.prompt ? `ORIGINAL REQUEST:\n${project.prompt}` : `SOURCE: uploaded file ${project.sourceName ?? ""}`,
    `OUTLINE:\n${project.slides.map((s, i) => `${i + 1}. ${s.brief.title}${i === index ? "   <== THIS SLIDE" : ""}`).join("\n")}`,
  ].join("\n\n");

  const ask: string[] = [];
  const currentContent = { title: brief.title, subtitle: brief.subtitle ?? "", body: brief.body ?? "", bullets: brief.bullets ?? [] };
  const editText = !!brief.locked && isContentEdit(feedback);
  if (editText) {
    ask.push(
      `Slide ${index + 1} of ${total} comes from the user's upload. CURRENT CONTENT:`,
      JSON.stringify({ ...currentContent, hasImage: !!brief.image }),
      `The user asked to change the text: "${feedback}". Return the full content with exactly that change applied ` +
        `(put new text where it fits best: short phrases as subtitle, sentences as body, list items as bullets). Keep every other field word for word.`,
      `Then choose the best layout from: ${allowed.join(", ")} and pick animation components for each slot.`,
    );
  } else if (brief.locked) {
    ask.push(
      `Design slide ${index + 1} of ${total}. Its content is FIXED (from the uploaded deck):`,
      JSON.stringify({ title: brief.title, subtitle: brief.subtitle, body: brief.body, bullets: brief.bullets, stats: brief.stats, hasImage: !!brief.image }),
      `Choose the best layout from: ${allowed.join(", ")}; then pick animation components for each slot.`,
    );
  } else {
    ask.push(
      `Write and design slide ${index + 1} of ${total}. Layout: ${brief.layout}. Title idea: "${brief.title}". Goal: ${brief.goal ?? "-"}.`,
      `Write the slide content (use concrete, specific facts from the request), then pick animation components for each slot.`,
    );
  }
  ask.push(`Engine focus for this slide: use ${ENGINE_NAME[prefer]} for at least two slots and mix in the others.`);
  const avoidStyles = [neighbour?.style, prevSpec && feedback ? prevSpec.style : undefined].filter(Boolean);
  if (avoidStyles.length) ask.push(`Use a different "style" than: ${avoidStyles.join(", ")}.`);
  if (avoid.size) ask.push(`Do NOT use these components: ${[...avoid].join(", ")}.`);
  if (prevSpec && feedback && !editText) {
    const prevContent = brief.locked
      ? {}
      : { title: prevSpec.title, subtitle: prevSpec.subtitle, body: prevSpec.body, bullets: prevSpec.bullets, items: prevSpec.items, stats: prevSpec.stats };
    ask.push(
      `PREVIOUS DESIGN (rejected): ${JSON.stringify({ layout: prevSpec.layout, style: prevSpec.style, animations: prevSpec.animations, ...prevContent })}`,
      `USER FEEDBACK: "${feedback}". Redesign the slide so it clearly addresses this feedback.` +
        (brief.locked ? "" : " Keep the previous text unless the feedback asks to change it; apply any requested text edits exactly."),
    );
  }

  try {
    const raw = await chatJson<Partial<SlideSpec> & Record<string, unknown>>({
      system: DESIGNER_SYSTEM,
      user: `${context}\n\n${ask.join("\n")}`,
      schema: editText ? designOnlySchema(allowed, true) : brief.locked ? designOnlySchema(allowed) : slideSchema(brief.layout as Layout),
      maxTokens: editText ? 550 : brief.locked ? 350 : 750,
      temperature: editText ? 0.4 : feedback ? 0.85 : 0.7,
      onProgress: (tokens) => onProgress?.({ tokens, stage: "slide" }),
    });
    let newBrief: SlideBrief | undefined;
    if (editText) {
      newBrief = applyContentEdit(brief, raw, feedback!);
      Object.assign(brief, newBrief);
    }
    const spec = normalizeSpec(raw, brief, { index, mood: project.mood, avoid: [...avoid] });
    spec.style = varyStyle(spec.style, avoidStyles as string[], index + slide.revision);
    // the model ignores "avoid" sometimes — swap offending picks deterministically
    return { spec: enforceAvoid(spec, hardAvoid, project.mood, index), usedLlm: true, brief: newBrief };
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[slide] LLM failed, using fallback", e);
    return { spec: fallbackSlide(brief, index, total, project.mood, [...avoid], allowed, slide.revision), usedLlm: false, warning: (e as Error).message };
  }
}

/** Merge the model's edited text into an uploaded slide's content, guarding against accidental drops. */
function applyContentEdit(brief: SlideBrief, raw: Record<string, unknown>, feedback: string): SlideBrief {
  const str = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const removing = REMOVE_RE.test(feedback);
  const keep = (next: string, prev?: string) => (next || (removing ? "" : prev ?? "")) || undefined;
  const bullets = Array.isArray(raw.bullets) ? raw.bullets.map(str).filter(Boolean).slice(0, 6) : [];
  return {
    ...brief,
    title: str(raw.title) || brief.title,
    subtitle: keep(str(raw.subtitle), brief.subtitle),
    body: keep(str(raw.body), brief.body),
    bullets: bullets.length ? bullets : removing ? undefined : brief.bullets,
  };
}

/** Keep consecutive slides (and redesigns) visually distinct. */
function varyStyle(style: SlideSpec["style"], avoid: string[], seed: number): SlideSpec["style"] {
  if (style && !avoid.includes(style)) return style;
  const pool = STYLES.filter((s) => !avoid.includes(s));
  return pool[seed % pool.length];
}

function enforceAvoid(spec: SlideSpec, avoid: Set<string>, mood: Mood, index: number): SlideSpec {
  const bad = slotsFor(spec.layout).filter((s) => avoid.has(spec.animations[s]));
  if (!bad.length) return spec;
  const alt = pickAnimations({ mood, seed: index * 977 + (Date.now() % 1000), prefer: engineForIndex(index + 1), avoid: [...avoid] });
  const animations = { ...spec.animations };
  for (const s of bad) animations[s] = alt[s];
  // the model's note may describe a component we replaced — keep the message truthful
  return { ...spec, animations, note: spec.note ? `${spec.note} (Swapped ${bad.join(", ")} for a fresh pick, since you asked for a change.)` : spec.note };
}

function fallbackSlide(brief: SlideBrief, index: number, total: number, mood: Mood, avoid: string[], allowed: Layout[], revision: number): SlideSpec {
  const layout = brief.locked ? allowed[revision % allowed.length] : (brief.layout ?? allowed[0]);
  const content: Partial<SlideSpec> = brief.locked
    ? {}
    : {
        title: brief.title,
        // the outline goal is an instruction, not copy: only reuse it as list content on content slides
        bullets: LAYOUT_GROUP[layout] === "text" ? undefined : (brief.bullets ?? (brief.goal ? brief.goal.split(/[,;.]\s+/).filter(Boolean).slice(0, 4) : undefined)),
        items: brief.items,
        stats: brief.stats,
      };
  const spec = normalizeSpec(
    { layout, ...content, animations: pickAnimations({ mood, seed: index * 31 + revision * 101 + 3, prefer: engineForIndex(index + revision), avoid }) } as Partial<SlideSpec> & Record<string, unknown>,
    { ...brief, layout },
    { index, mood, avoid },
  );
  spec.style = varyStyle(undefined, [], index * 2 + revision);
  spec.note = "Designed by the rule-based designer (local model unavailable).";
  return spec;
}
