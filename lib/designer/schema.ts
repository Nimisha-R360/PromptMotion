import { COMPONENTS, componentsByCategory } from "@/runtime/registry";
import { LAYOUTS, LAYOUT_INFO, SLOT_CATEGORY, STYLES, STYLE_INFO, type Layout, type Slot } from "@/runtime/types";
import { THEMES } from "@/runtime/themes";
import { MOODS } from "@/lib/types";

export { LAYOUT_GROUP, GROUP_LAYOUTS, slotsFor, type Group } from "@/runtime/layouts";
import { LAYOUT_GROUP, GROUP_LAYOUTS, slotsFor } from "@/runtime/layouts";

const idsFor = (slot: Slot) => componentsByCategory(SLOT_CATEGORY[slot]).map((c) => c.id);

function animationsSchema(slots: Slot[]) {
  return {
    type: "object",
    properties: Object.fromEntries(slots.map((s) => [s, { type: "string", enum: idsFor(s) }])),
    required: slots,
  };
}

const str = { type: "string" };

function contentProps(layout: Layout): Record<string, unknown> {
  switch (LAYOUT_GROUP[layout]) {
    case "text":
      return { subtitle: str, bullets: { type: "array", items: str, maxItems: 3 } };
    case "list":
      return { subtitle: str, bullets: { type: "array", items: str, minItems: 3, maxItems: 5 } };
    case "data":
      return {
        subtitle: str,
        stats: {
          type: "array",
          items: { type: "object", properties: { value: str, label: str }, required: ["value", "label"] },
          minItems: layout === "big-number" ? 1 : 3,
          maxItems: layout === "big-number" ? 1 : layout === "chart" ? 6 : 4,
        },
      };
    case "items":
      return {
        subtitle: str,
        items: {
          type: "array",
          items: { type: "object", properties: { heading: str, text: str }, required: ["heading", "text"] },
          minItems: 3,
          maxItems: 4,
        },
      };
    case "quote":
      return { body: str, subtitle: str };
  }
}

/** Prompt mode: the model writes content + picks components for one slide. */
export function slideSchema(layout: Layout) {
  const content = contentProps(layout);
  const slots = slotsFor(layout);
  return {
    type: "object",
    properties: {
      layout: { type: "string", enum: GROUP_LAYOUTS(LAYOUT_GROUP[layout]) },
      title: str,
      ...content,
      style: { type: "string", enum: [...STYLES] },
      animations: animationsSchema(slots),
      duration: { type: "integer" },
      note: str,
    },
    required: ["layout", "title", ...Object.keys(content), "style", "animations", "duration", "note"],
  };
}

/**
 * Upload mode: content is fixed, the model only designs (layout + components).
 * With `editableText`, the model also returns the slide text with the user's requested edit applied.
 */
export function designOnlySchema(layouts: Layout[], editableText = false) {
  const slots = Array.from(new Set(layouts.flatMap(slotsFor)));
  const text = editableText ? { title: str, subtitle: str, body: str, bullets: { type: "array", items: str, maxItems: 6 } } : {};
  return {
    type: "object",
    properties: {
      ...text,
      layout: { type: "string", enum: layouts },
      style: { type: "string", enum: [...STYLES] },
      animations: animationsSchema(slots),
      duration: { type: "integer" },
      note: str,
    },
    required: [...Object.keys(text), "layout", "style", "animations", "duration", "note"],
  };
}

export function outlineSchema(count?: number, themes: string[] = THEMES.map((t) => t.id)) {
  return {
    type: "object",
    properties: {
      title: str,
      theme: { type: "string", enum: themes },
      mood: { type: "string", enum: MOODS },
      slides: {
        type: "array",
        minItems: count ?? 3,
        maxItems: count ?? 8,
        items: {
          type: "object",
          properties: { layout: { type: "string", enum: [...LAYOUTS] }, title: str, goal: str },
          required: ["layout", "title", "goal"],
        },
      },
    },
    required: ["title", "theme", "mood", "slides"],
  };
}

const SLOT_LABEL: Record<Slot, string> = {
  title: "animations.title — headline text effects",
  body: "animations.body — entrance for subtitle/body/image/quote blocks",
  items: "animations.items — stagger for bullets/cards/steps/stat cards",
  number: "animations.number — counters for statistic values",
  chart: "animations.chart — bar chart growth",
  background: "animations.background — full-frame animated backdrop",
  decor: "animations.decor — SVG ornaments around the edges",
  transition: "animations.transition — how this slide enters from the previous one",
};

/** Static system prompt (kept identical across calls so llama.cpp reuses its KV cache). */
export const DESIGNER_SYSTEM = `You are Prompt Motion, a senior motion designer. You turn ideas into short animated videos made of slides.
Each slide is built ONLY from modular animation components of four engines: Remotion, anime.js, Motion (Framer) and GSAP.
Always answer with JSON that matches the provided schema. No markdown.

WRITING RULES
- Titles: max 8 words, punchy. Subtitles: one short sentence.
- Bullets: max 10 words each, parallel phrasing, no trailing periods.
- Stats: "value" is a short number with unit/prefix (e.g. "42%", "$3.2M", "120+", "4.8"); "label" max 6 words.
- Card/step headings max 4 words; text max 14 words.
- "note": ONE short sentence (max 15 words) telling the user what you changed or chose.
- "duration": seconds, 5-9 (more content = longer).

LAYOUTS
${LAYOUTS.map((l) => `- ${l}: ${LAYOUT_INFO[l]}`).join("\n")}

VISUAL STYLES (field "style" — the static look of cards, background and type)
${STYLES.map((st) => `- ${st}: ${STYLE_INFO[st]}`).join("\n")}

COMPONENT CATALOG (id: what it does [moods])
${(Object.keys(SLOT_LABEL) as Slot[])
  .map(
    (slot) =>
      `${SLOT_LABEL[slot]}\n` +
      COMPONENTS.filter((c) => c.category === SLOT_CATEGORY[slot])
        .map((c) => `  - ${c.id}: ${c.description} [${c.mood.join(",")}]`)
        .join("\n"),
  )
  .join("\n")}

DESIGN RULES
- Match components to the mood. Mix engines on a slide, it makes the motion richer.
- Keep backgrounds subtle for text-heavy slides; bolder backgrounds suit hero/closing slides.
- Do not repeat the previous slide's title effect, transition or style — every slide should look visibly different.`;
