// The rest of Onda's standalone components as slide cards (runtime/onda/components, installed with `ondajs add`).
// Each card is one or more Onda components ("parts") filled from the slide's words, drawn by the Onda add-on.
// Pure TypeScript (no React), shared by the slide runtime, the Onda add-on bundle and the server.
// Not here: Onda's transitions and the wrappers / media components (they need children or an image/video/audio source).
import type { SlideSpec } from "./types";

export const EXTRA_CARD_IDS = [
  // text entrances
  "onda.card.blur-reveal",
  "onda.card.fade-in",
  "onda.card.fade-out",
  "onda.card.mask-reveal",
  "onda.card.matrix-decode",
  "onda.card.rotate-in",
  "onda.card.scale-in",
  "onda.card.slide-in",
  "onda.card.slide-out",
  "onda.card.slot-machine-roll",
  "onda.card.stagger-group",
  "onda.card.tracking-in",
  "onda.card.typewriter",
  "onda.card.word-rotate",
  "onda.card.word-stagger",
  // graphics
  "onda.card.bounding-box",
  "onda.card.callout",
  "onda.card.confetti",
  "onda.card.draw-on",
  "onda.card.highlight",
  "onda.card.icon-pop",
  "onda.card.node-graph",
  "onda.card.rgb-glitch-text",
  "onda.card.shimmer-sweep",
  "onda.card.text-fade-replace",
  "onda.card.underline",
  // interface
  "onda.card.button",
  "onda.card.code-block",
  "onda.card.code-diff",
  "onda.card.cursor",
  "onda.card.input-field",
  "onda.card.kanban-board",
  "onda.card.progress-steps",
  "onda.card.pulsing-indicator",
  "onda.card.terminal",
  // data
  "onda.card.captions",
  "onda.card.count-up",
  "onda.card.timeline",
  // scenes
  "onda.card.chapter-card",
  "onda.card.end-card",
  "onda.card.logo-sting",
  "onda.card.lower-third",
  "onda.card.quote-card",
  "onda.card.stat-card",
  // atmosphere / cinematic
  "onda.card.dynamic-grid",
  "onda.card.gradient-shift",
  "onda.card.grain-overlay",
  "onda.card.marquee",
  "onda.card.mesh-gradient",
  "onda.card.spotlight",
  "onda.card.vignette",
] as const;
export type ExtraCardId = (typeof EXTRA_CARD_IDS)[number];
export const isExtraCardId = (v: unknown): v is ExtraCardId => typeof v === "string" && (EXTRA_CARD_IDS as readonly string[]).includes(v);

/** the Onda component slug, e.g. "fade-in" */
export type OndaSlug = string;

/** One Onda component to draw: `use` is its slug, `props` go through its schema; parts with the same `group` stack in a column. */
export interface CardPart {
  use: OndaSlug;
  props: Record<string, unknown>;
  group?: number;
}

/** How the parts sit: groups side by side ("row") or stacked ("column"); "panel" = a framed scene the full-frame components fill. */
export interface CardLayout {
  direction: "row" | "column";
  /** width of each group in px (components that size themselves to their container, e.g. the timeline) */
  width?: number;
  /** parts inside a group: stacked (default) or side by side */
  inner?: "row" | "column";
  /** draw inside a framed panel of this size (components that fill the whole frame) */
  panel?: { width: number; height: number };
  /** panel only: the slide's title (and subtitle) centred in the panel, in front of the component ("front", for
   *  backdrops) or behind it ("back", for things drawn over the words: spotlight, vignette, confetti, cursor…) */
  overlay?: "back" | "front";
}

type Content = Pick<SlideSpec, "title" | "subtitle" | "body" | "bullets" | "items" | "stats">;
type Mode = "full" | "list" | "side";
interface Opts {
  portrait: boolean;
  /** scene length in seconds */
  duration: number;
}

interface Entry {
  mode: Mode;
  /** slide field a click on the card edits (studio click-to-edit); null = decorative */
  field: (s: Content) => string | null;
  parts: (s: Content, o: Opts) => CardPart[];
  layout: (s: Content, o: Opts) => CardLayout;
}

// ───────────── the slide's words ─────────────

const FPS = 30;
const DIM = "var(--onda-dim, #8E8E98)";
const DISPLAY = "var(--onda-font-display, sans-serif)";

/** the slide's list: bullets, else card headings, else stat labels */
function list(s: Content): string[] {
  if (s.bullets?.length) return s.bullets;
  if (s.items?.length) return s.items.map((it) => it.heading || it.text).filter(Boolean);
  if (s.stats?.length) return s.stats.map((st) => `${st.value} ${st.label}`.trim());
  return [];
}
const listField = (s: Content) => (s.bullets?.length ? "bullets" : s.items?.length ? "items.heading" : s.stats?.length ? "stats.label" : "title");
const line = (s: Content) => s.subtitle || s.body || "";

/** "$4.2M" → { prefix: "$", value: 4.2, decimals: 1, suffix: "M" } */
function number(text: string | undefined): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const m = text?.match(/^(.*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const raw = m[2].replace(/,/g, "");
  return { prefix: m[1].trim(), value: Number(raw), decimals: raw.includes(".") ? raw.split(".")[1].length : 0, suffix: m[3].trim() };
}

/** font size that keeps one line of `text` within `avail` px (for components that never wrap) */
const oneLine = (text: string, avail: number, base = 96) => Math.max(28, Math.min(base, Math.floor(avail / (Math.max(1, text.length) * 0.62))));
const avail = (o: Opts) => (o.portrait ? 900 : 1450);

const ROW: CardLayout = { direction: "row" };
const COLUMN: CardLayout = { direction: "column" };
const panel = (o: Opts, overlay?: CardLayout["overlay"]): CardLayout => ({
  direction: "column",
  panel: o.portrait ? { width: 900, height: 1400 } : { width: 1600, height: 900 },
  overlay,
});

/** the slide's title drawn by one Onda text component, the subtitle fading in under it */
function titled(use: OndaSlug, extra: (s: Content, o: Opts) => Record<string, unknown> = () => ({})): Entry {
  return {
    mode: "full",
    field: () => "title",
    parts: (s, o) => [
      { use, props: { text: s.title, fontSize: s.title.length > 40 ? 76 : 96, align: "center", textWrap: "balance", ...extra(s, o) } },
      ...(line(s) ? [{ use: "fade-in", props: { text: line(s), fontSize: 40, color: DIM, delay: 14, align: "center", fontFamily: "var(--onda-font-body, sans-serif)" } }] : []),
    ],
    layout: () => COLUMN,
  };
}

/** a full-frame Onda component in a panel, with the slide's title in the middle (see CardLayout.overlay) */
function scene(use: OndaSlug, overlay: "back" | "front", props: (s: Content, o: Opts) => Record<string, unknown> = () => ({})): Entry {
  return { mode: "full", field: () => "title", parts: (s, o) => [{ use, props: props(s, o) }], layout: (_s, o) => panel(o, overlay) };
}

// ───────────── each card ─────────────

const EXTRA: Record<ExtraCardId, Entry> = {
  "onda.card.blur-reveal": titled("blur-reveal"),
  "onda.card.fade-in": titled("fade-in"),
  // exits: the title holds, then leaves just before the slide ends
  "onda.card.fade-out": titled("fade-out", (_s, o) => ({ delay: Math.max(0, Math.round(o.duration * FPS) - 24) })),
  "onda.card.slide-out": titled("slide-out", (_s, o) => ({ delay: Math.max(0, Math.round(o.duration * FPS) - 24) })),
  "onda.card.mask-reveal": titled("mask-reveal"),
  // these keep their text on one line: size it to fit (matrix decode also decodes faster for long titles)
  "onda.card.matrix-decode": titled("matrix-decode", (s, o) => ({ fontFamily: DISPLAY, fontSize: oneLine(s.title, avail(o)), charDelay: Math.max(1, Math.min(3, Math.floor(50 / Math.max(1, s.title.length)))) })),
  "onda.card.rotate-in": titled("rotate-in"),
  "onda.card.scale-in": titled("scale-in"),
  "onda.card.slide-in": titled("slide-in"),
  "onda.card.tracking-in": titled("tracking-in", (s, o) => ({ fontSize: oneLine(s.title, avail(o) * 0.8) })),
  "onda.card.typewriter": titled("typewriter", () => ({ fontFamily: DISPLAY })),
  "onda.card.word-stagger": titled("word-stagger", () => ({ justify: "center" })),
  "onda.card.highlight": titled("highlight"),
  "onda.card.underline": titled("underline"),
  "onda.card.rgb-glitch-text": titled("rgb-glitch-text"),
  "onda.card.shimmer-sweep": titled("shimmer-sweep"),

  // the first number rolls in like a slot machine, its label under it
  "onda.card.slot-machine-roll": {
    mode: "full",
    field: (s) => (s.stats?.length ? "stats.value" : "title"),
    parts: (s) => {
      const st = s.stats?.[0];
      const text = st?.value ?? s.title.match(/\d[\d,.]*/)?.[0] ?? s.title;
      return [
        { use: "slot-machine-roll", props: { text, fontFamily: DISPLAY, charset: /^[\d,.\s]+$/.test(text) ? "0123456789" : undefined } },
        { use: "fade-in", props: { text: st ? st.label : line(s), fontSize: 40, color: DIM, delay: 18 } },
      ];
    },
    layout: () => COLUMN,
  },

  // the slide's list, one line after another
  "onda.card.stagger-group": {
    mode: "list",
    field: listField,
    parts: (s) => [{ use: "stagger-group", props: { items: (list(s).length ? list(s) : [line(s) || s.title]).slice(0, 6), fontSize: 48, align: "start" } }],
    layout: () => COLUMN,
  },
  // the slide's list words take turns in one spot
  "onda.card.word-rotate": {
    mode: "list",
    field: listField,
    parts: (s, o) => {
      const phrases = (list(s).length ? list(s) : s.title.split(/\s+/)).slice(0, 6);
      return [{ use: "word-rotate", props: { phrases, fontSize: oneLine(phrases.reduce((a, b) => (b.length > a.length ? b : a), ""), avail(o)) } }];
    },
    layout: (_s, o) => ({ direction: "column", width: avail(o) }),
  },
  "onda.card.text-fade-replace": {
    mode: "list",
    field: listField,
    parts: (s, o) => {
      const phrases = (list(s).length ? list(s) : s.title.split(/\s+/)).slice(0, 6);
      return [{ use: "text-fade-replace", props: { phrases, fontSize: oneLine(phrases.reduce((a, b) => (b.length > a.length ? b : a), ""), avail(o)) } }];
    },
    layout: (_s, o) => ({ direction: "column", width: avail(o) }),
  },

  "onda.card.bounding-box": scene("bounding-box", "back", (s) => ({ x: 0.18, y: 0.32, width: 0.64, height: 0.36, label: (s.subtitle ?? "").slice(0, 32) })),
  "onda.card.callout": scene("callout", "back", (s) => ({ label: list(s)[0] || s.subtitle || "Look here", x: 0.5, y: 0.58, position: "bottom-right", fontSize: 34, offset: 200 })),
  "onda.card.confetti": scene("confetti", "back"),
  "onda.card.cursor": scene("cursor", "back", () => ({ toX: 0.5, toY: 0.5 })),

  // a hand-drawn swoosh under the title
  "onda.card.draw-on": {
    mode: "full",
    field: () => "title",
    parts: (s) => [
      { use: "blur-reveal", props: { text: s.title, fontSize: s.title.length > 40 ? 76 : 96, align: "center", textWrap: "balance" } },
      { use: "draw-on", props: { d: "M 10 60 C 60 20, 110 90, 160 50 S 260 30, 290 60", viewBox: "0 0 300 100", width: 900, height: 120, stroke: "var(--onda-accent, #D96B82)", strokeWidth: 4, delay: 10 } },
      ...(line(s) ? [{ use: "fade-in", props: { text: line(s), fontSize: 40, color: DIM, delay: 20 } }] : []),
    ],
    layout: () => COLUMN,
  },

  // a check pops in beside each point
  "onda.card.icon-pop": {
    mode: "list",
    field: listField,
    parts: (s) =>
      (list(s).length ? list(s) : [line(s) || s.title]).slice(0, 5).flatMap((text, i) => [
        { use: "icon-pop", group: i, props: { icon: "check", iconSize: 56, delay: i * 6 } },
        { use: "fade-in", group: i, props: { text, fontSize: 44, delay: i * 6 + 4, align: "left" } },
      ]),
    layout: () => ({ direction: "column", inner: "row" }),
  },

  // the title as the hub, the list orbiting it
  "onda.card.node-graph": {
    mode: "full",
    field: listField,
    parts: (s) => {
      const labels = (list(s).length ? list(s) : s.title.split(/\s+/).slice(1)).slice(0, 6).map((l) => (l.length > 14 ? l.slice(0, 13) + "…" : l));
      const hub = s.title.split(/\s+/)[0].slice(0, 8);
      return [
        {
          use: "node-graph",
          props: {
            hubLabel: hub,
            hubDiameter: 170,
            hubFontSize: 40,
            satellites: labels.map((label, i) => ({ label, radius: 220 + (i % 3) * 60, speed: (i % 2 ? -1 : 1) * (0.006 + (i % 3) * 0.002), startAngle: (i / labels.length) * Math.PI * 2 })),
            background: "transparent",
          },
        },
      ];
    },
    layout: (_s, o) => ({ direction: "column", panel: o.portrait ? { width: 900, height: 1200 } : { width: 1200, height: 720 } }),
  },

  // interface pieces beside the slide's own text
  "onda.card.button": {
    mode: "side",
    field: () => null,
    parts: (s) => [{ use: "button", props: { label: (s.bullets?.[0] && s.bullets[0].length <= 24 ? s.bullets[0] : "Get started") } }],
    layout: () => ROW,
  },
  "onda.card.code-block": {
    mode: "side",
    field: (s) => (s.body ? "body" : listField(s)),
    parts: (s) => [{ use: "code-block", props: { code: s.body || list(s).join("\n") || s.title, title: "code", width: 900 } }],
    layout: () => ROW,
  },
  "onda.card.code-diff": {
    mode: "side",
    field: listField,
    parts: (s) => [
      {
        use: "code-diff",
        props: {
          lines: (list(s).length ? list(s) : [s.title]).slice(0, 8).map((l) => {
            const m = l.match(/^\s*([+-])\s?(.*)$/);
            return m ? { text: m[2], type: m[1] === "+" ? "add" : "remove" } : { text: l, type: "context" };
          }),
          title: "changes",
          width: 900,
        },
      },
    ],
    layout: () => ROW,
  },
  "onda.card.input-field": {
    mode: "side",
    field: () => null,
    parts: (s) => [{ use: "input-field", props: { label: "", value: (s.bullets?.[0] || s.subtitle || s.title).slice(0, 40), placeholder: "" } }],
    layout: () => ROW,
  },
  "onda.card.terminal": {
    mode: "side",
    field: listField,
    parts: (s) => {
      const l = list(s);
      return [{ use: "terminal", props: { command: l[0] || s.title, output: l.slice(1, 6).map((x) => `✓ ${x}`), title: "terminal", width: 900 } }];
    },
    layout: () => ROW,
  },
  "onda.card.pulsing-indicator": {
    mode: "side",
    field: () => null,
    parts: (s) => [{ use: "pulsing-indicator", props: { label: s.subtitle && s.subtitle.length <= 14 ? s.subtitle.toUpperCase() : "LIVE", size: 28, fontSize: 40 } }],
    layout: () => ROW,
  },

  // the slide's cards as board columns (or one column of its bullets)
  "onda.card.kanban-board": {
    mode: "list",
    field: (s) => (s.items?.length ? "items.heading" : listField(s)),
    parts: (s) => {
      const columns = s.items?.length
        ? s.items.slice(0, 4).map((it) => ({ title: it.heading, cards: (it.text || "").split(/\s*[,;•]\s*/).filter(Boolean).slice(0, 4) }))
        : [{ title: s.subtitle || "Tasks", cards: list(s).slice(0, 5) }];
      return [{ use: "kanban-board", props: { columns, width: Math.min(1400, 340 * columns.length + 60) } }];
    },
    layout: () => COLUMN,
  },
  "onda.card.progress-steps": {
    mode: "list",
    field: listField,
    parts: (s, o) => {
      const steps = (list(s).length ? list(s) : s.title.split(/\s+/)).slice(0, 5).map((x) => (x.length > 18 ? x.slice(0, 17) + "…" : x));
      return [{ use: "progress-steps", props: { steps, current: Math.max(0, steps.length - 1), width: o.portrait ? 900 : 1400 } }];
    },
    layout: () => COLUMN,
  },
  "onda.card.timeline": {
    mode: "list",
    field: listField,
    parts: (s) => [{ use: "timeline", props: { points: (list(s).length ? list(s) : s.title.split(/\s+/)).slice(0, 6).map((label) => ({ label })), fontSize: 34, dotSize: 20 } }],
    layout: (_s, o) => ({ direction: "column", width: o.portrait ? 900 : 1300 }),
  },

  // the body as kinetic captions, a word at a time
  "onda.card.captions": {
    mode: "list",
    field: (s) => (s.body ? "body" : s.subtitle ? "subtitle" : "title"),
    parts: (s, o) => {
      const words = (s.body || s.subtitle || s.title).split(/\s+/).filter(Boolean).slice(0, 40);
      const per = Math.max(250, Math.min(600, ((o.duration - 0.5) * 1000) / Math.max(1, words.length)));
      return [{ use: "captions", props: { captions: words.map((text, i) => ({ text, startMs: i * per, endMs: (i + 1) * per })), fontSize: 64 } }];
    },
    layout: () => COLUMN,
  },

  // numbers: each stat counts up (count-up) or as a stat card
  "onda.card.count-up": {
    mode: "list",
    field: () => "stats.value",
    parts: (s) =>
      (s.stats?.length ? s.stats : [{ value: s.title.match(/\d[\d,.]*/)?.[0] ?? "100", label: line(s) }]).slice(0, 4).flatMap((st, i) => {
        const n = number(st.value) ?? { prefix: "", value: 0, decimals: 0, suffix: st.value };
        return [
          { use: "count-up", group: i, props: { from: 0, to: n.value, decimals: n.decimals, prefix: n.prefix, suffix: n.suffix, fontSize: 120, delay: i * 4 } },
          { use: "fade-in", group: i, props: { text: st.label, fontSize: 32, color: DIM, delay: i * 4 + 10 } },
        ];
      }),
    layout: (_s, o) => (o.portrait ? COLUMN : { direction: "row", width: 480 }),
  },
  "onda.card.stat-card": {
    mode: "list",
    field: () => "stats.value",
    parts: (s) =>
      (s.stats?.length ? s.stats : [{ value: s.title.match(/\d[\d,.]*/)?.[0] ?? "100", label: line(s) || s.title }]).slice(0, 3).map((st, i) => {
        const n = number(st.value) ?? { prefix: "", value: 0, decimals: 0, suffix: st.value };
        return { use: "stat-card", group: i, props: { value: n.value, prefix: n.prefix, suffix: n.suffix, label: st.label, delay: i * 6 } };
      }),
    layout: (_s, o) => (o.portrait ? COLUMN : { direction: "row", width: 560 }),
  },

  // scene blocks
  "onda.card.chapter-card": {
    mode: "full",
    field: () => "title",
    parts: (s) => [{ use: "chapter-card", props: { chapter: s.title, number: s.subtitle && s.subtitle.length <= 12 ? s.subtitle : "" } }],
    layout: () => COLUMN,
  },
  "onda.card.end-card": {
    mode: "full",
    field: () => "title",
    parts: (s) => [{ use: "end-card", props: { cta: s.title, handles: (s.bullets?.length ? s.bullets : s.subtitle ? [s.subtitle] : []).slice(0, 3), handlesFontSize: 34 } }],
    layout: () => COLUMN,
  },
  "onda.card.logo-sting": {
    mode: "full",
    field: () => "title",
    parts: (s) => [{ use: "logo-sting", props: { title: s.title } }],
    layout: (_s, o) => panel(o),
  },
  "onda.card.lower-third": {
    mode: "full",
    field: () => "title",
    parts: (s) => [{ use: "lower-third", props: { name: s.title, role: line(s), fontSize: 72, roleFontSize: 36 } }],
    layout: (_s, o) => panel(o),
  },
  "onda.card.quote-card": {
    mode: "full",
    field: (s) => (s.body ? "body" : "title"),
    parts: (s) => [{ use: "quote-card", props: s.body ? { quote: s.body, author: s.subtitle || s.title, role: s.subtitle ? s.title : "" } : { quote: s.title, author: s.subtitle || "", role: "" } }],
    layout: () => COLUMN,
  },

  // atmosphere: the slide's title over a moving backdrop
  "onda.card.dynamic-grid": scene("dynamic-grid", "front", () => ({ background: "transparent", color: "color-mix(in srgb, var(--onda-accent, #D96B82) 40%, transparent)", opacity: 0.9 })),
  "onda.card.gradient-shift": scene("gradient-shift", "front", () => ({ from: "color-mix(in srgb, var(--onda-accent, #D96B82) 35%, transparent)", to: "transparent" })),
  "onda.card.mesh-gradient": scene("mesh-gradient", "front", () => ({ background: "transparent" })),
  "onda.card.grain-overlay": scene("grain-overlay", "back", () => ({ opacity: 0.08 })),
  "onda.card.spotlight": scene("spotlight", "front", () => ({ color: "color-mix(in srgb, var(--onda-accent, #D96B82) 35%, transparent)", radius: 45 })),
  "onda.card.vignette": scene("vignette", "back", () => ({ intensity: 0.7 })),
  "onda.card.marquee": {
    mode: "list",
    field: listField,
    parts: (s) => [{ use: "marquee", props: { items: (list(s).length ? list(s) : s.title.split(/\s+/)).slice(0, 8), fontSize: 56 } }],
    layout: (_s, o) => ({ direction: "column", panel: { width: o.portrait ? 900 : 1600, height: 160 } }),
  },
};

export const extraCardMode = (id: ExtraCardId): Mode => EXTRA[id].mode;
export const extraCardField = (id: ExtraCardId, s: Content): string | null => EXTRA[id].field(s);
export const extraCardParts = (id: ExtraCardId, s: Content, o: Opts): CardPart[] => EXTRA[id].parts(s, o);
export const extraCardLayout = (id: ExtraCardId, s: Content, o: Opts): CardLayout => EXTRA[id].layout(s, o);
