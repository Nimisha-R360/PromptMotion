// Magic UI add-on host (runtime-dist/magicui/host.js): one shared React / ReactDOM / motion for every Magic UI component
// bundle (runtime-dist/magicui/c/<slug>.js), the components' Tailwind CSS scoped under .pm-mu, and the mount() the
// slide runtime calls to draw a Magic UI card (registers itself as window.PromptMotionMagicUI).
//
// Timing: Magic UI components animate on the page's clock (motion springs, timers, CSS keyframes), not frame by frame.
// CSS keyframe animations are paused and set to the slide's time on every seek (exact when scrubbing); everything else
// plays in real time from when the card appears, and restarts when the video seeks back or jumps ahead.
import React from "react";
import * as ReactJsx from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as Motion from "motion/react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
// compiled by scripts/build-magicui.mjs (Tailwind utilities + preflight, scoped under .pm-mu)
import css from "magicui-css";
import { SCENES, setPalette, type Scene } from "./scenes";
import { MAGICUI_CARD_IDS, magicSlug, type MagicCardId } from "../magicui-cards";
import type { OndaAddon, OndaMountOptions } from "../cards";
import type { Theme } from "../themes";

declare global {
  interface Window {
    __PMU__?: { modules: Record<string, unknown>; register: (slug: string, mod: unknown) => void };
    PromptMotionMagicUI?: OndaAddon;
  }
}

/** component modules registered by their bundles, by slug */
const MODULES = new Map<string, unknown>();
window.__PMU__ = {
  modules: { react: React, "react/jsx-runtime": ReactJsx, "react-dom": ReactDOM, "react-dom/client": ReactDOMClient, "motion/react": Motion },
  register: (slug, mod) => MODULES.set(slug, mod),
};

if (!document.getElementById("pm-mu-css")) {
  const style = document.createElement("style");
  style.id = "pm-mu-css";
  style.textContent = css;
  document.head.appendChild(style);
}

const luminance = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  return (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
};

/** the slide theme as the CSS variables Magic UI (shadcn tokens) and the scenes (--mu-*) read */
function themeVars(theme: Theme): Record<string, string> {
  const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
  return {
    "--mu-text": theme.text,
    "--mu-muted": theme.muted,
    "--mu-accent": theme.accent,
    "--mu-accent2": theme.accent2,
    "--mu-surface": theme.surface,
    "--mu-bg": theme.bg,
    "--mu-card": `color-mix(in srgb, ${theme.bg2} 70%, ${theme.bg})`,
    "--mu-display": theme.display,
    "--background": theme.bg,
    "--foreground": theme.text,
    "--card": theme.bg2,
    "--card-foreground": theme.text,
    "--popover": theme.bg2,
    "--popover-foreground": theme.text,
    "--primary": theme.accent,
    "--primary-foreground": theme.bg,
    "--secondary": theme.bg2,
    "--secondary-foreground": theme.text,
    "--muted": theme.bg2,
    "--muted-foreground": theme.muted,
    "--accent": theme.bg2,
    "--accent-foreground": theme.text,
    "--border": mix(theme.text, 14),
    "--input": mix(theme.text, 18),
    "--ring": theme.accent,
    "--font-sans": theme.body,
    "--font-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  };
}

const PANEL = { landscape: { width: 1600, height: 900 }, portrait: { width: 900, height: 1400 } };
const MAX_SCALE = 1.5;

/** The card's content: the scene, framed in a panel (backgrounds, with the slide's title) or at its natural size. */
const Card: React.FC<{ scene: Scene; title: string; subtitle: string; portrait: boolean }> = ({ scene, title, subtitle, portrait }) => {
  if (!scene.panel) return <>{scene.el}</>;
  const size = portrait ? PANEL.portrait : PANEL.landscape;
  const words = scene.overlay ? (
    <div key="words" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 96, textAlign: "center", pointerEvents: "none" }}>
      <h2 style={{ fontFamily: "var(--mu-display)", fontSize: title.length > 40 ? 72 : 96, fontWeight: 700, lineHeight: 1.1, margin: 0, color: "var(--mu-text)", textWrap: "balance" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 38, margin: 0, color: "var(--mu-muted)" }}>{subtitle}</p>}
    </div>
  ) : null;
  const comp = <div key="comp" style={{ position: "absolute", inset: 0 }}>{scene.el}</div>;
  return (
    <div style={{ position: "relative", width: size.width, height: size.height, borderRadius: 28, overflow: "hidden" }}>
      {scene.overlay === "front" ? [comp, words] : [words, comp]}
    </div>
  );
};

/** Mount a Magic UI card into `host` (sized by the slide's CSS). Returns seek(t), t in seconds since the card starts. */
function mount(host: HTMLElement, o: OndaMountOptions): (t: number) => void {
  const slug = magicSlug(o.id as MagicCardId);
  const mod = MODULES.get(slug);
  const build = SCENES[slug];
  if (!mod || !build) throw new Error(`Magic UI component ${slug} is not loaded`);

  const light = luminance(o.theme.bg) >= 0.5;
  const box = document.createElement("div");
  box.className = `pm-mu${light ? "" : " dark"}`;
  Object.assign(box.style, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", color: o.theme.text, fontFamily: o.theme.body });
  for (const [k, v] of Object.entries(themeVars(o.theme))) box.style.setProperty(k, v);
  const fit = document.createElement("div");
  Object.assign(fit.style, { width: "max-content", flexShrink: "0", transformOrigin: "50% 50%" });
  box.appendChild(fit);
  host.appendChild(box);

  let root: Root | null = null;
  let last = -1;
  let maxScale = MAX_SCALE;
  /** the content size the zoom was computed for (re-fit when it changes: typing, async content) */
  let sized = "";
  /** the slide time each CSS animation was first seen at (its start) */
  let seen = new WeakMap<Animation, number>();

  const render = () => {
    setPalette({ text: o.theme.text, muted: o.theme.muted, accent: o.theme.accent, accent2: o.theme.accent2, bg: o.theme.bg });
    const scene = build(mod, o.spec, { portrait: o.portrait, duration: o.duration });
    root = createRoot(fit);
    flushSync(() => root!.render(<Card scene={scene} title={o.spec.title} subtitle={o.spec.subtitle || o.spec.body || ""} portrait={o.portrait} />));
    seen = new WeakMap();
    maxScale = scene.maxScale ?? MAX_SCALE;
    sized = "";
    fitTo();
  };
  // zoom to fill the slot without overflowing (layout size, so entrance transforms don't matter)
  const fitTo = () => {
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    const ew = Math.max(fit.offsetWidth, fit.scrollWidth);
    const eh = Math.max(fit.offsetHeight, fit.scrollHeight);
    if (!w || !h || !ew || !eh) return;
    const size = `${w}x${h}:${ew}x${eh}`;
    if (size === sized) return;
    sized = size;
    fit.style.transform = `scale(${Math.min(maxScale, (w * 0.96) / ew, (h * 0.96) / eh)})`;
  };
  const unmount = () => {
    root?.unmount();
    root = null;
    fit.style.transform = "";
  };

  return (t: number) => {
    if (t < 0) {
      if (root) unmount();
      last = -1;
      return;
    }
    // first show, a seek back, or a jump ahead: start the card again
    if (!root || t < last - 0.05 || t > last + 0.75) {
      unmount();
      render();
    }
    fitTo();
    // CSS keyframe animations follow the slide's clock
    for (const a of box.getAnimations({ subtree: true })) {
      if (!(a instanceof CSSAnimation)) continue;
      if (!seen.has(a)) seen.set(a, t);
      a.pause();
      a.currentTime = Math.max(0, (t - seen.get(a)!) * 1000);
    }
    last = t;
  };
}

window.PromptMotionMagicUI = {
  version: "magicui",
  get ids() {
    return MAGICUI_CARD_IDS.filter((id) => MODULES.has(magicSlug(id)));
  },
  mount,
} as OndaAddon;
