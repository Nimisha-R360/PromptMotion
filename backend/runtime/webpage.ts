import type { VideoSpec } from "./types";
import { buildScene, type Track } from "./scene";
import { h } from "./dom";
import { applyTheme } from "./player";

/**
 * Web-application output: the same slide designs rendered as a scrolling, responsive web page.
 *  - one <section> per slide, laid out at the design width (1920, or 1080 on narrow screens) and scaled with CSS zoom
 *  - each section's animations play when it scrolls into view (driven through the same seek() components)
 *  - backgrounds/decor keep looping while their section is visible
 *  - sticky navigation, scroll progress, footer; respects prefers-reduced-motion
 */
const NARROW = 820;

interface Section {
  el: HTMLElement;
  tracks: Track[];
  started: number | null;
  visible: boolean;
}

export class WebPage {
  private sections: Section[] = [];
  private narrow = window.innerWidth < NARROW;
  private reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private progress!: HTMLElement;

  constructor(private spec: VideoSpec, private mount: HTMLElement) {
    this.build();
  }

  private build() {
    const theme = applyTheme(this.spec.theme);
    document.documentElement.classList.add("pm-web-root");
    document.body.classList.add("pm-web");
    document.body.classList.toggle("pm-portrait", this.narrow);

    // ── navigation ──
    const nav = h("header", "pm-nav");
    const brand = h("a", "pm-brand", this.spec.title);
    brand.setAttribute("href", "#sec-0");
    const links = h("nav", "pm-links");
    links.setAttribute("aria-label", "Sections");
    const menu = h("button", "pm-menu") as HTMLButtonElement;
    menu.setAttribute("aria-label", "Menu");
    menu.setAttribute("aria-expanded", "false");
    menu.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>';
    menu.onclick = () => {
      const open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
    };
    this.spec.slides.forEach((s, i) => {
      if (i === 0) return;
      const a = h("a", "", s.title.length > 26 ? s.title.slice(0, 24) + "…" : s.title);
      a.setAttribute("href", `#sec-${i}`);
      a.onclick = () => nav.classList.remove("open");
      links.appendChild(a);
    });
    nav.append(brand, links, menu);
    this.progress = h("div", "pm-scrollbar");
    nav.appendChild(this.progress);

    // ── sections ──
    const main = h("main", "pm-webmain");
    this.mount.append(nav, main);
    this.spec.slides.forEach((slide, i) => {
      const sec = h("section", "pm-websec");
      sec.id = `sec-${i}`;
      sec.setAttribute("aria-label", slide.title);
      const zoom = h("div", "pm-web-zoom");
      sec.appendChild(zoom);
      main.appendChild(sec);
      const built = buildScene(slide, theme, i, zoom, null);
      this.sections.push({ el: sec, tracks: built.tracks, started: null, visible: false });
    });

    const foot = h("footer", "pm-foot");
    foot.innerHTML = `<span>${escapeText(this.spec.title)}</span><span>Made with Prompt Motion · Remotion · anime.js · Motion · GSAP</span>`;
    main.appendChild(foot);

    this.fit();
    window.addEventListener("resize", () => this.fit());
    // initial (pre-animation) state for every section
    this.sections.forEach((s) => this.seek(s, 0));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const s = this.sections.find((x) => x.el === e.target);
          if (!s) continue;
          s.visible = e.isIntersecting;
          if (s.visible && s.started == null) s.started = performance.now() - (this.reduce ? 1e6 : 0);
        }
      },
      { threshold: 0.22 },
    );
    this.sections.forEach((s) => io.observe(s.el));
    window.addEventListener("scroll", () => this.onScroll(), { passive: true });
    this.onScroll();

    const tick = (now: number) => {
      for (const s of this.sections) if (s.visible && s.started != null) this.seek(s, (now - s.started) / 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    if (this.spec.focus != null) document.getElementById(`sec-${this.spec.focus}`)?.scrollIntoView();
  }

  private seek(s: Section, t: number) {
    for (const tr of s.tracks) {
      try {
        tr.seek(t - tr.start);
      } catch (e) {
        if (!tr.failed) {
          tr.failed = true;
          console.warn("[prompt-motion] seek failed", e);
        }
      }
    }
  }

  /** Lay sections out at the design width and zoom them to the viewport. */
  private fit() {
    const narrow = window.innerWidth < NARROW;
    if (narrow !== this.narrow) {
      location.reload(); // switch between wide/narrow layouts (text is split & measured at build time)
      return;
    }
    const z = window.innerWidth / (narrow ? 1080 : 1920);
    document.documentElement.style.setProperty("--pm-z", String(z));
    for (const s of this.sections) (s.el.firstElementChild as HTMLElement).style.zoom = String(z);
  }

  private onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  }
}

function escapeText(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
