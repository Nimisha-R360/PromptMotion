import type { Category, Framework } from "./types";
import { REMOCN_COMPONENTS } from "./remocn/registry";
import { LOTTIE_ANIMATIONS, LOTTIE_SLUGS, type LottieAnimationMeta } from "./lottie-cards";

/**
 * Component registry: the single source of truth for every modular animation component.
 *  - The studio's left panel lists these.
 *  - The LLM's JSON schema uses the ids as enums (so a small model can't invent ids).
 *  - The runtime (runtime/engines/*) implements each id with the real framework.
 */

export interface ComponentMeta {
  id: string;
  framework: Framework;
  category: Category;
  name: string;
  description: string;
  /** framework primitives the component is built from */
  uses: string[];
  /** mood tags help the LLM / fallback designer pick */
  mood: ("calm" | "energetic" | "playful" | "elegant" | "techy" | "bold")[];
  /** remocn: shows the user's uploaded image(s) — "one" a single picture, "many" a set (grid, reel…) */
  media?: "one" | "many";
}

export interface FrameworkInfo {
  id: Framework;
  name: string;
  version: string;
  color: string;
  description: string;
}

export const FRAMEWORKS: FrameworkInfo[] = [
  { id: "remotion", name: "Remotion", version: "4.0", color: "#4f8cff", description: "Frame-driven React video primitives: interpolate(), spring(), Easing, interpolateColors(), @remotion/shapes, @remotion/paths, @remotion/noise. Every style is a pure function of the current frame." },
  { id: "anime", name: "anime.js", version: "4.5", color: "#ff4b4b", description: "Lightweight timeline engine: animate(), stagger(), createTimeline(), splitText(), svg.createDrawable(), svg.morphTo(), createMotionPath()." },
  { id: "motion", name: "Motion (Framer)", version: "14", color: "#f5d90a", description: "Framer Motion's vanilla engine: animate(), stagger(), spring physics, hardware-accelerated WAAPI keyframes and value generators." },
  { id: "gsap", name: "GSAP", version: "3.15", color: "#0ae448", description: "GreenSock timelines plus plugins: SplitText, ScrambleText, TextPlugin, DrawSVG, MorphSVG, MotionPath, CustomEase." },
  { id: "remocn", name: "remocn", version: "registry", color: "#ec4899", description: "remocn.dev registry of React/Remotion components (text effects, shader backgrounds, animated icons and full-frame UI scenes), rendered through the Remotion <Player>." },
  {
    id: "onda",
    name: "Onda",
    version: "0.9.2",
    color: "#d96b82",
    description:
      "Premium motion-graphics components for Remotion (MIT, by Rodrigo Botelho), installed as source with `npx ondajs add` into runtime/onda/. Real React components drawn frame by frame with Remotion's <Thumbnail>; colours and fonts follow the slide theme.",
  },
  {
    id: "magicui",
    name: "Magic UI",
    version: "registry",
    color: "#8b5cf6",
    description:
      "Magic UI (magicui.design, MIT): animated React + Tailwind components installed as source into components/magicui/, drawn as slide cards by the Magic UI add-on. CSS animations follow the video clock; motion and timer effects play from when the card appears. Colours and fonts follow the slide theme.",
  },
  {
    id: "lottie",
    name: "Lottie",
    version: "5.13",
    color: "#00ddb3",
    description:
      "Free LottieFiles animations (Lottie Simple License, credited in runtime/lottie/credits.json) stored as JSON in runtime/lottie/animations/, plus useAnimations line icons (react-useanimations, MIT) drawn in the slide's accent colour, played by lottie-web's SVG renderer. Frame-exact: every frame follows the video clock, so scrubbing and export match. Also usable on the site as <LottieAnimation name=\"…\" />.",
  },
];

export interface Primitive {
  framework: Framework;
  name: string;
  kind: "function" | "plugin" | "component" | "util";
  description: string;
}

/** Inventory of the framework APIs bundled into the runtime. */
export const PRIMITIVES: Primitive[] = [
  // Remotion
  { framework: "remotion", name: "interpolate()", kind: "function", description: "Map a frame range to an output range with clamping & easing." },
  { framework: "remotion", name: "spring()", kind: "function", description: "Physics spring evaluated at a frame (mass, damping, stiffness)." },
  { framework: "remotion", name: "interpolateColors()", kind: "function", description: "Blend between colors over frames." },
  { framework: "remotion", name: "Easing", kind: "util", description: "bezier, in/out/inOut, cubic, quad, exp, elastic, bounce, back…" },
  { framework: "remotion", name: "random()", kind: "function", description: "Deterministic seeded randomness (stable across renders)." },
  { framework: "remotion", name: "<Sequence>/<Series>", kind: "component", description: "Time-shifted sub-timelines — modelled by the player's scene clock." },
  { framework: "remotion", name: "<TransitionSeries>", kind: "component", description: "Overlapping scene transitions (fade, slide, wipe, flip, clockWipe, iris)." },
  { framework: "remotion", name: "makeStar / makeCircle / makePolygon / makeTriangle / makeHeart / makeRect / makePie / makeEllipse", kind: "function", description: "@remotion/shapes SVG path generators." },
  { framework: "remotion", name: "evolvePath()", kind: "function", description: "@remotion/paths: animate stroke drawing of an SVG path." },
  { framework: "remotion", name: "interpolatePath()", kind: "function", description: "@remotion/paths: morph between two SVG paths." },
  { framework: "remotion", name: "getLength / getPointAtLength", kind: "function", description: "@remotion/paths geometry helpers." },
  { framework: "remotion", name: "noise2D / noise3D", kind: "function", description: "@remotion/noise simplex noise for organic motion." },
  // anime.js
  { framework: "anime", name: "animate()", kind: "function", description: "Animate CSS, transforms, attributes, JS objects." },
  { framework: "anime", name: "stagger()", kind: "function", description: "Distribute delays/values (from center, grid, reversed…)." },
  { framework: "anime", name: "createTimeline()", kind: "function", description: "Sequence animations with labels and offsets." },
  { framework: "anime", name: "splitText()", kind: "function", description: "Split text into lines/words/chars." },
  { framework: "anime", name: "scrambleText()", kind: "function", description: "Scramble-reveal text tween value." },
  { framework: "anime", name: "svg.createDrawable()", kind: "function", description: "Line-drawing animation for SVG strokes." },
  { framework: "anime", name: "svg.morphTo()", kind: "function", description: "Morph one SVG shape into another." },
  { framework: "anime", name: "svg.createMotionPath()", kind: "function", description: "Move elements along an SVG path." },
  { framework: "anime", name: "createSpring() / eases", kind: "util", description: "Spring physics & 30+ easing functions (outElastic, inOutBack…)." },
  { framework: "anime", name: "utils.random / utils.mapRange", kind: "util", description: "Helpers for procedural values." },
  // Motion
  { framework: "motion", name: "animate()", kind: "function", description: "Animate elements, sequences or raw values (WAAPI accelerated)." },
  { framework: "motion", name: "stagger()", kind: "function", description: "Stagger delays across elements." },
  { framework: "motion", name: "spring()", kind: "function", description: "Spring generator usable as easing or sampled directly." },
  { framework: "motion", name: "animate([...sequence])", kind: "function", description: "Timeline sequences with `at` offsets." },
  { framework: "motion", name: "mix() / interpolate()", kind: "util", description: "Value mixers for numbers, colors and complex strings." },
  { framework: "motion", name: "easeIn / easeOut / backOut / circOut / anticipate / cubicBezier", kind: "util", description: "Easing functions." },
  { framework: "motion", name: "inView / scroll / hover / press", kind: "function", description: "Gesture & viewport triggers (used for interactive pages)." },
  // GSAP
  { framework: "gsap", name: "gsap.timeline()", kind: "function", description: "Master sequencing with labels, nesting and seek()." },
  { framework: "gsap", name: "gsap.fromTo() / to() / from()", kind: "function", description: "Core tweens for any property." },
  { framework: "gsap", name: "SplitText", kind: "plugin", description: "Split text into chars/words/lines with masks." },
  { framework: "gsap", name: "ScrambleTextPlugin", kind: "plugin", description: "Decoder-style text scrambling." },
  { framework: "gsap", name: "TextPlugin", kind: "plugin", description: "Typewriter text replacement." },
  { framework: "gsap", name: "DrawSVGPlugin", kind: "plugin", description: "Progressively reveal SVG strokes." },
  { framework: "gsap", name: "MorphSVGPlugin", kind: "plugin", description: "Morph any SVG shape into another." },
  { framework: "gsap", name: "MotionPathPlugin", kind: "plugin", description: "Animate along a path with auto-rotate." },
  { framework: "gsap", name: "CustomEase", kind: "plugin", description: "Bespoke easing curves." },
  { framework: "gsap", name: "Eases (back, elastic, expo, power, bounce)", kind: "util", description: "Built-in easing library." },
  // Onda (runtime/onda/lib)
  { framework: "onda", name: "<Surface>", kind: "component", description: "The glass card material every Onda card sits on: blur, hairline border, sheen and shadow." },
  { framework: "onda", name: "<Glow>", kind: "component", description: "Soft radial accent glow behind a card (spotlight, recommended plan)." },
  { framework: "onda", name: "useEntrance() / useStaggeredEntrance()", kind: "function", description: "The house 'rise' entrance on Onda's overdamped spring, optionally staggered across siblings." },
  { framework: "onda", name: "SPRING_SMOOTH / STAGGER / DURATION", kind: "util", description: "Onda's motion language: one calm spring, 4-frame stagger, a shared duration scale." },
  { framework: "onda", name: "<PlacementBox> / resolveSize()", kind: "component", description: "Canvas-aware placement regions and type sizes." },
  { framework: "onda", name: "<Thumbnail> (@remotion/player)", kind: "component", description: "Renders an Onda composition at the slide's current frame inside the player." },
];

const C = (
  id: string,
  category: Category,
  name: string,
  description: string,
  uses: string[],
  mood: ComponentMeta["mood"],
): ComponentMeta => ({ id, framework: id.split(".")[0] as Framework, category, name, description, uses, mood });

export const COMPONENTS: ComponentMeta[] = [
  // ───────────── Remotion ─────────────
  C("remotion.text.spring-words", "text", "Spring Words", "Each word pops in with a physics spring scale.", ["spring()", "interpolate()"], ["playful", "energetic"]),
  C("remotion.text.typewriter", "text", "Typewriter", "Characters revealed frame by frame with a blinking caret.", ["interpolate()"], ["techy", "calm"]),
  C("remotion.text.mask-rise", "text", "Mask Rise", "Lines rise from behind a mask with a bezier ease.", ["interpolate()", "Easing.bezier"], ["elegant", "bold"]),
  C("remotion.text.color-sweep", "text", "Color Sweep", "Letters fade in while a color wave sweeps across.", ["interpolateColors()", "interpolate()"], ["bold", "playful"]),
  C("remotion.enter.spring-pop", "entrance", "Spring Pop", "Scale + fade in driven by spring().", ["spring()"], ["playful", "energetic"]),
  C("remotion.enter.fade-rise", "entrance", "Fade Rise", "Opacity and Y offset with Easing.out(cubic).", ["interpolate()", "Easing.out"], ["calm", "elegant"]),
  C("remotion.enter.blur-in", "entrance", "Blur In", "Starts blurred and oversized, settles sharp.", ["interpolate()", "Easing.inOut"], ["elegant", "calm"]),
  C("remotion.list.spring-cascade", "list", "Spring Cascade", "Items spring in from the left, offset by frames like <Sequence>.", ["spring()", "<Sequence>"], ["energetic", "playful"]),
  C("remotion.list.series-reveal", "list", "Series Reveal", "Items appear one after another like <Series>, with a highlight bar.", ["interpolate()", "<Series>"], ["calm", "techy"]),
  C("remotion.number.spring-count", "number", "Spring Counter", "Numbers count up following a spring curve.", ["spring()", "interpolate()"], ["energetic", "bold"]),
  C("remotion.chart.spring-bars", "chart", "Spring Bars", "Bars grow with staggered springs and value labels.", ["spring()", "interpolate()"], ["playful", "energetic"]),
  C("remotion.bg.noise-blobs", "background", "Noise Blobs", "Soft color blobs drifting on simplex noise.", ["noise2D()", "interpolate()"], ["calm", "elegant"]),
  C("remotion.bg.gradient-shift", "background", "Gradient Shift", "Background gradient whose colors morph over time.", ["interpolateColors()"], ["calm", "bold"]),
  C("remotion.bg.grid-pan", "background", "Grid Pan", "Perspective tech grid scrolling toward the viewer.", ["interpolate()"], ["techy", "energetic"]),
  C("remotion.shape.star-spin", "decor", "Star Spin", "@remotion/shapes stars spinning and pulsing.", ["makeStar()", "spring()"], ["playful", "energetic"]),
  C("remotion.shape.polygon-orbit", "decor", "Polygon Orbit", "Outlined polygons orbiting the frame edges.", ["makePolygon()", "interpolate()"], ["techy", "calm"]),
  C("remotion.shape.circle-pulse", "decor", "Circle Pulse", "Concentric circles rippling outward.", ["makeCircle()", "interpolate()"], ["calm", "elegant"]),
  C("remotion.path.evolve-line", "decor", "Evolve Line", "A flowing curve drawn with evolvePath().", ["evolvePath()", "Easing.inOut"], ["elegant", "calm"]),
  C("remotion.shape.morph-blob", "decor", "Morph Shape", "Shape morphs star → circle → heart via interpolatePath().", ["interpolatePath()", "makeStar()", "makeHeart()"], ["playful", "bold"]),
  C("remotion.transition.fade", "transition", "Fade", "Cross-fade presentation from @remotion/transitions.", ["<TransitionSeries>", "interpolate()"], ["calm", "elegant"]),
  C("remotion.transition.slide", "transition", "Slide", "Next scene pushes the previous one out.", ["<TransitionSeries>", "Easing.inOut"], ["energetic", "techy"]),
  C("remotion.transition.wipe", "transition", "Wipe", "Diagonal clip-path wipe.", ["<TransitionSeries>", "interpolate()"], ["bold", "techy"]),
  C("remotion.transition.flip", "transition", "Flip", "3D card flip between scenes.", ["<TransitionSeries>", "spring()"], ["playful"]),
  C("remotion.transition.clock-wipe", "transition", "Clock Wipe", "Radial sweep like a clock hand.", ["<TransitionSeries>", "interpolate()"], ["playful", "bold"]),
  C("remotion.transition.iris", "transition", "Iris", "Circle opens from the center.", ["<TransitionSeries>", "Easing.out"], ["elegant", "bold"]),

  // ───────────── anime.js ─────────────
  C("anime.text.letters-wave", "text", "Letters Wave", "splitText chars rise in a wave with outBack easing.", ["splitText()", "stagger()", "animate()"], ["playful", "energetic"]),
  C("anime.text.scramble", "text", "Scramble Reveal", "Characters decode from random glyphs.", ["scrambleText()", "animate()"], ["techy", "bold"]),
  C("anime.text.rotate-3d", "text", "3D Letter Flip", "Characters flip in on the X axis from the center out.", ["splitText()", "stagger({from:'center'})"], ["bold", "energetic"]),
  C("anime.text.elastic-words", "text", "Elastic Words", "Words drop in with an elastic spring.", ["splitText()", "createSpring()"], ["playful"]),
  C("anime.enter.elastic-scale", "entrance", "Elastic Scale", "Pops in with outElastic.", ["animate()", "eases.outElastic"], ["playful", "energetic"]),
  C("anime.enter.slide-bounce", "entrance", "Slide Bounce", "Slides from the right and bounces to rest.", ["animate()", "outBounce"], ["energetic"]),
  C("anime.enter.flip-up", "entrance", "Flip Up", "Rotates up from a 3D hinge.", ["animate()", "inOutCirc"], ["techy", "bold"]),
  C("anime.list.stagger-grid", "list", "Stagger Grid", "Items scale in staggered from the center.", ["stagger({from:'center'})", "animate()"], ["energetic", "playful"]),
  C("anime.list.stagger-slide", "list", "Stagger Slide", "Items slide in from alternating sides.", ["stagger()", "createTimeline()"], ["energetic", "techy"]),
  C("anime.number.count-up", "number", "Count Up", "Counts up with outExpo and rounding modifier.", ["animate()", "utils.round"], ["techy", "bold"]),
  C("anime.chart.bars-elastic", "chart", "Elastic Bars", "Bars grow with elastic overshoot, staggered.", ["animate()", "stagger()"], ["playful", "energetic"]),
  C("anime.bg.particles", "background", "Floating Particles", "Particles drifting with randomized loops.", ["animate()", "utils.random()"], ["calm", "techy"]),
  C("anime.bg.dot-wave", "background", "Dot Grid Wave", "Dot matrix rippling with a grid stagger.", ["stagger({grid})", "animate()"], ["techy", "energetic"]),
  C("anime.svg.line-draw", "decor", "Line Draw", "Decorative strokes drawn with createDrawable().", ["svg.createDrawable()", "animate()"], ["elegant", "calm"]),
  C("anime.svg.morph", "decor", "SVG Morph", "Shape morphing loop with morphTo().", ["svg.morphTo()", "animate()"], ["playful", "bold"]),
  C("anime.svg.motion-path", "decor", "Motion Path Orbit", "Glowing dots travel along a path.", ["svg.createMotionPath()", "animate()"], ["techy", "elegant"]),
  C("anime.transition.shutter", "transition", "Shutter Bars", "Vertical bars close and reveal the next scene.", ["stagger()", "animate()"], ["bold", "energetic"]),
  C("anime.transition.tiles", "transition", "Tile Flip", "Grid tiles flip to reveal the next scene.", ["stagger({grid})", "animate()"], ["playful", "techy"]),

  // ───────────── Motion ─────────────
  C("motion.text.word-fade-up", "text", "Word Fade Up", "Words fade up with stagger and easeOut.", ["animate()", "stagger()"], ["calm", "elegant"]),
  C("motion.text.blur-reveal", "text", "Blur Reveal", "Letters de-blur in sequence.", ["animate()", "stagger()"], ["elegant", "calm"]),
  C("motion.text.spring-letters", "text", "Spring Letters", "Letters bounce in with spring physics.", ["spring()", "stagger()"], ["playful", "energetic"]),
  C("motion.enter.fade-up", "entrance", "Fade Up", "Classic fade + rise with backOut.", ["animate()", "backOut"], ["calm", "elegant"]),
  C("motion.enter.spring-scale", "entrance", "Spring Scale", "Spring-driven scale from 0.6.", ["animate()", "spring()"], ["playful"]),
  C("motion.enter.clip-reveal", "entrance", "Clip Reveal", "clip-path inset reveal from bottom.", ["animate()", "cubicBezier()"], ["elegant", "bold"]),
  C("motion.enter.slide-left", "entrance", "Slide In", "Slides in from the left with circOut.", ["animate()", "circOut"], ["energetic", "techy"]),
  C("motion.list.stagger-fade", "list", "Stagger Fade", "Items fade in one after another.", ["animate()", "stagger()"], ["calm", "elegant"]),
  C("motion.list.spring-pop", "list", "Spring Pop List", "Items pop with spring physics.", ["spring()", "stagger()"], ["playful", "energetic"]),
  C("motion.number.animate-value", "number", "Value Tween", "Counts with Motion's mix() value interpolation + easeOut.", ["mix()", "easeOut"], ["calm", "elegant"]),
  C("motion.chart.bars-spring", "chart", "Spring Bars", "Bars grow with Motion springs.", ["spring()", "stagger()"], ["energetic"]),
  C("motion.bg.aurora", "background", "Aurora", "Large blurred gradients sway like an aurora.", ["animate()", "mix()"], ["calm", "elegant"]),
  C("motion.bg.spotlight", "background", "Spotlight", "A moving radial spotlight over a vignette.", ["animate()", "easeInOut"], ["elegant", "bold"]),
  C("motion.decor.orbit-rings", "decor", "Orbit Rings", "Rotating rings with orbiting satellites.", ["animate()"], ["techy", "calm"]),
  C("motion.decor.floating-shapes", "decor", "Floating Shapes", "Glassy shapes bobbing gently.", ["animate()", "easeInOut"], ["calm", "playful"]),
  C("motion.transition.push-scale", "transition", "Push & Scale", "Old scene scales down while new one slides over.", ["mix()", "easeInOut"], ["elegant", "energetic"]),
  C("motion.transition.blur-cross", "transition", "Blur Cross", "Cross dissolve through blur.", ["mix()", "easeOut"], ["calm", "elegant"]),

  // ───────────── GSAP ─────────────
  C("gsap.text.split-chars", "text", "Split Chars", "SplitText chars fly in with back.out.", ["SplitText", "gsap.timeline()"], ["energetic", "bold"]),
  C("gsap.text.scramble", "text", "Scramble Text", "ScrambleTextPlugin decoder effect.", ["ScrambleTextPlugin"], ["techy"]),
  C("gsap.text.typewriter", "text", "Typewriter", "TextPlugin types the headline.", ["TextPlugin"], ["techy", "calm"]),
  C("gsap.text.lines-mask", "text", "Masked Lines", "SplitText lines slide up inside masks.", ["SplitText({mask:'lines'})"], ["elegant", "bold"]),
  C("gsap.enter.back-out", "entrance", "Back Out", "Rises and overshoots with back.out(1.7).", ["gsap.fromTo()", "back.out"], ["energetic"]),
  C("gsap.enter.elastic-drop", "entrance", "Elastic Drop", "Drops from above with elastic.out.", ["gsap.fromTo()", "elastic.out"], ["playful"]),
  C("gsap.enter.skew-in", "entrance", "Skew In", "Slides in with skew that straightens.", ["gsap.fromTo()", "expo.out"], ["bold", "energetic"]),
  C("gsap.enter.rotate-3d", "entrance", "Rotate 3D", "Rotates in on Y axis with perspective.", ["gsap.fromTo()", "power3.out"], ["techy", "elegant"]),
  C("gsap.list.stagger-edges", "list", "Stagger From Edges", "Items enter staggered from the edges inward.", ["stagger({from:'edges'})"], ["energetic", "bold"]),
  C("gsap.list.wave", "list", "Wave List", "Items rise in a sine wave.", ["gsap.timeline()", "sine.inOut"], ["calm", "playful"]),
  C("gsap.number.snap-count", "number", "Snap Counter", "Counts with snap and expo.out.", ["gsap.to()", "snap"], ["bold", "techy"]),
  C("gsap.chart.bars-stagger", "chart", "Stagger Bars", "Bars sweep up with power4.out and labels.", ["gsap.timeline()", "stagger"], ["bold", "techy"]),
  C("gsap.bg.wave-lines", "background", "Wave Lines", "Layered SVG waves undulating.", ["gsap.timeline()", "sine.inOut"], ["calm", "elegant"]),
  C("gsap.bg.conic-spin", "background", "Conic Spin", "Slow-rotating conic gradient glow.", ["gsap.to()", "rotation"], ["bold", "energetic"]),
  C("gsap.decor.draw-svg", "decor", "Draw SVG", "DrawSVGPlugin reveals ornamental strokes.", ["DrawSVGPlugin"], ["elegant"]),
  C("gsap.decor.morph-svg", "decor", "Morph SVG", "MorphSVGPlugin shape-shifting accent.", ["MorphSVGPlugin"], ["playful", "bold"]),
  C("gsap.decor.motion-path", "decor", "Motion Path", "Comet follows a curve with autoRotate.", ["MotionPathPlugin"], ["energetic", "techy"]),
  C("gsap.transition.zoom-through", "transition", "Zoom Through", "Zooms into the old scene and out of the new one.", ["gsap.timeline()", "expo.inOut"], ["energetic", "bold"]),
  C("gsap.transition.curtain", "transition", "Curtain", "Accent curtain sweeps across.", ["gsap.timeline()", "power4.inOut"], ["bold", "elegant"]),
  C("gsap.transition.skew-slide", "transition", "Skew Slide", "Skewed horizontal slide.", ["gsap.timeline()", "power3.inOut"], ["energetic", "techy"]),

  // ───────────── Onda data charts (React + Remotion; runtime/onda): drawn from a chart slide's numbers ─────────────
  C("onda.chart.bar-chart", "chart", "Onda Bar Chart", "Horizontal bars grow one after another on Onda's calm spring; the biggest bar gets the accent, each value sits at its end.", ["spring()", "interpolate()", "STAGGER"], ["calm", "elegant"]),
  C("onda.chart.line-chart", "chart", "Line Chart", "A line draws itself left to right over a soft area fill; dots, values and labels appear as it reaches each point. Best for trends over time.", ["useSceneProgress()", "SVG path", "HOUSE_EASE"], ["calm", "elegant", "techy"]),
  C("onda.chart.pie-reveal", "chart", "Pie Reveal", "One ring per number fills to its percentage with the value in the centre and the label below. Best for percentages.", ["spring()", "SVG arc"], ["elegant", "bold"]),
  C("onda.chart.progress-bar", "chart", "Progress Bars", "Pill-shaped bars fill to each value, labelled, one per number. Best for percentages and goals.", ["spring()", "interpolate()"], ["calm", "techy"]),

  // ───────────── Onda cards (React + Remotion; runtime/onda) ─────────────
  C("onda.card.bento-grid", "card", "Bento Grid", "Glass cells of different widths rise in one after another; the slide's cards, numbers or bullets fill them.", ["<Surface>", "useStaggeredEntrance()", "spring()"], ["elegant", "techy", "calm"]),
  C("onda.card.pricing-card", "card", "Pricing Card", "A plan with name, big price, feature checklist and button, lifted with an accent glow. Two or three numbers on the slide become side-by-side plans.", ["<Surface>", "<Glow>", "useEntrance()"], ["bold", "elegant"]),
  C("onda.card.skeleton-card", "card", "Skeleton Card", "A loading placeholder with a shimmer sweeping over text bars, shown beside the slide's content.", ["<Surface>", "interpolate()", "useEntrance()"], ["techy", "calm"]),
  C("onda.card.spotlight-card", "card", "Spotlight Card", "One large glass card with a slowly drifting spotlight that holds the slide's title and message.", ["<Surface>", "<Glow>", "useCurrentFrame()"], ["elegant", "calm"]),

  // the rest of Onda's standalone components as cards (runtime/cards-extra.ts)
  C("onda.card.blur-reveal", "card", "Blur Reveal", "A calm, spring-driven text reveal: blur and opacity fade in together while the text rises by 16px. Draws the slide's title, subtitle under it.", ["<BlurReveal>"], ["elegant", "calm"]),
  C("onda.card.fade-in", "card", "Fade In", "A pure opacity fade for text — no movement, no scale, no blur. Draws the slide's title, subtitle under it.", ["<FadeIn>"], ["elegant", "calm"]),
  C("onda.card.fade-out", "card", "Fade Out", "The inverse of FadeIn: a pure opacity exit. Draws the slide's title, which leaves just before the slide ends.", ["<FadeOut>"], ["elegant", "calm"]),
  C("onda.card.mask-reveal", "card", "Mask Reveal", "Reveals text from behind a retreating mask. Draws the slide's title, subtitle under it.", ["<MaskReveal>"], ["elegant", "calm"]),
  C("onda.card.matrix-decode", "card", "Matrix Decode", "Each character flickers through random glyphs, then settles to its target left-to-right — a decode reveal. Draws the slide's title, subtitle under it.", ["<MatrixDecode>"], ["elegant", "calm"]),
  C("onda.card.rotate-in", "card", "Rotate In", "A calm, spring-driven text rotation: the text settles from a slight starting angle (default -8 degrees) to 0 while fading in. Draws the slide's title, subtitle under it.", ["<RotateIn>"], ["elegant", "calm"]),
  C("onda.card.scale-in", "card", "Scale In", "A subtle scale-from-slightly-smaller-and-fade entrance. Draws the slide's title, subtitle under it.", ["<ScaleIn>"], ["elegant", "calm"]),
  C("onda.card.slide-in", "card", "Slide In", "A direction-parameterized translate-and-fade entrance — text slides into place from up, down, left, or right on the house spring. Draws the slide's title, subtitle under it.", ["<SlideIn>"], ["elegant", "calm"]),
  C("onda.card.slide-out", "card", "Slide Out", "A direction-parameterized translate-and-fade exit — text drifts up, down, left, or right while opacity fades to 0 on the house spring. Draws the slide's title, which leaves just before the slide ends.", ["<SlideOut>"], ["elegant", "calm"]),
  C("onda.card.slot-machine-roll", "card", "Slot Machine Roll", "Each character spins down a reel of glyphs and lands on its target, settling on the house spring, staggered left-to-right. The slide's first number rolls in, its label below.", ["<SlotMachineRoll>"], ["elegant", "calm"]),
  C("onda.card.stagger-group", "card", "Stagger Group", "A composition primitive that reveals a list of items in sequence using the canonical Onda stagger (4 frames between siblings). The slide's bullets reveal one after another.", ["<StaggerGroup>"], ["elegant", "calm"]),
  C("onda.card.tracking-in", "card", "Tracking In", "Text begins spread wide and contracts to its resting letter-spacing on the house spring, fading and sharpening from a soft blur as it settles. Draws the slide's title, subtitle under it.", ["<TrackingIn>"], ["elegant", "calm"]),
  C("onda.card.typewriter", "card", "Typewriter", "Character-by-character text reveal with an optional blinking cursor in the Onda accent. Draws the slide's title, subtitle under it.", ["<Typewriter>"], ["elegant", "calm"]),
  C("onda.card.word-rotate", "card", "Word Rotate", "Cycles through a list of phrases in place. The slide's bullets take turns in one spot under the title.", ["<WordRotate>"], ["elegant", "calm"]),
  C("onda.card.word-stagger", "card", "Word Stagger", "Multi-word text where each word fades and rises in sequence — the clearest demonstration of the Onda stagger fingerprint. Draws the slide's title, subtitle under it.", ["<WordStagger>"], ["elegant", "calm"]),
  C("onda.card.bounding-box", "card", "Bounding Box", "A UI annotation bounding box — a rectangle outline that strokes itself on like a selection marquee around a region, with optional corner ticks and an optional label tag pinned to the top-left corner. Framed around the slide's title.", ["<BoundingBox>"], ["playful", "bold"]),
  C("onda.card.callout", "card", "Callout", "A label-and-arrow annotation pointing at a specific spot on the canvas. Points at the slide's title with its first bullet.", ["<Callout>"], ["playful", "bold"]),
  C("onda.card.confetti", "card", "Confetti", "A celebratory confetti burst — pieces launch from an origin, fan outward, arc under gravity, tumble, and fade. Bursts over the slide's title.", ["<Confetti>"], ["playful", "bold"]),
  C("onda.card.draw-on", "card", "Draw On", "An SVG path that strokes itself in — the substrate for logos, icons, and signature flourishes. A hand-drawn stroke under the slide's title.", ["<DrawOn>"], ["playful", "bold"]),
  C("onda.card.highlight", "card", "Highlight", "Text fades in, then an accent-rose highlight bar slides in behind it at full text-height — a marker-style reveal. Draws the slide's title, subtitle under it.", ["<Highlight>"], ["playful", "bold"]),
  C("onda.card.icon-pop", "card", "Icon Pop", "A small state icon — check, cross, dot, or star — that pops into place on SPRING_SMOOTH via entryScale (scale 0 → 1 plus opacity fade). A check pops in beside each bullet.", ["<IconPop>"], ["playful", "bold"]),
  C("onda.card.node-graph", "card", "Node Graph", "A hub-and-spoke constellation: a labeled central hub with satellite nodes that fly in from off-frame, then settle into elliptical orbits at varying radii and speeds. The title is the hub; the bullets orbit it.", ["<NodeGraph>"], ["playful", "bold"]),
  C("onda.card.rgb-glitch-text", "card", "Rgb Glitch Text", "RGB channel-split text — red and cyan copies ride just off the white center, with periodic glitch bursts that kick the split wider. Draws the slide's title, subtitle under it.", ["<RgbGlitchText>"], ["playful", "bold"]),
  C("onda.card.shimmer-sweep", "card", "Shimmer Sweep", "A single band of light sweeps across text once (or on a loop), drawing the eye without moving the layout. Draws the slide's title, subtitle under it.", ["<ShimmerSweep>"], ["playful", "bold"]),
  C("onda.card.text-fade-replace", "card", "Text Fade Replace", "Cycles through a list of phrases, crossfading one into the next in place so the swap never shifts the layout. The slide's bullets cross-fade in one spot under the title.", ["<TextFadeReplace>"], ["playful", "bold"]),
  C("onda.card.underline", "card", "Underline", "Text fades in, then an accent-rose underline draws beneath it after a small beat. Draws the slide's title, subtitle under it.", ["<Underline>"], ["playful", "bold"]),
  C("onda.card.button", "card", "Button", "A CTA pill button — accent-filled (primary) or bordered (ghost). Beside the slide's text; label from the first short bullet.", ["<Button>"], ["techy"]),
  C("onda.card.code-block", "card", "Code Block", "Syntax-highlighted code on the Onda glass surface, revealed line-by-line. Beside the slide's text; the body is the code.", ["<CodeBlock>"], ["techy"]),
  C("onda.card.code-diff", "card", "Code Diff", "A unified code diff on the Onda glass surface, revealed line-by-line. Beside the slide's text; bullets starting with + / - become added / removed lines.", ["<CodeDiff>"], ["techy"]),
  C("onda.card.cursor", "card", "Cursor", "An animated pointer that travels between two canvas points on the house spring and emits a single restrained click ripple on arrival. Glides to the slide's title and clicks.", ["<Cursor>"], ["techy"]),
  C("onda.card.input-field", "card", "Input Field", "A rounded glass text input on the Onda Surface, with an optional label above and a placeholder. Beside the slide's text; types the first bullet or subtitle.", ["<InputField>"], ["techy"]),
  C("onda.card.kanban-board", "card", "Kanban Board", "A data-driven Kanban board — glass Surface columns with a header, status dot, ticket count, and a stack of small glass ticket cards. The slide's cards become columns (their text, split by commas, the tickets).", ["<KanbanBoard>"], ["techy"]),
  C("onda.card.progress-steps", "card", "Progress Steps", "A horizontal stepper whose fill animates to the current step on the house spring. The slide's bullets become steps.", ["<ProgressSteps>"], ["techy"]),
  C("onda.card.pulsing-indicator", "card", "Pulsing Indicator", "A live status dot with a calm expanding-ring pulse and an optional label. Beside the slide's text; a short subtitle is its label.", ["<PulsingIndicator>"], ["techy"]),
  C("onda.card.terminal", "card", "Terminal", "A terminal session: the command types itself after the prompt with a frame-keyed blinking cursor, then output lines appear staggered. Beside the slide's text; the first bullet is the command, the rest its output.", ["<Terminal>"], ["techy"]),
  C("onda.card.captions", "card", "Captions", "Sequential word-by-word captions driven by a timed array. The body plays as kinetic captions under the title.", ["<Captions>"], ["techy", "calm"]),
  C("onda.card.count-up", "card", "Count Up", "An animated number that counts from `from` to `to` on SPRING_SMOOTH while fading in. Each number on the slide counts up with its label.", ["<CountUp>"], ["techy", "calm"]),
  C("onda.card.timeline", "card", "Timeline", "A horizontal timeline: a thin line strokes itself on, then dots cascade in at each anchor with the canonical Onda stagger, then labels fade in beneath. The slide's bullets become timeline points.", ["<Timeline>"], ["techy", "calm"]),
  C("onda.card.chapter-card", "card", "Chapter Card", "Chapter-title scene block with a numbered eyebrow ('01 The setup'). The title as a chapter heading; a short subtitle is its number.", ["<ChapterCard>"], ["elegant", "bold"]),
  C("onda.card.end-card", "card", "End Card", "Closing scene block: a hero CTA reveals with an optional accent underline, then a faint, staggered row of social handles or URLs fades in beneath it. The title as the call to action, bullets as handles.", ["<EndCard>"], ["elegant", "bold"]),
  C("onda.card.logo-sting", "card", "Logo Sting", "Silent, restrained branded reveal: an SVG logo stroke draws in, a title settles beneath it, and a single accent underline lands last. The title as the logo word.", ["<LogoSting>"], ["elegant", "bold"]),
  C("onda.card.lower-third", "card", "Lower Third", "Broadcast-style name + role bar that slides in from the corner with a single accent underline. Title as the name, subtitle as the role.", ["<LowerThird>"], ["elegant", "bold"]),
  C("onda.card.quote-card", "card", "Quote Card", "A centered pull-quote scene block with attribution. The body as the quote, subtitle as the author.", ["<Quote Card>"], ["elegant", "bold"]),
  C("onda.card.stat-card", "card", "Stat Card", "Flagship Onda data scene — a big counted-up number above a word-staggered label above an accent rule. Each number on the slide becomes a stat card.", ["<StatCard>"], ["elegant", "bold"]),
  C("onda.card.dynamic-grid", "card", "Dynamic Grid", "A technical grid that drifts diagonally — the GridField primitive on a frame-driven translate that loops by one cell, so it's seamless and deterministic. Behind the slide's title.", ["<DynamicGrid>"], ["calm", "elegant"]),
  C("onda.card.gradient-shift", "card", "Gradient Shift", "A quiet, drifting two-color linear gradient background. Behind the slide's title.", ["<GradientShift>"], ["calm", "elegant"]),
  C("onda.card.grain-overlay", "card", "Grain Overlay", "A subtle film-grain layer overlaid on the canvas — pure SVG fractal noise, no text, no motion. Over the slide's title.", ["<GrainOverlay>"], ["calm", "elegant"]),
  C("onda.card.marquee", "card", "Marquee", "A seamless looping horizontal scroll — logo strips, ticker tape, 'as featured in' rows. The slide's bullets scroll under the title.", ["<Marquee>"], ["calm", "elegant"]),
  C("onda.card.mesh-gradient", "card", "Mesh Gradient", "A soft mesh-gradient backdrop — colored blobs drifting slowly over the near-black canvas. Behind the slide's title.", ["<MeshGradient>"], ["calm", "elegant"]),
  C("onda.card.spotlight", "card", "Spotlight", "A soft radial light reveal that grows from 0 to a target radius on the Onda house spring. Over the slide's title.", ["<Spotlight>"], ["elegant", "bold"]),
  C("onda.card.vignette", "card", "Vignette", "A static cinematic vignette: a radial darkening at the canvas edges that frames the center. Over the slide's title.", ["<Vignette>"], ["elegant", "bold"]),

  // ───────────── Magic UI cards (React + Tailwind; components/magicui, drawn by runtime/magicui) ─────────────
  C("magicui.card.android", "card", "Android", "A mockup of an Android device. Beside the slide's text, showing the slide's picture.", ["<Android>"], ["techy"]),
  C("magicui.card.animated-beam", "card", "Animated Beam", "An animated beam of light which travels along a path. Useful for showcasing the integration features of a website. Beams connect the slide's bullets to its title.", ["<AnimatedBeam>"], ["elegant", "bold"]),
  C("magicui.card.animated-circular-progress-bar", "card", "Animated Circular Progress Bar", "Animated Circular Progress Bar is a component that displays a circular gauge with a percentage value. A gauge per number on the slide.", ["<AnimatedCircularProgressBar>"], ["techy", "calm"]),
  C("magicui.card.animated-gradient-text", "card", "Animated Gradient Text", "An animated gradient background which transitions between colors for text. Shows the slide's title.", ["<AnimatedGradientText>"], ["elegant", "bold"]),
  C("magicui.card.animated-grid-pattern", "card", "Animated Grid Pattern", "A animated background grid pattern made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<AnimatedGridPattern>"], ["calm", "elegant"]),
  C("magicui.card.animated-list", "card", "Animated List", "A list that animates each item in sequence with a delay. Used to showcase notifications or events on your landing page. The slide's bullets arrive as notifications.", ["<AnimatedList>"], ["techy", "calm"]),
  C("magicui.card.animated-shiny-text", "card", "Animated Shiny Text", "A light glare effect which pans across text making it appear as if it is shimmering. Shows the slide's title.", ["<AnimatedShinyText>"], ["elegant", "bold"]),
  C("magicui.card.aurora-text", "card", "Aurora Text", "A beautiful aurora text effect. Shows the slide's title.", ["<AuroraText>"], ["elegant", "bold"]),
  C("magicui.card.avatar-circles", "card", "Avatar Circles", "Overlapping circles of avatars. Overlapping avatars for the slide's bullets.", ["<AvatarCircles>"], ["techy", "calm"]),
  C("magicui.card.backlight", "card", "Backlight", "A backlight glow effect for videos, images, and SVGs. Shows the slide's title.", ["<Backlight>"], ["elegant", "bold"]),
  C("magicui.card.bento-grid", "card", "Bento Grid", "Bento grid is a layout used to showcase the features of a product in a simple and elegant way. The slide's cards as a bento grid.", ["<BentoGrid>"], ["techy", "calm"]),
  C("magicui.card.blur-fade", "card", "Blur Fade", "Blur fade in and out animation. Used to smoothly fade in and out content. The slide's bullets fade in one by one.", ["<BlurFade>"], ["techy", "calm"]),
  C("magicui.card.border-beam", "card", "Border Beam", "An animated beam of light which travels along the border of its container. Shows the slide's title.", ["<BorderBeam>"], ["elegant", "bold"]),
  C("magicui.card.code-comparison", "card", "Code Comparison", "A component which compares two code snippets. Bullets starting with - / + become before / after code.", ["<CodeComparison>"], ["techy"]),
  C("magicui.card.comic-text", "card", "Comic Text", "Comic text animation. Shows the slide's title.", ["<ComicText>"], ["elegant", "bold"]),
  C("magicui.card.confetti", "card", "Confetti", "Confetti animations are best used to delight your users when something special happens. Drawn over the slide's title.", ["<Confetti>"], ["calm", "elegant"]),
  C("magicui.card.cool-mode", "card", "Cool Mode", "Cool mode effect for buttons, links, and other DOMs. Beside the slide's text.", ["<CoolMode>"], ["bold", "playful"]),
  C("magicui.card.dia-text-reveal", "card", "Dia Text Reveal", "A horizontal color band sweeps across text, revealing a gradient shine before settling on the base color. Shows the slide's title.", ["<DiaTextReveal>"], ["elegant", "bold"]),
  C("magicui.card.dither", "card", "Dither", "An animated WebGL2 layer of Bayer-dithered square dots that fills its parent. Pick one of 17 patterns, dither an image or a video, or write your own GLSL field. Set `colors` to one color or a list of stops, and `interactive` to brighten the dots under the pointer. A backdrop behind the slide's title.", ["<Dither>"], ["calm", "elegant"]),
  C("magicui.card.dock", "card", "Dock", "An implementation of the MacOS dock using react + tailwindcss + motion. The slide's bullets as dock icons.", ["<Dock>"], ["techy", "calm"]),
  C("magicui.card.dot-pattern", "card", "Dot Pattern", "A background dot pattern made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<DotPattern>"], ["calm", "elegant"]),
  C("magicui.card.dotted-map", "card", "Dotted Map", "A component with a dotted map. A backdrop behind the slide's title.", ["<DottedMap>"], ["calm", "elegant"]),
  C("magicui.card.file-tree", "card", "File Tree", "A component used to showcase the folder and file structure of a directory. The slide's bullets as files, beside its text.", ["<FileTree>"], ["techy"]),
  C("magicui.card.flickering-grid", "card", "Flickering Grid", "A flickering grid background made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<FlickeringGrid>"], ["calm", "elegant"]),
  C("magicui.card.floating-3d-particles", "card", "Floating 3D Particles", "A canvas-based pseudo-3D particle field with perspective projection, continuous rotation and buoyant drift. A backdrop behind the slide's title.", ["<Floating3dParticles>"], ["calm", "elegant"]),
  C("magicui.card.glare-hover", "card", "Glare Hover", "A diagonal glare on hover using a ::before gradient and CSS variables (angle, size, duration, color). Shows the slide's title.", ["<GlareHover>"], ["elegant", "bold"]),
  C("magicui.card.globe", "card", "Globe", "An autorotating, interactive, and highly performant globe made using WebGL. A backdrop behind the slide's title.", ["<Globe>"], ["calm", "elegant"]),
  C("magicui.card.glyph-matrix", "card", "Glyph Matrix", "An animated grid of subtly shifting glyphs with fade effect and theme support. A backdrop behind the slide's title.", ["<GlyphMatrix>"], ["calm", "elegant"]),
  C("magicui.card.grid-pattern", "card", "Grid Pattern", "A background grid pattern made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<GridPattern>"], ["calm", "elegant"]),
  C("magicui.card.hero-video-dialog", "card", "Hero Video Dialog", "A hero video dialog component. The slide's picture as a video thumbnail beside its text.", ["<HeroVideoDialog>"], ["techy"]),
  C("magicui.card.hexagon-pattern", "card", "Hexagon Pattern", "A background hexagon pattern made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<HexagonPattern>"], ["calm", "elegant"]),
  C("magicui.card.highlighter", "card", "Highlighter", "A text highlighter that mimics the effect of a human-drawn marker stroke. Shows the slide's title.", ["<Highlighter>"], ["elegant", "bold"]),
  C("magicui.card.hyper-text", "card", "Hyper Text", "A text animation that scrambles letters before revealing the final text. Shows the slide's title.", ["<HyperText>"], ["elegant", "bold"]),
  C("magicui.card.icon-cloud", "card", "Icon Cloud", "An interactive 3D tag cloud component. A 3D cloud of the slide's bullets as icons.", ["<IconCloud>"], ["techy"]),
  C("magicui.card.interactive-grid-pattern", "card", "Interactive Grid Pattern", "A interactive background grid pattern made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<InteractiveGridPattern>"], ["calm", "elegant"]),
  C("magicui.card.interactive-hover-button", "card", "Interactive Hover Button", "Interactive Hover Button. Beside the slide's text.", ["<InteractiveHoverButton>"], ["bold", "playful"]),
  C("magicui.card.iphone", "card", "iPhone", "A mockup of the iPhone. Beside the slide's text, showing the slide's picture.", ["<Iphone>"], ["techy"]),
  C("magicui.card.kinetic-text", "card", "Kinetic Text", "A text component that animates font weight of characters on hover. Shows the slide's title.", ["<KineticText>"], ["elegant", "bold"]),
  C("magicui.card.lens", "card", "Lens", "A interactive component that enables zooming into images, videos and other elements. Zooms into the slide's picture beside its text.", ["<Lens>"], ["techy"]),
  C("magicui.card.light-rays", "card", "Light Rays", "A component with animated light rays which shine down from above. A backdrop behind the slide's title.", ["<LightRays>"], ["calm", "elegant"]),
  C("magicui.card.line-shadow-text", "card", "Line Shadow Text", "A text component with a moving line shadow. Shows the slide's title.", ["<LineShadowText>"], ["elegant", "bold"]),
  C("magicui.card.magic-card", "card", "Magic Card", "A spotlight effect that follows your mouse cursor and highlights borders on hover. The slide's cards as glowing cards.", ["<MagicCard>"], ["techy", "calm"]),
  C("magicui.card.marquee", "card", "Marquee", "An infinite scrolling component that can be used to display text, images, or videos. The slide's bullets scroll in two rows.", ["<Marquee>"], ["techy", "calm"]),
  C("magicui.card.meteors", "card", "Meteors", "A meteor shower effect. A backdrop behind the slide's title.", ["<Meteors>"], ["calm", "elegant"]),
  C("magicui.card.morphing-text", "card", "Morphing Text", "A dynamic text morphing component for Magic UI. Shows the slide's title.", ["<MorphingText>"], ["elegant", "bold"]),
  C("magicui.card.neon-gradient-card", "card", "Neon Gradient Card", "A beautiful neon card effect. Shows the slide's title.", ["<NeonGradientCard>"], ["elegant", "bold"]),
  C("magicui.card.noise-texture", "card", "Noise Texture", "An SVG fractal noise layer using feTurbulence, desaturation, and contrast controls for subtle texture overlays. Drawn over the slide's title.", ["<NoiseTexture>"], ["calm", "elegant"]),
  C("magicui.card.number-ticker", "card", "Number Ticker", "Animate numbers to count up or down to a target number. Each number on the slide counts up, its label below.", ["<NumberTicker>"], ["techy", "calm"]),
  C("magicui.card.orbiting-circles", "card", "Orbiting Circles", "A collection of circles which move in orbit along a circular path. The slide's bullets orbit its title.", ["<OrbitingCircles>"], ["elegant", "bold"]),
  C("magicui.card.particles", "card", "Particles", "Particles are a fun way to add some visual flair to your website. They can be used to create a sense of depth, movement, and interactivity. A backdrop behind the slide's title.", ["<Particles>"], ["calm", "elegant"]),
  C("magicui.card.pixel-image", "card", "Pixel Image", "A component that displays an image with a pixelated effect, creating a retro aesthetic. Reveals the slide's picture beside its text.", ["<PixelImage>"], ["techy"]),
  C("magicui.card.progressive-blur", "card", "Progressive Blur", "The Progressive Blur component adds a smooth blur gradient effect to scrollable content, indicating more content below or above. The slide's bullets fade out under a progressive blur.", ["<ProgressiveBlur>"], ["calm", "elegant"]),
  C("magicui.card.pulsating-button", "card", "Pulsating Button", "An animated pulsating button useful for capturing attention of users. Beside the slide's text.", ["<PulsatingButton>"], ["bold", "playful"]),
  C("magicui.card.rainbow-button", "card", "Rainbow Button", "An animated button with a rainbow effect. Beside the slide's text.", ["<RainbowButton>"], ["bold", "playful"]),
  C("magicui.card.retro-grid", "card", "Retro Grid", "An animated scrolling retro grid effect. A backdrop behind the slide's title.", ["<RetroGrid>"], ["calm", "elegant"]),
  C("magicui.card.ripple", "card", "Ripple", "An animated ripple effect typically used behind elements to emphasize them. A backdrop behind the slide's title.", ["<Ripple>"], ["calm", "elegant"]),
  C("magicui.card.ripple-button", "card", "Ripple Button", "An animated button with ripple useful for user engagement. Beside the slide's text.", ["<RippleButton>"], ["bold", "playful"]),
  C("magicui.card.safari", "card", "Safari", "A safari browser mockup to showcase your website. Beside the slide's text, showing the slide's picture.", ["<Safari>"], ["techy"]),
  C("magicui.card.scroll-based-velocity", "card", "Scroll Based Velocity", "Scrolling text whose speed changes based on scroll speed. The title and bullets scroll across in two rows.", ["<ScrollBasedVelocity>"], ["elegant", "bold"]),
  C("magicui.card.shimmer-button", "card", "Shimmer Button", "A button with a shimmering light which travels around the perimeter. Beside the slide's text.", ["<ShimmerButton>"], ["bold", "playful"]),
  C("magicui.card.shine-border", "card", "Shine Border", "Shine border is an animated background border effect. Shows the slide's title.", ["<ShineBorder>"], ["elegant", "bold"]),
  C("magicui.card.shiny-button", "card", "Shiny Button", "A shiny button component with dynamic styles in the dark mode or light mode. Beside the slide's text.", ["<ShinyButton>"], ["bold", "playful"]),
  C("magicui.card.sparkles-text", "card", "Sparkles Text", "A dynamic text that generates continuous sparkles with smooth transitions, perfect for highlighting text with animated stars. Shows the slide's title.", ["<SparklesText>"], ["elegant", "bold"]),
  C("magicui.card.spinning-text", "card", "Spinning Text", "The Spinning Text component animates text in a circular motion with customizable speed, direction, color, and transitions for dynamic and engaging effects. Shows the slide's title.", ["<SpinningText>"], ["elegant", "bold"]),
  C("magicui.card.striped-pattern", "card", "Striped Pattern", "A background striped pattern made with SVGs, fully customizable using Tailwind CSS. A backdrop behind the slide's title.", ["<StripedPattern>"], ["calm", "elegant"]),
  C("magicui.card.terminal", "card", "Terminal", "A terminal component. Beside the slide's text; the first bullet is the command, the rest its output.", ["<Terminal>"], ["techy"]),
  C("magicui.card.text-3d-flip", "card", "Text 3D Flip", "A text effect that flips each letter in 3D with a staggered animation on hover. Shows the slide's title.", ["<Text3dFlip>"], ["elegant", "bold"]),
  C("magicui.card.text-animate", "card", "Text Animate", "A text animation component that animates text using a variety of different animations. Shows the slide's title.", ["<TextAnimate>"], ["elegant", "bold"]),
  C("magicui.card.typing-animation", "card", "Typing Animation", "Characters appearing in typed animation. Shows the slide's title.", ["<TypingAnimation>"], ["elegant", "bold"]),
  C("magicui.card.warp-background", "card", "Warp Background", "A card with a time warping background effect. Shows the slide's title.", ["<WarpBackground>"], ["elegant", "bold"]),
  C("magicui.card.word-rotate", "card", "Word Rotate", "A vertical rotation of words. The slide's bullets take turns in one spot.", ["<WordRotate>"], ["techy", "calm"]),
  // ───────────── Lottie cards (LottieFiles JSON; runtime/lottie, drawn by the Lottie add-on) ─────────────
  ...LOTTIE_SLUGS.map((slug) => {
    const a: LottieAnimationMeta = LOTTIE_ANIMATIONS[slug];
    const where = a.mode === "full" ? "Plays over the slide's title." : a.ua ? "A useAnimations line icon in the slide's accent colour, beside the slide's text." : "Beside the slide's text.";
    return C(`lottie.card.${slug}`, "card", a.name, `${a.description} ${where}`, a.ua ? ["useAnimations", "lottie-web"] : ["lottie-web", "goToAndStop()"], [...a.mood]);
  }),
];

/**
 * Core components (above) + the remocn components (runtime/remocn/registry.ts). The core list stays the static
 * catalog of the designer prompt; remocn components are offered per slide as a relevant shortlist (see remocnCandidates).
 */
export const ALL_COMPONENTS: ComponentMeta[] = [...COMPONENTS, ...REMOCN_COMPONENTS];

export const COMPONENT_IDS = new Set(ALL_COMPONENTS.map((c) => c.id));

export function componentsByCategory(cat: Category): ComponentMeta[] {
  return COMPONENTS.filter((c) => c.category === cat);
}

const BY_ID = new Map(ALL_COMPONENTS.map((c) => [c.id, c]));
export function getComponent(id: string): ComponentMeta | undefined {
  return BY_ID.get(id);
}
