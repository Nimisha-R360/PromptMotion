// Remotion engine: every style is a pure function of the current frame, exactly like a Remotion composition.
import { interpolate } from "remotion-core/interpolate.js";
import { spring } from "remotion-core/spring/index.js";
import { interpolateColors } from "remotion-core/interpolate-colors.js";
import { Easing } from "remotion-core/easing.js";
import { random } from "remotion-core/random.js";
import { makeStar } from "remotion-shapes/make-star.js";
import { makeCircle } from "remotion-shapes/make-circle.js";
import { makePolygon } from "remotion-shapes/make-polygon.js";
import { makeHeart } from "remotion-shapes/make-heart.js";
import { evolvePath, interpolatePath, getPointAtLength, getLength } from "@remotion/paths";
import { noise2D } from "@remotion/noise";
import { EngineImpls, FPS, clamp, formatNumber, h, resetStyles, s, splitChars, svgRoot } from "../dom";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const fr = (t: number) => Math.max(0, t) * FPS;
const sp = (frame: number, damping = 12, stiffness = 100, mass = 1) =>
  spring({ frame, fps: FPS, config: { damping, stiffness, mass } });

function centerShape(path: string, w: number, hgt: number, cx: number, cy: number) {
  return { d: path, transform: `translate(${cx - w / 2} ${cy - hgt / 2})` };
}

export const remotion: EngineImpls = {
  text: {
    "remotion.text.spring-words": (el) => {
      const { words } = splitChars(el);
      return (t) => {
        const f = fr(t);
        words.forEach((w, i) => {
          const v = sp(f - i * 4, 10, 120);
          w.style.display = "inline-block";
          w.style.opacity = String(clamp(v * 1.4));
          w.style.transform = `scale(${interpolate(v, [0, 1], [0.3, 1])}) translateY(${interpolate(v, [0, 1], [40, 0])}px)`;
        });
      };
    },
    "remotion.text.typewriter": (el, ctx) => {
      const full = el.textContent ?? "";
      el.textContent = "";
      const txt = h("span");
      const caret = h("span", "pm-caret", "▍");
      caret.style.color = ctx.theme.accent;
      el.append(txt, caret);
      el.setAttribute("aria-label", full);
      const total = Math.min(70, full.length * 1.4);
      return (t) => {
        const f = fr(t);
        const n = Math.round(interpolate(f, [0, total], [0, full.length], CL));
        txt.textContent = full.slice(0, n);
        caret.style.opacity = n >= full.length ? String(Math.round(f / 15) % 2) : "1";
      };
    },
    "remotion.text.mask-rise": (el) => {
      const inner = h("span", "pm-mask-inner", el.textContent ?? "");
      el.textContent = "";
      const mask = h("span", "pm-mask");
      mask.appendChild(inner);
      el.appendChild(mask);
      const ease = Easing.bezier(0.16, 1, 0.3, 1);
      return (t) => {
        const f = fr(t);
        const y = interpolate(f, [0, 28], [110, 0], { ...CL, easing: ease });
        inner.style.transform = `translateY(${y}%)`;
        inner.style.opacity = String(interpolate(f, [0, 6], [0, 1], CL));
      };
    },
    "remotion.text.color-sweep": (el, ctx) => {
      const { chars } = splitChars(el);
      const { text, accent, accent2 } = ctx.theme;
      return (t) => {
        const f = fr(t);
        chars.forEach((c, i) => {
          const local = f - i * 1.2;
          c.style.opacity = String(interpolate(local, [0, 8], [0, 1], CL));
          c.style.color = interpolateColors(local, [0, 10, 26], [accent2, accent, text]);
          c.style.display = "inline-block";
          c.style.transform = `translateY(${interpolate(local, [0, 12], [24, 0], { ...CL, easing: Easing.out(Easing.cubic) })}px)`;
        });
      };
    },
  },

  entrance: {
    "remotion.enter.spring-pop": (el) => (t) => {
      const v = sp(fr(t), 11, 110);
      el.style.opacity = String(clamp(v * 1.3));
      el.style.transform = `scale(${interpolate(v, [0, 1], [0.6, 1])})`;
    },
    "remotion.enter.fade-rise": (el) => (t) => {
      const f = fr(t);
      const e = { ...CL, easing: Easing.out(Easing.cubic) };
      el.style.opacity = String(interpolate(f, [0, 20], [0, 1], e));
      el.style.transform = `translateY(${interpolate(f, [0, 24], [60, 0], e)}px)`;
    },
    "remotion.enter.blur-in": (el) => (t) => {
      const f = fr(t);
      const e = { ...CL, easing: Easing.inOut(Easing.ease) };
      el.style.opacity = String(interpolate(f, [0, 18], [0, 1], e));
      el.style.filter = `blur(${interpolate(f, [0, 24], [24, 0], e)}px)`;
      el.style.transform = `scale(${interpolate(f, [0, 30], [1.15, 1], e)})`;
    },
  },

  list: {
    "remotion.list.spring-cascade": (els) => (t) => {
      const f = fr(t);
      els.forEach((el, i) => {
        // each item lives in its own <Sequence from={i*6}>
        const v = sp(f - i * 6, 13, 120);
        el.style.opacity = String(clamp(v * 1.5));
        el.style.transform = `translateX(${interpolate(v, [0, 1], [-120, 0])}px)`;
      });
    },
    "remotion.list.series-reveal": (els, ctx) => {
      const bars = els.map((el) => {
        const b = h("span", "pm-hl");
        b.style.background = ctx.theme.accent;
        el.style.position = "relative";
        el.appendChild(b);
        return b;
      });
      return (t) => {
        const f = fr(t);
        els.forEach((el, i) => {
          const local = f - i * 12; // <Series.Sequence durationInFrames={12}>
          el.style.opacity = String(interpolate(local, [0, 8], [0, 1], CL));
          el.style.transform = `translateY(${interpolate(local, [0, 10], [20, 0], { ...CL, easing: Easing.out(Easing.quad) })}px)`;
          bars[i].style.transform = `scaleX(${interpolate(local, [0, 10, 22], [0, 1, 0], CL)})`;
        });
      };
    },
  },

  number: {
    "remotion.number.spring-count": (el, n) => (t) => {
      const v = sp(fr(t), 30, 60);
      el.textContent = formatNumber(n, n.value * v);
      el.style.opacity = String(clamp(fr(t) / 6));
    },
  },

  chart: {
    "remotion.chart.spring-bars": (bars) => (t) => {
      const f = fr(t);
      bars.forEach((b, i) => {
        const v = sp(f - i * 5, 12, 90);
        const fill = b.querySelector<HTMLElement>(".pm-bar-fill")!;
        fill.style.transform = `scaleY(${Math.max(0, v)})`;
        const lab = b.querySelector<HTMLElement>(".pm-bar-val");
        if (lab) lab.style.opacity = String(clamp(v));
      });
    },
  },

  background: {
    "remotion.bg.noise-blobs": (layer, ctx) => {
      const colors = [ctx.theme.accent, ctx.theme.accent2, ctx.theme.bg2];
      const blobs = colors.map((c, i) => {
        const b = h("div", "pm-blob");
        b.style.background = `radial-gradient(circle, ${c} 0%, transparent 65%)`;
        b.style.opacity = i === 2 ? "0.9" : "0.45";
        layer.appendChild(b);
        return b;
      });
      return (t) => {
        const f = fr(t);
        blobs.forEach((b, i) => {
          const x = noise2D("x" + i + ctx.seed, f / 160, i) * 500 + [400, 1400, 900][i];
          const y = noise2D("y" + i + ctx.seed, f / 160, i + 4) * 300 + [300, 700, 540][i];
          b.style.transform = `translate(${x - 600}px, ${y - 600}px) scale(${1 + noise2D("s" + i, f / 200, 0) * 0.2})`;
        });
      };
    },
    "remotion.bg.gradient-shift": (layer, ctx) => {
      const { bg, bg2, accent, accent2 } = ctx.theme;
      return (t) => {
        const f = fr(t) % 360;
        const c1 = interpolateColors(f, [0, 120, 240, 360], [bg2, bg, bg2, bg2]);
        const c2 = interpolateColors(f, [0, 180, 360], [accent, accent2, accent]);
        layer.style.background = `radial-gradient(1200px 800px at ${interpolate(f, [0, 360], [20, 80])}% 20%, ${c2}55, transparent 60%), linear-gradient(135deg, ${c1}, ${bg})`;
      };
    },
    "remotion.bg.grid-pan": (layer, ctx) => {
      const grid = h("div", "pm-grid3d");
      grid.style.backgroundImage = `linear-gradient(${ctx.theme.accent}88 3px, transparent 3px), linear-gradient(90deg, ${ctx.theme.accent}88 3px, transparent 3px)`;
      const glow = h("div", "pm-fill");
      glow.style.background = `linear-gradient(180deg, ${ctx.theme.bg} 25%, transparent 60%), radial-gradient(900px 400px at 50% 100%, ${ctx.theme.accent}33, transparent 70%)`;
      layer.append(grid, glow);
      return (t) => {
        grid.style.backgroundPosition = `0 ${interpolate(fr(t), [0, 60], [0, 120], { extrapolateRight: "extend" }) % 120}px`;
      };
    },
  },

  decor: {
    "remotion.shape.star-spin": (layer, ctx) => {
      const svg = svgRoot();
      const stars = [
        { x: 1720, y: 170, r: 70, p: 5 },
        { x: 190, y: 900, r: 46, p: 4 },
        { x: 1600, y: 920, r: 30, p: 6 },
      ].map((d, i) => {
        const shape = makeStar({ points: d.p, innerRadius: d.r * 0.45, outerRadius: d.r, cornerRadius: 4 });
        const g = s("g");
        const path = s("path", { d: shape.path, fill: i === 1 ? ctx.theme.accent2 : ctx.theme.accent, opacity: 0.85 });
        path.setAttribute("transform", `translate(${-shape.width / 2} ${-shape.height / 2})`);
        g.appendChild(path);
        svg.appendChild(g);
        return { g, d, i };
      });
      layer.appendChild(svg);
      return (t) => {
        const f = fr(t);
        stars.forEach(({ g, d, i }) => {
          const v = sp(f - i * 8, 8, 80);
          g.setAttribute("transform", `translate(${d.x} ${d.y}) rotate(${f * (0.6 + random(`star-${ctx.seed}-${i}`) * 1.6)}) scale(${v * (1 + Math.sin(f / 12 + i) * 0.08)})`);
        });
      };
    },
    "remotion.shape.polygon-orbit": (layer, ctx) => {
      const svg = svgRoot();
      const polys = [3, 4, 6, 5].map((p, i) => {
        const shape = makePolygon({ points: p, radius: 40 + i * 8 });
        const path = s("path", { d: shape.path, fill: "none", stroke: i % 2 ? ctx.theme.accent2 : ctx.theme.accent, "stroke-width": 4, opacity: 0.7 });
        svg.appendChild(path);
        return { path, shape, i };
      });
      layer.appendChild(svg);
      return (t) => {
        const f = fr(t);
        polys.forEach(({ path, shape, i }) => {
          const a = (f / 240) * Math.PI * 2 + (i * Math.PI) / 2;
          const x = 960 + Math.cos(a) * 860;
          const y = 540 + Math.sin(a) * 440;
          const o = interpolate(f, [i * 5, i * 5 + 20], [0, 0.75], CL);
          path.setAttribute("opacity", String(o));
          path.setAttribute("transform", `translate(${x - shape.width / 2} ${y - shape.height / 2}) rotate(${f * 2} ${shape.width / 2} ${shape.height / 2})`);
        });
      };
    },
    "remotion.shape.circle-pulse": (layer, ctx) => {
      const svg = svgRoot();
      const rings = [0, 1, 2, 3].map(() => {
        const c = makeCircle({ radius: 300 });
        const p = s("path", { d: c.path, fill: "none", stroke: ctx.theme.accent, "stroke-width": 3 });
        svg.appendChild(p);
        return { p, c };
      });
      layer.appendChild(svg);
      return (t) => {
        const f = fr(t);
        rings.forEach(({ p, c }, i) => {
          const local = (f + i * 30) % 120;
          const sc = interpolate(local, [0, 120], [0.2, 2.2]);
          const { d, transform } = centerShape(c.path, c.width, c.height, 1640, 260);
          p.setAttribute("d", d);
          p.setAttribute("transform", `${transform} translate(${c.width / 2} ${c.height / 2}) scale(${sc}) translate(${-c.width / 2} ${-c.height / 2})`);
          p.setAttribute("opacity", String(interpolate(local, [0, 20, 120], [0, 0.5, 0], CL) * clamp(f / 15)));
        });
      };
    },
    "remotion.path.evolve-line": (layer, ctx) => {
      const svg = svgRoot();
      const d1 = "M -50 860 C 300 640, 600 1040, 980 820 S 1600 560, 1980 760";
      const d2 = "M -50 940 C 360 760, 700 1080, 1040 900 S 1640 700, 1980 860";
      const paths = [d1, d2].map((d, i) => {
        const p = s("path", { d, fill: "none", stroke: i ? ctx.theme.accent2 : ctx.theme.accent, "stroke-width": i ? 3 : 6, "stroke-linecap": "round", opacity: i ? 0.5 : 0.85 });
        svg.appendChild(p);
        return p;
      });
      const dot = s("circle", { r: 10, fill: ctx.theme.accent });
      svg.appendChild(dot);
      layer.appendChild(svg);
      const len = getLength(d1);
      return (t) => {
        const f = fr(t);
        paths.forEach((p, i) => {
          const prog = interpolate(f, [i * 8, 50 + i * 8], [0, 1], { ...CL, easing: Easing.inOut(Easing.cubic) });
          const ev = evolvePath(prog, p.getAttribute("d")!);
          p.style.strokeDasharray = ev.strokeDasharray;
          p.style.strokeDashoffset = String(ev.strokeDashoffset);
        });
        const prog = interpolate(f, [0, 50], [0, 1], { ...CL, easing: Easing.inOut(Easing.cubic) });
        const pt = getPointAtLength(d1, len * prog);
        if (pt) {
          dot.setAttribute("cx", String(pt.x));
          dot.setAttribute("cy", String(pt.y));
        }
        dot.setAttribute("opacity", String(prog > 0 && prog < 1 ? 1 : 0));
      };
    },
    "remotion.shape.morph-blob": (layer, ctx) => {
      const svg = svgRoot();
      const star = makeStar({ points: 6, innerRadius: 70, outerRadius: 140 });
      const circle = makeCircle({ radius: 140 });
      const heart = makeHeart({ height: 260 });
      const shapes = [star.path, circle.path, heart.path];
      const path = s("path", { fill: ctx.theme.accent, opacity: 0.8 });
      svg.appendChild(path);
      layer.appendChild(svg);
      return (t) => {
        const f = fr(t);
        const cyc = (f / 45) % shapes.length;
        const i = Math.floor(cyc);
        const v = interpolate(cyc - i, [0, 0.6, 1], [0, 1, 1], { easing: Easing.inOut(Easing.cubic) });
        const d = interpolatePath(v, shapes[i], shapes[(i + 1) % shapes.length]);
        path.setAttribute("d", d);
        const sc = sp(f, 10, 80);
        path.setAttribute("transform", `translate(1600 760) scale(${sc}) rotate(${f / 2}) translate(-140 -140)`);
        path.setAttribute("fill", interpolateColors(f % 90, [0, 45, 90], [ctx.theme.accent, ctx.theme.accent2, ctx.theme.accent]));
      };
    },
  },

  transition: {
    "remotion.transition.fade": ({ outEl, inEl }) => ({
      seek: (p) => {
        inEl.style.opacity = String(interpolate(p, [0, 1], [0, 1], CL));
        outEl.style.opacity = String(interpolate(p, [0, 1], [1, 0], CL));
      },
      reset: () => resetStyles(outEl, inEl),
    }),
    "remotion.transition.slide": ({ outEl, inEl }) => ({
      seek: (p) => {
        const e = Easing.inOut(Easing.cubic)(p);
        inEl.style.transform = `translateX(${interpolate(e, [0, 1], [100, 0])}%)`;
        outEl.style.transform = `translateX(${interpolate(e, [0, 1], [0, -100])}%)`;
      },
      reset: () => resetStyles(outEl, inEl),
    }),
    "remotion.transition.wipe": ({ outEl, inEl }) => ({
      seek: (p) => {
        const e = Easing.inOut(Easing.quad)(p) * 200;
        inEl.style.clipPath = `polygon(0 0, ${e}% 0, ${e - 100}% 100%, 0 100%)`;
        inEl.style.zIndex = "2";
        outEl.style.zIndex = "1";
      },
      reset: () => resetStyles(outEl, inEl),
    }),
    "remotion.transition.flip": ({ outEl, inEl }) => ({
      seek: (p) => {
        const v = spring({ frame: p * 24, fps: FPS, config: { damping: 200 } });
        const deg = v * 180;
        outEl.style.transform = `perspective(2400px) rotateY(${deg}deg)`;
        inEl.style.transform = `perspective(2400px) rotateY(${deg - 180}deg)`;
        outEl.style.opacity = deg < 90 ? "1" : "0";
        inEl.style.opacity = deg >= 90 ? "1" : "0";
      },
      reset: () => resetStyles(outEl, inEl),
    }),
    "remotion.transition.clock-wipe": ({ outEl, inEl }) => ({
      seek: (p) => {
        const a = interpolate(p, [0, 1], [0, 360]);
        inEl.style.zIndex = "2";
        inEl.style.setProperty("-webkit-mask-image", `conic-gradient(#000 ${a}deg, transparent ${a}deg)`);
        inEl.style.setProperty("mask-image", `conic-gradient(#000 ${a}deg, transparent ${a}deg)`);
      },
      reset: () => {
        resetStyles(outEl, inEl);
        inEl.style.removeProperty("-webkit-mask-image");
        inEl.style.removeProperty("mask-image");
      },
    }),
    "remotion.transition.iris": ({ outEl, inEl }) => ({
      seek: (p) => {
        const r = interpolate(p, [0, 1], [0, 75], { ...CL, easing: Easing.out(Easing.exp) });
        inEl.style.zIndex = "2";
        inEl.style.clipPath = `circle(${r}% at 50% 50%)`;
      },
      reset: () => resetStyles(outEl, inEl),
    }),
  },
};

