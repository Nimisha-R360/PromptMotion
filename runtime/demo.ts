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

export const CATEGORY_SLOT: Record<Category, Slot> = {
  text: "title",
  entrance: "body",
  list: "items",
  number: "number",
  chart: "chart",
  background: "background",
  decor: "decor",
  transition: "transition",
};

const DEMO_LAYOUT: Record<Category, Layout> = {
  text: "hero",
  entrance: "split-image",
  list: "title-bullets",
  number: "stats",
  chart: "chart",
  background: "hero",
  decor: "hero",
  transition: "cards",
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

/** A short video showcasing a single registry component (used for library previews). */
export function demoVideo(componentId: string, theme = "midnight"): VideoSpec | null {
  const meta = getComponent(componentId);
  if (!meta) return null;
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
