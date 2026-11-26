import type { VideoSpec } from "./types";
import { getTheme } from "./themes";
import { BuiltScene, buildScene } from "./scene";
import { TransitionHandle, h, resetStyles } from "./dom";

const TRANSITION = 0.9; // seconds of overlap between scenes (TransitionSeries semantics)

interface Timed extends BuiltScene {
  start: number;
  end: number;
  transition?: TransitionHandle; // how this scene enters
  wasVisible: boolean;
}

const ICON = {
  play: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
  fs: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>',
};

/** Theme → CSS custom properties on :root (shared by the video player and the web page). */
export function applyTheme(id: string) {
  const theme = getTheme(id);
  const set = (k: string, v: string) => document.documentElement.style.setProperty(k, v);
  set("--pm-bg", theme.bg);
  set("--pm-bg2", theme.bg2);
  set("--pm-surface", theme.surface);
  set("--pm-text", theme.text);
  set("--pm-muted", theme.muted);
  set("--pm-accent", theme.accent);
  set("--pm-accent2", theme.accent2);
  set("--pm-display", theme.display);
  set("--pm-font", theme.body);
  return theme;
}

const RESUME_KEY = "pm:resume-t";
/** Taller than wide (with a little tolerance for square-ish windows) → portrait stage. */
const isPortraitViewport = () => window.innerWidth / Math.max(1, window.innerHeight) < 0.85;
/** Portrait stage is 1080px wide and as tall as the device's aspect ratio needs (phones are taller than 9:16). */
const portraitHeight = () => Math.round(Math.min(2400, Math.max(1440, (1080 * window.innerHeight) / Math.max(1, window.innerWidth))));

const fmt = (s: number) => {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export class Player {
  scenes: Timed[] = [];
  t = 0;
  total = 0;
  playing = false;
  loop: boolean;
  loopStart = 0;
  portrait = false;
  private last = 0;
  private stage!: HTMLElement;
  private overlay!: HTMLElement;
  private ui!: { root: HTMLElement; play: HTMLButtonElement; time: HTMLElement; fill: HTMLElement; bar: HTMLElement; label: HTMLElement; loop: HTMLButtonElement };
  private hideTimer = 0;
  private lastPost = 0;

  constructor(private spec: VideoSpec, private mount: HTMLElement) {
    this.loop = spec.loop ?? false;
    this.build();
  }

  private build() {
    const theme = applyTheme(this.spec.theme);

    // Portrait screens (phones, portrait tablets / app webviews) get a 1080×1920 stage with stacked layouts.
    // Decided before the scenes are built because engines measure/split text against the final layout.
    this.portrait = isPortraitViewport();
    document.body.classList.toggle("pm-portrait", this.portrait);

    const viewport = h("div", "pm-viewport");
    this.stage = h("div", "pm-stage");
    this.overlay = h("div", "pm-overlay");
    if (this.portrait) this.stage.style.height = portraitHeight() + "px";
    viewport.appendChild(this.stage);
    this.stage.appendChild(this.overlay);
    this.mount.appendChild(viewport);

    let cursor = 0;
    this.spec.slides.forEach((slide, i) => {
      const built = buildScene(slide, theme, i, this.stage, this.overlay);
      const start = i === 0 ? 0 : cursor - TRANSITION;
      const end = start + built.duration;
      cursor = end;
      const timed: Timed = { ...built, start, end, wasVisible: true };
      this.scenes.push(timed);
    });
    // transitions need both scenes in the DOM
    this.scenes.forEach((sc, i) => {
      if (i === 0) return;
      try {
        sc.transition = sc.makeTransition({ outEl: this.scenes[i - 1].el, overlay: this.overlay }, sc.ctx);
      } catch (e) {
        console.warn("[prompt-motion] transition failed", e);
      }
    });
    this.total = cursor;

    if (this.spec.focus != null && this.scenes[this.spec.focus]) {
      const f = this.scenes[this.spec.focus];
      this.loopStart = Math.max(0, f.start - (this.spec.focus > 0 ? 0.6 : 0));
      this.loop = true;
      this.t = this.loopStart;
    }

    this.buildUI();
    if (this.spec.badge) {
      const b = h("div", "pm-badge-corner", this.spec.badge);
      this.stage.appendChild(b);
    }
    this.fit();
    window.addEventListener("resize", () => this.fit());
    try {
      const resume = sessionStorage.getItem(RESUME_KEY);
      if (resume != null) {
        sessionStorage.removeItem(RESUME_KEY);
        this.t = Math.min(this.total, Math.max(0, Number(resume) || 0));
      }
    } catch {
      /* storage unavailable */
    }
    this.render();
    this.bindKeys();
    this.bindMessages();
    if (this.spec.autoplay !== false) this.play();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
    this.post({ type: "pm:ready", total: this.total, scenes: this.scenes.map((s) => ({ start: s.start, end: s.end })) });
  }

  private fit() {
    if (isPortraitViewport() !== this.portrait) {
      // device rotated: rebuild for the other orientation, resuming at the same time
      try {
        sessionStorage.setItem(RESUME_KEY, String(this.t));
      } catch {
        /* storage unavailable */
      }
      location.reload();
      return;
    }
    const [w, hgt] = this.portrait ? [1080, portraitHeight()] : [1920, 1080];
    if (this.portrait) this.stage.style.height = hgt + "px";
    const k = Math.min(window.innerWidth / w, window.innerHeight / hgt);
    this.stage.style.transform = `translate(-50%, -50%) scale(${k})`;
  }

  private buildUI() {
    const root = h("div", "pm-controls");
    const play = h("button", "pm-btn") as HTMLButtonElement;
    play.setAttribute("aria-label", "Play/Pause");
    play.innerHTML = ICON.play;
    play.onclick = () => this.toggle();
    const replay = h("button", "pm-btn") as HTMLButtonElement;
    replay.innerHTML = ICON.replay;
    replay.setAttribute("aria-label", "Restart");
    replay.onclick = () => {
      this.seek(this.loopStart);
      this.play();
    };
    const time = h("span", "pm-time");
    const bar = h("div", "pm-progress");
    const fill = h("div", "pm-progress-fill");
    bar.appendChild(fill);
    this.scenes.forEach((sc, i) => {
      if (i === 0) return;
      const m = h("span", "pm-marker");
      m.style.left = (sc.start / this.total) * 100 + "%";
      bar.appendChild(m);
    });
    const knob = h("div", "pm-knob");
    fill.appendChild(knob);
    const scrub = (e: PointerEvent) => {
      const r = bar.getBoundingClientRect();
      this.seek(((e.clientX - r.left) / r.width) * this.total);
    };
    bar.addEventListener("pointerdown", (e) => {
      bar.setPointerCapture(e.pointerId);
      const wasPlaying = this.playing;
      this.pause();
      scrub(e);
      const move = (ev: PointerEvent) => scrub(ev);
      const up = () => {
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", up);
        if (wasPlaying) this.play();
      };
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", up);
    });
    const label = h("span", "pm-scene-label");
    const loop = h("button", "pm-btn") as HTMLButtonElement;
    loop.innerHTML = ICON.loop;
    loop.setAttribute("aria-label", "Loop");
    loop.onclick = () => {
      this.loop = !this.loop;
      loop.classList.toggle("on", this.loop);
    };
    loop.classList.toggle("on", this.loop);
    const fs = h("button", "pm-btn") as HTMLButtonElement;
    fs.innerHTML = ICON.fs;
    fs.setAttribute("aria-label", "Fullscreen");
    fs.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    };
    root.append(play, replay, time, bar, label, loop, fs);
    document.body.appendChild(root);
    this.ui = { root, play, time, fill, bar, label, loop };

    const big = h("button", "pm-bigplay") as HTMLButtonElement;
    big.innerHTML = ICON.play;
    big.setAttribute("aria-label", "Play");
    big.onclick = () => this.play();
    document.body.appendChild(big);

    const wake = () => {
      document.body.classList.add("pm-ui-on");
      clearTimeout(this.hideTimer);
      this.hideTimer = window.setTimeout(() => {
        if (this.playing) document.body.classList.remove("pm-ui-on");
      }, 2200);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    wake();
  }

  private bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        this.toggle();
      } else if (e.key === "ArrowRight") this.seek(this.t + 2);
      else if (e.key === "ArrowLeft") this.seek(this.t - 2);
      else if (e.key === "f") this.ui.root.querySelectorAll("button")[4]?.dispatchEvent(new MouseEvent("click"));
      else if (e.key === "l") this.ui.loop.click();
      else if (e.key === "Home") this.seek(0);
    });
  }

  private bindMessages() {
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "pm:play") this.play();
      if (d.type === "pm:pause") this.pause();
      if (d.type === "pm:seek" && typeof d.t === "number") this.seek(d.t);
      if (d.type === "pm:seekScene" && typeof d.index === "number" && this.scenes[d.index]) this.seek(this.scenes[d.index].start + 0.01);
    });
  }

  private post(msg: unknown) {
    if (window.parent !== window) window.parent.postMessage(msg, "*");
  }

  play() {
    if (this.t >= this.total - 0.01) this.t = this.loopStart;
    this.playing = true;
    this.last = performance.now();
    document.body.classList.add("pm-playing");
    this.ui.play.innerHTML = ICON.pause;
  }
  pause() {
    this.playing = false;
    document.body.classList.remove("pm-playing");
    this.ui.play.innerHTML = ICON.play;
    document.body.classList.add("pm-ui-on");
  }
  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }
  seek(t: number) {
    this.t = Math.min(this.total, Math.max(0, t));
    this.render();
  }

  private tick(now: number) {
    if (this.playing) {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.t += dt;
      if (this.t >= this.total) {
        if (this.loop) this.t = this.loopStart;
        else {
          this.t = this.total;
          this.pause();
        }
      }
      this.render();
    }
    this.last = now;
    requestAnimationFrame(this.tick);
  }

  render() {
    const t = this.t;
    let current = 0;
    // 1. reset transition styles first so scene visibility/transforms start clean
    this.scenes.forEach((sc) => sc.transition?.reset());
    this.scenes.forEach((sc, i) => {
      const visible = t >= sc.start && t < sc.end + (i === this.scenes.length - 1 ? 0.001 : 0);
      sc.el.style.visibility = visible ? "visible" : "hidden";
      if (visible) {
        current = i;
        const local = t - sc.start;
        for (const tr of sc.tracks) {
          try {
            tr.seek(local - tr.start);
          } catch (e) {
            // never let one component break the video; report once
            if (!tr.failed) {
              tr.failed = true;
              console.warn("[prompt-motion] seek failed", e);
            }
          }
        }
      } else if (sc.wasVisible) {
        resetStyles(sc.el);
      }
      sc.wasVisible = visible;
    });
    // 2. active transition (scene i entering while scene i-1 is still visible)
    this.scenes.forEach((sc, i) => {
      if (i === 0 || !sc.transition) return;
      if (t >= sc.start && t < sc.start + TRANSITION) {
        try {
          sc.transition.seek((t - sc.start) / TRANSITION);
        } catch (e) {
          console.warn("[prompt-motion] transition seek failed", e);
        }
      }
    });
    if (this.ui) {
      this.ui.fill.style.width = (t / this.total) * 100 + "%";
      this.ui.time.textContent = `${fmt(t)} / ${fmt(this.total)}`;
      this.ui.label.textContent = `Scene ${current + 1}/${this.scenes.length}`;
    }
    const now = performance.now();
    if (now - this.lastPost > 200) {
      this.lastPost = now;
      this.post({ type: "pm:time", t, scene: current, playing: this.playing });
    }
  }
}
