// remocn engine: React/Remotion components from the remocn registry, rendered through the host bundle
// (runtime/remocn/host.tsx → window.__PMR__) inside a Remotion <Player> that is seeked frame by frame, so they scrub
// with the master clock like every other engine. Props are filled from the slide's content and the theme.
import type { Theme } from "../themes";
import { Ctx, FPS, Seek, h } from "../dom";
import { MEDIA_LIST_PROPS, MEDIA_PROPS, REMOCN_PREFIX } from "../remocn/types";
import type { RemocnPropKind } from "../remocn/types";

export { isRemocnId } from "../remocn/types";

/** Slide content a component's props can be filled from. */
export interface RemocnSource {
  text?: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  /** canvas colour behind the component ("transparent" when it sits on top of our own backdrop) */
  background?: string;
  size?: number;
  loop?: boolean;
  width?: number;
  height?: number;
  /** the user's uploaded pictures for this slide (data URIs / URLs; video clips are ignored) */
  images?: string[];
}

/** a video clip (uploaded scene) — shown by our own media block, not by image props */
export const isVideoSrc = (src: string | undefined) => !!src && /^data:video\/|\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);

const name = (id: string) => id.slice(REMOCN_PREFIX.length);
const host = () => (typeof window !== "undefined" ? window.__PMR__ : undefined);

/** true when the component's bundle is loaded on this page */
export const remocnAvailable = (id: string) => !!host()?.has(name(id));

function luminance(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Word-by-word captions (@remotion/captions format) for caption components. */
function captionsFor(text: string) {
  const ws = text.split(/\s+/).filter(Boolean);
  const per = Math.max(220, Math.min(420, 2600 / Math.max(1, ws.length)));
  return ws.map((w, i) => ({ text: (i ? " " : "") + w, startMs: Math.round(i * per), endMs: Math.round((i + 1) * per), timestampMs: Math.round(i * per + per / 2), confidence: 1 }));
}

const STRING_FROM: Record<string, (s: RemocnSource, t: Theme) => string | undefined> = {
  text: (s) => s.text ?? s.title,
  children: (s) => s.text ?? s.title,
  title: (s) => s.title,
  heading: (s) => s.title,
  headline: (s) => s.title,
  label: (s) => s.title,
  subtitle: (s) => s.subtitle,
  tagline: (s) => s.subtitle,
  description: (s) => s.subtitle,
  message: (s) => s.subtitle,
  toText: (s) => s.text ?? s.title,
  fromText: (s) => s.subtitle ?? s.text ?? s.title,
  accent: (_, t) => t.accent,
  accentColor: (_, t) => t.accent,
  activeColor: (_, t) => t.accent,
  cursorColor: (_, t) => t.accent,
  highlightColor: (_, t) => t.accent,
  ink: (_, t) => t.text,
  color: (_, t) => t.text,
  textColor: (_, t) => t.text,
  foreground: (_, t) => t.text,
  background: (s) => s.background,
  fontFamily: (s) => s.fontFamily,
};
const LIST_PROPS = new Set(["lines", "items", "bullets", "statements", "words", "phrases", "points"]);

/** Fill a component's props from slide content + theme (only props it declares, only with matching types). */
export function remocnProps(id: string, src: RemocnSource, theme: Theme): Record<string, unknown> | null {
  const entry = host()?.entry(name(id));
  if (!entry) return null;
  const out: Record<string, unknown> = {};
  for (const [prop, kind] of Object.entries(entry.props) as [string, RemocnPropKind][]) {
    let v: unknown;
    const pics = (src.images ?? []).filter((x) => x && !isVideoSrc(x));
    if (kind === "string" && MEDIA_PROPS.includes(prop)) v = prop === "toSrc" ? (pics[1] ?? pics[0]) : pics[0];
    else if (kind === "string[]" && MEDIA_LIST_PROPS.includes(prop)) v = pics.length ? pics : undefined;
    else if (kind === "string" || (kind === "node" && prop === "children")) v = STRING_FROM[prop]?.(src, theme);
    else if (kind === "number") v = prop === "fontSize" ? src.fontSize : prop === "fontWeight" ? src.fontWeight : prop === "size" ? src.size : prop === "width" ? src.width : prop === "height" ? src.height : undefined;
    else if (kind === "boolean") v = prop === "loop" ? src.loop : undefined;
    else if (kind === "string[]") v = LIST_PROPS.has(prop) && src.bullets?.length ? src.bullets : undefined;
    else if (kind === "captions") v = captionsFor(src.text ?? src.title ?? "");
    else if (typeof kind === "object" && prop === "theme" && kind.enum.includes("dark") && kind.enum.includes("light")) v = luminance(theme.bg) > 0.5 ? "light" : "dark";
    if (v !== undefined && v !== "") out[prop] = v;
  }
  // a required prop we can't fill → the component can't render meaningfully
  if (entry.required.some((r) => out[r] === undefined)) return null;
  return out;
}

/** Mount a component into `box` (sized to the box) and return a seek(t) in scene-local seconds. */
export function mountRemocn(box: HTMLElement, id: string, props: Record<string, unknown>, ctx: Ctx, size?: { width: number; height: number }): Seek | null {
  const pmr = host();
  if (!pmr) return null;
  const width = size?.width ?? (box.offsetWidth || 1920);
  const height = size?.height ?? (box.offsetHeight || 1080);
  const m = pmr.mount(box, name(id), props, { width, height, fps: FPS, durationInFrames: Math.ceil((ctx.duration + 4) * FPS) });
  if (!m) return null;
  m.seek(0);
  return (t) => m.seek(Math.max(0, t) * FPS);
}

/** Headline effect: the component draws the title over an invisible copy that keeps the layout. */
export function remocnText(id: string) {
  return (el: HTMLElement, ctx: Ctx): Seek => {
    const text = (el.textContent ?? "").trim();
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize) || 72;
    const src: RemocnSource = { text, title: text, fontSize, fontFamily: cs.fontFamily, fontWeight: parseInt(cs.fontWeight, 10) || 700, background: "transparent" };
    // check before touching the element, so the fallback effect still finds the original title
    if (!remocnProps(id, { ...src, width: el.offsetWidth, height: el.offsetHeight }, ctx.theme)) throw new Error(`remocn component unavailable: ${id}`);
    el.textContent = "";
    el.setAttribute("aria-label", text);
    const ghost = h("span", "pm-rc-ghost", text);
    ghost.setAttribute("aria-hidden", "true");
    el.appendChild(ghost);
    if (cs.position === "static") el.style.position = "relative";
    const padX = Math.round(fontSize * 0.6);
    const padY = Math.round(fontSize * 0.5);
    const width = ghost.offsetWidth + padX * 2;
    const height = ghost.offsetHeight + padY * 2;
    const box = h("div", "pm-rc-box");
    Object.assign(box.style, { left: `${ghost.offsetLeft - padX}px`, top: `${ghost.offsetTop - padY}px`, width: `${width}px`, height: `${height}px` });
    el.appendChild(box);
    const props = remocnProps(id, { ...src, width, height }, ctx.theme);
    const seek = props && mountRemocn(box, id, props, ctx, { width, height });
    if (!seek) throw new Error(`remocn component unavailable: ${id}`);
    return seek;
  };
}

/** Full-bleed animated backdrop. */
export function remocnBackground(id: string) {
  return (layer: HTMLElement, ctx: Ctx): Seek => {
    const box = h("div", "pm-rc-fill");
    layer.appendChild(box);
    const width = layer.offsetWidth || 1920;
    const height = layer.offsetHeight || 1080;
    const props = remocnProps(id, { background: ctx.theme.bg, loop: true, width, height }, ctx.theme);
    const seek = props && mountRemocn(box, id, props, ctx, { width, height });
    if (!seek) throw new Error(`remocn component unavailable: ${id}`);
    return seek;
  };
}

/** Animated icon placed as an ornament in the top-right corner. */
export function remocnDecor(id: string) {
  return (layer: HTMLElement, ctx: Ctx): Seek => {
    const box = h("div", "pm-rc-icon");
    layer.appendChild(box);
    const size = box.offsetWidth || 180;
    const props = remocnProps(id, { size: Math.round(size * 0.8), loop: true, background: "transparent", width: size, height: size }, { ...ctx.theme, text: ctx.theme.accent });
    const seek = props && mountRemocn(box, id, props, ctx, { width: size, height: size });
    if (!seek) throw new Error(`remocn component unavailable: ${id}`);
    return seek;
  };
}

/** Full-frame scene of a "showcase" slide. */
export function remocnScene(id: string, box: HTMLElement, src: RemocnSource, ctx: Ctx): Seek {
  const width = box.offsetWidth || 1920;
  const height = box.offsetHeight || 1080;
  const props = remocnProps(id, { ...src, background: "transparent", width, height }, ctx.theme);
  const seek = props && mountRemocn(box, id, props, ctx, { width, height });
  if (!seek) throw new Error(`remocn component unavailable: ${id}`);
  return seek;
}
