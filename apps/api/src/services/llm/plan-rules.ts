import type { VideoPlan } from "@promptmotion/shared";

/** Limits beyond what VideoPlanSchema checks. The system prompt states the same numbers. */
export const PLAN_RULES = {
  minScenes: 3,
  maxTotalSec: 180,
  /** About 2.5 words per second is natural speech; allow some slack. */
  maxWordsPerSec: 3,
} as const;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Returns a list of problems, written so Claude can fix them. Empty means the plan is fine. */
export const checkPlanRules = (plan: VideoPlan): string[] => {
  const problems: string[] = [];

  if (plan.scenes.length < PLAN_RULES.minScenes) {
    problems.push(
      `The plan has ${plan.scenes.length} scenes; it needs at least ${PLAN_RULES.minScenes}.`,
    );
  }

  const totalSec = plan.scenes.reduce((total, scene) => total + scene.durationSec, 0);
  if (totalSec > PLAN_RULES.maxTotalSec) {
    problems.push(
      `Total length is ${totalSec.toFixed(1)}s; it must be at most ${PLAN_RULES.maxTotalSec}s.`,
    );
  }

  for (const scene of plan.scenes) {
    if (scene.audioUrl) {
      problems.push(`Scene ${scene.id}: remove audioUrl; it is filled in later.`);
    }
    if (!scene.narration) continue;
    const words = wordCount(scene.narration);
    const maxWords = Math.floor(scene.durationSec * PLAN_RULES.maxWordsPerSec);
    if (words > maxWords) {
      problems.push(
        `Scene ${scene.id}: narration has ${words} words but ${scene.durationSec}s allows at most ${maxWords}. Shorten the narration or lengthen durationSec.`,
      );
    }
  }

  return problems;
};
