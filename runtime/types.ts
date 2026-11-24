// Shared types between the Next.js server (LLM, composer) and the in-page player runtime.

export type Framework = "remotion" | "anime" | "motion" | "gsap" | "remocn" | "onda";

export type Category =
  | "text" // headline / title effects (split chars/words)
  | "entrance" // block entrance (paragraph, image, quote)
  | "list" // staggered collections (bullets, cards, steps)
  | "number" // animated counters for stats
  | "chart" // data bars
  | "background" // full-bleed animated backdrop
  | "decor" // SVG shapes / ornaments
  | "transition" // scene-to-scene transition
  | "scene" // full-frame remocn scene (product UI, mockup, chart, template…) on a "showcase" slide
  | "card"; // Onda card components (whole content blocks, not an animation slot)

/** Animation slots on a slide; each maps to one registry category. */
export type Slot = "title" | "body" | "items" | "number" | "chart" | "background" | "decor" | "transition" | "scene";

export const SLOT_CATEGORY: Record<Slot, Category> = {
  title: "text",
  body: "entrance",
  items: "list",
  number: "number",
  chart: "chart",
  background: "background",
  decor: "decor",
  transition: "transition",
  scene: "scene",
};

export const LAYOUTS = [
  "hero",
  "title-bullets",
  "split-image",
  "stats",
  "big-number",
  "chart",
  "cards",
  "timeline",
  "quote",
  "closing",
  "showcase",
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const LAYOUT_INFO: Record<Layout, string> = {
  hero: "Opening title slide: big title + subtitle",
  "title-bullets": "Title with 3-5 bullet points",
  "split-image": "Title + bullets on one side, image on the other",
  stats: "Title + 2-4 key statistics (value + label)",
  "big-number": "One huge headline number with a label and short body",
  chart: "Title + bar chart from 3-6 numeric data points",
  cards: "Title + 3-4 feature cards (heading + text)",
  timeline: "Title + 3-5 sequential steps (heading + text)",
  quote: "Large quotation (body) with author (subtitle)",
  closing: "Final call-to-action / thank-you slide",
  showcase: "Full-frame animated remocn scene (app UI, device mockup, terminal, chat, chart, logo or product reveal) with a short title",
};

/** Per-slide visual treatment (cards, background tint, typography) — varies the look between slides. */
export const STYLES = ["glass", "solid", "outline", "gradient", "editorial", "split"] as const;
export type SlideStyle = (typeof STYLES)[number];
export const STYLE_INFO: Record<SlideStyle, string> = {
  glass: "frosted translucent cards on a dark backdrop (subtle, modern)",
  solid: "accent-tinted background with solid cards and accent edges (bold, confident)",
  outline: "transparent cards with thick accent outlines, uppercase title (techy, crisp)",
  gradient: "gradient title text and gradient-filled cards (vibrant, playful)",
  editorial: "left-aligned magazine look, thin rules, oversized numbers (elegant, calm)",
  split: "half-frame color block behind the content (dramatic, energetic)",
};

export interface Stat {
  value: string;
  label: string;
}
export interface Item {
  heading: string;
  text: string;
}

export interface SlideAnimations {
  title: string;
  body: string;
  items: string;
  number: string;
  chart: string;
  background: string;
  decor: string;
  transition: string;
  /** remocn scene component (showcase layout only) */
  scene?: string;
}

export interface SlideSpec {
  layout: Layout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  items?: Item[];
  stats?: Stat[];
  /** image src: data URI / URL, or `asset:<id>` resolved server-side before render (may also be a video clip) */
  image?: string;
  imageAlt?: string;
  /** every uploaded picture placed on this slide (`image` is the first); fills remocn scenes that show several */
  images?: string[];
  animations: SlideAnimations;
  /** visual treatment; when omitted the player rotates styles by slide index */
  style?: SlideStyle;
  /** an Onda card drawn on this slide (runtime/cards.ts), filled with the slide's words */
  card?: string;
  /** seconds */
  duration: number;
  note?: string;
}

export interface VideoSpec {
  title: string;
  theme: string;
  slides: SlideSpec[];
  /** player options */
  autoplay?: boolean;
  loop?: boolean;
  /** "video" (default): timed player with transitions · "web": scrolling animated web page, one section per slide */
  format?: "video" | "web";
  /** show a single slide looping (review mode) */
  focus?: number;
  /** demo mode label shown in corner (library previews) */
  badge?: string;
  /** studio preview only: clicking a text tells the parent window which text to edit (never set in exports) */
  editable?: boolean;
  /** studio preview only: project slide index of each entry in `slides` */
  refs?: number[];
}
