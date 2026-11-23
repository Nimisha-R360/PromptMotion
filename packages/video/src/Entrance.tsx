import type { Animation } from "@promptmotion/shared";
import type React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Style for a scene's `animation`, worked out from the frame number only. */
const getEntranceStyle = (
  animation: Animation | undefined,
  frame: number,
  fps: number,
): React.CSSProperties => {
  if (!animation) return {};

  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const progress = spring({ frame, fps, config: { damping: 200 } });

  switch (animation) {
    case "fade":
      return { opacity };
    case "slide-up":
      return { opacity, transform: `translateY(${interpolate(progress, [0, 1], [80, 0])}px)` };
    case "zoom":
      return { opacity, transform: `scale(${interpolate(progress, [0, 1], [0.85, 1])})` };
  }
};

/** Wraps a scene's content and plays its entrance animation. */
export const Entrance: React.FC<{
  animation?: Animation;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ animation, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <div style={{ ...style, ...getEntranceStyle(animation, frame, fps) }}>{children}</div>;
};
