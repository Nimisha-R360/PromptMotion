import type { Scene, VideoPlan } from "@promptmotion/shared";
import { VIDEO_FPS } from "./constants";

/** Frames one scene takes. At least 1, so every scene shows. */
export const getSceneDurationInFrames = (scene: Scene, fps: number = VIDEO_FPS): number =>
  Math.max(1, Math.round(scene.durationSec * fps));

/**
 * Total frames for a plan. Used by both the Player and the composition,
 * so the preview and the export always have the same length.
 */
export const getDurationInFrames = (plan: VideoPlan, fps: number = VIDEO_FPS): number =>
  plan.scenes.reduce((total, scene) => total + getSceneDurationInFrames(scene, fps), 0);
