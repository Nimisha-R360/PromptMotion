import { z } from "zod";
import { apiError, sse, tryLock, unlock } from "@/lib/api";
import { addMessage, getProject } from "@/lib/data/projects";
import { planOutline } from "@/lib/actions";
import { setActivity } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ feedback: z.string().trim().max(2000).optional() });

/** Generate (or revise with feedback) the slide outline — streamed as SSE. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  if (project.mode !== "prompt") return apiError(409, "invalid_stage", "Uploaded projects use their own slides as the outline");
  if (project.stage !== "outline" && project.stage !== "outline_review") return apiError(409, "invalid_stage", "The outline is already approved");
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "invalid_body", "Invalid feedback");
  const feedback = parsed.data.feedback || undefined;
  if (!tryLock(id)) return apiError(409, "busy", "A generation is already running for this project");

  return sse(async (send) => {
    const started = Date.now();
    const beat = setInterval(() => send("progress", { tokens: 0, elapsed: Math.round((Date.now() - started) / 1000) }), 2000);
    try {
      if (feedback) addMessage(id, "user", "text", feedback);
      await planOutline(id, feedback, {
        status: (phase, text) => {
          setActivity({ projectId: id, phase, label: text });
          send("status", { text, phase });
        },
        progress: (tokens) => send("progress", { tokens }),
      });
      send("done", getProject(id));
    } finally {
      clearInterval(beat);
      setActivity(null);
      unlock(id);
    }
  });
}
