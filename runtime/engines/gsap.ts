// GSAP engine: paused timelines scrubbed with tl.time()/totalTime()/progress().
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { TextPlugin } from "gsap/TextPlugin";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { CustomEase } from "gsap/CustomEase";
import { EngineImpls, Seek, clamp, formatNumber, h, s, svgRoot } from "../dom";

gsap.registerPlugin(SplitText, ScrambleTextPlugin, TextPlugin, DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, CustomEase);
CustomEase.create("pmSnap", "M0,0 C0.14,0 0.24,1.12 0.48,1.04 0.7,0.97 0.8,1 1,1");

type TL = gsap.core.Timeline;
const paused = () => gsap.timeline({ paused: true });
const drive = (tl: TL): Seek => {
  tl.time(0);
  return (t) => {
    tl.time(clamp(t, 0, tl.duration()));
  };
};
const driveLoop = (tl: TL): Seek => (t) => {
  tl.totalTime(Math.min(Math.max(0, t), tl.totalDuration() - 0.001));
};
const CLEAR = "transform,opacity,filter,clipPath,zIndex";

export const gsapEngine: EngineImpls = {
  text: {
    "gsap.text.split-chars": (el) => {
      const split = SplitText.create(el, { type: "chars,words" });
      const tl = paused().fromTo(
        split.chars,
        { opacity: 0, y: 80, rotation: () => gsap.utils.random(-30, 30), scale: 0.4 },
        { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 0.8, ease: "back.out(2)", stagger: { each: 0.03, from: "random" } },
      );
      return drive(tl);
    },
    "gsap.text.scramble": (el) => {
      const full = el.textContent ?? "";
      el.textContent = "";
      const tl = paused().to(el, { duration: Math.min(2, 0.5 + full.length * 0.035), scrambleText: { text: full, chars: "upperCase", revealDelay: 0.3, speed: 0.6 }, ease: "none" });
      return drive(tl);
    },
    "gsap.text.typewriter": (el, ctx) => {
      const full = el.textContent ?? "";
      el.textContent = "";
      const txt = h("span");
      const caret = h("span", "pm-caret", "|");
      caret.style.color = ctx.theme.accent;
      el.append(txt, caret);
      const tl = paused().to(txt, { duration: Math.min(2.2, full.length * 0.05), text: { value: full }, ease: "none" });
      const blink = paused().to(caret, { opacity: 0, duration: 0.4, repeat: 99, yoyo: true, ease: "steps(1)" });
      return (t) => {
        tl.time(clamp(t, 0, tl.duration()));
        blink.totalTime(Math.max(0, t) % 30);
      };
    },
    "gsap.text.lines-mask": (el) => {
      const split = SplitText.create(el, { type: "lines,words", mask: "lines" });
      const tl = paused().fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.12 });
      return drive(tl);
    },
  },

  entrance: {
    "gsap.enter.back-out": (el) => drive(paused().fromTo(el, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.9, ease: "back.out(1.7)" })),
    "gsap.enter.elastic-drop": (el) => drive(paused().fromTo(el, { opacity: 0, y: -160 }, { opacity: 1, y: 0, duration: 1.4, ease: "elastic.out(1, 0.45)" })),
    "gsap.enter.skew-in": (el) => drive(paused().fromTo(el, { opacity: 0, x: 200, skewX: -25 }, { opacity: 1, x: 0, skewX: 0, duration: 1, ease: "expo.out" })),
    "gsap.enter.rotate-3d": (el) =>
      drive(paused().fromTo(el, { opacity: 0, rotationY: -70, transformPerspective: 1200, transformOrigin: "0% 50%" }, { opacity: 1, rotationY: 0, duration: 1.1, ease: "power3.out" })),
  },

  list: {
    "gsap.list.stagger-edges": (els) =>
      drive(paused().fromTo(els, { opacity: 0, scale: 0.6, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: "pmSnap", stagger: { each: 0.12, from: "edges" } })),
    "gsap.list.wave": (els) =>
      drive(
        paused().fromTo(els, { opacity: 0, y: (i: number) => 60 + Math.sin(i) * 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "sine.inOut", stagger: { each: 0.14, ease: "sine.inOut" } }),
      ),
  },

  number: {
    "gsap.number.snap-count": (el, n) => {
      const obj = { v: 0 };
      const step = 1 / Math.pow(10, n.decimals);
      const tl = paused().to(obj, { v: n.value, duration: 1.6, ease: "expo.out", snap: { v: step } });
      return (t) => {
        tl.time(clamp(t, 0, tl.duration()));
        el.textContent = formatNumber(n, obj.v);
        el.style.opacity = t > 0 ? "1" : "0";
      };
    },
  },

  chart: {
    "gsap.chart.bars-stagger": (bars) => {
      const fills = bars.map((b) => b.querySelector(".pm-bar-fill"));
      const vals = bars.map((b) => b.querySelector(".pm-bar-val"));
      const tl = paused()
        .fromTo(fills, { scaleY: 0 }, { scaleY: 1, duration: 1.1, ease: "power4.out", stagger: 0.12 })
        .fromTo(vals, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12 }, 0.5);
      return drive(tl);
    },
  },

  background: {
    "gsap.bg.wave-lines": (layer, ctx) => {
      const root = svgRoot();
      const waves = [0, 1, 2, 3].map((i) => {
        const p = s("path", { fill: "none", stroke: i % 2 ? ctx.theme.accent2 : ctx.theme.accent, "stroke-width": 2, opacity: 0.18 + i * 0.08 });
        root.appendChild(p);
        return p;
      });
      layer.appendChild(root);
      const state = waves.map(() => ({ phase: 0, amp: 40 }));
      const tl = paused();
      state.forEach((st, i) => {
        tl.to(st, { phase: Math.PI * 2, duration: 6 + i, ease: "none", repeat: 20 }, 0);
        tl.to(st, { amp: 90 - i * 10, duration: 3 + i * 0.5, ease: "sine.inOut", repeat: 40, yoyo: true }, 0);
      });
      const draw = () =>
        waves.forEach((p, i) => {
          const { phase, amp } = state[i];
          let d = "";
          for (let x = -20; x <= 1940; x += 40) {
            const y = 640 + i * 70 + Math.sin(x / 260 + phase + i) * amp;
            d += (x === -20 ? "M" : "L") + x + " " + y.toFixed(1) + " ";
          }
          p.setAttribute("d", d);
        });
      return (t) => {
        tl.totalTime(Math.max(0, t) % 60);
        draw();
      };
    },
    "gsap.bg.conic-spin": (layer, ctx) => {
      const spin = h("div", "pm-conic");
      spin.style.background = `conic-gradient(from 0deg, ${ctx.theme.accent}aa, transparent 25%, ${ctx.theme.accent2}aa 50%, transparent 75%, ${ctx.theme.accent}aa)`;
      const veil = h("div", "pm-fill");
      veil.style.background = `radial-gradient(circle at 50% 50%, transparent 0%, ${ctx.theme.bg}cc 75%)`;
      layer.append(spin, veil);
      const tl = paused().to(spin, { rotation: 360, duration: 20, ease: "none", repeat: 10 });
      return driveLoop(tl);
    },
  },

  decor: {
    "gsap.decor.draw-svg": (layer, ctx) => {
      const root = svgRoot();
      const d = [
        "M 100 100 C 300 60 380 260 560 180",
        "M 1820 980 C 1600 1020 1560 820 1360 900",
        "M 1500 120 h 300 v 120",
        "M 120 960 h 220 l 60 -60",
      ];
      const paths = d.map((dd, i) => {
        const p = s("path", { d: dd, fill: "none", stroke: i % 2 ? ctx.theme.accent2 : ctx.theme.accent, "stroke-width": 6, "stroke-linecap": "round" });
        root.appendChild(p);
        return p;
      });
      layer.appendChild(root);
      return drive(paused().fromTo(paths, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "power2.inOut", stagger: 0.2 }));
    },
    "gsap.decor.morph-svg": (layer, ctx) => {
      const root = svgRoot();
      const blob = "M1640,700 C1740,640 1820,740 1790,830 C1760,930 1640,960 1560,910 C1470,850 1520,760 1640,700 Z";
      const star = "M1650,640 L1690,760 L1810,770 L1715,840 L1750,960 L1650,890 L1550,960 L1585,840 L1490,770 L1610,760 Z";
      const square = "M1530,680 L1770,680 L1770,920 L1530,920 Z";
      const p = s("path", { d: blob, fill: ctx.theme.accent, opacity: 0.8 });
      root.appendChild(p);
      layer.appendChild(root);
      const tl = paused().to(p, { morphSVG: star, fill: ctx.theme.accent2, duration: 1, ease: "power2.inOut" }, 0.4)
        .to(p, { morphSVG: square, rotation: 45, transformOrigin: "50% 50%", duration: 1, ease: "power2.inOut" }, 1.8)
        .to(p, { morphSVG: blob, rotation: 0, fill: ctx.theme.accent, duration: 1, ease: "power2.inOut" }, 3.2);
      tl.repeat(15);
      return driveLoop(tl);
    },
    "gsap.decor.motion-path": (layer, ctx) => {
      const root = svgRoot();
      const track = s("path", { d: "M -50 900 C 400 600, 800 1100, 1200 700 S 1800 300, 1980 420", fill: "none", stroke: ctx.theme.accent, "stroke-opacity": 0.25, "stroke-width": 3 });
      const comet = s("g");
      comet.appendChild(s("path", { d: "M 0 0 L -70 -9 L -70 9 Z", fill: ctx.theme.accent2, opacity: 0.5 }));
      comet.appendChild(s("circle", { r: 12, fill: ctx.theme.accent }));
      root.append(track, comet);
      layer.appendChild(root);
      const tl = paused().to(comet, { motionPath: { path: track, align: track, autoRotate: true, alignOrigin: [0.5, 0.5] }, duration: 4.5, ease: "power1.inOut", repeat: 20 });
      return driveLoop(tl);
    },
  },

  transition: {
    "gsap.transition.zoom-through": ({ outEl, inEl }) => {
      const tl = paused()
        .fromTo(outEl, { scale: 1, opacity: 1, filter: "blur(0px)" }, { scale: 2.2, opacity: 0, filter: "blur(16px)", duration: 0.55, ease: "expo.in" }, 0)
        .fromTo(inEl, { scale: 0.4, opacity: 0, filter: "blur(16px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, 0.45);
      return {
        seek: (p) => tl.progress(p),
        reset: () => {
          tl.progress(0);
          gsap.set([outEl, inEl], { clearProps: CLEAR });
        },
      };
    },
    "gsap.transition.curtain": ({ outEl, inEl, overlay }, ctx) => {
      const cur = h("div", "pm-curtain");
      cur.style.background = `linear-gradient(90deg, ${ctx.theme.accent}, ${ctx.theme.accent2})`;
      const tl = paused()
        .fromTo(cur, { xPercent: -101 }, { xPercent: 0, duration: 0.5, ease: "power4.inOut" })
        .set(outEl, { opacity: 0 })
        .set(inEl, { opacity: 1 })
        .to(cur, { xPercent: 101, duration: 0.5, ease: "power4.inOut" });
      return {
        seek: (p) => {
          if (!cur.isConnected) overlay.appendChild(cur);
          if (p < 0.5) {
            inEl.style.opacity = "0";
            outEl.style.opacity = "1";
          }
          tl.progress(p);
        },
        reset: () => {
          cur.remove();
          gsap.set([outEl, inEl], { clearProps: CLEAR });
        },
      };
    },
    "gsap.transition.skew-slide": ({ outEl, inEl }) => {
      const tl = paused()
        .fromTo(outEl, { xPercent: 0, skewX: 0 }, { xPercent: -100, skewX: 12, duration: 1, ease: "power3.inOut" }, 0)
        .fromTo(inEl, { xPercent: 100, skewX: 12 }, { xPercent: 0, skewX: 0, duration: 1, ease: "power3.inOut" }, 0);
      return {
        seek: (p) => tl.progress(p),
        reset: () => {
          tl.progress(0);
          gsap.set([outEl, inEl], { clearProps: CLEAR });
        },
      };
    },
  },
};
