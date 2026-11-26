// Motion (Framer Motion vanilla) engine.
// Element animations use animate() controls paused & scrubbed via `.time`; springs are sampled from Motion's spring() generator.
import { animate, stagger, spring, mix, easeOut, easeInOut, backOut, circOut, cubicBezier } from "motion";
import { EngineImpls, Seek, clamp, formatNumber, h, resetStyles, rng, s, splitChars, svgRoot } from "../dom";

type Controls = { pause: () => void; time: number; duration: number };

/**
 * Pause an animate() result and drive it from the player clock.
 * Note: a group's `duration` excludes stagger delays, so we must not clamp to it (later
 * elements would freeze half-way); seeking past the end simply holds the final keyframe.
 */
const drive = (c: Controls, maxDur = 30): Seek => {
  c.pause();
  c.time = 0;
  return (t) => {
    c.time = clamp(t, 0, maxDur);
  };
};

/** Sample a Motion spring generator at time t (seconds). */
const springAt = (opts: { stiffness?: number; damping?: number; mass?: number }) => {
  const gen = spring({ keyframes: [0, 1], ...opts });
  return (t: number) => (t <= 0 ? 0 : (gen.next(t * 1000).value as number));
};

export const motion: EngineImpls = {
  text: {
    "motion.text.word-fade-up": (el) => {
      const { words } = splitChars(el);
      words.forEach((w) => (w.style.display = "inline-block"));
      return drive(animate(words, { opacity: [0, 1], y: [36, 0] }, { duration: 0.7, delay: stagger(0.09), ease: "easeOut" }) as Controls);
    },
    "motion.text.blur-reveal": (el) => {
      const { chars } = splitChars(el);
      chars.forEach((c) => (c.style.display = "inline-block"));
      return drive(
        animate(chars, { opacity: [0, 1], filter: ["blur(14px)", "blur(0px)"] }, { duration: 0.8, delay: stagger(0.03), ease: easeOut }) as Controls,
      );
    },
    "motion.text.spring-letters": (el) => {
      const { chars } = splitChars(el);
      const sp = springAt({ stiffness: 380, damping: 14 });
      return (t) => {
        chars.forEach((c, i) => {
          const v = sp(t - i * 0.035);
          c.style.display = "inline-block";
          c.style.opacity = String(clamp(v * 2));
          c.style.transform = `translateY(${mix(70, 0, v)}px) scale(${mix(0.5, 1, v)})`;
        });
      };
    },
  },

  entrance: {
    "motion.enter.fade-up": (el) => drive(animate(el, { opacity: [0, 1], y: [50, 0] }, { duration: 0.8, ease: backOut }) as Controls),
    "motion.enter.spring-scale": (el) => {
      const sp = springAt({ stiffness: 260, damping: 13 });
      return (t) => {
        const v = sp(t);
        el.style.opacity = String(clamp(v * 1.5));
        el.style.transform = `scale(${mix(0.6, 1, v)})`;
      };
    },
    "motion.enter.clip-reveal": (el) =>
      drive(
        animate(
          el,
          { clipPath: ["inset(100% 0% 0% 0% round 24px)", "inset(0% 0% 0% 0% round 24px)"], opacity: [0, 1] },
          { duration: 1, ease: cubicBezier(0.65, 0, 0.35, 1) },
        ) as Controls,
      ),
    "motion.enter.slide-left": (el) => drive(animate(el, { x: [-200, 0], opacity: [0, 1] }, { duration: 0.8, ease: circOut }) as Controls),
  },

  list: {
    "motion.list.stagger-fade": (els) =>
      drive(animate(els, { opacity: [0, 1], y: [24, 0] }, { duration: 0.6, delay: stagger(0.16), ease: "easeOut" }) as Controls),
    "motion.list.spring-pop": (els) => {
      const sp = springAt({ stiffness: 300, damping: 12 });
      return (t) =>
        els.forEach((el, i) => {
          const v = sp(t - i * 0.12);
          el.style.opacity = String(clamp(v * 1.6));
          el.style.transform = `scale(${mix(0.3, 1, v)}) rotate(${mix(-8, 0, v)}deg)`;
        });
    },
  },

  number: {
    "motion.number.animate-value": (el, n) => (t) => {
      const p = clamp(t / 1.6);
      el.textContent = formatNumber(n, mix(0, n.value, easeOut(p)));
      el.style.opacity = t > 0 ? "1" : "0";
    },
  },

  chart: {
    "motion.chart.bars-spring": (bars) => {
      const sp = springAt({ stiffness: 170, damping: 11 });
      return (t) =>
        bars.forEach((b, i) => {
          const v = sp(t - i * 0.1);
          b.querySelector<HTMLElement>(".pm-bar-fill")!.style.transform = `scaleY(${Math.max(0, v)})`;
          const lab = b.querySelector<HTMLElement>(".pm-bar-val");
          if (lab) lab.style.opacity = String(clamp(v));
        });
    },
  },

  background: {
    "motion.bg.aurora": (layer, ctx) => {
      const bands = [ctx.theme.accent, ctx.theme.accent2, ctx.theme.accent].map((c, i) => {
        const b = h("div", "pm-aurora");
        b.style.background = `linear-gradient(90deg, transparent, ${c}, transparent)`;
        b.style.top = 120 + i * 260 + "px";
        layer.appendChild(b);
        return b;
      });
      const period = 12;
      return (t) => {
        bands.forEach((b, i) => {
          const p = ((t + i * 2.3) % period) / period;
          const w = Math.sin(p * Math.PI * 2);
          b.style.transform = `translateX(${mix(-300, 300, (w + 1) / 2)}px) rotate(${mix(-14, 10, easeInOut((Math.cos(p * Math.PI * 2) + 1) / 2))}deg) scaleY(${mix(0.8, 1.3, (w + 1) / 2)})`;
          b.style.opacity = String(mix(0.25, 0.55, (Math.sin(p * Math.PI * 4) + 1) / 2));
        });
      };
    },
    "motion.bg.spotlight": (layer, ctx) => {
      const spot = h("div", "pm-fill");
      layer.appendChild(spot);
      return (t) => {
        const p = (t % 10) / 10;
        const x = mix(25, 75, easeInOut((Math.sin(p * Math.PI * 2) + 1) / 2));
        const y = mix(30, 60, easeInOut((Math.cos(p * Math.PI * 2) + 1) / 2));
        spot.style.background = `radial-gradient(900px 700px at ${x}% ${y}%, ${ctx.theme.accent}40, transparent 70%), radial-gradient(1600px 1000px at 50% 50%, transparent 40%, rgba(0,0,0,.55))`;
      };
    },
  },

  decor: {
    "motion.decor.orbit-rings": (layer, ctx) => {
      const root = svgRoot();
      const g = s("g", { transform: "translate(1640 300)" });
      const rings = [120, 190, 260].map((r, i) => {
        const ring = s("g");
        ring.appendChild(s("circle", { r, fill: "none", stroke: ctx.theme.accent, "stroke-opacity": 0.3, "stroke-width": 2 }));
        ring.appendChild(s("circle", { cx: r, cy: 0, r: 10 - i * 2, fill: i % 2 ? ctx.theme.accent2 : ctx.theme.accent }));
        g.appendChild(ring);
        return ring;
      });
      root.appendChild(g);
      layer.appendChild(root);
      const ctl = rings.map((ring, i) => {
        const c = animate(ring, { rotate: [0, i % 2 ? -360 : 360] }, { duration: 8 + i * 4, ease: "linear", repeat: Infinity }) as unknown as Controls;
        c.pause();
        return { c, d: 8 + i * 4 };
      });
      g.style.opacity = "0";
      const intro = drive(animate(g, { opacity: [0, 1], scale: [0.6, 1] }, { duration: 1 }) as Controls);
      return (t) => {
        intro(t);
        ctl.forEach(({ c, d }) => (c.time = Math.max(0, t) % d));
      };
    },
    "motion.decor.floating-shapes": (layer, ctx) => {
      const r = rng(ctx.seed + 3);
      const shapes = Array.from({ length: 6 }, (_, i) => {
        const d = h("div", "pm-glass");
        const size = 60 + r() * 120;
        Object.assign(d.style, {
          width: size + "px",
          height: size + "px",
          left: (i % 2 ? 1500 + r() * 300 : 40 + r() * 260) + "px",
          top: 80 + r() * 860 + "px",
          borderRadius: i % 3 === 0 ? "50%" : "28px",
          borderColor: (i % 2 ? ctx.theme.accent2 : ctx.theme.accent) + "88",
        });
        layer.appendChild(d);
        return { d, phase: r() * 6, amp: 20 + r() * 30 };
      });
      return (t) =>
        shapes.forEach(({ d, phase, amp }, i) => {
          const p = easeInOut((Math.sin(t * 0.9 + phase) + 1) / 2);
          d.style.transform = `translateY(${mix(-amp, amp, p)}px) rotate(${mix(-12, 12, p)}deg)`;
          d.style.opacity = String(clamp(t * 1.5 - i * 0.15) * 0.8);
        });
    },
  },

  transition: {
    "motion.transition.push-scale": ({ outEl, inEl }) => ({
      seek: (p) => {
        const e = easeInOut(p);
        outEl.style.transform = `scale(${mix(1, 0.85, e)})`;
        outEl.style.filter = `brightness(${mix(1, 0.4, e)})`;
        inEl.style.zIndex = "2";
        inEl.style.transform = `translateY(${mix(100, 0, e)}%)`;
      },
      reset: () => resetStyles(outEl, inEl),
    }),
    "motion.transition.blur-cross": ({ outEl, inEl }) => ({
      seek: (p) => {
        const e = easeOut(p);
        outEl.style.filter = `blur(${mix(0, 30, e)}px)`;
        outEl.style.opacity = String(mix(1, 0, e));
        inEl.style.filter = `blur(${mix(30, 0, e)}px)`;
        inEl.style.opacity = String(mix(0, 1, e));
      },
      reset: () => resetStyles(outEl, inEl),
    }),
  },
};
