"use client";

// useAnimations (useanimations.com, MIT): 300 animated line icons with hover, click and loop interactions built in.
//
// Two ways to use them on the site:
//  - static (best for icons you know up front; only that icon is bundled):
//      import UseAnimations from "react-useanimations";
//      import heart from "react-useanimations/lib/heart";
//      <UseAnimations animation={heart} size={32} />
//  - by name (icons chosen at runtime; each icon loads lazily as its own small chunk):
//      <AnimatedIcon name="heart" size={32} />
// Icons follow the text colour (`currentColor`) unless `strokeColor` / `fillColor` are set.
import { useEffect, useState } from "react";
import UseAnimations, { type Animation, type AnimationKey, type UseAnimationsProps } from "react-useanimations";
import { ICON_LOADERS } from "./icons";

export type AnimatedIconName = AnimationKey;

export type AnimatedIconProps = Omit<UseAnimationsProps, "animation"> & {
  /** icon name, as listed at useanimations.com (e.g. "heart", "loading", "menu3") */
  name: AnimatedIconName;
};

/** loaded icons, shared by every <AnimatedIcon> on the page */
const cache = new Map<AnimatedIconName, Animation>();

export function AnimatedIcon({ name, size = 24, ...props }: AnimatedIconProps) {
  // the last icon this instance loaded; a cached icon shows straight away
  const [loaded, setLoaded] = useState<{ name: AnimatedIconName; animation: Animation } | null>(null);
  const animation = cache.get(name) ?? (loaded?.name === name ? loaded.animation : undefined);

  useEffect(() => {
    if (cache.has(name)) return;
    let cancelled = false;
    ICON_LOADERS[name]().then((m) => {
      cache.set(name, m.default);
      if (!cancelled) setLoaded({ name, animation: m.default });
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // same footprint while loading, so the layout doesn't jump
  if (!animation) {
    const px = typeof size === "number" ? `${size}px` : size;
    return <span aria-hidden style={{ display: "inline-block", width: px, height: px }} />;
  }
  return <UseAnimations key={name} animation={animation} size={size} {...props} />;
}

export { UseAnimations };
