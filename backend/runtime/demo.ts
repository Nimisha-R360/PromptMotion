import type { Category, Layout, SlideAnimations, SlideSpec, Slot, VideoSpec } from "./types";
import { getComponent } from "./registry";

export const DEFAULT_ANIMATIONS: SlideAnimations = {
  title: "gsap.text.split-chars",
  body: "motion.enter.fade-up",
  items: "motion.list.stagger-fade",
  number: "anime.number.count-up",
  chart: "gsap.chart.bars-stagger",
  background: "remotion.bg.noise-blobs",
  decor: "anime.svg.line-draw",
  transition: "remotion.transition.slide",
};

/** Categories that fill an animation slot (Onda cards are whole content blocks, not a slot). */
export type SlotCategory = Exclude<Category, "card">;
/** Animation slot of each category. */
export const CATEGORY_SLOT: Record<SlotCategory, Slot> = {
  text: "title",
  entrance: "body",
  list: "items",
  number: "number",
  chart: "chart",
  background: "background",
  decor: "decor",
  transition: "transition",
  scene: "scene",
};

const DEMO_LAYOUT: Record<Exclude<Category, "card">, Layout> = {
  text: "hero",
  entrance: "split-image",
  list: "title-bullets",
  number: "stats",
  chart: "chart",
  background: "hero",
  decor: "hero",
  transition: "cards",
  scene: "showcase",
};

export function demoSlide(layout: Layout, animations: Partial<SlideAnimations> = {}, title?: string): SlideSpec {
  const base: SlideSpec = {
    layout,
    title: title ?? "Motion that tells a story",
    subtitle: "Composed from modular animation components",
    body: "Every element on this slide is animated by a reusable component from Remotion, anime.js, Motion or GSAP.",
    bullets: ["Frame-accurate scrubbing", "Four animation engines", "One standalone HTML file"],
    items: [
      { heading: "Prompt", text: "Describe the video you want" },
      { heading: "Design", text: "Local LLM picks layouts & motion" },
      { heading: "Review", text: "Approve or redesign each slide" },
    ],
    stats: [
      { value: "84", label: "Animation components" },
      { value: "4", label: "Engines" },
      { value: "100%", label: "Offline runtime" },
    ],
    animations: { ...DEFAULT_ANIMATIONS, ...animations },
    duration: 5,
  };
  if (layout === "chart")
    base.stats = [
      { value: "32", label: "Q1" },
      { value: "58", label: "Q2" },
      { value: "71", label: "Q3" },
      { value: "96", label: "Q4" },
    ];
  if (layout === "quote") {
    base.body = "Simplicity is the ultimate sophistication.";
    base.subtitle = "Leonardo da Vinci";
  }
  return base;
}

/** Showcase slide for an Onda card: content that fills it the way a real slide would. */
function demoCardSlide(cardId: string): SlideSpec {
  const anim = { background: "motion.bg.aurora", decor: "motion.decor.floating-shapes" };
  switch (cardId) {
    case "onda.card.bento-grid":
      return {
        ...demoSlide("cards", anim, "Everything in one place"),
        subtitle: "Onda bento grid, filled with this slide's cards",
        body: undefined,
        items: [
          { heading: "Describe it", text: "Type an idea, a lesson or a product: the AI plans the story." },
          { heading: "80 effects", text: "Remotion, anime.js, Motion and GSAP." },
          { heading: "Offline", text: "One standalone HTML file." },
          { heading: "Review", text: "Approve each slide or ask for changes." },
          { heading: "Any screen", text: "Video, web page or phone." },
        ],
        card: cardId,
      };
    case "onda.card.pricing-card":
      return {
        ...demoSlide("title-bullets", anim, "Simple pricing"),
        subtitle: "Everything you need to make your first video",
        body: undefined,
        bullets: ["Unlimited videos", "All 80 animation effects", "Export to HTML and web page", "Priority support"],
        stats: [{ value: "$29", label: "Pro /month" }],
        card: cardId,
      };
    case "onda.card.skeleton-card":
      return { ...demoSlide("title-bullets", anim, "Your video is on its way"), subtitle: "The AI is designing each slide", body: undefined, card: cardId };
    default:
      return {
        ...demoSlide("hero", anim, "Motion that tells a story"),
        subtitle: "Feature",
        body: "Every slide is built from modular animation components, now with Onda cards.",
        card: cardId,
      };
  }
}

/** A short video showcasing a single registry component (used for library previews). */
export function demoVideo(componentId: string, theme = "midnight"): VideoSpec | null {
  const meta = getComponent(componentId);
  if (!meta) return null;
  if (meta.category === "card") return { title: meta.name, theme, slides: [{ ...demoCardSlide(meta.id), duration: 5 }], autoplay: true, loop: true, badge: meta.id };
  const slot = CATEGORY_SLOT[meta.category];
  const layout = DEMO_LAYOUT[meta.category];
  const anim = { [slot]: componentId } as Partial<SlideAnimations>;
  const slides: SlideSpec[] =
    meta.category === "transition"
      ? [
          { ...demoSlide("hero", { background: "remotion.bg.gradient-shift" }, meta.name), duration: 2 },
          { ...demoSlide(layout, anim, "Next scene"), duration: 3 },
        ]
      : [{ ...demoSlide(layout, anim, meta.category === "text" ? meta.name : undefined), duration: 4.5 }];
  return { title: meta.name, theme, slides, autoplay: true, loop: true, badge: meta.id };
}
