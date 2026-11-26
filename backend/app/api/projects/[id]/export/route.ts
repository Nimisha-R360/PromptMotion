import { apiError } from "@/lib/api";
import { composeHtml } from "@/lib/compose";
import { getProject } from "@/lib/data/projects";
import { buildVideoSpec } from "@/lib/video";

export const runtime = "nodejs";

/** Download the standalone HTML (approved slides; ?draft=1 includes slides in review; ?format=web → animated web page). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return apiError(404, "not_found", "Project not found");
  const sp = new URL(req.url).searchParams;
  const draft = sp.get("draft") === "1";
  const format = sp.get("format") === "web" ? "web" : "video";
  const spec = buildVideoSpec(project, draft ? "all" : "approved", 0, format);
  if (!spec) return apiError(409, "nothing_to_export", draft ? "No slides designed yet" : "Approve at least one slide before exporting");
  spec.loop = false;
  spec.focus = undefined;
  const file = (project.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "video") + (format === "web" ? "-web" : "") + ".html";
  return new Response(composeHtml(spec), {
    headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store" },
  });
}
