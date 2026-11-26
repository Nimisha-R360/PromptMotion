// Onda add-on for the slide runtime: renders real Onda components (React + Remotion) inside a slide.
// Bundled separately (scripts/build-runtime.mjs → runtime-dist/pm-onda.js) and only inlined into pages whose slides
// use an Onda card or chart, so other videos stay small. Each component is drawn by Remotion's <Thumbnail> at the
// slide's current frame, so scrubbing and exports stay frame-exact.
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Thumbnail } from "@remotion/player";
import { BentoGrid, bentoGridSchema } from "./components/bento-grid/BentoGrid";
import { PricingCard, pricingCardSchema } from "./components/pricing-card/PricingCard";
import { SkeletonCard, skeletonCardSchema } from "./components/skeleton-card/SkeletonCard";
import { SpotlightCard, spotlightCardSchema } from "./components/spotlight-card/SpotlightCard";
import { BarChart, barChartSchema } from "./components/bar-chart/BarChart";
import { LineChart, lineChartSchema } from "./components/line-chart/LineChart";
import { PieReveal, pieRevealSchema } from "./components/pie-reveal/PieReveal";
import { ProgressBar, progressBarSchema } from "./components/progress-bar/ProgressBar";
import { useSceneProgress } from "./lib/hooks";
// the other Onda components, used by the cards in runtime/cards-extra.ts
import { BlurReveal } from "./components/blur-reveal/BlurReveal";
import { blurRevealSchema } from "./components/blur-reveal/schema";
import { BoundingBox } from "./components/bounding-box/BoundingBox";
import { boundingBoxSchema } from "./components/bounding-box/schema";
import { Button } from "./components/button/Button";
import { buttonSchema } from "./components/button/schema";
import { Callout } from "./components/callout/Callout";
import { calloutSchema } from "./components/callout/schema";
import { Captions } from "./components/captions/Captions";
import { captionsSchema } from "./components/captions/schema";
import { ChapterCard } from "./components/chapter-card/ChapterCard";
import { chapterCardSchema } from "./components/chapter-card/schema";
import { CodeBlock } from "./components/code-block/CodeBlock";
import { codeBlockSchema } from "./components/code-block/schema";
import { CodeDiff } from "./components/code-diff/CodeDiff";
import { codeDiffSchema } from "./components/code-diff/schema";
import { Confetti } from "./components/confetti/Confetti";
import { confettiSchema } from "./components/confetti/schema";
import { CountUp } from "./components/count-up/CountUp";
import { countUpSchema } from "./components/count-up/schema";
import { Cursor } from "./components/cursor/Cursor";
import { cursorSchema } from "./components/cursor/schema";
import { DrawOn } from "./components/draw-on/DrawOn";
import { drawOnSchema } from "./components/draw-on/schema";
import { DynamicGrid } from "./components/dynamic-grid/DynamicGrid";
import { dynamicGridSchema } from "./components/dynamic-grid/schema";
import { EndCard } from "./components/end-card/EndCard";
import { endCardSchema } from "./components/end-card/schema";
import { FadeIn } from "./components/fade-in/FadeIn";
import { fadeInSchema } from "./components/fade-in/schema";
import { FadeOut } from "./components/fade-out/FadeOut";
import { fadeOutSchema } from "./components/fade-out/schema";
import { GradientShift } from "./components/gradient-shift/GradientShift";
import { gradientShiftSchema } from "./components/gradient-shift/schema";
import { GrainOverlay } from "./components/grain-overlay/GrainOverlay";
import { grainOverlaySchema } from "./components/grain-overlay/schema";
import { Highlight } from "./components/highlight/Highlight";
import { highlightSchema } from "./components/highlight/schema";
import { IconPop } from "./components/icon-pop/IconPop";
import { iconPopSchema } from "./components/icon-pop/schema";
import { InputField } from "./components/input-field/InputField";
import { inputFieldSchema } from "./components/input-field/schema";
import { KanbanBoard } from "./components/kanban-board/KanbanBoard";
import { kanbanBoardSchema } from "./components/kanban-board/schema";
import { LogoSting } from "./components/logo-sting/LogoSting";
import { logoStingSchema } from "./components/logo-sting/schema";
import { LowerThird } from "./components/lower-third/LowerThird";
import { lowerThirdSchema } from "./components/lower-third/schema";
import { Marquee } from "./components/marquee/Marquee";
import { marqueeSchema } from "./components/marquee/schema";
import { MaskReveal } from "./components/mask-reveal/MaskReveal";
import { maskRevealSchema } from "./components/mask-reveal/schema";
import { MatrixDecode } from "./components/matrix-decode/MatrixDecode";
import { matrixDecodeSchema } from "./components/matrix-decode/schema";
import { MeshGradient } from "./components/mesh-gradient/MeshGradient";
import { meshGradientSchema } from "./components/mesh-gradient/schema";
import { NodeGraph } from "./components/node-graph/NodeGraph";
import { nodeGraphSchema } from "./components/node-graph/schema";
import { ProgressSteps } from "./components/progress-steps/ProgressSteps";
import { progressStepsSchema } from "./components/progress-steps/schema";
import { PulsingIndicator } from "./components/pulsing-indicator/PulsingIndicator";
import { pulsingIndicatorSchema } from "./components/pulsing-indicator/schema";
import { QuoteCard } from "./components/quote-card/QuoteCard";
import { quoteCardSchema } from "./components/quote-card/schema";
import { RgbGlitchText } from "./components/rgb-glitch-text/RgbGlitchText";
import { rgbGlitchTextSchema } from "./components/rgb-glitch-text/schema";
import { RotateIn } from "./components/rotate-in/RotateIn";
import { rotateInSchema } from "./components/rotate-in/schema";
import { ScaleIn } from "./components/scale-in/ScaleIn";
import { scaleInSchema } from "./components/scale-in/schema";
import { ShimmerSweep } from "./components/shimmer-sweep/ShimmerSweep";
import { shimmerSweepSchema } from "./components/shimmer-sweep/schema";
import { SlideIn } from "./components/slide-in/SlideIn";
import { slideInSchema } from "./components/slide-in/schema";
import { SlideOut } from "./components/slide-out/SlideOut";
import { slideOutSchema } from "./components/slide-out/schema";
import { SlotMachineRoll } from "./components/slot-machine-roll/SlotMachineRoll";
import { slotMachineRollSchema } from "./components/slot-machine-roll/schema";
import { Spotlight } from "./components/spotlight/Spotlight";
import { spotlightSchema } from "./components/spotlight/schema";
import { StaggerGroup } from "./components/stagger-group/StaggerGroup";
import { staggerGroupSchema } from "./components/stagger-group/schema";
import { StatCard } from "./components/stat-card/StatCard";
import { statCardSchema } from "./components/stat-card/schema";
import { Terminal } from "./components/terminal/Terminal";
import { terminalSchema } from "./components/terminal/schema";
import { TextFadeReplace } from "./components/text-fade-replace/TextFadeReplace";
import { textFadeReplaceSchema } from "./components/text-fade-replace/schema";
import { Timeline } from "./components/timeline/Timeline";
import { timelineSchema } from "./components/timeline/schema";
import { TrackingIn } from "./components/tracking-in/TrackingIn";
import { trackingInSchema } from "./components/tracking-in/schema";
import { Typewriter } from "./components/typewriter/Typewriter";
import { typewriterSchema } from "./components/typewriter/schema";
import { Underline } from "./components/underline/Underline";
import { underlineSchema } from "./components/underline/schema";
import { Vignette } from "./components/vignette/Vignette";
import { vignetteSchema } from "./components/vignette/schema";
import { WordRotate } from "./components/word-rotate/WordRotate";
import { wordRotateSchema } from "./components/word-rotate/schema";
import { WordStagger } from "./components/word-stagger/WordStagger";
import { wordStaggerSchema } from "./components/word-stagger/schema";
import { ONDA_IDS, cardProps, isCardId, type CardId, type ChartId, type OndaId, type OndaMountOptions } from "../cards";
import { parseNumber } from "../dom";
import type { SlideSpec } from "../types";
import { extraCardLayout, extraCardParts, isExtraCardId, type CardLayout, type CardPart, type ExtraCardId } from "../cards-extra";
import type { MagicCardId } from "../magicui-cards";
import type { LottieCardId } from "../lottie-cards";
import type { Theme } from "../themes";

const FPS = 30;
const TEXT = "var(--onda-text, #F2F2F4)";
const DIM = "var(--onda-dim, #8E8E98)";
const DISPLAY = 'var(--onda-font-display, "Clash Display", sans-serif)';
const BODY = 'var(--onda-font-body, "Space Grotesk", sans-serif)';
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// ───────────── cards: Onda components as they are, props from the slide's words (runtime/cards.ts) ─────────────

interface CardEntry {
  // Onda components take their fully-defaulted (schema-parsed) props
  component: React.FC<never>;
  parse: (props: unknown) => object;
}
const CARDS: Record<Exclude<CardId, ExtraCardId | MagicCardId | LottieCardId>, CardEntry> = {
  "onda.card.bento-grid": { component: BentoGrid as React.FC<never>, parse: (p) => bentoGridSchema.parse(p) },
  "onda.card.pricing-card": { component: PricingCard as React.FC<never>, parse: (p) => pricingCardSchema.parse(p) },
  "onda.card.skeleton-card": { component: SkeletonCard as React.FC<never>, parse: (p) => skeletonCardSchema.parse(p) },
  "onda.card.spotlight-card": { component: SpotlightCard as React.FC<never>, parse: (p) => spotlightCardSchema.parse(p) },
};

// the Onda components the other cards are built from (runtime/cards-extra.ts), by slug
const PARTS: Record<string, CardEntry> = {
  "blur-reveal": { component: BlurReveal as React.FC<never>, parse: (p) => blurRevealSchema.parse(p) },
  "bounding-box": { component: BoundingBox as React.FC<never>, parse: (p) => boundingBoxSchema.parse(p) },
  "button": { component: Button as React.FC<never>, parse: (p) => buttonSchema.parse(p) },
  "callout": { component: Callout as React.FC<never>, parse: (p) => calloutSchema.parse(p) },
  "captions": { component: Captions as React.FC<never>, parse: (p) => captionsSchema.parse(p) },
  "chapter-card": { component: ChapterCard as React.FC<never>, parse: (p) => chapterCardSchema.parse(p) },
  "code-block": { component: CodeBlock as React.FC<never>, parse: (p) => codeBlockSchema.parse(p) },
  "code-diff": { component: CodeDiff as React.FC<never>, parse: (p) => codeDiffSchema.parse(p) },
  "confetti": { component: Confetti as React.FC<never>, parse: (p) => confettiSchema.parse(p) },
  "count-up": { component: CountUp as React.FC<never>, parse: (p) => countUpSchema.parse(p) },
  "cursor": { component: Cursor as React.FC<never>, parse: (p) => cursorSchema.parse(p) },
  "draw-on": { component: DrawOn as React.FC<never>, parse: (p) => drawOnSchema.parse(p) },
  "dynamic-grid": { component: DynamicGrid as React.FC<never>, parse: (p) => dynamicGridSchema.parse(p) },
  "end-card": { component: EndCard as React.FC<never>, parse: (p) => endCardSchema.parse(p) },
  "fade-in": { component: FadeIn as React.FC<never>, parse: (p) => fadeInSchema.parse(p) },
  "fade-out": { component: FadeOut as React.FC<never>, parse: (p) => fadeOutSchema.parse(p) },
  "gradient-shift": { component: GradientShift as React.FC<never>, parse: (p) => gradientShiftSchema.parse(p) },
  "grain-overlay": { component: GrainOverlay as React.FC<never>, parse: (p) => grainOverlaySchema.parse(p) },
  "highlight": { component: Highlight as React.FC<never>, parse: (p) => highlightSchema.parse(p) },
  "icon-pop": { component: IconPop as React.FC<never>, parse: (p) => iconPopSchema.parse(p) },
  "input-field": { component: InputField as React.FC<never>, parse: (p) => inputFieldSchema.parse(p) },
  "kanban-board": { component: KanbanBoard as React.FC<never>, parse: (p) => kanbanBoardSchema.parse(p) },
  "logo-sting": { component: LogoSting as React.FC<never>, parse: (p) => logoStingSchema.parse(p) },
  "lower-third": { component: LowerThird as React.FC<never>, parse: (p) => lowerThirdSchema.parse(p) },
  "marquee": { component: Marquee as React.FC<never>, parse: (p) => marqueeSchema.parse(p) },
  "mask-reveal": { component: MaskReveal as React.FC<never>, parse: (p) => maskRevealSchema.parse(p) },
  "matrix-decode": { component: MatrixDecode as React.FC<never>, parse: (p) => matrixDecodeSchema.parse(p) },
  "mesh-gradient": { component: MeshGradient as React.FC<never>, parse: (p) => meshGradientSchema.parse(p) },
  "node-graph": { component: NodeGraph as React.FC<never>, parse: (p) => nodeGraphSchema.parse(p) },
  "progress-steps": { component: ProgressSteps as React.FC<never>, parse: (p) => progressStepsSchema.parse(p) },
  "pulsing-indicator": { component: PulsingIndicator as React.FC<never>, parse: (p) => pulsingIndicatorSchema.parse(p) },
  "quote-card": { component: QuoteCard as React.FC<never>, parse: (p) => quoteCardSchema.parse(p) },
  "rgb-glitch-text": { component: RgbGlitchText as React.FC<never>, parse: (p) => rgbGlitchTextSchema.parse(p) },
  "rotate-in": { component: RotateIn as React.FC<never>, parse: (p) => rotateInSchema.parse(p) },
  "scale-in": { component: ScaleIn as React.FC<never>, parse: (p) => scaleInSchema.parse(p) },
  "shimmer-sweep": { component: ShimmerSweep as React.FC<never>, parse: (p) => shimmerSweepSchema.parse(p) },
  "slide-in": { component: SlideIn as React.FC<never>, parse: (p) => slideInSchema.parse(p) },
  "slide-out": { component: SlideOut as React.FC<never>, parse: (p) => slideOutSchema.parse(p) },
  "slot-machine-roll": { component: SlotMachineRoll as React.FC<never>, parse: (p) => slotMachineRollSchema.parse(p) },
  "spotlight": { component: Spotlight as React.FC<never>, parse: (p) => spotlightSchema.parse(p) },
  "stagger-group": { component: StaggerGroup as React.FC<never>, parse: (p) => staggerGroupSchema.parse(p) },
  "stat-card": { component: StatCard as React.FC<never>, parse: (p) => statCardSchema.parse(p) },
  "terminal": { component: Terminal as React.FC<never>, parse: (p) => terminalSchema.parse(p) },
  "text-fade-replace": { component: TextFadeReplace as React.FC<never>, parse: (p) => textFadeReplaceSchema.parse(p) },
  "timeline": { component: Timeline as React.FC<never>, parse: (p) => timelineSchema.parse(p) },
  "tracking-in": { component: TrackingIn as React.FC<never>, parse: (p) => trackingInSchema.parse(p) },
  "typewriter": { component: Typewriter as React.FC<never>, parse: (p) => typewriterSchema.parse(p) },
  "underline": { component: Underline as React.FC<never>, parse: (p) => underlineSchema.parse(p) },
  "vignette": { component: Vignette as React.FC<never>, parse: (p) => vignetteSchema.parse(p) },
  "word-rotate": { component: WordRotate as React.FC<never>, parse: (p) => wordRotateSchema.parse(p) },
  "word-stagger": { component: WordStagger as React.FC<never>, parse: (p) => wordStaggerSchema.parse(p) },
};

// ───────────── charts: Onda's data charts drawn from the slide's numbers, plus the words a slide needs ─────────────
// (Onda's bar chart has labels but no values, its line chart neither: values and labels are laid out on Onda's geometry.)

interface Point {
  label: string;
  /** the value as written on the slide, e.g. "$4.2M" */
  text: string;
  value: number;
}
interface ChartData {
  points: Point[];
  max: number;
  /** largest value not written as a percentage (what non-% values are compared with) */
  maxOther: number;
  /** every value reads as a plain percentage (0-100, no currency or unit) */
  percent: boolean;
}

function chartData(spec: SlideSpec): ChartData {
  const points = (spec.stats ?? []).slice(0, 6).map((st) => {
    const n = parseNumber(st.value);
    return { label: st.label, text: st.value, value: n.ok ? Math.abs(n.value) : 0 };
  });
  return {
    points,
    max: Math.max(1, ...points.map((p) => p.value)),
    maxOther: Math.max(1, ...points.filter((p) => !p.text.includes("%")).map((p) => p.value)),
    percent: points.length > 0 && points.every((p) => p.value <= 100 && !/[$€£₹¥]|\d\s*[a-zA-Z]/.test(p.text)),
  };
}
/** a whole-number percentage that Onda's own "N%" label shows exactly */
const plainPct = (text: string) => /^\d{1,3}\s?%$/.test(text.trim());
/** ring/bar fill: percentages fill to themselves, other values relative to the largest non-% value */
const pctOf = (d: ChartData, p: Point) => clamp(d.percent || p.text.includes("%") ? p.value : (p.value / d.maxOther) * 100, 0, 100);
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

interface ChartProps {
  d: ChartData;
  portrait: boolean;
}

/** Onda BarChart + each value at the end of its bar. */
const BarBlock: React.FC<ChartProps> = ({ d, portrait }) => {
  const frame = useCurrentFrame();
  const W = portrait ? 900 : 1240;
  const barHeight = portrait ? 44 : 36;
  const gap = portrait ? 32 : 22;
  const fontSize = portrait ? 30 : 26;
  // Onda's chart spans the middle 80%; labels sit in its label column, so keep them on one line
  const labelWidth = Math.round(Math.min(W * 0.8 * 0.45, Math.max(140, Math.max(...d.points.map((p) => p.label.length)) * fontSize * 0.55)));
  const maxChars = Math.floor(labelWidth / (fontSize * 0.55));
  const props = barChartSchema.parse({ data: d.points.map((p) => ({ label: truncate(p.label, maxChars), value: p.value })), max: d.max, barHeight, gap, fontSize, labelWidth });
  return (
    <div style={{ position: "relative", width: W }}>
      <BarChart {...props} />
      <div style={{ position: "absolute", top: 0, left: W * 0.9 + 16, display: "flex", flexDirection: "column", gap }}>
        {d.points.map((p, i) => (
          <div
            key={i}
            style={{
              height: barHeight,
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              fontFamily: DISPLAY,
              fontSize,
              fontWeight: 600,
              color: TEXT,
              fontVariantNumeric: "tabular-nums",
              opacity: interpolate(frame - (props.delay + i * props.stagger), [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {p.text}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Onda LineChart + each value above its point and its label below, appearing as the line reaches them. */
const LineBlock: React.FC<ChartProps> = ({ d, portrait }) => {
  const W = portrait ? 900 : 1200;
  const H = portrait ? 720 : 440;
  const props = lineChartSchema.parse({ data: d.points.map((p) => p.value), width: W, height: H });
  const progress = useSceneProgress({ delay: props.delay, durationInFrames: props.duration, eased: true });
  // the same geometry as Onda's LineChart
  const padX = 24;
  const padTop = 24;
  const innerW = W - padX * 2;
  const innerH = H - padTop - 32;
  const n = d.points.length;
  const vals = d.points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const xAt = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => padTop + (hi === lo ? innerH / 2 : (1 - (v - lo) / (hi - lo)) * innerH);
  const TOP = 56; // room for the highest value
  return (
    <div style={{ position: "relative", width: W, height: H + TOP + 48 }}>
      <div style={{ position: "absolute", top: TOP, left: 0 }}>
        <LineChart {...props} />
      </div>
      {d.points.map((p, i) => {
        const at = n <= 1 ? 0 : i / (n - 1);
        const o = clamp((progress - at) / 0.06 + 1);
        const common = { position: "absolute" as const, left: xAt(i), transform: "translateX(-50%)", whiteSpace: "nowrap" as const, opacity: o };
        return (
          <React.Fragment key={i}>
            <div style={{ ...common, top: TOP + yAt(p.value) - 46, fontFamily: DISPLAY, fontSize: 28, fontWeight: 600, color: TEXT }}>{p.text}</div>
            <div style={{ ...common, top: TOP + H - 4, fontFamily: BODY, fontSize: 22, color: DIM }}>{truncate(p.label, 22)}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** One Onda PieReveal ring per number, its label underneath. */
const PieBlock: React.FC<ChartProps> = ({ d, portrait }) => {
  const frame = useCurrentFrame();
  const radius = d.points.length > 3 || portrait ? 104 : 124;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 56, maxWidth: portrait ? 900 : 1500 }}>
      {d.points.map((p, i) => {
        const own = d.percent && plainPct(p.text);
        const props = pieRevealSchema.parse({ value: pctOf(d, p), delay: i * 6, radius, strokeWidth: 16, showValue: own, fontSize: 52 });
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: radius * 2 + 60 }}>
            {/* PieReveal fills its positioned parent (AbsoluteFill), so the parent gets the ring's size */}
            <div style={{ position: "relative", width: props.radius * 2 + props.strokeWidth * 2, height: props.radius * 2 + props.strokeWidth * 2 }}>
              <PieReveal {...props} />
              {!own && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: DISPLAY,
                    fontSize: p.text.length > 5 ? 36 : 46,
                    fontWeight: 600,
                    color: TEXT,
                    opacity: interpolate(frame - i * 6, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  }}
                >
                  {p.text}
                </div>
              )}
            </div>
            <div style={{ fontFamily: BODY, fontSize: 24, lineHeight: 1.3, color: DIM, textAlign: "center" }}>{p.label}</div>
          </div>
        );
      })}
    </div>
  );
};

/** One Onda ProgressBar per number, with its label (and the value, when it isn't a plain percentage) above. */
const ProgressBlock: React.FC<ChartProps> = ({ d, portrait }) => {
  const W = portrait ? 1000 : 1000; // Onda's bar takes 80% of this, capped at 800
  return (
    <div style={{ width: W, display: "flex", flexDirection: "column", gap: 36 }}>
      {d.points.map((p, i) => {
        const own = d.percent && plainPct(p.text);
        const props = progressBarSchema.parse({ value: pctOf(d, p), delay: i * 4, height: 18, fontSize: 30, showValue: own });
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ width: "80%", maxWidth: 800, marginInline: "auto", display: "flex", justifyContent: "space-between", gap: 24, fontFamily: BODY, fontSize: 26, color: TEXT }}>
              <span>{p.label}</span>
              {!own && <span style={{ fontFamily: DISPLAY, fontWeight: 600 }}>{p.text}</span>}
            </div>
            <ProgressBar {...props} />
          </div>
        );
      })}
    </div>
  );
};

const CHARTS: Record<ChartId, React.FC<ChartProps>> = {
  "onda.chart.bar-chart": BarBlock,
  "onda.chart.line-chart": LineBlock,
  "onda.chart.pie-reveal": PieBlock,
  "onda.chart.progress-bar": ProgressBlock,
};

/** largest zoom over Onda's native (1080p) size */
const MAX_SCALE: Partial<Record<OndaId, number>> = {
  "onda.card.bento-grid": 1.4,
  "onda.card.pricing-card": 1.35,
  "onda.card.skeleton-card": 1.4,
  "onda.card.spotlight-card": 1.6,
  "onda.chart.bar-chart": 1.3,
  "onda.chart.line-chart": 1.3,
  "onda.chart.pie-reveal": 1.4,
  "onda.chart.progress-bar": 1.3,
};

/** Onda's colour/font slots follow the slide theme. Onda's glass is always dark, so light themes keep Onda's own text colours. */
function themeVars(theme: Theme): React.CSSProperties {
  const hex = theme.bg.replace("#", "");
  const lum = hex.length === 6 ? (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) / 255 : 0;
  const vars: Record<string, string> = {
    "--onda-accent": theme.accent,
    "--onda-accent-soft": `color-mix(in srgb, ${theme.accent} 25%, transparent)`,
    "--onda-font-display": theme.display,
    "--onda-font-body": theme.body,
  };
  if (lum < 0.5) {
    Object.assign(vars, {
      "--onda-text": theme.text,
      "--onda-dim": theme.muted,
      "--onda-faint": `color-mix(in srgb, ${theme.muted} 70%, transparent)`,
      "--onda-bg": theme.bg,
    });
  } else {
    // charts sit on the slide itself (no glass): use the theme's dark text and a visible track
    Object.assign(vars, {
      "--onda-border": `color-mix(in srgb, ${theme.text} 14%, transparent)`,
      "--onda-border-lit": `color-mix(in srgb, ${theme.text} 18%, transparent)`,
    });
  }
  return vars as React.CSSProperties;
}

/** The other cards: their Onda parts in groups (side by side or stacked), or full-frame ones in a framed panel. */
const PartsBlock: React.FC<{ parts: CardPart[]; layout: CardLayout; words: { title: string; subtitle: string } }> = ({ parts, layout, words }) => {
  const groups: CardPart[][] = [];
  parts.forEach((p) => {
    const g = p.group ?? 0;
    (groups[g] ??= []).push(p);
  });
  const draw = (p: CardPart, i: number) => {
    const Comp = PARTS[p.use].component as React.FC<object>;
    return <Comp key={i} {...p.props} />;
  };
  const stacks = groups.filter(Boolean).map((g, i) => (
    <div key={i} style={{ display: "flex", flexDirection: layout.inner ?? "column", alignItems: "center", gap: layout.inner === "row" ? 28 : 20, maxWidth: layout.width ?? 1500, width: layout.width }}>
      {g.map(draw)}
    </div>
  ));
  if (!layout.panel) {
    return <div style={{ display: "flex", flexDirection: layout.direction, alignItems: layout.inner === "row" ? "flex-start" : "center", gap: 48 }}>{stacks}</div>;
  }
  // full-frame components fill a framed panel; the slide's title sits in the middle, in front of or behind them
  const title = layout.overlay ? (
    <AbsoluteFill key="words" style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24, padding: 96, textAlign: "center" }}>
      <BlurReveal {...blurRevealSchema.parse({ text: words.title, fontSize: words.title.length > 40 ? 72 : 92, align: "center", textWrap: "balance" })} />
      {words.subtitle && <FadeIn {...fadeInSchema.parse({ text: words.subtitle, fontSize: 38, color: DIM, delay: 14, align: "center", fontFamily: BODY })} />}
    </AbsoluteFill>
  ) : null;
  const comp = <AbsoluteFill key="comp">{parts.map(draw)}</AbsoluteFill>;
  return (
    <div style={{ position: "relative", width: layout.panel.width, height: layout.panel.height, borderRadius: 28, overflow: "hidden" }}>
      {layout.overlay === "front" ? [comp, title] : [title, comp]}
    </div>
  );
};

interface SceneProps extends Record<string, unknown> {
  id: OndaId;
  cards: object[];
  /** the other cards (runtime/cards-extra.ts): parsed parts and how they sit */
  parts: CardPart[];
  layout: CardLayout | null;
  /** the slide's title and subtitle, for panel cards that show them over / under the component */
  words: { title: string; subtitle: string };
  chart: ChartData | null;
  portrait: boolean;
  scale: number;
  vars: React.CSSProperties;
  light: boolean;
}

/** The composition: the component(s), centred and zoomed to fit the slot the slide gave them. */
const OndaScene: React.FC<SceneProps> = ({ id, cards, parts, layout, words, chart, portrait, scale, vars, light }) => {
  let body: React.ReactNode;
  if (isExtraCardId(id) && layout) {
    body = <PartsBlock parts={parts} layout={layout} words={words} />;
  } else if (isCardId(id)) {
    const Comp = CARDS[id as Exclude<CardId, ExtraCardId | MagicCardId | LottieCardId>].component as React.FC<object>;
    body = cards.map((p, i) => <Comp key={i} {...p} />);
  } else {
    const Chart = CHARTS[id];
    // on light themes the chart's words use the slide's own text colours
    body = <div style={light ? ({ "--onda-text": "var(--pm-text)", "--onda-dim": "var(--pm-muted)" } as React.CSSProperties) : undefined}>{chart && <Chart d={chart} portrait={portrait} />}</div>;
  }
  return (
    <AbsoluteFill style={{ ...vars, alignItems: "center", justifyContent: "center" }}>
      <div
        data-onda-fit=""
        // the other cards are measured at their natural width (a row of stat cards can be wider than the slot)
        style={{ display: "flex", gap: 32, alignItems: "center", transform: `scale(${scale})`, transformOrigin: "50% 50%", ...(isExtraCardId(id) ? { width: "max-content", flexShrink: 0 } : {}) }}
      >
        {body}
      </div>
    </AbsoluteFill>
  );
};

/** Mount an Onda card or chart into `host` (sized by the slide's CSS). Returns a seek(t) driven by the slide's clock. */
function mount(host: HTMLElement, o: OndaMountOptions): (t: number) => void {
  const w = Math.max(1, host.offsetWidth);
  const h = Math.max(1, host.offsetHeight);
  const extra = isExtraCardId(o.id) ? o.id : null;
  const cards = isCardId(o.id) && !extra ? cardProps(o.id, o.spec, { portrait: o.portrait }).map((p) => CARDS[o.id as Exclude<CardId, ExtraCardId | MagicCardId | LottieCardId>].parse(p)) : [];
  const partOpts = { portrait: o.portrait, duration: o.duration };
  const parts = extra ? extraCardParts(extra, o.spec, partOpts).map((p) => ({ ...p, props: PARTS[p.use].parse(p.props) as Record<string, unknown> })) : [];
  const layout = extra ? extraCardLayout(extra, o.spec, partOpts) : null;
  const words = { title: o.spec.title, subtitle: o.spec.subtitle || o.spec.body || "" };
  const chart = isCardId(o.id) ? null : chartData(o.spec);
  const vars = themeVars(o.theme);
  const light = !("--onda-text" in vars);
  const durationInFrames = Math.max(1, Math.ceil((o.duration + 2) * FPS));
  const root = createRoot(host);
  let scale = 1;
  let fitted = false;
  let last = -1;

  const draw = (frame: number) =>
    flushSync(() =>
      root.render(
        <Thumbnail
          component={OndaScene}
          inputProps={{ id: o.id, cards, parts, layout, words, chart, portrait: o.portrait, scale, vars, light }}
          compositionWidth={w}
          compositionHeight={h}
          durationInFrames={durationInFrames}
          fps={FPS}
          frameToDisplay={frame}
          style={{ width: w, height: h }}
        />,
      ),
    );
  // zoom to fill the slot without overflowing (layout size, so entrance transforms don't matter)
  const fit = () => {
    const el = host.querySelector<HTMLElement>("[data-onda-fit]");
    if (!el || !el.offsetWidth || !el.offsetHeight) return false;
    // the other cards can hold one-line text wider than its box (e.g. matrix decode): fit what is drawn
    const ew = extra ? Math.max(el.offsetWidth, el.scrollWidth) : el.offsetWidth;
    const eh = extra ? Math.max(el.offsetHeight, el.scrollHeight) : el.offsetHeight;
    scale = Math.min(MAX_SCALE[o.id] ?? 1.5, (w * 0.96) / ew, (h * 0.96) / eh);
    return true;
  };

  return (t: number) => {
    const frame = Math.min(durationInFrames - 1, Math.max(0, Math.round(t * FPS)));
    if (frame === last && fitted) return;
    draw(frame);
    if (!fitted && fit()) {
      fitted = true;
      draw(frame);
    }
    last = frame;
  };
}

window.PromptMotionOnda = { version: "0.9.2", ids: ONDA_IDS, mount };
