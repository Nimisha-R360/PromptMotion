import "server-only";
import { chatJson, LlmUnavailableError } from "@agents/llm";
import { THEMES } from "@backend/runtime/themes";
import { LAYOUTS, SLOT_CATEGORY, STYLES, type Framework, type Layout, type SlideSpec, type Slot } from "@backend/runtime/types";
import { remocnCandidates } from "@backend/runtime/remocn/registry";
import { MOODS, type MediaAsset, type Mood, type Project, type SlideBrief } from "@backend/lib/types";
import { DESIGNER_SYSTEM, GROUP_LAYOUTS, LAYOUT_GROUP, designOnlySchema, outlineSchema, slideSchema, slotsFor, type ExtraIds } from "./schema";
import { compatibleLayouts, engineForIndex, normalizeSpec, pickAnimations } from "./normalize";
import { MAX_SLIDES, MIN_SLIDES, startOptionsBrief, type StartOptions } from "@backend/lib/start-options";

export type Progress = (info: { tokens: number; stage: string }) => void;

export interface OutlineResult {
  title: string;
  theme: string;
  mood: Mood;
  briefs: SlideBrief[];
  usedLlm: boolean;
  warning?: string;
}

const ENGINE_NAME: Record<Framework, string> = { gsap: "GSAP", anime: "anime.js", motion: "Motion", remotion: "Remotion", remocn: "remocn", onda: "Onda", magicui: "Magic UI", lottie: "Lottie" };

// ───────────────────────── outline (prompt mode) ─────────────────────────

export async function generateOutline(project: Project, feedback: string | undefined, onProgress?: Progress): Promise<OutlineResult> {
  const prev = project.slides.map((s, i) => `${i + 1}. [${s.brief.layout}] ${s.brief.title} — ${s.brief.goal ?? ""}`).join("\n");
  const opts = project.options ?? {};
  // slide count: asked for in the feedback ("make it 3 slides") > picked on the start screen > written in the prompt
  const asked = (text: string | undefined) => text?.match(/\b(\d{1,2})\s*[- ]?\s*(?:slides?|scenes?|parts?)\b/i)?.[1];
  const wanted = asked(feedback) ?? opts.slides ?? asked(project.prompt);
  const count = wanted != null ? Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Number(wanted))) : undefined;
  // grayscale / light themes look flat — only offer them when the request asks for that look
  const themeIds = THEMES.map((t) => t.id).filter(
    (id) =>
      (id !== "mono" || /\b(mono|monochrome|black and white|black & white|minimal|grayscale)\b/i.test(project.prompt)) &&
      (id !== "paper" || /\b(light|paper|print|white background|bright)\b/i.test(project.prompt)),
  );
  const user = [
    `VIDEO REQUEST:\n${project.prompt}`,
    ...startOptionsBrief(opts, "outline", count),
    feedback && prev ? `\nCURRENT OUTLINE:\n${prev}\n\nUSER FEEDBACK ON THE OUTLINE: "${feedback}"\nRewrite the outline applying the feedback.` : "",
    `\nPlan the video as an outline of ${count ? `exactly ${count}` : "3-7"} slides. Slide 1 should be "hero", the last slide "closing".`,
    `Choose layouts that fit each message (stats/chart/big-number for numbers, cards/timeline for features or steps, quote for testimonials).`,
    `"goal" = what the slide must communicate, including the concrete facts/numbers from the request.`,
    `Pick a visual theme id${opts.mood ? "" : " and a mood"} that suit the topic. Theme ids are only visual styles: never mention them in titles or goals.`,
    `Theme ids: ${themeIds.join(", ")}.`,
  ];
  const media = project.media ?? [];
  if (media.length)
    user.push(
      `\nUPLOADED MEDIA (the user's own pictures / video clips — each one must be presented on a slide):`,
      ...media.map((m, i) => `${i + 1}. ${m.name} (${m.kind})`),
      `Set "media" on a slide to the number of the file it presents (0 = none); write that slide's title and goal about what the file shows, following the request.`,
    );
  try {
    const out = await chatJson<{ title: string; theme: string; mood: Mood; slides: { layout: Layout; title: string; goal: string; media?: number }[] }>({
      system: DESIGNER_SYSTEM,
      user: user.join("\n"),
      // a mood picked on the start screen is the only mood offered
      schema: outlineSchema(count, themeIds, media.length, opts.mood ? [opts.mood] : MOODS),
      maxTokens: 900,
      temperature: 0.6,
      onProgress: (tokens) => onProgress?.({ tokens, stage: "outline" }),
    });
    const slides = (out.slides ?? []).filter((s) => s?.title).slice(0, 12);
    const briefs: SlideBrief[] = slides.map((s) => ({ layout: (LAYOUTS as readonly string[]).includes(s.layout) ? s.layout : "title-bullets", title: s.title.trim(), goal: s.goal?.trim() }));
    if (briefs.length < 2) throw new Error("outline too short");
    placeMediaInOutline(briefs, media, slides.map((s) => Number(s.media) || 0));
    return {
      title: out.title?.trim() || project.title,
      theme: themeIds.includes(out.theme) ? out.theme : "midnight",
      mood: opts.mood ?? (MOODS.includes(out.mood) ? out.mood : "energetic"),
      briefs,
      usedLlm: true,
    };
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[outline] LLM failed, using fallback", e);
    const fb = fallbackOutline(project.prompt, { ...opts, slides: count });
    placeMediaInOutline(fb.briefs, project.media ?? [], []);
    return { ...fb, usedLlm: false, warning: (e as Error).message };
  }
}

/**
 * Put every uploaded image / clip on a slide: the model's picks first (`picked[i]` = 1-based media number for slide i),
 * then the rest on content slides that have none (hero/closing last); leftovers join a slide's picture set.
 * A slide with a picture becomes a "showcase" (remocn scene that shows it) unless it is already split-image;
 * a video clip plays in the split-image media block.
 */
export function placeMediaInOutline(briefs: SlideBrief[], media: MediaAsset[], picked: number[]) {
  if (!media.length || !briefs.length) return;
  const used = new Set<number>();
  picked.forEach((n, i) => {
    if (briefs[i] && n >= 1 && n <= media.length && !used.has(n - 1) && !briefs[i].image) {
      briefs[i].image = media[n - 1].ref;
      used.add(n - 1);
    }
  });
  const order = briefs.map((_, i) => i).sort((a, b) => Number(a === 0 || a === briefs.length - 1) - Number(b === 0 || b === briefs.length - 1) || a - b);
  let k = 0;
  media.forEach((m, mi) => {
    if (used.has(mi)) return;
    const free = order.find((i) => !briefs[i].image);
    if (free !== undefined) briefs[free].image = m.ref;
    else {
      const b = briefs[order[k++ % order.length]];
      b.images = [...(b.images ?? [b.image!]), m.ref];
    }
  });
  const kind = new Map(media.map((m) => [m.ref, m.kind]));
  for (const b of briefs) if (b.image) b.layout = mediaLayout(b.layout, kind.get(b.image) === "video");
}

/**
 * Layout for a slide that presents the user's media, from the layout planned for its content:
 *  - title-only slides (hero, closing, quote, showcase) → "showcase": a remocn scene that shows the picture
 *  - slides with facts / lists (stats, chart, cards, timeline, bullets) → "split-image": the facts stay on the slide
 *    as points next to the picture (a showcase slide only has room for a title and one line)
 *  - a video clip always plays in the split-image media block
 */
export function mediaLayout(planned: Layout | undefined, video: boolean): Layout {
  if (video) return "split-image";
  if (!planned || planned === "showcase" || LAYOUT_GROUP[planned] === "text" || LAYOUT_GROUP[planned] === "quote") return "showcase";
  return "split-image";
}

function fallbackOutline(prompt: string, opts: StartOptions = {}): Omit<OutlineResult, "usedLlm"> {
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
  const middle: SlideBrief[] = [
    { layout: "title-bullets", title: "Why it matters", goal: sentences.slice(1, 4).join(" ") || `Key reasons behind ${topic}` },
    { layout: "cards", title: "Key ideas", goal: `Three core ideas about ${topic}` },
    { layout: "stats", title: "By the numbers", goal: `Highlight figures related to ${topic}` },
  ];
  const body = Array.from({ length: Math.max(0, (opts.slides ?? 5) - 2) }, (_, i): SlideBrief =>
    middle[i] ?? { layout: "title-bullets", title: `More about ${topic}`.slice(0, 60), goal: `Another key point about ${topic}` },
  );
  const briefs: SlideBrief[] = [{ layout: "hero", title: t, goal: "Introduce the topic" }, ...body, { layout: "closing", title: "Thank you", goal: "Call to action" }];
  return { title: t, theme: "midnight", mood: opts.mood ?? "energetic", briefs };
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
  [/\b(showcase|mockup|mock-up|app ui|product demo|ui scene|remocn scene)\b/i, "showcase"],
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
  let wanted = layoutFromFeedback(feedback);
  // with the user's media on the slide, "image/photo" in the feedback names that media, not the split-image layout
  if (brief.image && wanted === "split-image" && !/\bsplit\b/i.test(feedback ?? "")) wanted = undefined;
  // the user's uploaded picture / clip on this slide (shown by a remocn scene, or a video in the split-image media block)
  const mediaInfo = brief.image ? project.media?.find((m) => m.ref === brief.image) : undefined;
  const video = mediaInfo?.kind === "video";
  const pictureCount = Math.max(1, brief.images?.length ?? 1);
  let allowed: Layout[];
  if (brief.locked) {
    allowed = compatibleLayouts(brief, index, total);
    if (video) allowed = allowed.filter((l) => l !== "showcase");
    if (wanted && allowed.includes(wanted)) allowed = [wanted];
  } else {
    let layout = wanted ?? prevSpec?.layout ?? brief.layout ?? "title-bullets";
    // a slide with the user's media must use a layout that presents it (and keeps its facts — see mediaLayout)
    if (brief.image && (video ? layout !== "split-image" : layout !== "split-image" && layout !== "showcase")) layout = mediaLayout(layout, video);
    brief.layout = layout;
    allowed = GROUP_LAYOUTS(LAYOUT_GROUP[layout]);
  }

  // Components to avoid: neighbour's title/transition, and on redesign the previous picks (unless asked to keep).
  // hard: the rejected design's own picks (the user asked for change); soft: the neighbour's title/transition.
  const hardAvoid = new Set<string>();
  if (prevSpec && feedback && !KEEP_RE.test(feedback)) {
    for (const s of slotsFor(prevSpec.layout)) if (prevSpec.animations[s]) hardAvoid.add(prevSpec.animations[s]!);
  }
  const avoid = new Set<string>(hardAvoid);
  if (neighbour) avoid.add(neighbour.animations.title).add(neighbour.animations.transition);

  const context = [
    `VIDEO: "${project.title}" — mood: ${project.mood}, theme: ${project.theme}.`,
    ...startOptionsBrief(project.options ?? {}, "slide"),
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

  // remocn: a short list of relevant components per slot (the full registry is far too large for the prompt)
  const used = new Set(allowed.flatMap(slotsFor));
  const query = [project.prompt, brief.title, brief.goal, brief.subtitle, feedback].filter(Boolean).join(" ");
  const extra: ExtraIds = {};
  const lines: string[] = [];
  for (const [slot, limit] of [["title", 4], ["background", 4], ["decor", 2], ["scene", 6]] as [Slot, number][]) {
    if (!used.has(slot)) continue;
    const picks = remocnCandidates({
      category: SLOT_CATEGORY[slot],
      query,
      mood: project.mood,
      limit,
      seed: index * 7919 + (slide.revision ?? 0) * 31 + 1,
      avoid: [...avoid],
      // the scene must be able to show the user's uploaded picture
      // the scene must show exactly the user's picture(s): one image → a single-image scene, never a grid of copies
      media: slot === "scene" && brief.image && !video ? pictureCount : undefined,
    });
    extra[slot] = picks.map((c) => c.id);
    lines.push(...picks.map((c) => `- ${c.id} (animations.${slot}): ${c.description} [${c.mood.join(",")}]`));
  }
  if (lines.length) {
    ask.push(`REMOCN COMPONENTS you may also use (React/Remotion, from remocn.dev):\n${lines.join("\n")}`);
    if (/\bremocn\b/i.test(`${feedback ?? ""} ${project.prompt ?? ""}`)) ask.push(`The user asked for remocn: use REMOCN COMPONENTS for every slot that has one.`);
  }
  if (brief.image && mediaInfo)
    ask.push(
      video
        ? `This slide presents the user's uploaded video clip "${mediaInfo.name}" in its media block: write the text around what the clip shows.`
        : `This slide presents ${pictureCount > 1 ? `the user's ${pictureCount} uploaded images` : `exactly ONE uploaded image ("${mediaInfo.name}")`}` +
            (allowed.includes("showcase") || brief.layout === "showcase"
              ? `: on a showcase slide pick a scene from REMOCN COMPONENTS (each one displays ${pictureCount > 1 ? "these images" : "this one image"}).`
              : ` in its media block, next to the slide's points.`),
    );
  // an image slide's facts come from the user's request — a 3B model otherwise drifts into generic copy
  if (brief.image && !brief.locked && !editText)
    ask.push(
      brief.layout === "showcase"
        ? `Content: the subtitle is ONE short sentence stating this slide's key fact from the ORIGINAL REQUEST (keep its exact numbers).`
        : `Content: use the exact facts and numbers from the ORIGINAL REQUEST that belong to this slide; do not invent other statistics.`,
    );
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
      schema: editText ? designOnlySchema(allowed, true, extra) : brief.locked ? designOnlySchema(allowed, false, extra) : slideSchema(brief.layout as Layout, extra),
      maxTokens: editText ? 550 : brief.locked ? 350 : 750,
      temperature: editText ? 0.4 : feedback ? 0.85 : 0.7,
      onProgress: (tokens) => onProgress?.({ tokens, stage: "slide" }),
    });
    let newBrief: SlideBrief | undefined;
    if (editText) {
      newBrief = applyContentEdit(brief, raw, feedback!);
      Object.assign(brief, newBrief);
    }
    const spec = normalizeSpec(raw, brief, { index, mood: project.mood, avoid: [...avoid], video });
    spec.style = varyStyle(spec.style, avoidStyles as string[], index + slide.revision);
    // the model ignores "avoid" sometimes — swap offending picks deterministically
    return { spec: enforceAvoid(spec, hardAvoid, project.mood, index), usedLlm: true, brief: newBrief };
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[slide] LLM failed, using fallback", e);
    return { spec: fallbackSlide(brief, index, total, project.mood, [...avoid], allowed, slide.revision, video), usedLlm: false, warning: (e as Error).message };
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
  const bad = slotsFor(spec.layout).filter((s) => avoid.has(spec.animations[s] ?? ""));
  if (!bad.length) return spec;
  const alt = pickAnimations({ mood, seed: index * 977 + (Date.now() % 1000), prefer: engineForIndex(index + 1), avoid: [...avoid] });
  const animations = { ...spec.animations };
  for (const s of bad)
    animations[s] =
      s === "scene"
        ? (remocnCandidates({ category: "scene", query: spec.title, mood, seed: index * 977 + 3, avoid: [...avoid], limit: 1 })[0]?.id ?? animations.scene)
        : alt[s]!;
  // the model's note may describe a component we replaced — keep the message truthful
  return { ...spec, animations, note: spec.note ? `${spec.note} (Swapped ${bad.join(", ")} for a fresh pick, since you asked for a change.)` : spec.note };
}

function fallbackSlide(brief: SlideBrief, index: number, total: number, mood: Mood, avoid: string[], allowed: Layout[], revision: number, video = false): SlideSpec {
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
    { index, mood, avoid, video },
  );
  spec.style = varyStyle(undefined, [], index * 2 + revision);
  spec.note = "Designed by the rule-based designer (model unavailable).";
  return spec;
}
