import { z } from "zod";
import { VideoPlanSchema } from "./video-plan";

/** Where a project is in the pipeline. Mirrors the `project_status` enum in the database. */
export const ProjectStatusSchema = z.enum([
  "queued",
  "planning",
  "validating",
  "assets",
  "ready",
  "failed",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/** POST /projects */
export const CreateProjectRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Type a prompt first.").max(4000),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const CreateProjectResponseSchema = z.object({ projectId: z.uuid() });
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

/** POST /projects/:id/revisions: what the viewer wants changed. */
export const CreateRevisionRequestSchema = z.object({
  feedback: z.string().trim().min(1, "Say what should change.").max(2000),
});
export type CreateRevisionRequest = z.infer<typeof CreateRevisionRequestSchema>;

export const CreateRevisionResponseSchema = z.object({
  projectId: z.uuid(),
  /** The plan version the feedback is about. The revision becomes the next version. */
  basedOnVersion: z.number().int(),
});
export type CreateRevisionResponse = z.infer<typeof CreateRevisionResponseSchema>;

/** GET /projects/:id */
export const ProjectResponseSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  prompt: z.string(),
  status: ProjectStatusSchema,
  error: z.string().nullable(),
  /** The current plan, once one exists. */
  plan: VideoPlanSchema.nullable(),
  planVersion: z.number().int().nullable(),
  /** The feedback that produced the current version (null for the first plan). */
  planFeedback: z.string().nullable(),
  createdAt: z.string(),
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
