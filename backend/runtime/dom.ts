import type { Theme } from "./themes";

export type Seek = (t: number) => void;

export interface Ctx {
  theme: Theme;
  /** deterministic seed per scene */
  seed: number;
  /** scene duration in seconds */
  duration: number;
}

export interface TransitionHandle {
  /** p in [0,1] */
  seek(p: number): void;
  reset(): void;
}
export interface TransitionTargets {
  outEl: HTMLElement;
  inEl: HTMLElement;
  overlay: HTMLElement;
}

export interface EngineImpls {
  text: Record<string, (el: HTMLElement, ctx: Ctx) => Seek>;
  entrance: Record<string, (el: HTMLElement, ctx: Ctx) => Seek>;
  list: Record<string, (els: HTMLElement[], ctx: Ctx) => Seek>;
  number: Record<string, (el: HTMLElement, n: ParsedNumber, ctx: Ctx) => Seek>;
  chart: Record<string, (bars: HTMLElement[], ctx: Ctx) => Seek>;
  background: Record<string, (layer: HTMLElement, ctx: Ctx) => Seek>;
  decor: Record<string, (layer: HTMLElement, ctx: Ctx) => Seek>;
  transition: Record<string, (t: TransitionTargets, ctx: Ctx) => TransitionHandle>;
}

export const FPS = 30;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export const SVGNS = "http://www.w3.org/2000/svg";
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function svgRoot(w = 1920, hgt = 1080, cls = "fill"): SVGSVGElement {
  return s("svg", { viewBox: `0 0 ${w} ${hgt}`, class: cls, preserveAspectRatio: "xMidYMid slice" });
}

/** Wrap text into word > char spans (used by remotion/motion text effects). */
export function splitChars(el: HTMLElement): { words: HTMLElement[]; chars: HTMLElement[] } {
  const text = el.textContent ?? "";
  el.textContent = "";
  el.setAttribute("aria-label", text);
  const words: HTMLElement[] = [];
  const chars: HTMLElement[] = [];
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(" "));
      return;
    }
    const w = h("span", "pm-w");
    w.setAttribute("aria-hidden", "true");
    for (const ch of Array.from(part)) {
      const c = h("span", "pm-c", ch);
      w.appendChild(c);
      chars.push(c);
    }
    el.appendChild(w);
    words.push(w);
  });
  return { words, chars };
}

export interface ParsedNumber {
  prefix: string;
  value: number;
  decimals: number;
  suffix: string;
  ok: boolean;
  raw: string;
}

export function parseNumber(raw: string): ParsedNumber {
  const m = raw.match(/^([^\d\-.]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return { prefix: "", value: 0, decimals: 0, suffix: "", ok: false, raw };
  const numStr = m[2].replace(/,/g, "");
  const dec = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return { prefix: m[1], value: parseFloat(numStr), decimals: dec, suffix: m[3], ok: !isNaN(parseFloat(numStr)), raw };
}

export function formatNumber(n: ParsedNumber, v: number): string {
  if (!n.ok) return n.raw;
  const fixed = v.toFixed(n.decimals);
  const [i, d] = fixed.split(".");
  const grouped = n.raw.includes(",") ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : i;
  return n.prefix + grouped + (d ? "." + d : "") + n.suffix;
}

/** mulberry32 — deterministic pseudo random (used where engines lack seeded random) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Combine many seeks into one. */
export const all = (seeks: Seek[]): Seek => (t) => {
  for (const f of seeks) f(t);
};

export function resetStyles(...els: HTMLElement[]) {
  for (const e of els) {
    e.style.transform = "";
    e.style.opacity = "";
    e.style.clipPath = "";
    e.style.filter = "";
    e.style.zIndex = "";
    e.style.transformOrigin = "";
  }
}
