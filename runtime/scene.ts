import { STYLES, type SlideSpec } from "./types";
import type { Theme } from "./themes";
import { Ctx, EngineImpls, Seek, TransitionHandle, TransitionTargets, h, parseNumber } from "./dom";
import { remotion } from "./engines/remotion";
import { anime } from "./engines/anime";
import { motion } from "./engines/motion";
import { gsapEngine } from "./engines/gsap";
import { isRemocnId, isVideoSrc, remocnAvailable, remocnBackground, remocnDecor, remocnScene, remocnText } from "./engines/remocn";
import { cardField, cardMode, cardTakesLists, isCardId, isChartId, type CardMode } from "./cards";

const ENGINES: EngineImpls[] = [remotion, anime, motion, gsapEngine];

type Cat = keyof EngineImpls;
export function findImpl<C extends Cat>(cat: C, id: string): EngineImpls[C][string] | undefined {
  for (const e of ENGINES) {
    const f = e[cat][id];
    if (f) return f as EngineImpls[C][string];
  }
  // remocn components (only when their bundle was inlined into the page — see lib/compose.ts)
  if (isRemocnId(id) && remocnAvailable(id)) {
    if (cat === "text") return remocnText(id) as EngineImpls[C][string];
    if (cat === "background") return remocnBackground(id) as EngineImpls[C][string];
    if (cat === "decor") return remocnDecor(id) as EngineImpls[C][string];
  }
  return undefined;
}

/** Every implemented id per category (used by tests + fallbacks). Onda cards count when the add-on is on the page. */
export function implementedIds(): Record<Cat | "card", string[]> {
  const out = {} as Record<Cat | "card", string[]>;
  for (const cat of ["text", "entrance", "list", "number", "chart", "background", "decor", "transition"] as Cat[]) {
    out[cat] = ENGINES.flatMap((e) => Object.keys(e[cat]));
  }
  const onda = window.PromptMotionOnda?.ids ?? [];
  out.card = onda.filter((id) => id.startsWith("onda.card."));
  out.chart = [...out.chart, ...onda.filter((id) => id.startsWith("onda.chart."))];
  return out;
}

const FALLBACK: Record<Cat, string> = {
  text: "motion.text.word-fade-up",
  entrance: "motion.enter.fade-up",
  list: "motion.list.stagger-fade",
  number: "motion.number.animate-value",
  chart: "gsap.chart.bars-stagger",
  background: "remotion.bg.gradient-shift",
  decor: "anime.svg.line-draw",
  transition: "remotion.transition.fade",
};

function impl<C extends Cat>(cat: C, id: string | undefined): EngineImpls[C][string] {
  return (id && findImpl(cat, id)) || (findImpl(cat, FALLBACK[cat]) as EngineImpls[C][string]);
}

export interface Track {
  start: number;
  seek: Seek;
  failed?: boolean;
}

export interface BuiltScene {
  el: HTMLElement;
  tracks: Track[];
  duration: number;
  makeTransition: (t: Omit<TransitionTargets, "inEl">, ctx: Ctx) => TransitionHandle;
  ctx: Ctx;
}

function titleSize(text: string, big: boolean) {
  const n = text.length;
  if (big) return n <= 18 ? 150 : n <= 34 ? 120 : n <= 60 ? 92 : 76;
  return n <= 28 ? 92 : n <= 50 ? 76 : n <= 80 ? 62 : 52;
}

function safeTry<T>(fn: () => T, fallback: () => T, label: string): T {
  try {
    return fn();
  } catch (e) {
    console.warn("[prompt-motion] component failed, using fallback:", label, e);
    return fallback();
  }
}

/** Marks an element as editable text (studio preview): which field of the slide it shows, and the list position. */
function tag<E extends HTMLElement>(el: E, field: string, i?: number): E {
  el.dataset.pmField = field;
  if (i != null) el.dataset.pmI = String(i);
  return el;
}

export function buildScene(spec: SlideSpec, theme: Theme, index: number, parent: HTMLElement, before: Node | null): BuiltScene {
  const A = spec.animations;
  const ctx: Ctx = { theme, seed: index * 7919 + 17, duration: spec.duration };
  const style = spec.style && STYLES.includes(spec.style) ? spec.style : STYLES[index % STYLES.length];
  const el = h("section", `pm-scene pm-l-${spec.layout} pm-s-${style}`);
  el.dataset.index = String(index);
  const bg = h("div", "pm-bg");
  const decor = h("div", "pm-decor");
  const content = h("div", "pm-content");
  el.append(bg, decor, content);

  const tracks: Track[] = [];
  const blocks: HTMLElement[] = [];
  const items: HTMLElement[] = [];
  const numbers: HTMLElement[] = [];
  const bars: HTMLElement[] = [];
  let showcase: HTMLElement | null = null;
  /** uploaded video clip: scrubbed with the master clock */
  let video: HTMLVideoElement | null = null;

  const big = spec.layout === "hero" || spec.layout === "closing" || spec.layout === "big-number";
  const title = tag(h("h1", "pm-title", spec.title), "title");
  // --pm-ts scales titles down on the narrower portrait stage
  title.style.fontSize = `calc(${titleSize(spec.title, big)}px * var(--pm-ts, 1))`;

  const sub = spec.subtitle ? tag(h("p", "pm-sub", spec.subtitle), "subtitle") : null;
  const body = spec.body ? tag(h("p", "pm-body", spec.body), "body") : null;
  const kicker = h("div", "pm-kicker");

  // Onda card: drawn by the add-on bundle (only on pages that include it) into `host`, filled with the slide's words
  const card = isCardId(spec.card) && window.PromptMotionOnda ? spec.card : undefined;
  const mode: CardMode | null = card ? cardMode(card, spec) : null;
  const host = card ? h("div", `pm-card-host pm-card-${mode}`) : null;
  if (card && host) {
    const field = cardField(card, spec);
    if (field) tag(host, field, 0);
  }
  // the card shows the slide's lists/numbers itself, so the slide's own layout leaves them out
  const lists = !card || !cardTakesLists(card);
  /** slot for an Onda chart (chart slides whose chart slot holds one) */
  let ondaChart: HTMLElement | null = null;

  const statsList = lists ? (spec.stats ?? []).slice(0, 6) : [];
  const bulletList = lists ? (spec.bullets ?? []).slice(0, 6) : [];
  const itemList = lists ? (spec.items ?? []).slice(0, 5) : [];

  if (mode === "full" && host) {
    content.append(host);
  } else if (mode === "list" && host) {
    content.append(title);
    for (const b of [sub, body]) {
      if (!b) continue;
      content.append(b);
      blocks.push(b);
    }
    content.append(host);
  } else switch (spec.layout) {
    case "hero":
    case "closing": {
      content.append(kicker, title);
      if (sub) {
        content.append(sub);
        blocks.push(sub);
      }
      if (body) {
        content.append(body);
        blocks.push(body);
      }
      if (bulletList.length) {
        const row = h("div", "pm-pills");
        bulletList.slice(0, 4).forEach((b, i) => {
          const p = tag(h("span", "pm-pill", b), "bullets", i);
          row.appendChild(p);
          items.push(p);
        });
        content.append(row);
      }
      break;
    }
    case "title-bullets":
    case "split-image": {
      const col = h("div", "pm-col");
      col.append(title);
      if (sub) {
        col.append(sub);
        blocks.push(sub);
      }
      if (body) {
        col.append(body);
        blocks.push(body);
      }
      const ul = h("ul", "pm-bullets");
      bulletList.forEach((b, i) => {
        const li = tag(h("li"), "bullets", i);
        const mark = h("span", "pm-mark", String(i + 1).padStart(2, "0"));
        li.append(mark, h("span", "", b));
        ul.appendChild(li);
        items.push(li);
      });
      if (!bulletList.length)
        itemList.forEach((it, i) => {
          const li = tag(h("li"), "items.heading", i);
          li.append(h("span", "pm-mark", String(i + 1).padStart(2, "0")), h("span", "", `${it.heading} — ${it.text}`));
          ul.appendChild(li);
          items.push(li);
        });
      if (items.length) col.append(ul);
      content.append(col);
      // a card beside the text takes the image's place
      if (spec.layout === "split-image" && mode !== "side") {
        const fig = h("figure", "pm-media");
        if (spec.image && isVideoSrc(spec.image)) {
          video = h("video") as HTMLVideoElement;
          Object.assign(video, { src: spec.image, muted: true, playsInline: true, preload: "auto", loop: false });
          video.setAttribute("aria-label", spec.imageAlt || spec.title);
          fig.appendChild(video);
        } else if (spec.image) {
          const img = h("img");
          img.src = spec.image;
          img.alt = spec.imageAlt || spec.title;
          fig.appendChild(img);
        } else {
          fig.classList.add("pm-media-empty");
          fig.appendChild(h("span", "pm-glyph", (spec.title.trim()[0] || "✦").toUpperCase()));
        }
        content.append(fig);
        blocks.push(fig);
      }
      break;
    }
    case "stats": {
      content.append(title);
      if (sub) {
        content.append(sub);
        blocks.push(sub);
      }
      const grid = h("div", "pm-stats");
      grid.style.gridTemplateColumns = `repeat(${Math.min(4, Math.max(1, statsList.length))}, 1fr)`;
      statsList.forEach((st, i) => {
        const card = h("div", "pm-stat");
        const num = tag(h("div", "pm-num", st.value), "stats.value", i);
        num.dataset.value = st.value;
        card.append(num, tag(h("div", "pm-stat-label", st.label), "stats.label", i));
        grid.appendChild(card);
        items.push(card);
        numbers.push(num);
      });
      content.append(grid);
      if (body) {
        content.append(body);
        blocks.push(body);
      }
      break;
    }
    case "big-number": {
      const st = statsList[0] ?? { value: "100%", label: spec.subtitle ?? "" };
      const num = tag(h("div", "pm-num pm-huge", st.value), "stats.value", 0);
      num.dataset.value = st.value;
      numbers.push(num);
      const label = tag(h("div", "pm-huge-label", st.label), "stats.label", 0);
      title.style.fontSize = `calc(${titleSize(spec.title, false) * 0.8}px * var(--pm-ts, 1))`;
      content.append(title, num, label);
      blocks.push(label);
      if (body) {
        content.append(body);
        blocks.push(body);
      }
      break;
    }
    case "chart": {
      content.append(title);
      if (sub) {
        content.append(sub);
        blocks.push(sub);
      }
      // an Onda chart in the chart slot is drawn by the add-on instead of the built-in bars
      if (isChartId(A.chart) && window.PromptMotionOnda && statsList.length) {
        ondaChart = tag(h("div", "pm-card-host pm-card-list"), "stats.value", 0);
        content.append(ondaChart);
        break;
      }
      const chart = h("div", "pm-chart");
      const parsed = statsList.map((st) => ({ st, n: parseNumber(st.value) }));
      const max = Math.max(1, ...parsed.map((p) => (p.n.ok ? Math.abs(p.n.value) : 0)));
      parsed.forEach(({ st, n }, i) => {
        const bar = h("div", "pm-bar");
        const track = h("div", "pm-bar-track");
        const fill = h("div", "pm-bar-fill");
        fill.style.height = `${Math.max(4, ((n.ok ? Math.abs(n.value) : max * 0.5) / max) * 100)}%`;
        const val = tag(h("div", "pm-bar-val", st.value), "stats.value", i);
        fill.appendChild(val);
        track.appendChild(fill);
        bar.append(track, tag(h("div", "pm-bar-label", st.label), "stats.label", i));
        chart.appendChild(bar);
        bars.push(bar);
      });
      content.append(chart);
      break;
    }
    case "cards":
    case "timeline": {
      content.append(title);
      if (sub) {
        content.append(sub);
        blocks.push(sub);
      }
      const list = itemList.length ? itemList : bulletList.map((b) => ({ heading: b.split(/[:—-]/)[0].slice(0, 40), text: b }));
      const wrap = h("div", spec.layout === "cards" ? "pm-cards" : "pm-timeline");
      wrap.style.gridTemplateColumns = `repeat(${Math.min(5, Math.max(1, list.length))}, 1fr)`;
      list.forEach((it, i) => {
        const card = h("div", spec.layout === "cards" ? "pm-card" : "pm-step");
        // cards made from bullets (no items) edit those bullets
        const heading = itemList.length ? tag(h("h3", "", it.heading), "items.heading", i) : tag(h("h3", "", it.heading), "bullets", i);
        const text = itemList.length ? tag(h("p", "", it.text), "items.text", i) : tag(h("p", "", it.text), "bullets", i);
        card.append(h("div", "pm-badge", String(i + 1)), heading, text);
        wrap.appendChild(card);
        items.push(card);
      });
      content.append(wrap);
      break;
    }
    case "quote": {
      const q = h("blockquote", "pm-quote");
      q.append(h("span", "pm-qmark", "“"), tag(h("p", "", spec.body || spec.title), spec.body ? "body" : "title"));
      const who = tag(h("cite", "", spec.subtitle ? `— ${spec.subtitle}` : ""), "subtitle");
      if (spec.body) {
        title.classList.add("pm-title-small");
        title.style.fontSize = "44px";
        content.append(title);
      }
      content.append(q, who);
      blocks.push(q, who);
      break;
    }
    case "showcase": {
      title.style.fontSize = `calc(${Math.round(titleSize(spec.title, false) * 0.7)}px * var(--pm-ts, 1))`;
      content.append(title);
      if (sub) {
        content.append(sub);
        blocks.push(sub);
      }
      showcase = h("div", "pm-showcase");
      content.append(showcase);
      break;
    }
  }

  if (mode === "side" && host) {
    const col = h("div", "pm-col pm-card-col");
    col.append(...Array.from(content.childNodes));
    content.classList.add("pm-with-card");
    content.append(col, host);
  }

  // ── wire animations (scene must be attached so engines can measure/split) ──
  parent.insertBefore(el, before);
  const t = (start: number, label: string, mk: () => Seek, fb: () => Seek) => tracks.push({ start, seek: safeTry(mk, fb, label) });

  t(0, A.background, () => impl("background", A.background)(bg, ctx), () => impl("background", FALLBACK.background)(bg, ctx));
  t(0.15, A.decor, () => impl("decor", A.decor)(decor, ctx), () => () => {});
  const isTitleHidden = (spec.layout === "quote" && !spec.body) || mode === "full";
  if (!isTitleHidden) t(0.25, A.title, () => impl("text", A.title)(title, ctx), () => impl("entrance", FALLBACK.entrance)(title, ctx));

  let cursor = 0.9;
  blocks.forEach((b) => {
    t(cursor, A.body, () => impl("entrance", A.body)(b, ctx), () => () => {});
    cursor += 0.25;
  });
  const itemsStart = Math.max(1.1, cursor - 0.1);
  if (items.length) t(itemsStart, A.items, () => impl("list", A.items)(items, ctx), () => () => {});
  numbers.forEach((n, i) => {
    const parsed = parseNumber(n.dataset.value || n.textContent || "");
    const start = spec.layout === "big-number" ? 0.7 : itemsStart + 0.25 + i * 0.15;
    t(start, A.number, () => impl("number", A.number)(n, parsed, ctx), () => () => {});
  });
  if (bars.length) t(1.0, A.chart, () => impl("chart", A.chart)(bars, ctx), () => () => {});
  const box = showcase;
  if (box && A.scene)
    t(
      0.5,
      A.scene,
      () => remocnScene(A.scene!, box, { title: spec.title, subtitle: spec.subtitle ?? spec.body, bullets: spec.bullets, images: spec.images ?? (spec.image ? [spec.image] : undefined) }, ctx),
      () => () => {},
    );
  const clip = video;
  if (clip)
    tracks.push({
      start: 0,
      seek: (tt) => {
        // a paused <video> scrubbed to the scene time (loops if the clip is shorter than the slide)
        const d = clip.duration;
        const target = Number.isFinite(d) && d > 0 ? Math.max(0, tt) % d : Math.max(0, tt);
        if (Math.abs(clip.currentTime - target) > 0.04) clip.currentTime = target;
      },
    });
  const portrait = document.body.classList.contains("pm-portrait");
  const ondaDuration = Math.max(spec.duration || 6, 10);
  if (card && host) {
    const onda = window.PromptMotionOnda!;
    t(mode === "full" ? 0.3 : mode === "list" ? itemsStart : 0.8, card, () => onda.mount(host, { id: card, spec, theme, portrait, duration: ondaDuration }), () => () => {});
  }
  if (ondaChart && isChartId(A.chart)) {
    const onda = window.PromptMotionOnda!;
    const id = A.chart;
    const slot = ondaChart;
    t(1.0, id, () => onda.mount(slot, { id, spec, theme, portrait, duration: ondaDuration }), () => () => {});
  }

  // minimum duration so every element finishes animating + 2s of hold
  const lastStart = Math.max(...tracks.map((tr) => tr.start), 0);
  const duration = Math.max(spec.duration || 6, lastStart + 3.2);

  return {
    el,
    tracks,
    duration,
    ctx,
    makeTransition: (targets, c) => {
      const mk = impl("transition", A.transition);
      return mk({ ...targets, inEl: el }, c);
    },
  };
}
