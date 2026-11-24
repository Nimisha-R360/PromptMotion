// anime.js v4 engine: every component builds paused animations/timelines (autoplay:false) and is driven by seek().
import { animate, createTimeline, stagger, splitText, scrambleText, svg, spring, utils } from "animejs";
import { EngineImpls, Seek, clamp, formatNumber, h, resetStyles, rng, s, svgRoot } from "../dom";

type Seekable = { seek: (ms: number) => unknown; duration: number };

/** Drive a finite anime animation/timeline from seconds. */
const drive = (a: Seekable): Seek => {
  a.seek(0);
  return (t) => {
    a.seek(clamp(t * 1000, 0, a.duration));
  };
};
/** Drive a looping animation (finite loop count, seeked modulo its iteration). */
const driveLoop = (a: Seekable, period: number): Seek => (t) => {
  a.seek(((Math.max(0, t) * 1000) % period) + 0.0001);
};

export const anime: EngineImpls = {
  text: {
    "anime.text.letters-wave": (el) => {
      const split = splitText(el, { words: { wrap: "clip" }, chars: true });
      return drive(
        animate(split.chars, {
          y: ["110%", "0%"],
          opacity: [0, 1],
          duration: 700,
          delay: stagger(28),
          ease: "outBack(1.6)",
          autoplay: false,
        }),
      );
    },
    "anime.text.scramble": (el, ctx) => {
      const full = el.textContent ?? "";
      el.style.fontVariantNumeric = "tabular-nums";
      const tl = createTimeline({ autoplay: false })
        .set(el, { opacity: 1 })
        .add(el, {
          innerHTML: scrambleText({ text: full, chars: "uppercase", seed: ctx.seed || 7, cursor: "_", revealRate: 40 }),
          duration: Math.min(1800, 300 + full.length * 35),
          ease: "linear",
        });
      el.innerHTML = full;
      const seek = drive(tl);
      return (t) => {
        if (t <= 0) {
          el.textContent = "";
          return;
        }
        seek(t);
      };
    },
    "anime.text.rotate-3d": (el) => {
      el.style.perspective = "800px";
      const split = splitText(el, { chars: true });
      return drive(
        animate(split.chars, {
          rotateX: [-95, 0],
          opacity: [0, 1],
          y: [30, 0],
          duration: 900,
          delay: stagger(35, { from: "center" }),
          ease: "outExpo",
          autoplay: false,
        }),
      );
    },
    "anime.text.elastic-words": (el) => {
      const split = splitText(el, { words: true });
      return drive(
        animate(split.words, {
          y: [-120, 0],
          opacity: [0, 1],
          delay: stagger(110),
          ease: spring({ stiffness: 160, damping: 9 }),
          autoplay: false,
        }),
      );
    },
  },

  entrance: {
    "anime.enter.elastic-scale": (el) =>
      drive(animate(el, { scale: [0.4, 1], opacity: [0, 1], duration: 1200, ease: "outElastic(1, .6)", autoplay: false })),
    "anime.enter.slide-bounce": (el) =>
      drive(animate(el, { x: [260, 0], opacity: { to: [0, 1], duration: 300 }, duration: 1100, ease: "outBounce", autoplay: false })),
    "anime.enter.flip-up": (el) => {
      el.style.transformOrigin = "50% 100%";
      return drive(
        animate(el, { rotateX: [80, 0], opacity: [0, 1], duration: 900, ease: "inOutCirc", autoplay: false }),
      );
    },
  },

  list: {
    "anime.list.stagger-grid": (els) =>
      drive(
        animate(els, {
          scale: [0.2, 1],
          opacity: [0, 1],
          duration: 700,
          delay: stagger(110, { from: "center" }),
          ease: "outBack(1.4)",
          autoplay: false,
        }),
      ),
    "anime.list.stagger-slide": (els) => {
      const tl = createTimeline({ autoplay: false });
      els.forEach((el, i) => {
        tl.add(el, { x: [i % 2 ? 200 : -200, 0], opacity: [0, 1], duration: 650, ease: "outQuart" }, i * 140);
      });
      return drive(tl);
    },
  },

  number: {
    "anime.number.count-up": (el, n) => {
      const obj = { v: 0 };
      const a = animate(obj, {
        v: [0, n.value],
        duration: 1600,
        ease: "outExpo",
        modifier: utils.round(n.decimals),
        onUpdate: () => {
          el.textContent = formatNumber(n, obj.v);
        },
        autoplay: false,
      });
      const seek = drive(a);
      return (t) => {
        seek(t);
        el.textContent = formatNumber(n, obj.v);
        el.style.opacity = t > 0 ? "1" : "0";
      };
    },
  },

  chart: {
    "anime.chart.bars-elastic": (bars) => {
      const fills = bars.map((b) => b.querySelector<HTMLElement>(".pm-bar-fill")!);
      const vals = bars.map((b) => b.querySelector<HTMLElement>(".pm-bar-val")!);
      const tl = createTimeline({ autoplay: false })
        .add(fills, { scaleY: [0, 1], duration: 1300, delay: stagger(120), ease: "outElastic(1, .55)" }, 0)
        .add(vals, { opacity: [0, 1], y: [20, 0], duration: 400, delay: stagger(120) }, 400);
      return drive(tl);
    },
  },

  background: {
    "anime.bg.particles": (layer, ctx) => {
      const r = rng(ctx.seed + 11);
      const dots = Array.from({ length: 46 }, () => {
        const d = h("div", "pm-particle");
        const size = 4 + r() * 10;
        Object.assign(d.style, {
          width: size + "px",
          height: size + "px",
          left: r() * 1920 + "px",
          top: r() * 1080 + "px",
          background: r() > 0.5 ? ctx.theme.accent : ctx.theme.accent2,
          opacity: String(0.15 + r() * 0.5),
        });
        layer.appendChild(d);
        return d;
      });
      const a = animate(dots, {
        x: () => utils.random(-120, 120),
        y: () => utils.random(-160, 40),
        scale: () => [1, utils.random(0.6, 1.6, 2)],
        duration: 4000,
        loop: 30,
        alternate: true,
        ease: "inOutSine",
        autoplay: false,
      });
      return driveLoop(a, 8000);
    },
    "anime.bg.dot-wave": (layer, ctx) => {
      const cols = 32, rows = 18;
      const grid = h("div", "pm-dotgrid");
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      const dots: HTMLElement[] = [];
      for (let i = 0; i < cols * rows; i++) {
        const d = h("span");
        d.style.background = ctx.theme.accent;
        grid.appendChild(d);
        dots.push(d);
      }
      layer.appendChild(grid);
      const a = animate(dots, {
        scale: [{ to: 2.2, duration: 600 }, { to: 1, duration: 900 }],
        opacity: [{ to: 1, duration: 600 }, { to: 0.3, duration: 900 }],
        delay: stagger(60, { grid: [cols, rows], from: "center" }),
        loop: 30,
        ease: "inOutQuad",
        autoplay: false,
      });
      dots.forEach((d) => (d.style.opacity = "0.3"));
      const period = 1500 + 60 * (cols + rows);
      return driveLoop(a, period);
    },
  },

  decor: {
    "anime.svg.line-draw": (layer, ctx) => {
      const root = svgRoot();
      const paths = [
        "M 120 140 Q 360 40 600 140 T 1080 140",
        "M 1800 300 C 1650 420, 1850 560, 1700 700 S 1800 980, 1620 1000",
        "M 80 980 L 380 980 L 460 900 L 760 900",
      ].map((d, i) => {
        const p = s("path", { d, fill: "none", stroke: i === 1 ? ctx.theme.accent2 : ctx.theme.accent, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.8 });
        root.appendChild(p);
        return p;
      });
      layer.appendChild(root);
      const drawables = svg.createDrawable(paths);
      return drive(
        animate(drawables, { draw: ["0 0", "0 1"], duration: 1800, delay: stagger(250), ease: "inOutQuad", autoplay: false }),
      );
    },
    "anime.svg.morph": (layer, ctx) => {
      const root = svgRoot();
      const shapes = [
        "M1600 640 L1740 760 L1690 930 L1510 930 L1460 760 Z",
        "M1600 620 L1760 780 L1600 940 L1440 780 Z",
        "M1600 640 L1720 700 L1760 840 L1600 940 L1440 840 L1480 700 Z",
      ];
      const p = s("path", { d: shapes[0], fill: ctx.theme.accent, opacity: 0.75 });
      const ghosts = shapes.slice(1).map((d) => s("path", { d, fill: "none" }));
      root.append(p, ...ghosts);
      layer.appendChild(root);
      const tl = createTimeline({ autoplay: false, loop: 20 })
        .add(p, { d: svg.morphTo(ghosts[0]), duration: 900, ease: "inOutExpo" }, 300)
        .add(p, { d: svg.morphTo(ghosts[1]), fill: ctx.theme.accent2, duration: 900, ease: "inOutExpo" }, 1600)
        .add(p, { d: shapes[0], fill: ctx.theme.accent, duration: 900, ease: "inOutExpo" }, 2900);
      return driveLoop(tl, 3800);
    },
    "anime.svg.motion-path": (layer, ctx) => {
      const root = svgRoot();
      const d = "M 1500 540 a 300 300 0 1 0 600 0 a 300 300 0 1 0 -600 0";
      const track = s("path", { d, fill: "none", stroke: ctx.theme.accent, "stroke-width": 2, opacity: 0.35, "stroke-dasharray": "6 12" });
      root.appendChild(track);
      const dots = [0, 1, 2].map((i) => {
        const c = s("circle", { r: 12 - i * 3, cx: 0, cy: 0, fill: i ? ctx.theme.accent2 : ctx.theme.accent });
        root.appendChild(c);
        return c;
      });
      layer.appendChild(root);
      root.setAttribute("style", "transform: translateX(-230px)");
      const mp = svg.createMotionPath(track);
      const tl = createTimeline({ autoplay: false, loop: 20 });
      dots.forEach((c, i) => tl.add(c, { ...mp, duration: 4000, ease: "linear" }, i * 300));
      return driveLoop(tl, 4000);
    },
  },

  transition: {
    "anime.transition.shutter": ({ outEl, inEl, overlay }, ctx) => {
      const bars = Array.from({ length: 8 }, (_, i) => {
        const b = h("div", "pm-shutter");
        b.style.left = (i * 100) / 8 + "%";
        b.style.width = 100 / 8 + 0.2 + "%";
        b.style.background = i % 2 ? ctx.theme.accent : ctx.theme.accent2;
        return b;
      });
      const tl = createTimeline({ autoplay: false })
        .add(bars, { scaleY: [0, 1], duration: 450, delay: stagger(40), ease: "inQuart" }, 0)
        .add(bars, { scaleY: [1, 0], duration: 450, delay: stagger(40), ease: "outQuart" }, 550);
      return {
        seek: (p) => {
          if (!bars[0].isConnected) overlay.append(...bars);
          const ms = p * tl.duration;
          tl.seek(ms);
          const half = p > 0.5;
          inEl.style.opacity = half ? "1" : "0";
          outEl.style.opacity = half ? "0" : "1";
        },
        reset: () => {
          bars.forEach((b) => b.remove());
          resetStyles(outEl, inEl);
        },
      };
    },
    "anime.transition.tiles": ({ outEl, inEl, overlay }, ctx) => {
      const cols = 8, rows = 5;
      const tiles = Array.from({ length: cols * rows }, (_, i) => {
        const t = h("div", "pm-tile");
        Object.assign(t.style, {
          left: (i % cols) * (100 / cols) + "%",
          top: Math.floor(i / cols) * (100 / rows) + "%",
          width: 100 / cols + 0.1 + "%",
          height: 100 / rows + 0.1 + "%",
          background: ctx.theme.bg2,
        });
        return t;
      });
      const tl = createTimeline({ autoplay: false })
        .add(tiles, { scale: [0, 1], rotate: [90, 0], duration: 400, delay: stagger(25, { grid: [cols, rows], from: "first" }), ease: "inOutQuad" }, 0)
        .add(tiles, { scale: [1, 0], rotate: [0, -90], duration: 400, delay: stagger(25, { grid: [cols, rows], from: "last" }), ease: "inOutQuad" }, 750);
      return {
        seek: (p) => {
          if (!tiles[0].isConnected) overlay.append(...tiles);
          tl.seek(p * tl.duration);
          inEl.style.opacity = p > 0.5 ? "1" : "0";
          outEl.style.opacity = p > 0.5 ? "0" : "1";
        },
        reset: () => {
          tiles.forEach((t) => t.remove());
          resetStyles(outEl, inEl);
        },
      };
    },
  },
};
