// Onda components on a slide: cards (whole content blocks) and charts (the chart slot of a chart slide).
// Which ids exist, where a card sits on the slide, and which slide text fills it.
// Pure TypeScript (no React), shared by the slide runtime, the Onda add-on bundle and the server.
import type { SlideSpec } from "./types";
import type { Theme } from "./themes";

export const CARD_IDS = ["onda.card.bento-grid", "onda.card.pricing-card", "onda.card.skeleton-card", "onda.card.spotlight-card"] as const;
export type CardId = (typeof CARD_IDS)[number];
export const isCardId = (v: unknown): v is CardId => typeof v === "string" && (CARD_IDS as readonly string[]).includes(v);

/** Onda's data charts: drawn in place of the built-in bars on "chart" slides, from the slide's numbers. */
export const CHART_IDS = ["onda.chart.bar-chart", "onda.chart.line-chart", "onda.chart.pie-reveal", "onda.chart.progress-bar"] as const;
export type ChartId = (typeof CHART_IDS)[number];
export const isChartId = (v: unknown): v is ChartId => typeof v === "string" && (CHART_IDS as readonly string[]).includes(v);

export type OndaId = CardId | ChartId;
export const ONDA_IDS: readonly OndaId[] = [...CARD_IDS, ...CHART_IDS];

/** Does this slide draw an Onda component (so its page needs the Onda add-on)? */
export const usesOnda = (s: Pick<SlideSpec, "card" | "layout" | "animations">): boolean =>
  isCardId(s.card) || (s.layout === "chart" && isChartId(s.animations?.chart));

export interface OndaMountOptions {
  /** an Onda card or chart id */
  id: OndaId;
  spec: SlideSpec;
  theme: Theme;
  portrait: boolean;
  /** scene length in seconds */
  duration: number;
}

/** The Onda add-on bundle (runtime/onda/addon.tsx) registers itself as window.PromptMotionOnda. */
export interface OndaAddon {
  version: string;
  ids: readonly string[];
  /** draws a card or chart into `host` (sized by the slide's CSS); returns seek(t) driven by the slide's clock */
  mount(host: HTMLElement, o: OndaMountOptions): (t: number) => void;
}

declare global {
  interface Window {
    PromptMotionOnda?: OndaAddon;
  }
}

/**
 * - "full": the card is the whole slide (it shows the title itself);
 * - "list": title + subtitle stay on top, the card replaces the slide's list/numbers below;
 * - "side": the slide's own content on the left, the card on the right (stacked in portrait).
 */
export type CardMode = "full" | "list" | "side";

type Content = Pick<SlideSpec, "title" | "subtitle" | "body" | "bullets" | "items" | "stats">;

const PERIOD = /(\/\s?(?:mo|month|yr|year|user|seat|week|day)\w*|\bper\s+(?:month|year|user|seat|week)\b)/i;
const MONEY = /[$€£₹¥]\s?\d[\d,.]*(?:\s?[kKmM])?|\bfree\b/i;

interface Tier {
  tier: string;
  price: string;
  period: string;
  features: string[];
}

/** Pricing plans on the slide: 2-3 numbers become side-by-side plans, otherwise one plan. */
function pricingTiers(s: Content): Tier[] {
  const stats = s.stats ?? [];
  const features = (s.bullets?.length ? s.bullets : (s.items ?? []).map((it) => (it.text ? `${it.heading}: ${it.text}` : it.heading))).slice(0, 5);
  if (stats.length >= 2) {
    const items = s.items ?? [];
    return stats.slice(0, 3).map((st, i) => ({
      tier: st.label.replace(PERIOD, "").trim() || `Plan ${i + 1}`,
      price: st.value,
      period: st.label.match(PERIOD)?.[0] ?? "",
      // one card's features from the matching card text ("a, b, c"), when the slide has one per plan
      features: items.length === stats.length ? (items[i].text || "").split(/\s*[,;•]\s*/).filter(Boolean).slice(0, 4) : [],
    }));
  }
  const st = stats[0];
  const words = [s.title, s.subtitle, s.body, ...(s.bullets ?? [])].filter(Boolean).join(" ");
  const price = st?.value || words.match(MONEY)?.[0] || "Free";
  const period = st?.label.match(PERIOD)?.[0] ?? words.match(PERIOD)?.[0] ?? "";
  const tier = st ? st.label.replace(PERIOD, "").trim() : "";
  return [{ tier: tier || "Pro", price, period, features }];
}

export function cardMode(card: CardId, s: Content): CardMode {
  switch (card) {
    case "onda.card.bento-grid":
      return "list";
    case "onda.card.spotlight-card":
      return "full";
    case "onda.card.skeleton-card":
      return "side";
    case "onda.card.pricing-card":
      return pricingTiers(s).length > 1 ? "list" : "side";
  }
}

/** Does the card show the slide's lists/numbers itself (so the slide's own layout leaves them out)? */
export const cardTakesLists = (card: CardId): boolean => card !== "onda.card.skeleton-card";

/** Which slide field a click on the card edits (studio click-to-edit); null = decorative. */
export function cardField(card: CardId, s: Content): string | null {
  switch (card) {
    case "onda.card.spotlight-card":
      return "title";
    case "onda.card.skeleton-card":
      return null;
    case "onda.card.pricing-card":
      return s.stats?.length ? "stats.value" : s.bullets?.length ? "bullets" : "title";
    case "onda.card.bento-grid":
      return s.items?.length ? "items.heading" : s.stats?.length ? "stats.value" : s.bullets?.length ? "bullets" : "title";
  }
}

/** Bento spans: 3 columns alternate wide/narrow rows ([2,1] then [1,2]); 2 columns (portrait) open with a full-width cell. */
function spans(n: number, cols: number): number[] {
  if (cols === 2) return Array.from({ length: n }, (_, i) => (i === 0 || (i === n - 1 && (n - 1) % 2 === 1) ? 2 : 1));
  const out: number[] = [];
  for (let i = 0, row = 0; i < n; i += 2, row++) {
    if (i === n - 1) out.push(3);
    else out.push(row % 2 === 0 ? 2 : 1, row % 2 === 0 ? 1 : 2);
  }
  return out;
}

function bentoCells(s: Content): { title: string; caption?: string; value?: string }[] {
  if (s.items?.length) return s.items.map((it) => (it.heading ? { title: it.heading, caption: it.text || undefined } : { title: it.text }));
  if (s.stats?.length) return s.stats.map((st) => ({ title: st.label, value: st.value }));
  if (s.bullets?.length)
    return s.bullets.map((b) => {
      const m = b.match(/^(.{2,40}?)\s*[:—–-]\s+(.+)$/);
      return m ? { title: m[1], caption: m[2] } : { title: b };
    });
  return [{ title: s.subtitle || s.title, caption: s.body }];
}

/**
 * Props for the Onda component(s), from the slide's words (so text edits show up in the card). Returns one entry per
 * card to draw (pricing can draw 2-3 plans side by side). Unset props take Onda's own defaults.
 */
export function cardProps(card: CardId, s: Content, opts: { portrait: boolean }): Record<string, unknown>[] {
  switch (card) {
    case "onda.card.bento-grid": {
      const cells = bentoCells(s).slice(0, 6);
      const cols = opts.portrait ? 2 : 3;
      const span = spans(cells.length, cols);
      // one earned accent: the first cell with a figure, else the first cell
      const accent = Math.max(0, cells.findIndex((c) => c.value));
      return [
        {
          items: cells.map((c, i) => ({ ...c, colSpan: span[i], rowSpan: 1, accent: i === accent })),
          columns: cols,
          width: opts.portrait ? 820 : 1240,
        },
      ];
    }
    case "onda.card.pricing-card": {
      const tiers = pricingTiers(s);
      return tiers.map((t, i) => ({ ...t, cta: "Get started", recommended: tiers.length === 1 || i === Math.min(1, tiers.length - 1), width: tiers.length > 1 ? 360 : 420 }));
    }
    case "onda.card.skeleton-card":
      return [{ lines: 4, thumbnail: true, width: 520 }];
    case "onda.card.spotlight-card": {
      const short = s.subtitle && s.subtitle.length <= 40 ? s.subtitle : "";
      const list = s.items?.length ? s.items.map((it) => it.heading).join(" · ") : (s.bullets ?? []).join(" · ");
      return [{ eyebrow: short, title: s.title, body: s.body || (short ? "" : s.subtitle) || list || "", width: 820, padding: 56 }];
    }
  }
}
