import { z } from "zod";

/** How a scene's content animates in. Keep this list short and fixed. */
export const AnimationSchema = z.enum(["fade", "slide-up", "zoom"]);

/** How a scene enters after the previous one. No value means a plain cut. */
export const TransitionSchema = z.enum(["fade", "slide-left", "zoom"]);

/** Fields every scene has, whatever its `type`. */
const sceneBase = {
  /** Stable id such as "s1". Unique within a plan. Assets and edits attach to it. */
  id: z.string().min(1),
  /** How long the scene is on screen. The voiceover step replaces the AI's guess with the real audio length. */
  durationSec: z.number().positive(),
  /** The script spoken over the scene. */
  narration: z.string().optional(),
  /** Filled in by the voiceover step. */
  audioUrl: z.url().optional(),
  animation: AnimationSchema.optional(),
  transition: TransitionSchema.optional(),
};

export const TitleSceneSchema = z.object({
  type: z.literal("title"),
  ...sceneBase,
  heading: z.string().min(1),
  subheading: z.string().optional(),
});

export const BulletsSceneSchema = z.object({
  type: z.literal("bullets"),
  ...sceneBase,
  heading: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
});

export const DialogueLineSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
});

export const DialogueSceneSchema = z.object({
  type: z.literal("dialogue"),
  ...sceneBase,
  lines: z.array(DialogueLineSchema).min(1),
});

/** One scene, discriminated on `type`. */
export const SceneSchema = z.discriminatedUnion("type", [
  TitleSceneSchema,
  BulletsSceneSchema,
  DialogueSceneSchema,
]);

export const MAX_SCENES = 12;

/** The whole plan: what the agent writes and Remotion renders. */
export const VideoPlanSchema = z
  .object({
    title: z.string().min(1),
    scenes: z.array(SceneSchema).min(1).max(MAX_SCENES),
  })
  .refine((plan) => new Set(plan.scenes.map((scene) => scene.id)).size === plan.scenes.length, {
    message: "Scene ids must be unique",
    path: ["scenes"],
  });

export type Animation = z.infer<typeof AnimationSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type TitleScene = z.infer<typeof TitleSceneSchema>;
export type BulletsScene = z.infer<typeof BulletsSceneSchema>;
export type DialogueLine = z.infer<typeof DialogueLineSchema>;
export type DialogueScene = z.infer<typeof DialogueSceneSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneType = Scene["type"];
export type VideoPlan = z.infer<typeof VideoPlanSchema>;
