import { STYLES, type SlideSpec } from "./types";
import type { Theme } from "./themes";
import { Ctx, EngineImpls, Seek, TransitionHandle, TransitionTargets, h, parseNumber } from "./dom";
import { remotion } from "./engines/remotion";
import { anime } from "./engines/anime";
import { motion } from "./engines/motion";
import { gsapEngine } from "./engines/gsap";

const ENGINES: EngineImpls[] = [remotion, anime, motion, gsapEngine];

type Cat = keyof EngineImpls;
export function findImpl<C extends Cat>(cat: C, id: string): EngineImpls[C][string] | undefined {
  for (const e of ENGINES) {
    const f = e[cat][id];
    if (f) return f as EngineImpls[C][string];
  }
  return undefined;
}

/** Every implemented id per category (used by tests + fallbacks). */
export function implementedIds(): Record<Cat, string[]> {
  const out = {} as Record<Cat, string[]>;
  for (const cat of ["text", "entrance", "list", "number", "chart", "background", "decor", "transition"] as Cat[]) {
    out[cat] = ENGINES.flatMap((e) => Object.keys(e[cat]));
  }
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

  const big = spec.layout === "hero" || spec.layout === "closing" || spec.layout === "big-number";
  const title = h("h1", "pm-title", spec.title);
  // --pm-ts scales titles down on the narrower portrait stage
  title.style.fontSize = `calc(${titleSize(spec.title, big)}px * var(--pm-ts, 1))`;

  const sub = spec.subtitle ? h("p", "pm-sub", spec.subtitle) : null;
  const body = spec.body ? h("p", "pm-body", spec.body) : null;
  const kicker = h("div", "pm-kicker");

  const statsList = (spec.stats ?? []).slice(0, 6);
  const bulletList = (spec.bullets ?? []).slice(0, 6);
  const itemList = (spec.items ?? []).slice(0, 5);

  switch (spec.layout) {
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
        bulletList.slice(0, 4).forEach((b) => {
          const p = h("span", "pm-pill", b);
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
        const li = h("li");
        const mark = h("span", "pm-mark", String(i + 1).padStart(2, "0"));
        li.append(mark, h("span", "", b));
        ul.appendChild(li);
        items.push(li);
      });
      if (!bulletList.length)
        itemList.forEach((it, i) => {
          const li = h("li");
          li.append(h("span", "pm-mark", String(i + 1).padStart(2, "0")), h("span", "", `${it.heading} — ${it.text}`));
          ul.appendChild(li);
          items.push(li);
        });
      if (items.length) col.append(ul);
      content.append(col);
      if (spec.layout === "split-image") {
        const fig = h("figure", "pm-media");
        if (spec.image) {
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
      statsList.forEach((st) => {
        const card = h("div", "pm-stat");
        const num = h("div", "pm-num", st.value);
        num.dataset.value = st.value;
        card.append(num, h("div", "pm-stat-label", st.label));
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
      const num = h("div", "pm-num pm-huge", st.value);
      num.dataset.value = st.value;
      numbers.push(num);
      const label = h("div", "pm-huge-label", st.label);
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
      const chart = h("div", "pm-chart");
      const parsed = statsList.map((st) => ({ st, n: parseNumber(st.value) }));
      const max = Math.max(1, ...parsed.map((p) => (p.n.ok ? Math.abs(p.n.value) : 0)));
      parsed.forEach(({ st, n }) => {
        const bar = h("div", "pm-bar");
        const track = h("div", "pm-bar-track");
        const fill = h("div", "pm-bar-fill");
        fill.style.height = `${Math.max(4, ((n.ok ? Math.abs(n.value) : max * 0.5) / max) * 100)}%`;
        const val = h("div", "pm-bar-val", st.value);
        fill.appendChild(val);
        track.appendChild(fill);
        bar.append(track, h("div", "pm-bar-label", st.label));
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
        card.append(h("div", "pm-badge", String(i + 1)), h("h3", "", it.heading), h("p", "", it.text));
        wrap.appendChild(card);
        items.push(card);
      });
      content.append(wrap);
      break;
    }
    case "quote": {
      const q = h("blockquote", "pm-quote");
      q.append(h("span", "pm-qmark", "“"), h("p", "", spec.body || spec.title));
      const who = h("cite", "", spec.subtitle ? `— ${spec.subtitle}` : "");
      if (spec.body) {
        title.classList.add("pm-title-small");
        title.style.fontSize = "44px";
        content.append(title);
      }
      content.append(q, who);
      blocks.push(q, who);
      break;
    }
  }

  // ── wire animations (scene must be attached so engines can measure/split) ──
  parent.insertBefore(el, before);
  const t = (start: number, label: string, mk: () => Seek, fb: () => Seek) => tracks.push({ start, seek: safeTry(mk, fb, label) });

  t(0, A.background, () => impl("background", A.background)(bg, ctx), () => impl("background", FALLBACK.background)(bg, ctx));
  t(0.15, A.decor, () => impl("decor", A.decor)(decor, ctx), () => () => {});
  const isTitleHidden = spec.layout === "quote" && !spec.body;
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
