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
import { ONDA_IDS, cardProps, isCardId, type CardId, type ChartId, type OndaId, type OndaMountOptions } from "../cards";
import { parseNumber } from "../dom";
import type { SlideSpec } from "../types";
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
const CARDS: Record<CardId, CardEntry> = {
  "onda.card.bento-grid": { component: BentoGrid as React.FC<never>, parse: (p) => bentoGridSchema.parse(p) },
  "onda.card.pricing-card": { component: PricingCard as React.FC<never>, parse: (p) => pricingCardSchema.parse(p) },
  "onda.card.skeleton-card": { component: SkeletonCard as React.FC<never>, parse: (p) => skeletonCardSchema.parse(p) },
  "onda.card.spotlight-card": { component: SpotlightCard as React.FC<never>, parse: (p) => spotlightCardSchema.parse(p) },
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
const MAX_SCALE: Record<OndaId, number> = {
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

interface SceneProps extends Record<string, unknown> {
  id: OndaId;
  cards: object[];
  chart: ChartData | null;
  portrait: boolean;
  scale: number;
  vars: React.CSSProperties;
  light: boolean;
}

/** The composition: the component(s), centred and zoomed to fit the slot the slide gave them. */
const OndaScene: React.FC<SceneProps> = ({ id, cards, chart, portrait, scale, vars, light }) => {
  let body: React.ReactNode;
  if (isCardId(id)) {
    const Comp = CARDS[id].component as React.FC<object>;
    body = cards.map((p, i) => <Comp key={i} {...p} />);
  } else {
    const Chart = CHARTS[id];
    // on light themes the chart's words use the slide's own text colours
    body = <div style={light ? ({ "--onda-text": "var(--pm-text)", "--onda-dim": "var(--pm-muted)" } as React.CSSProperties) : undefined}>{chart && <Chart d={chart} portrait={portrait} />}</div>;
  }
  return (
    <AbsoluteFill style={{ ...vars, alignItems: "center", justifyContent: "center" }}>
      <div data-onda-fit="" style={{ display: "flex", gap: 32, alignItems: "center", transform: `scale(${scale})`, transformOrigin: "50% 50%" }}>
        {body}
      </div>
    </AbsoluteFill>
  );
};

/** Mount an Onda card or chart into `host` (sized by the slide's CSS). Returns a seek(t) driven by the slide's clock. */
function mount(host: HTMLElement, o: OndaMountOptions): (t: number) => void {
  const w = Math.max(1, host.offsetWidth);
  const h = Math.max(1, host.offsetHeight);
  const cards = isCardId(o.id) ? cardProps(o.id, o.spec, { portrait: o.portrait }).map((p) => CARDS[o.id as CardId].parse(p)) : [];
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
          inputProps={{ id: o.id, cards, chart, portrait: o.portrait, scale, vars, light }}
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
    scale = Math.min(MAX_SCALE[o.id], (w * 0.96) / el.offsetWidth, (h * 0.96) / el.offsetHeight);
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
