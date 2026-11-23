import { z } from "zod";

/** Every queue the app uses. Later: generate, assets, render. */
export const QUEUES = {
  ping: "ping",
  /** Turn a project's prompt into a plan. */
  generate: "generate",
  /** Turn the viewer's feedback into a new plan version. */
  revise: "revise",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Payload of the test `ping` job. */
export const PingJobSchema = z.object({ message: z.string().min(1).max(200) });
export type PingJob = z.infer<typeof PingJobSchema>;

/** Payload of a `generate` job. */
export const GenerateJobSchema = z.object({ projectId: z.uuid() });
export type GenerateJob = z.infer<typeof GenerateJobSchema>;

/** Payload of a `revise` job. */
export const ReviseJobSchema = z.object({
  projectId: z.uuid(),
  /** The plan version the feedback is about. */
  basePlanId: z.uuid(),
  feedback: z.string().min(1),
});
export type ReviseJob = z.infer<typeof ReviseJobSchema>;
