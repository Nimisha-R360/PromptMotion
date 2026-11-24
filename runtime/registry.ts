import type { Category, Framework } from "./types";

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
];

export const COMPONENT_IDS = new Set(COMPONENTS.map((c) => c.id));

export function componentsByCategory(cat: Category): ComponentMeta[] {
  return COMPONENTS.filter((c) => c.category === cat);
}

export function getComponent(id: string): ComponentMeta | undefined {
  return COMPONENTS.find((c) => c.id === id);
}
