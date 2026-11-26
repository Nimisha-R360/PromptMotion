// Onda text reveals in the slide runtime: Matrix Decode (title effect) and Count Up (number counter) are real Onda
// components, drawn by the add-on bundle (runtime/onda/addon.tsx → window.PromptMotionOnda) over an invisible copy of
// the slide's text, so the layout, wrapping and click-to-edit stay exactly as they were.
import { Ctx, ParsedNumber, Seek, h } from "../dom";
import { isCounterId, isTextRevealId, type OndaTextOptions, type OndaTextStyle } from "../cards";

const addon = () => (typeof window !== "undefined" ? window.PromptMotionOnda : undefined);

/** true when the Onda add-on is on this page and draws this id */
export const ondaTextAvailable = (id: string) => (isTextRevealId(id) || isCounterId(id)) && !!addon()?.mountText && !!addon()?.ids.includes(id);

const ALIGN: Record<string, OndaTextStyle["align"]> = { center: "center", right: "right", end: "right" };

function textStyle(cs: CSSStyleDeclaration): OndaTextStyle {
  const fontSize = parseFloat(cs.fontSize) || 72;
  const clip = cs.backgroundClip === "text" || cs.getPropertyValue("-webkit-background-clip") === "text";
  return {
    fontSize,
    fontFamily: cs.fontFamily,
    fontWeight: parseInt(cs.fontWeight, 10) || 700,
    letterSpacing: cs.letterSpacing,
    lineHeight: parseFloat(cs.lineHeight) || fontSize * 1.1,
    // outlined text stays transparent and keeps its (inherited) -webkit-text-stroke
    color: cs.color,
    align: ALIGN[cs.textAlign] ?? "left",
    textTransform: cs.textTransform,
    fontStyle: cs.fontStyle,
    backgroundImage: clip && cs.backgroundImage !== "none" ? cs.backgroundImage : undefined,
  };
}

/** Swap the element's text for an invisible copy that keeps the layout (one span per word, so lines can be read back). */
function ghostOf(el: HTMLElement, text: string) {
  el.textContent = "";
  el.setAttribute("aria-label", text);
  const ghost = h("span", "pm-onda-ghost");
  ghost.setAttribute("aria-hidden", "true");
  const words = text.split(/\s+/).filter(Boolean);
  const spans = words.map((w, i) => {
    const sp = h("span", "", w);
    if (i) ghost.append(" ");
    ghost.append(sp);
    return sp;
  });
  el.appendChild(ghost);
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  return { ghost, words, spans };
}

type Ghost = ReturnType<typeof ghostOf>;

/** Where the copy sits and how it wraps: its lines, size and position, plus room around it (`room` × font size). */
function measure({ ghost, words, spans }: Ghost, text: string, fontSize: number, room: number) {
  // words that share a top edge share a line
  const lines: string[] = [];
  let top = Number.NaN;
  spans.forEach((sp, i) => {
    if (Number.isNaN(top) || Math.abs(sp.offsetTop - top) > 2) {
      lines.push(words[i]);
      top = sp.offsetTop;
    } else lines[lines.length - 1] += " " + words[i];
  });
  return {
    lines: lines.length ? lines : [text],
    width: ghost.offsetWidth,
    height: ghost.offsetHeight,
    left: ghost.offsetLeft,
    top: ghost.offsetTop,
    padX: Math.round(fontSize * room),
    padY: Math.round(fontSize * 0.25),
  };
}

type Geometry = ReturnType<typeof measure>;
const sameGeometry = (a: Geometry, b: Geometry) =>
  a.width === b.width && a.height === b.height && a.left === b.left && a.top === b.top && a.lines.join("\n") === b.lines.join("\n");

function mountOn(el: HTMLElement, text: string, id: OndaTextOptions["id"], ctx: Ctx, number?: OndaTextOptions["number"]): Seek {
  // scrambling glyphs (capitals, digits, symbols) run wider than the final letters; a counted number never does
  const room = number ? 0.25 : 2;
  const onda = addon();
  if (!onda?.mountText || !onda.ids.includes(id)) throw new Error(`Onda add-on missing for ${id}`);
  const style = textStyle(getComputedStyle(el));
  const copy = ghostOf(el, text);
  const box = h("div", "pm-onda-box");
  box.setAttribute("aria-hidden", "true");
  el.appendChild(box);
  const place = (g: Geometry): OndaTextOptions => {
    Object.assign(box.style, { left: `${g.left - g.padX}px`, top: `${g.top - g.padY}px`, width: `${g.width + g.padX * 2}px`, height: `${g.height + g.padY * 2}px` });
    return { id, lines: g.lines, number, style, width: g.width, height: g.height, padX: g.padX, padY: g.padY, theme: ctx.theme, duration: ctx.duration, seed: ctx.seed };
  };
  let g = measure(copy, text, style.fontSize, room);
  const m = onda.mountText(box, place(g));
  m.seek(0);
  // the slide's web font can finish loading after the slide was built: follow the text's final size and wrapping
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(() => {
      if (!copy.ghost.offsetWidth) return; // scene hidden
      const next = measure(copy, text, style.fontSize, room);
      if (sameGeometry(next, g)) return;
      g = next;
      m.update(place(g));
    }).observe(copy.ghost);
  return (t) => m.seek(t);
}

/** Headline effect: Onda MatrixDecode, one decoding line after another. */
export function ondaText(id: string) {
  return (el: HTMLElement, ctx: Ctx): Seek => {
    if (!isTextRevealId(id)) throw new Error(`not an Onda text reveal: ${id}`);
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return mountOn(el, text, id, ctx);
  };
}

type NumberImpl = (el: HTMLElement, n: ParsedNumber, ctx: Ctx) => Seek;

/**
 * Number counter: Onda CountUp. It always writes the number en-US style (1,250 · 3.5), so a value written another way
 * ("2024", "1,00,000", ".5") is counted by `fallback` instead and still reads exactly as on the slide.
 */
export function ondaNumber(id: string, fallback: NumberImpl) {
  return (el: HTMLElement, n: ParsedNumber, ctx: Ctx): Seek => {
    if (!isCounterId(id)) throw new Error(`not an Onda counter: ${id}`);
    const shown = n.ok && n.prefix + n.value.toLocaleString("en-US", { minimumFractionDigits: n.decimals, maximumFractionDigits: n.decimals }) + n.suffix;
    if (!n.ok || shown !== n.raw) return fallback(el, n, ctx);
    return mountOn(el, n.raw, id, ctx, { prefix: n.prefix, value: n.value, decimals: n.decimals, suffix: n.suffix });
  };
}
