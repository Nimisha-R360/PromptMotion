import { LAYOUTS, type Layout, type Slot } from "./types";

/** Layouts sharing the same content shape — the designer may switch within a group freely. */
export type Group = "text" | "list" | "data" | "items" | "quote" | "showcase";
export const LAYOUT_GROUP: Record<Layout, Group> = {
  hero: "text",
  closing: "text",
  "title-bullets": "list",
  "split-image": "list",
  stats: "data",
  "big-number": "data",
  chart: "data",
  cards: "items",
  timeline: "items",
  quote: "quote",
  showcase: "showcase",
};
export const GROUP_LAYOUTS = (g: Group) => LAYOUTS.filter((l) => LAYOUT_GROUP[l] === g);

/** Animation slots that matter for each layout (others keep sensible defaults). */
export function slotsFor(layout: Layout): Slot[] {
  // a remocn scene fills the slide; only the title, backdrop and transition are animated around it
  if (layout === "showcase") return ["title", "scene", "background", "transition"];
  const g = LAYOUT_GROUP[layout];
  const slots: Slot[] = ["title", "body"];
  if (layout === "chart") slots.push("chart");
  if (g === "list" || g === "items" || g === "text" || layout === "stats") slots.push("items");
  if (layout === "stats" || layout === "big-number") slots.push("number");
  slots.push("background", "decor", "transition");
  return slots;
}
