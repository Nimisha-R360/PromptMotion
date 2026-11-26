import { COMPONENTS, componentsByCategory } from "@backend/runtime/registry";
import { LAYOUTS, LAYOUT_INFO, SLOT_CATEGORY, STYLES, STYLE_INFO, type Layout, type Slot } from "@backend/runtime/types";
import { THEMES } from "@backend/runtime/themes";
import { MOODS } from "@backend/lib/types";

export { LAYOUT_GROUP, GROUP_LAYOUTS, slotsFor, type Group } from "@backend/runtime/layouts";
import { LAYOUT_GROUP, GROUP_LAYOUTS, slotsFor } from "@backend/runtime/layouts";

// Onda components (React add-on) are added by the user from the Library, not picked by the designer
const idsFor = (slot: Slot) => componentsByCategory(SLOT_CATEGORY[slot]).filter((c) => c.framework !== "onda").map((c) => c.id);

/** Extra (remocn) component ids offered for this slide, per slot — see remocnCandidates(). */
export type ExtraIds = Partial<Record<Slot, string[]>>;

function animationsSchema(slots: Slot[], extra: ExtraIds = {}) {
  const enums = slots.map((s) => [s, [...idsFor(s), ...(extra[s] ?? [])]] as const).filter(([, ids]) => ids.length);
  return {
    type: "object",
    properties: Object.fromEntries(enums.map(([s, ids]) => [s, { type: "string", enum: ids }])),
    required: enums.map(([s]) => s),
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
    case "showcase":
      return { subtitle: str };
  }
}

/** Prompt mode: the model writes content + picks components for one slide. */
export function slideSchema(layout: Layout, extra: ExtraIds = {}) {
  const content = contentProps(layout);
  const slots = slotsFor(layout);
  return {
    type: "object",
    properties: {
      layout: { type: "string", enum: GROUP_LAYOUTS(LAYOUT_GROUP[layout]) },
      title: str,
      ...content,
      style: { type: "string", enum: [...STYLES] },
      animations: animationsSchema(slots, extra),
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
export function designOnlySchema(layouts: Layout[], editableText = false, extra: ExtraIds = {}) {
  const slots = Array.from(new Set(layouts.flatMap(slotsFor)));
  const text = editableText ? { title: str, subtitle: str, body: str, bullets: { type: "array", items: str, maxItems: 6 } } : {};
  return {
    type: "object",
    properties: {
      ...text,
      layout: { type: "string", enum: layouts },
      style: { type: "string", enum: [...STYLES] },
      animations: animationsSchema(slots, extra),
      duration: { type: "integer" },
      note: str,
    },
    required: [...Object.keys(text), "layout", "style", "animations", "duration", "note"],
  };
}

/** `mediaCount`: uploaded pictures/clips the slides can present · `moods`: the moods allowed (one when picked at start) */
export function outlineSchema(count?: number, themes: string[] = THEMES.map((t) => t.id), mediaCount = 0, moods: readonly string[] = MOODS) {
  return {
    type: "object",
    properties: {
      title: str,
      theme: { type: "string", enum: themes },
      mood: { type: "string", enum: [...moods] },
      slides: {
        type: "array",
        minItems: count ?? 3,
        maxItems: count ?? 8,
        items: {
          type: "object",
          properties: {
            layout: { type: "string", enum: [...LAYOUTS] },
            title: str,
            goal: str,
            // number of the uploaded image/clip this slide presents (0 = none)
            ...(mediaCount ? { media: { type: "integer", enum: Array.from({ length: mediaCount + 1 }, (_, i) => i) } } : {}),
          },
          required: mediaCount ? ["layout", "title", "goal", "media"] : ["layout", "title", "goal"],
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
  scene: "animations.scene — the full-frame remocn scene of a showcase slide (choose from REMOCN COMPONENTS in the request)",
};

/** Static system prompt (kept identical across calls so llama.cpp reuses its KV cache). */
export const DESIGNER_SYSTEM = `You are Prompt Motion, a senior motion designer. You turn ideas into short animated videos made of slides.
Each slide is built ONLY from modular animation components of four engines: Remotion, anime.js, Motion (Framer) and GSAP, plus remocn (a registry of React/Remotion components offered per slide).
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
      COMPONENTS.filter((c) => c.category === SLOT_CATEGORY[slot] && c.framework !== "onda")
        .map((c) => `  - ${c.id}: ${c.description} [${c.mood.join(",")}]`)
        .join("\n"),
  )
  .join("\n")}

DESIGN RULES
- Match components to the mood. Mix engines on a slide, it makes the motion richer.
- Keep backgrounds subtle for text-heavy slides; bolder backgrounds suit hero/closing slides.
- Do not repeat the previous slide's title effect, transition or style — every slide should look visibly different.
- REMOCN COMPONENTS (when the request lists them) are richer React/Remotion effects: use one when it fits the slide well, and always when the user asks for remocn or for exactly that effect.`;
