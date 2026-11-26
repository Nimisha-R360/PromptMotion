import { z } from "zod";
import { apiError, sse, tryLock, unlock } from "@/lib/api";
import { getProject } from "@/lib/data/projects";
import { voiceSlide, voiceVideo } from "@agents/actions";
import { setActivity, type LlmPhase } from "@agents/llm";
import { voiceoverLanguageOk } from "@/lib/voice/voices";

export const runtime = "nodejs";
export const maxDuration = 600;

const Body = z.object({
  /** one slide; every designed slide when left out */
  index: z.number().int().min(0).optional(),
  /** write the slide's narration again with the AI (one slide only) */
  rewrite: z.boolean().optional(),
});

/** Make voiceovers (write narration with the AI where missing, record it with the local voice) — streamed as SSE. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  if (!voiceoverLanguageOk(project.options.language)) return apiError(409, "unsupported_language", `The voice speaks English only, and this video is in ${project.options.language}.`);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  const { index, rewrite } = parsed.data;
  if (index != null && !project.slides[index]?.spec) return apiError(404, "not_found", "That slide has no design yet");
  if (!tryLock(id)) return apiError(409, "busy", "A generation is already running for this project");

  return sse(async (send) => {
    const started = Date.now();
    const beat = setInterval(() => send("progress", { tokens: 0, elapsed: Math.round((Date.now() - started) / 1000) }), 2000);
    const r = {
      status: (phase: LlmPhase, text: string) => {
        setActivity({ projectId: id, phase, label: text });
        send("status", { text, phase });
      },
    };
    try {
      if (index != null) await voiceSlide(id, index, r, { rewrite });
      else await voiceVideo(id, r);
      send("done", getProject(id));
    } finally {
      clearInterval(beat);
      setActivity(null);
      unlock(id);
    }
  });
}
