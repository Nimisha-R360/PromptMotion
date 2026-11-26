import { z } from "zod";
import { apiError, sse, tryLock, unlock } from "@/lib/api";
import { addMessage, getProject } from "@/lib/data/projects";
import { runAgentTurn } from "@agents/director";
import { ActionError } from "@agents/actions";
import { setActivity } from "@agents/llm";

export const runtime = "nodejs";
export const maxDuration = 600;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  /** 0-based index of the slide the user is looking at */
  slide: z.number().int().min(0).optional(),
  /** false when the message is already in the chat (e.g. the prompt that created the project) */
  record: z.boolean().optional(),
  /** `asset:` refs of images / video clips attached to this message (uploaded via /media first) */
  media: z.array(z.string().regex(/^asset:[\w-]+$/)).max(20).optional(),
});

/**
 * One chat turn handled by the Director agent (Strands). Streams live phases as SSE:
 *   status {phase, text} · tool {name, args} · progress {elapsed} · done {project, via, tools} · error
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  if (!tryLock(id)) return apiError(409, "busy", "The agent is already working on this project");
  const { message } = parsed.data;
  const slide = parsed.data.slide ?? project.currentIndex;

  return sse(async (send) => {
    const started = Date.now();
    const beat = setInterval(() => send("progress", { tokens: 0, elapsed: Math.round((Date.now() - started) / 1000) }), 2000);
    try {
      const media = parsed.data.media ?? [];
      if (parsed.data.record !== false) addMessage(id, "user", "text", message, { index: slide, ...(media.length ? { media } : {}) });
      const res = await runAgentTurn(id, message, slide, {
        status: (phase, text) => {
          setActivity({ projectId: id, phase, label: text });
          send("status", { phase, text });
        },
        tool: (name, args) => send("tool", { name, args }),
      }, media);
      send("done", { ...getProject(id), agent: res });
    } catch (e) {
      if (e instanceof ActionError) {
        addMessage(id, "assistant", "text", e.message);
        send("done", getProject(id));
      } else throw e;
    } finally {
      clearInterval(beat);
      setActivity(null);
      unlock(id);
    }
  });
}
