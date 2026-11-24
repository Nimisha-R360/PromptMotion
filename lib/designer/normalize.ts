import { COMPONENTS, getComponent } from "@/runtime/registry";
import { DEFAULT_ANIMATIONS } from "@/runtime/demo";
import { LAYOUTS, STYLES, SLOT_CATEGORY, type Framework, type Item, type Layout, type SlideAnimations, type SlideSpec, type Slot, type Stat } from "@/runtime/types";
import type { Mood, SlideBrief } from "@/lib/types";
import { LAYOUT_GROUP } from "./schema";

const ENGINES: Framework[] = ["gsap", "anime", "motion", "remotion"];
export const engineForIndex = (i: number) => ENGINES[i % ENGINES.length];

/** deterministic rng */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rule-based component picker (used when the LLM is offline or returns something unusable). */
export function pickAnimations(opts: { mood: Mood; seed: number; prefer?: Framework; avoid?: string[] }): SlideAnimations {
  const r = rng(opts.seed);
  const out = { ...DEFAULT_ANIMATIONS };
  (Object.keys(SLOT_CATEGORY) as Slot[]).forEach((slot, si) => {
    const pool = COMPONENTS.filter((c) => c.category === SLOT_CATEGORY[slot] && !opts.avoid?.includes(c.id));
    const moodPool = pool.filter((c) => c.mood.includes(opts.mood));
    const base = moodPool.length ? moodPool : pool;
    // alternate preferred engine on some slots so each slide mixes engines
    const preferred = si % 2 === 0 && opts.prefer ? base.filter((c) => c.framework === opts.prefer) : [];
    const choice = (preferred.length ? preferred : base)[Math.floor(r() * (preferred.length || base.length))];
    if (choice) out[slot] = choice.id;
  });
  return out;
}

const clean = (s: unknown, max = 160): string => {
  if (typeof s !== "string") return "";
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,;:\-–—]$/, "") + "…";
};
const cleanList = (a: unknown, max = 90, n = 6): string[] =>
  Array.isArray(a) ? a.map((x) => clean(x, max)).filter(Boolean).slice(0, n) : [];
/** "50,000 beta users" → value "50,000" (the words belong in the label, not the big number). */
function statValue(raw: unknown): string {
  const v = clean(raw, 40);
  const m = v.match(/[$€£₹]?\s?\d[\d,.]*\s?(?:%|[kKmMbB]n?\b|x\b|\+)?\+?(?:\s?\/\s?\w{1,5})?/);
  return m && v.length > m[0].trim().length + 1 ? m[0].trim() : clean(v, 14);
}
const cleanStats = (a: unknown, n = 6): Stat[] =>
  Array.isArray(a)
    ? a
        .map((x) => ({ value: statValue((x as Stat)?.value), label: clean((x as Stat)?.label, 60) }))
        .filter((x) => x.value)
        .slice(0, n)
    : [];
const cleanItems = (a: unknown, n = 5): Item[] =>
  Array.isArray(a)
    ? a
        .map((x) => ({ heading: clean((x as Item)?.heading, 40), text: clean((x as Item)?.text, 120) }))
        .filter((x) => x.heading || x.text)
        .slice(0, n)
    : [];

/** bullets → items: "Heading: text" or first words as heading */
export function bulletsToItems(bullets: string[]): Item[] {
  return bullets.map((b) => {
    const m = b.match(/^(.{2,40}?)\s*[:—–-]\s+(.+)$/);
    if (m) return { heading: m[1], text: m[2] };
    const words = b.split(" ");
    return words.length > 5 ? { heading: words.slice(0, 3).join(" "), text: b } : { heading: b, text: "" };
  });
}

/** Extract stats from bullets like "Revenue grew 42%" → {value:"42%", label:"Revenue grew"} */
export function bulletsToStats(bullets: string[]): Stat[] {
  const out: Stat[] = [];
  for (const b of bullets) {
    const m = b.match(/([$€£₹]?\d[\d,.]*\s?(?:%|[kKmMbB]n?|x|\+)?\+?)/);
    if (!m) continue;
    const label = clean(b.replace(m[1], "").replace(/^[\s:—–-]+|[\s:—–-]+$/g, ""), 50) || b;
    out.push({ value: m[1].trim(), label });
  }
  return out;
}

/** Layouts that can faithfully present fixed (uploaded) content. */
export function compatibleLayouts(brief: SlideBrief, index: number, total: number): Layout[] {
  const bullets = brief.bullets ?? [];
  const stats = brief.stats?.length ? brief.stats : bulletsToStats(bullets);
  const set = new Set<Layout>();
  if (brief.image) set.add("split-image");
  if (stats.length >= 2 && stats.length >= bullets.length * 0.6) set.add("stats").add("chart");
  if (stats.length === 1 && bullets.length <= 1) set.add("big-number");
  if (bullets.length >= 2 || brief.items?.length) {
    set.add("title-bullets").add("cards").add("timeline");
    if (!brief.image) set.add("split-image");
  }
  if (!bullets.length && brief.body && brief.body.length > 40) set.add("quote");
  if (bullets.length <= 3) {
    if (index === 0) set.add("hero");
    if (index === total - 1) set.add("closing");
    if (!bullets.length) set.add("hero").add("closing");
  }
  if (!set.size) set.add(bullets.length ? "title-bullets" : "hero");
  // only split-image can show a picture — never drop the user's image
  if (brief.image) return ["split-image"];
  return LAYOUTS.filter((l) => set.has(l));
}

/** Map fixed brief content into the fields a layout uses. */
export function contentForLayout(brief: SlideBrief, layout: Layout): Partial<SlideSpec> {
  const bullets = brief.bullets ?? [];
  const items = brief.items?.length ? brief.items : bulletsToItems(bullets);
  const stats = brief.stats?.length ? brief.stats : bulletsToStats(bullets);
  const base: Partial<SlideSpec> = { title: brief.title, subtitle: brief.subtitle, image: brief.image };
  switch (LAYOUT_GROUP[layout]) {
    case "text":
      return { ...base, body: brief.body, bullets: bullets.every((b) => b.length <= 32) ? bullets.slice(0, 4) : [], subtitle: brief.subtitle ?? (bullets.length && bullets.some((b) => b.length > 32) ? bullets[0] : undefined) };
    case "list":
      return { ...base, body: brief.body, bullets: bullets.length ? bullets : items.map((i) => (i.text ? `${i.heading}: ${i.text}` : i.heading)) };
    case "data":
      return { ...base, body: brief.body, stats: layout === "big-number" ? stats.slice(0, 1) : stats };
    case "items":
      return { ...base, items };
    case "quote":
      return { ...base, body: brief.body ?? bullets.join(" "), subtitle: brief.subtitle };
  }
}

/** Make any model output (or partial edit) into a valid SlideSpec. */
export function normalizeSpec(raw: Partial<SlideSpec> & Record<string, unknown>, brief: SlideBrief, opts: { index: number; mood: Mood; avoid?: string[] }): SlideSpec {
  const layout: Layout = (LAYOUTS as readonly string[]).includes(raw.layout as string) ? (raw.layout as Layout) : (brief.layout ?? "title-bullets");
  const picked = pickAnimations({ mood: opts.mood, seed: opts.index * 131 + 7, prefer: engineForIndex(opts.index), avoid: opts.avoid });
  const animations = { ...picked } as SlideAnimations;
  const rawAnim = (raw.animations ?? {}) as Partial<SlideAnimations>;
  (Object.keys(SLOT_CATEGORY) as Slot[]).forEach((slot) => {
    const id = rawAnim[slot];
    if (id && getComponent(id)?.category === SLOT_CATEGORY[slot]) animations[slot] = id;
  });

  const content: Partial<SlideSpec> = brief.locked
    ? contentForLayout(brief, layout)
    : {
        title: clean(raw.title, 90) || brief.title,
        subtitle: clean(raw.subtitle, 160) || undefined,
        body: clean(raw.body, 280) || undefined,
        bullets: cleanList(raw.bullets),
        items: cleanItems(raw.items),
        stats: cleanStats(raw.stats),
        image: brief.image,
      };

  // never render a layout whose content slots are empty
  let finalLayout = layout;
  const g = LAYOUT_GROUP[layout];
  const hasList = !!(content.bullets?.length || content.items?.length);
  if (g === "data" && !content.stats?.length) finalLayout = hasList ? "title-bullets" : "hero";
  else if ((g === "list" || g === "items") && !hasList && !(layout === "split-image" && content.image))
    finalLayout = content.stats?.length ? "stats" : "hero";
  else if (g === "quote" && !content.body) finalLayout = "hero";

  const amount = (content.bullets?.length ?? 0) + (content.items?.length ?? 0) + (content.stats?.length ?? 0);
  const rawDur = Number(raw.duration);
  const duration = Number.isFinite(rawDur) && rawDur >= 3 && rawDur <= 15 ? rawDur : 5 + Math.min(4, amount * 0.7);

  return {
    layout: finalLayout,
    title: content.title || brief.title || "Untitled",
    subtitle: content.subtitle || undefined,
    body: content.body || undefined,
    bullets: content.bullets?.length ? content.bullets : undefined,
    items: content.items?.length ? content.items : undefined,
    stats: content.stats?.length ? content.stats : undefined,
    image: content.image,
    animations,
    style: (STYLES as readonly string[]).includes(raw.style as string) ? (raw.style as SlideSpec["style"]) : undefined,
    duration: Math.round(duration * 2) / 2,
    note: clean(raw.note, 200) || undefined,
  };
}
