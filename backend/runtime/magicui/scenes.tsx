// What each Magic UI card draws: the component (from its module `M`, passed in by its bundle) filled with the slide's
// words. Imports no Magic UI module itself, so each component bundle (scripts/build-magicui.mjs) stays small.
// Colours and fonts come from the slide theme through CSS variables set by the host (--mu-*).
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import type { SlideSpec } from "../types";

type Content = Pick<SlideSpec, "title" | "subtitle" | "body" | "bullets" | "items" | "stats" | "image">;
export interface SceneOpts {
  portrait: boolean;
  /** scene length in seconds */
  duration: number;
}
/** what to draw: `panel` = a framed full-frame scene (backgrounds) with the slide's title in front of / behind it */
export interface Scene {
  el: React.ReactNode;
  panel?: boolean;
  overlay?: "front" | "back";
  /** largest zoom over the natural size (small things like buttons may grow more) */
  maxScale?: number;
}
type Builder = (M: any, s: Content, o: SceneOpts) => Scene;

// ───────────── the slide's words ─────────────

const TEXT = "var(--mu-text)";
const MUTED = "var(--mu-muted)";
const ACCENT = "var(--mu-accent)";
const ACCENT2 = "var(--mu-accent2)";
const SURFACE = "var(--mu-surface)";
const DISPLAY = "var(--mu-display)";
/** literal colours for components that draw on a canvas / need real colour values (set by the host from the theme) */
export interface Palette {
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  bg: string;
}
let P: Palette = { text: "#f5f7ff", muted: "#9aa3c7", accent: "#7c5cff", accent2: "#22d3ee", bg: "#07080f" };
export const setPalette = (p: Palette) => (P = p);

function list(s: Content): string[] {
  if (s.bullets?.length) return s.bullets;
  if (s.items?.length) return s.items.map((it) => it.heading || it.text).filter(Boolean);
  if (s.stats?.length) return s.stats.map((st) => `${st.value} ${st.label}`.trim());
  return [];
}
const orWords = (s: Content, n = 6) => (list(s).length ? list(s) : s.title.split(/\s+/)).slice(0, n);
const line = (s: Content) => s.subtitle || s.body || "";
const titleSize = (s: Content) => (s.title.length > 40 ? 72 : s.title.length > 24 ? 88 : 104);
const titleStyle = (s: Content): React.CSSProperties => ({ fontFamily: DISPLAY, fontSize: titleSize(s), fontWeight: 700, lineHeight: 1.1, color: TEXT, textAlign: "center", textWrap: "balance", margin: 0 });

function number(text: string): { prefix: string; value: number; decimals: number; suffix: string } {
  const m = text.match(/^(.*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return { prefix: "", value: 0, decimals: 0, suffix: text };
  const raw = m[2].replace(/,/g, "");
  return { prefix: m[1].trim(), value: Number(raw), decimals: raw.includes(".") ? raw.split(".")[1].length : 0, suffix: m[3].trim() };
}
const stats = (s: Content) => (s.stats?.length ? s.stats : [{ value: s.title.match(/\d[\d,.]*%?/)?.[0] ?? "100", label: line(s) || s.title }]).slice(0, 4);

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
/** a square tile with the word's first letter (icons, avatars) */
function tile(word: string, i = 0): string {
  const c = i % 2 ? P.accent2 : P.accent;
  const letter = esc((word.trim()[0] ?? "•").toUpperCase());
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${c}"/><text x="64" y="84" font-family="system-ui,sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="${P.bg}">${letter}</text></svg>`,
  );
}
/** the slide's picture, or a gradient card with its title (device frames, image effects) */
function picture(s: Content, w = 1200, h = 750): string {
  if (s.image && !/\.(mp4|webm|mov)(\?|$)/i.test(s.image)) return s.image;
  const words = esc(s.title.length > 34 ? s.title.slice(0, 33) + "…" : s.title);
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.accent}"/><stop offset="1" stop-color="${P.accent2}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="${w / 2}" y="${h / 2 + 22}" font-family="system-ui,sans-serif" font-size="${Math.round(w / 18)}" font-weight="700" text-anchor="middle" fill="${P.bg}">${words}</text></svg>`,
  );
}

const Title: React.FC<{ s: Content }> = ({ s }) => <h2 style={titleStyle(s)}>{s.title}</h2>;
const Sub: React.FC<{ s: Content; delay?: number }> = ({ s }) =>
  line(s) ? <p style={{ fontSize: 38, color: MUTED, margin: 0, textAlign: "center", maxWidth: 1300, lineHeight: 1.35 }}>{line(s)}</p> : null;
const column = (...nodes: React.ReactNode[]) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, maxWidth: 1500 }}>{nodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}</div>
);
/** the slide's title (by a text effect) with its subtitle */
const titled = (node: React.ReactNode, s: Content): Scene => ({ el: column(node, <Sub s={s} />) });
/** a glass card with the slide's title and subtitle, for card effects */
const CardBody: React.FC<{ s: Content }> = ({ s }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "64px 80px", maxWidth: 1200 }}>
    <h2 style={{ ...titleStyle(s), fontSize: Math.min(84, titleSize(s)) }}>{s.title}</h2>
    <Sub s={s} />
  </div>
);
const cardBox: React.CSSProperties = { position: "relative", overflow: "hidden", borderRadius: 32, background: SURFACE, border: "1px solid var(--border)" };
/** the button label: a short first bullet, else "Get started" */
const label = (s: Content) => (s.bullets?.[0] && s.bullets[0].length <= 24 ? s.bullets[0] : "Get started");
const bigButton = "text-3xl font-semibold px-12 py-6 rounded-full";
/** a full-frame background (absolutely filling the panel) */
const backdrop = (node: React.ReactNode, overlay: Scene["overlay"] = "front"): Scene => ({ el: node, panel: true, overlay });

/** grows from 0 to the value after mount (components that only animate on change) */
function useRise(value: number, delay = 150) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
const Gauge: React.FC<{ M: any; value: number; delay: number }> = ({ M, value, delay }) => {
  const v = useRise(value, delay);
  return <M.AnimatedCircularProgressBar value={v} min={0} max={100} gaugePrimaryColor={P.accent} gaugeSecondaryColor="rgba(255,255,255,0.12)" className="size-56 text-5xl" />;
};

/** circles for the slide's list, each with a beam into a hub holding the title's first word */
const BeamDiagram: React.FC<{ M: any; s: Content }> = ({ M, s }) => {
  const box = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const out = useRef<HTMLDivElement>(null);
  const words = orWords(s, 4);
  // one stable ref per list node (created once)
  const [refs] = useState(() => words.map(() => React.createRef<HTMLDivElement>()));
  const node = (w: string, i: number, ref: React.RefObject<HTMLDivElement | null>, big = false) => (
    <div
      key={i}
      ref={ref}
      style={{ zIndex: 1, display: "flex", alignItems: "center", gap: 14, padding: big ? "22px 34px" : "14px 22px", borderRadius: 999, background: big ? ACCENT : "var(--mu-card)", border: "1px solid var(--border)", color: big ? "var(--mu-bg)" : TEXT, fontSize: big ? 34 : 26, fontWeight: 600, whiteSpace: "nowrap" }}
    >
      {w}
    </div>
  );
  return (
    <div ref={box} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", width: 1300, height: 520, padding: 40 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>{words.map((w, i) => node(w, i, refs[i]))}</div>
      {node(s.title.split(/\s+/)[0], 9, hub, true)}
      {node(s.subtitle && s.subtitle.length <= 22 ? s.subtitle : "→", 10, out)}
      {refs.map((r, i) => (
        <M.AnimatedBeam key={i} containerRef={box} fromRef={r} toRef={hub} curvature={(i - (refs.length - 1) / 2) * 40} gradientStartColor={P.accent} gradientStopColor={P.accent2} delay={i * 0.3} />
      ))}
      <M.AnimatedBeam containerRef={box} fromRef={hub} toRef={out} gradientStartColor={P.accent} gradientStopColor={P.accent2} />
    </div>
  );
};

// ───────────── each card ─────────────

export const SCENES: Record<string, Builder> = {
  // text effects: the title, the subtitle under it
  "animated-gradient-text": (M, s) =>
    titled(<M.AnimatedGradientText colorFrom={P.accent} colorTo={P.accent2} speed={1} style={titleStyle(s)}>{s.title}</M.AnimatedGradientText>, s),
  "animated-shiny-text": (M, s) => titled(<M.AnimatedShinyText shimmerWidth={260} className="!max-w-none" style={{ ...titleStyle(s), color: undefined }}>{s.title}</M.AnimatedShinyText>, s),
  "aurora-text": (M, s) => titled(<h2 style={titleStyle(s)}><M.AuroraText colors={[P.accent, P.accent2, P.text, P.accent]}>{s.title}</M.AuroraText></h2>, s),
  "comic-text": (M, s) => titled(<M.ComicText fontSize={s.title.length > 30 ? 3.6 : 5}>{s.title}</M.ComicText>, s),
  "dia-text-reveal": (M, s) => titled(<M.DiaTextReveal text={s.title} colors={[P.accent, P.accent2, P.text]} textColor={P.text} startOnView={false} style={titleStyle(s)} />, s),
  "hyper-text": (M, s) => titled(<M.HyperText startOnView={false} animateOnHover={false} duration={1200} style={titleStyle(s)}>{s.title}</M.HyperText>, s),
  "kinetic-text": (M, s) => titled(<M.KineticText text={s.title} style={titleStyle(s)} />, s),
  "line-shadow-text": (M, s) => titled(<h2 style={{ ...titleStyle(s), fontStyle: "italic" }}><M.LineShadowText shadowColor={P.accent}>{s.title}</M.LineShadowText></h2>, s),
  "morphing-text": (M, s) => titled(<M.MorphingText texts={[s.title, ...list(s)].slice(0, 5)} className="!h-32 !max-w-[1500px] !text-[88px]" />, s),
  "sparkles-text": (M, s) => titled(<M.SparklesText colors={{ first: P.accent, second: P.accent2 }} style={titleStyle(s)}>{s.title}</M.SparklesText>, s),
  "spinning-text": (M, s) => ({
    el: column(
      <div style={{ position: "relative", width: 520, height: 520, display: "grid", placeItems: "center" }}>
        <M.SpinningText radius={9} duration={14} className="text-[30px] font-semibold uppercase tracking-[0.2em]">{`${s.title.slice(0, 36)} • `}</M.SpinningText>
        <div style={{ position: "absolute", fontFamily: DISPLAY, fontSize: 96, fontWeight: 700, color: ACCENT }}>{(s.title.trim()[0] ?? "").toUpperCase()}</div>
      </div>,
      <Sub s={s} />,
    ),
  }),
  "text-3d-flip": (M, s) => titled(<M.default style={titleStyle(s)}>{s.title}</M.default>, s),
  "text-animate": (M, s) => titled(<M.TextAnimate animation="blurInUp" by="word" startOnView={false} once style={titleStyle(s)}>{s.title}</M.TextAnimate>, s),
  "typing-animation": (M, s) => titled(<M.TypingAnimation startOnView={false} typeSpeed={60} style={titleStyle(s)}>{s.title}</M.TypingAnimation>, s),
  highlighter: (M, s) => {
    const words = s.title.split(/\s+/);
    const cut = Math.max(1, words.length - 2);
    return titled(
      <h2 style={titleStyle(s)}>
        {words.slice(0, cut).join(" ")}{" "}
        <M.Highlighter action="highlight" color={`${P.accent}66`} isView={false} animationDuration={900}>
          {words.slice(cut).join(" ")}
        </M.Highlighter>
      </h2>,
      s,
    );
  },

  // card effects: a card holding the title and subtitle
  "neon-gradient-card": (M, s) => ({ el: <M.NeonGradientCard neonColors={{ firstColor: P.accent, secondColor: P.accent2 }} className="max-w-[1200px]"><CardBody s={s} /></M.NeonGradientCard> }),
  "shine-border": (M, s) => ({ el: <div style={cardBox}><M.ShineBorder shineColor={[P.accent, P.accent2, P.text]} borderWidth={3} duration={10} /><CardBody s={s} /></div> }),
  "border-beam": (M, s) => ({ el: <div style={cardBox}><CardBody s={s} /><M.BorderBeam size={260} duration={6} colorFrom={P.accent} colorTo={P.accent2} borderWidth={3} /></div> }),
  backlight: (M, s) => ({
    el: (
      <M.Backlight blur={40}>
        <div style={{ borderRadius: 32, background: `linear-gradient(135deg, ${P.accent}, ${P.accent2})`, color: P.bg }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "64px 80px", maxWidth: 1200 }}>
            <h2 style={{ ...titleStyle(s), color: P.bg, fontSize: Math.min(84, titleSize(s)) }}>{s.title}</h2>
            {line(s) && <p style={{ fontSize: 36, margin: 0, textAlign: "center", opacity: 0.8 }}>{line(s)}</p>}
          </div>
        </div>
      </M.Backlight>
    ),
  }),
  "glare-hover": (M, s) => ({ el: <M.GlareHover width="1200px" height="560px" background={P.bg} borderColor="rgba(255,255,255,0.15)" glareColor="#ffffff" playOnce={false}><CardBody s={s} /></M.GlareHover> }),
  "warp-background": (M, s) => ({ el: <M.WarpBackground className="rounded-3xl border-[var(--border)]"><div style={{ ...cardBox, background: "var(--mu-card)" }}><CardBody s={s} /></div></M.WarpBackground> }),
  "magic-card": (M, s) => {
    const cards = s.items?.length ? s.items.slice(0, 3).map((it) => ({ h: it.heading, t: it.text })) : orWords(s, 3).map((w) => ({ h: w, t: "" }));
    return {
      el: (
        <div style={{ display: "flex", gap: 32 }}>
          {cards.map((c, i) => (
            <M.MagicCard key={i} gradientFrom={P.accent} gradientTo={P.accent2} className="rounded-3xl">
              <div style={{ width: 400, minHeight: 260, padding: 40, display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, margin: 0, color: TEXT }}>{c.h}</h3>
                {c.t && <p style={{ fontSize: 26, margin: 0, color: MUTED, lineHeight: 1.4 }}>{c.t}</p>}
              </div>
            </M.MagicCard>
          ))}
        </div>
      ),
    };
  },

  // diagrams and motion around the title
  "orbiting-circles": (M, s) => {
    const words = orWords(s, 6);
    const icon = (w: string, i: number) => <img key={i} src={tile(w, i)} alt="" style={{ width: "100%", height: "100%", borderRadius: 16 }} />;
    return {
      el: column(
        <div style={{ position: "relative", width: 760, height: 760, display: "grid", placeItems: "center", overflow: "hidden" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 56, fontWeight: 700, color: TEXT, textAlign: "center", maxWidth: 360 }}>{s.title.split(/\s+/).slice(0, 2).join(" ")}</div>
          <M.OrbitingCircles iconSize={72} radius={320}>{words.map(icon)}</M.OrbitingCircles>
          <M.OrbitingCircles iconSize={48} radius={190} reverse speed={1.6}>{words.slice(0, 3).map((w, i) => icon(w, i + 1))}</M.OrbitingCircles>
        </div>,
      ),
    };
  },
  "animated-beam": (M, s) => ({ el: column(<Title s={s} />, <BeamDiagram M={M} s={s} />) }),
  "scroll-based-velocity": (M, s) => ({
    el: (
      <div style={{ width: 1700, overflow: "hidden", display: "flex", flexDirection: "column", gap: 20 }}>
        <M.ScrollVelocityContainer className="text-[96px] font-bold tracking-tight">
          <M.ScrollVelocityRow baseVelocity={6} direction={1}>
            <span style={{ fontFamily: DISPLAY, color: TEXT, paddingRight: 48 }}>{s.title} •</span>
          </M.ScrollVelocityRow>
          <M.ScrollVelocityRow baseVelocity={6} direction={-1}>
            <span style={{ fontFamily: DISPLAY, color: ACCENT, paddingRight: 48 }}>{(list(s).length ? list(s) : [line(s) || s.title]).join(" • ")} •</span>
          </M.ScrollVelocityRow>
        </M.ScrollVelocityContainer>
      </div>
    ),
  }),

  // backgrounds: a framed scene with the slide's title in the middle
  globe: (M) => backdrop(<div style={{ position: "absolute", left: "50%", top: "38%", width: 1000, transform: "translateX(-50%)", opacity: 0.9 }}><M.Globe className="!relative !inset-auto !max-w-none" config={globeConfig()} /></div>),
  "dotted-map": (M) => backdrop(<M.DottedMap width={160} height={80} className="absolute inset-0 size-full text-[var(--mu-accent)] opacity-90" />),
  particles: (M) => backdrop(<M.Particles className="absolute inset-0" quantity={240} ease={70} size={1.4} color={P.accent} refresh />),
  meteors: (M) => backdrop(<M.Meteors number={36} />),
  ripple: (M) => backdrop(<M.Ripple mainCircleSize={260} numCircles={8} />),
  "retro-grid": (M) => backdrop(<M.RetroGrid opacity={0.6} darkLineColor={P.accent} lightLineColor={P.accent} />),
  "flickering-grid": (M) => backdrop(<M.FlickeringGrid className="absolute inset-0 [mask-image:radial-gradient(700px_circle_at_center,white,transparent)]" squareSize={6} gridGap={8} color={P.accent} maxOpacity={0.7} flickerChance={0.15} />),
  "animated-grid-pattern": (M) =>
    backdrop(<M.AnimatedGridPattern numSquares={40} maxOpacity={0.35} duration={3} className="text-[var(--mu-accent)] [mask-image:radial-gradient(700px_circle_at_center,white,transparent)] inset-x-0 inset-y-[-30%] h-[160%] skew-y-12" />),
  "grid-pattern": (M) =>
    backdrop(<M.GridPattern squares={[[4, 4], [5, 1], [8, 2], [5, 3], [10, 10], [12, 15], [15, 10], [10, 15]]} className="text-[var(--mu-accent)] fill-[var(--mu-accent)]/20 stroke-[var(--mu-accent)]/30 [mask-image:radial-gradient(700px_circle_at_center,white,transparent)]" />),
  "dot-pattern": (M) => backdrop(<M.DotPattern glow className="text-[var(--mu-accent)] [mask-image:radial-gradient(700px_circle_at_center,white,transparent)]" />),
  "hexagon-pattern": (M) => backdrop(<M.HexagonPattern className="text-[var(--mu-accent)]/40 [mask-image:radial-gradient(700px_circle_at_center,white,transparent)]" />),
  "striped-pattern": (M) => backdrop(<M.StripedPattern className="text-[var(--mu-accent)]/40 [mask-image:radial-gradient(700px_circle_at_center,white,transparent)]" />),
  "interactive-grid-pattern": (M) => backdrop(<M.InteractiveGridPattern className="text-[var(--mu-accent)]/40 [mask-image:radial-gradient(700px_circle_at_center,white,transparent)] inset-x-0 inset-y-[-30%] h-[160%] skew-y-12" />),
  "noise-texture": (M) => backdrop(<div style={{ position: "absolute", inset: 0 }}><M.NoiseTexture noiseOpacity={0.5} /></div>, "back"),
  "light-rays": (M) => backdrop(<M.LightRays color={`${P.accent}55`} count={8} />),
  "floating-3d-particles": (M) => backdrop(<M.Floating3DParticles className="absolute inset-0" color={P.accent} quantity={140} />),
  "glyph-matrix": (M) => backdrop(<M.GlyphMatrix className="absolute inset-0 opacity-60" color={P.accent} />),
  dither: (M) => backdrop(<M.Dither className="absolute inset-0 opacity-70" colors={[P.bg, P.accent, P.accent2]} />),
  "progressive-blur": (M, s) =>
    backdrop(
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 18, paddingBottom: 40 }}>
        {orWords(s, 5).map((w, i) => (
          <div key={i} style={{ fontSize: 44, fontWeight: 600, color: TEXT }}>{w}</div>
        ))}
        <M.ProgressiveBlur position="bottom" height="45%" />
      </div>,
      "back",
    ),
  confetti: (M) => backdrop(<M.Confetti className="pointer-events-none absolute inset-0 size-full" options={{ particleCount: 160, spread: 100, origin: { y: 0.55 }, colors: [P.accent, P.accent2, P.text] }} />, "back"),

  // the slide's list or numbers, under the title
  "number-ticker": (M, s) => ({
    el: (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 72 }}>
        {stats(s).map((st, i) => {
          const n = number(st.value);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 120, fontWeight: 700, color: TEXT, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {n.prefix}
                <M.NumberTicker value={n.value} decimalPlaces={n.decimals} delay={0.15 + i * 0.15} className="!text-inherit tracking-tight" />
                {n.suffix}
              </div>
              <div style={{ fontSize: 32, color: MUTED }}>{st.label}</div>
            </div>
          );
        })}
      </div>
    ),
  }),
  "animated-circular-progress-bar": (M, s) => ({
    el: (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 64 }}>
        {stats(s).map((st, i, all) => {
          const n = number(st.value);
          const max = Math.max(...all.map((x) => number(x.value).value), 1);
          const pct = st.value.includes("%") || all.every((x) => number(x.value).value <= 100) ? n.value : (n.value / max) * 100;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <Gauge M={M} value={Math.round(Math.min(100, Math.max(0, pct)))} delay={150 + i * 200} />
              <div style={{ fontSize: 30, color: MUTED }}>{st.value} {st.label}</div>
            </div>
          );
        })}
      </div>
    ),
  }),
  "blur-fade": (M, s) => ({
    el: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 900 }}>
        {orWords(s, 6).map((w, i) => (
          <M.BlurFade key={i} delay={0.2 + i * 0.18} inView={false}>
            <div style={{ padding: "22px 34px", borderRadius: 24, background: SURFACE, border: "1px solid var(--border)", fontSize: 40, fontWeight: 600, color: TEXT }}>{w}</div>
          </M.BlurFade>
        ))}
      </div>
    ),
  }),
  "animated-list": (M, s) => {
    const rows = s.items?.length ? s.items.map((it) => ({ h: it.heading, t: it.text })) : orWords(s, 6).map((w) => ({ h: w, t: "" }));
    return {
      el: (
        <div style={{ width: 900, height: 620, overflow: "hidden" }}>
          <M.AnimatedList delay={900}>
            {rows.slice(0, 6).map((r, i) => (
              <div key={i} style={{ width: 900, display: "flex", alignItems: "center", gap: 22, padding: "20px 26px", borderRadius: 22, background: "var(--mu-card)", border: "1px solid var(--border)" }}>
                <img src={tile(r.h, i)} alt="" style={{ width: 64, height: 64, borderRadius: 16 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 32, fontWeight: 600, color: TEXT }}>{r.h}</div>
                  {r.t && <div style={{ fontSize: 24, color: MUTED }}>{r.t}</div>}
                </div>
              </div>
            ))}
          </M.AnimatedList>
        </div>
      ),
    };
  },
  marquee: (M, s) => {
    const words = orWords(s, 8);
    const chip = (w: string, i: number) => (
      <div key={i} style={{ padding: "18px 32px", borderRadius: 999, background: SURFACE, border: "1px solid var(--border)", fontSize: 36, fontWeight: 600, color: TEXT, whiteSpace: "nowrap" }}>{w}</div>
    );
    return {
      el: (
        <div style={{ width: 1600, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
          <M.Marquee className="[--duration:18s] [--gap:1.5rem]">{words.map(chip)}</M.Marquee>
          <M.Marquee reverse className="[--duration:18s] [--gap:1.5rem]">{[...words].reverse().map(chip)}</M.Marquee>
        </div>
      ),
    };
  },
  "word-rotate": (M, s) => ({
    el: (
      <div style={{ fontFamily: DISPLAY, color: TEXT, minWidth: 900, display: "flex", justifyContent: "center" }}>
        <M.WordRotate words={orWords(s, 6)} duration={1400} className="text-[96px] font-bold leading-tight" />
      </div>
    ),
  }),
  "bento-grid": (M, s) => {
    const cells = s.items?.length ? s.items.slice(0, 5).map((it) => ({ h: it.heading, t: it.text })) : orWords(s, 5).map((w) => ({ h: w, t: "" }));
    const span = (i: number) => (cells.length >= 4 ? (i === 0 || i === 3 ? "col-span-2" : "col-span-1") : "col-span-1");
    const Icon = ({ className }: { className?: string }) => <span className={className} style={{ display: "inline-block", width: 40, height: 40, borderRadius: 12, background: ACCENT }} />;
    return {
      el: (
        <M.BentoGrid className="w-[1400px] auto-rows-[240px] grid-cols-3">
          {cells.map((c, i) => (
            <M.BentoCard key={i} name={c.h} description={c.t || " "} Icon={Icon} href="#" cta="Learn more" className={span(i)} background={<div className="absolute inset-0 bg-gradient-to-br from-[var(--mu-accent)]/25 to-transparent" />} />
          ))}
        </M.BentoGrid>
      ),
    };
  },
  "avatar-circles": (M, s) => {
    const words = orWords(s, 6);
    const extra = Math.max(1, Math.round(number(s.stats?.[0]?.value ?? "").value)) || 99;
    return {
      el: column(
        <div style={{ transform: "scale(2.2)", padding: 40 }}>
          <M.AvatarCircles numPeople={extra} avatarUrls={words.map((w, i) => ({ imageUrl: tile(w, i), profileUrl: "#" }))} />
        </div>,
        s.stats?.[0] ? <div style={{ fontSize: 34, color: MUTED }}>{s.stats[0].label}</div> : null,
      ),
    };
  },
  dock: (M, s) => ({
    el: (
      <M.Dock iconSize={72} iconMagnification={72} disableMagnification className="h-[110px] gap-4 rounded-3xl px-5">
        {orWords(s, 6).map((w, i) => (
          <M.DockIcon key={i}>
            <img src={tile(w, i)} alt="" style={{ width: 72, height: 72, borderRadius: 18 }} />
          </M.DockIcon>
        ))}
      </M.Dock>
    ),
  }),

  // beside the slide's text
  terminal: (M, s) => {
    const l = list(s);
    return {
      el: (
        <div style={{ width: 900 }}>
        <M.Terminal className="!w-full !max-w-none !max-h-none text-[22px]" startOnView={false}>
          <M.TypingAnimation>{`> ${l[0] ?? s.title}`}</M.TypingAnimation>
          {(l.length > 1 ? l.slice(1, 6) : [line(s) || "done"]).map((b, i) => (
            <M.AnimatedSpan key={i} className="text-green-400">{`✔ ${b}`}</M.AnimatedSpan>
          ))}
        </M.Terminal>
        </div>
      ),
    };
  },
  "file-tree": (M, s) => {
    const files = orWords(s, 6);
    return {
      el: (
        <div style={{ width: 640, padding: 24, borderRadius: 24, background: "var(--mu-card)", border: "1px solid var(--border)", fontSize: 26 }}>
          <M.Tree className="overflow-hidden" initialExpandedItems={["root"]} elements={[{ id: "root", name: s.title, isSelectable: true, children: files.map((f, i) => ({ id: `f${i}`, name: f, isSelectable: true })) }]}>
            <M.Folder element={s.title.split(/\s+/).slice(0, 3).join(" ")} value="root">
              {files.map((f, i) => (
                <M.File key={i} value={`f${i}`}>
                  <p>{f}</p>
                </M.File>
              ))}
            </M.Folder>
          </M.Tree>
        </div>
      ),
    };
  },
  "code-comparison": (M, s) => {
    const l = list(s);
    const minus = l.filter((x) => /^\s*-/.test(x)).map((x) => x.replace(/^\s*-\s?/, ""));
    const plus = l.filter((x) => /^\s*\+/.test(x)).map((x) => x.replace(/^\s*\+\s?/, ""));
    const before = minus.length ? minus.join("\n") : s.body || l[0] || s.title;
    const after = plus.length ? plus.join("\n") : (minus.length ? l.filter((x) => !/^\s*-/.test(x)) : l.slice(1)).join("\n") || s.title;
    return { el: <div style={{ width: 1100 }}><M.CodeComparison beforeCode={before} afterCode={after} language="typescript" filename="code.ts" lightTheme="github-light" darkTheme="github-dark" highlightColor="rgba(101,117,133,0.16)" /></div> };
  },
  "icon-cloud": (M, s) => {
    const words = orWords(s, 8);
    const images = Array.from({ length: 16 }, (_, i) => tile(words[i % words.length], i));
    return { el: <div style={{ width: 640, height: 640, display: "grid", placeItems: "center" }}><M.IconCloud images={images} /></div> };
  },
  android: (M, s) => ({ el: <div style={{ width: 420 }}><M.Android src={picture(s, 540, 1120)} /></div> }),
  iphone: (M, s) => ({ el: <div style={{ width: 420 }}><M.Iphone src={picture(s, 540, 1120)} /></div> }),
  safari: (M, s) => ({ el: <div style={{ width: 1100 }}><M.Safari url={(s.subtitle ?? "example.com").toLowerCase().replace(/\s+/g, "") .slice(0, 30) || "example.com"} imageSrc={picture(s, 1200, 750)} /></div> }),
  "pixel-image": (M, s) => ({ el: <div style={{ width: 900 }}><M.PixelImage src={picture(s, 900, 600)} grid="6x4" /></div> }),
  lens: (M, s) => ({
    el: (
      <div style={{ width: 900, borderRadius: 24, overflow: "hidden" }}>
        <M.Lens isStatic position={{ x: 450, y: 280 }} zoomFactor={1.7} lensSize={240}>
          <img src={picture(s, 900, 560)} alt="" style={{ width: 900, display: "block" }} />
        </M.Lens>
      </div>
    ),
  }),
  "hero-video-dialog": (M, s) => ({ el: <div style={{ width: 1000 }}><M.HeroVideoDialog animationStyle="from-center" videoSrc="about:blank" thumbnailSrc={picture(s, 1200, 675)} thumbnailAlt={s.title} /></div> }),

  // buttons: the first short bullet (or "Get started") as the label
  "shimmer-button": (M, s) => ({ el: <M.ShimmerButton shimmerColor={P.text} background={P.accent} className={bigButton}>{label(s)}</M.ShimmerButton>, maxScale: 2.2 }),
  "shiny-button": (M, s) => ({ el: <M.ShinyButton className={bigButton}>{label(s)}</M.ShinyButton>, maxScale: 2.2 }),
  "rainbow-button": (M, s) => ({ el: <M.RainbowButton className={`${bigButton} h-auto`}>{label(s)}</M.RainbowButton>, maxScale: 2.2 }),
  "pulsating-button": (M, s) => ({ el: <div style={{ padding: 40 }}><M.PulsatingButton pulseColor={P.accent} className={bigButton} style={{ background: P.accent, color: P.bg }}>{label(s)}</M.PulsatingButton></div>, maxScale: 2.2 }),
  "ripple-button": (M, s) => ({ el: <M.RippleButton rippleColor={P.accent} className={bigButton}>{label(s)}</M.RippleButton>, maxScale: 2.2 }),
  "interactive-hover-button": (M, s) => ({ el: <M.InteractiveHoverButton className={bigButton}>{label(s)}</M.InteractiveHoverButton>, maxScale: 2.2 }),
  "cool-mode": (M, s) => ({
    el: (
      <M.CoolMode options={{ particle: tile(s.title, 0) }}>
        <button className={bigButton} style={{ background: P.accent, color: P.bg }}>{label(s)}</button>
      </M.CoolMode>
    ),
    maxScale: 2.2,
  }),
};

function globeConfig() {
  const rgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return [n[0] / 255, n[1] / 255, n[2] / 255];
  };
  return {
    width: 1000,
    height: 1000,
    onRender: () => {},
    devicePixelRatio: 2,
    phi: 0,
    theta: 0.3,
    dark: 1,
    diffuse: 0.4,
    mapSamples: 16000,
    mapBrightness: 1.2,
    baseColor: [0.3, 0.3, 0.35] as [number, number, number],
    markerColor: rgb(P.accent),
    glowColor: rgb(P.accent2),
    markers: [
      { location: [14.5995, 120.9842] as [number, number], size: 0.03 },
      { location: [40.7128, -74.006] as [number, number], size: 0.1 },
      { location: [51.5072, -0.1276] as [number, number], size: 0.07 },
      { location: [35.6762, 139.6503] as [number, number], size: 0.06 },
      { location: [12.9716, 77.5946] as [number, number], size: 0.08 },
    ],
  };
}
