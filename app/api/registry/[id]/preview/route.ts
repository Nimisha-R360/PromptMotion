import { demoVideo } from "@/runtime/demo";
import { THEME_IDS } from "@/runtime/themes";
import { composeHtml } from "@/lib/compose";
import { apiError } from "@/lib/api";

export const runtime = "nodejs";

/** Live preview of a single library component, rendered by the same runtime used for exports. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = new URL(req.url).searchParams.get("theme") ?? "midnight";
  const spec = demoVideo(decodeURIComponent(id), THEME_IDS.includes(theme) ? theme : "midnight");
  if (!spec) return apiError(404, "not_found", "Unknown component");
  return new Response(composeHtml(spec), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
