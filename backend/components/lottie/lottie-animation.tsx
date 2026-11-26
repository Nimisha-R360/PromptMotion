"use client";

// Reusable Lottie player for the site: <LottieAnimation name="success-check" />.
// Plays one of the bundled LottieFiles animations (runtime/lottie/animations; list in runtime/lottie-cards.ts), one of
// the useAnimations icons used as cards ("ua-" names, drawn in the current text colour) or any Lottie JSON passed as
// `data`. lottie-web and the JSON load lazily on the client, so they never touch the server bundle. Respects
// prefers-reduced-motion (shows a still frame).
import { useEffect, useRef, type CSSProperties } from "react";
import type { AnimationItem } from "lottie-web";
import { LOTTIE_ANIMATIONS, isTinted, lottieTintCss, type LottieSlug } from "@/runtime/lottie-cards";
import { LOTTIE_LOADERS } from "./animations";

export interface LottieAnimationProps {
  /** a bundled animation (runtime/lottie-cards.ts) */
  name?: LottieSlug;
  /** or any Lottie JSON (takes precedence over `name`) */
  data?: object;
  /** defaults to the animation's own setting (one-shots play once and hold their last frame) */
  loop?: boolean;
  /** start playing on mount (default true) */
  autoplay?: boolean;
  /** playback speed (default 1) */
  speed?: number;
  /** how the animation fits its box (default "contain") */
  fit?: "contain" | "cover";
  className?: string;
  style?: CSSProperties;
  /** accessible label; omit for a decorative animation */
  label?: string;
  onComplete?: () => void;
}

/** the recolouring rules for useAnimations icons, added to the page once */
function useTintCss(on: boolean) {
  useEffect(() => {
    if (!on || document.getElementById("pm-lottie-tint-css")) return;
    const style = document.createElement("style");
    style.id = "pm-lottie-tint-css";
    style.textContent = lottieTintCss(".pm-lottie-tint");
    document.head.appendChild(style);
  }, [on]);
}

export function LottieAnimation({ name, data, loop, autoplay = true, speed = 1, fit = "contain", className, style, label, onComplete }: LottieAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const shouldLoop = loop ?? (name ? LOTTIE_ANIMATIONS[name].loop : true);
  const tinted = !data && !!name && isTinted(name);
  useTintCss(tinted);

  useEffect(() => {
    const el = ref.current;
    if (!el || (!data && !name)) return;
    let cancelled = false;
    (async () => {
      const [{ default: lottie }, json] = await Promise.all([
        import("lottie-web/build/player/lottie_svg"),
        data ? Promise.resolve(data) : LOTTIE_LOADERS[name!]().then((m) => m.default),
      ]);
      if (cancelled || !ref.current) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const anim = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: shouldLoop && !reduced,
        autoplay: autoplay && !reduced,
        // lottie-web mutates the JSON it plays
        animationData: JSON.parse(JSON.stringify(json)),
        rendererSettings: { preserveAspectRatio: fit === "cover" ? "xMidYMid slice" : "xMidYMid meet" },
      });
      anim.setSpeed(speed);
      anim.addEventListener("complete", () => completeRef.current?.());
      // reduced motion: show the finished (one-shot) or first (loop) frame
      if (reduced) anim.addEventListener("DOMLoaded", () => anim.goToAndStop(shouldLoop ? 0 : anim.totalFrames - 1, true));
      animRef.current = anim;
    })();
    return () => {
      cancelled = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
    // speed is applied separately so changing it doesn't restart the animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, data, shouldLoop, autoplay, fit]);

  useEffect(() => {
    animRef.current?.setSpeed(speed);
  }, [speed]);

  const tint: CSSProperties | undefined = tinted ? ({ "--ua-stroke": "currentColor", "--ua-knockout": "transparent" } as CSSProperties) : undefined;
  return <div ref={ref} className={tinted ? `pm-lottie-tint ${className ?? ""}` : className} style={tint ? { ...tint, ...style } : style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export { LOTTIE_ANIMATIONS, type LottieSlug };
