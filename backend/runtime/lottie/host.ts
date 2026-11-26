// Lottie add-on host (runtime-dist/lottie/host.js): lottie-web's SVG player and the mount() the slide runtime calls to
// draw a Lottie card (registers itself as window.PromptMotionLottie). Each animation ships as its own small bundle
// (runtime-dist/lottie/a/<slug>.js, built by scripts/build-lottie.mjs) that registers its JSON with the host, so a page
// only carries the animations its slides use.
//
// Timing: frame-exact. Every seek moves the animation to the frame for the slide's time (goToAndStop), so scrubbing,
// playback and export always show the same frame.
import lottie from "lottie-web/build/player/lottie_svg";
import { LOTTIE_ANIMATIONS, LOTTIE_CARD_IDS, isTinted, lottieFrameAt, lottieSlug, lottieTintCss, type LottieAnimationMeta, type LottieCardId, type LottieData } from "../lottie-cards";
import type { OndaAddon, OndaMountOptions } from "../cards";

declare global {
  interface Window {
    __PML__?: { register: (slug: string, data: LottieData) => void };
    PromptMotionLottie?: OndaAddon;
  }
}

/** animation JSON registered by the per-animation bundles, by slug */
const DATA = new Map<string, LottieData>();
window.__PML__ = { register: (slug, data) => DATA.set(slug, data) };

// useAnimations icons are black line art: drawn in the slide's colours (variables set per card)
if (!document.getElementById("pm-lottie-css")) {
  const style = document.createElement("style");
  style.id = "pm-lottie-css";
  style.textContent = lottieTintCss(".pm-lottie-tint");
  document.head.appendChild(style);
}

/** Mount a Lottie card into `host` (sized by the slide's CSS). Returns seek(t), t in seconds since the card starts. */
function mount(host: HTMLElement, o: OndaMountOptions): (t: number) => void {
  const slug = lottieSlug(o.id as LottieCardId);
  const data = DATA.get(slug);
  const meta: LottieAnimationMeta = LOTTIE_ANIMATIONS[slug];
  if (!data || !meta) throw new Error(`Lottie animation ${slug} is not loaded`);
  const full = meta.mode === "full";
  const tinted = isTinted(slug);

  const box = document.createElement("div");
  Object.assign(box.style, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", pointerEvents: "none" });
  if (tinted) {
    box.className = "pm-lottie-tint";
    box.style.setProperty("--ua-stroke", o.theme.accent);
    box.style.setProperty("--ua-fill", o.theme.accent);
    box.style.setProperty("--ua-knockout", o.theme.bg);
  }

  // the full-slide card shows the slide's title (the slide hides its own), the animation plays over it
  let words: HTMLElement | null = null;
  if (full) {
    words = document.createElement("div");
    Object.assign(words.style, { position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.35em", padding: "6%", textAlign: "center" });
    const title = document.createElement("h2");
    title.textContent = o.spec.title;
    Object.assign(title.style, { fontFamily: o.theme.display, fontWeight: "700", lineHeight: "1.1", margin: "0", color: o.theme.text, textWrap: "balance" });
    words.appendChild(title);
    const subText = o.spec.subtitle || o.spec.body || "";
    if (subText) {
      const sub = document.createElement("p");
      sub.textContent = subText;
      Object.assign(sub.style, { fontFamily: o.theme.body, fontSize: "0.42em", margin: "0", color: o.theme.muted });
      words.appendChild(sub);
    }
    box.appendChild(words);
  }

  const stage = document.createElement("div");
  Object.assign(stage.style, full ? { position: "absolute", inset: "0" } : { position: "relative", flexShrink: "0" });
  box.appendChild(stage);
  host.appendChild(box);

  // lottie-web mutates the JSON it plays, so every card gets its own copy
  const anim = lottie.loadAnimation({
    container: stage,
    renderer: "svg",
    loop: false,
    autoplay: false,
    animationData: JSON.parse(JSON.stringify(data)),
    rendererSettings: { preserveAspectRatio: full ? "xMidYMid slice" : "xMidYMid meet" },
  });

  /** the host size the layout was computed for */
  let sized = "";
  const fitTo = () => {
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    if (!w || !h) return;
    const size = `${w}x${h}`;
    if (size === sized) return;
    sized = size;
    if (words) words.style.fontSize = `${Math.round(Math.min(w * 0.065, h * 0.12, o.spec.title.length > 40 ? 64 : 96))}px`;
    if (!full) {
      // as large as the slot allows (keeping the animation's aspect ratio), with a little air around it
      // (line icons stay smaller, so their strokes don't turn into heavy bars)
      const room = tinted ? 0.55 : 0.9;
      const scale = Math.min((w * room) / data.w, (h * room) / data.h);
      stage.style.width = `${Math.round(data.w * scale)}px`;
      stage.style.height = `${Math.round(data.h * scale)}px`;
    }
    anim.resize();
  };

  return (t: number) => {
    fitTo();
    anim.goToAndStop(lottieFrameAt(data, t, meta.loop, 1, meta.repeat), true);
  };
}

window.PromptMotionLottie = {
  version: "lottie",
  get ids() {
    return LOTTIE_CARD_IDS.filter((id) => DATA.has(lottieSlug(id)));
  },
  mount,
} as OndaAddon;
