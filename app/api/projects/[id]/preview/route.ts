import { apiError } from "@/lib/api";
import { composeHtml } from "@/lib/compose";
import { getProject } from "@/lib/data/projects";
import { buildVideoSpec } from "@/lib/video";

export const runtime = "nodejs";

/** HTML preview for the center player. ?scope=slide&index=N (focused loop) or ?scope=all · ?format=web for the web page */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope") === "all" ? "all" : "slide";
  const index = Number(sp.get("index") ?? project.currentIndex) || 0;
  const format = sp.get("format") === "web" ? "web" : "video";
  const spec = buildVideoSpec(project, scope, index, format);
  if (!spec) return apiError(404, "not_found", "Nothing designed yet");
  return new Response(composeHtml(spec), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
