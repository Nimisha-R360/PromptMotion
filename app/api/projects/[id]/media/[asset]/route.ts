import fs from "node:fs";
import { apiError } from "@/lib/api";
import { assetFile } from "@/lib/assets";

export const runtime = "nodejs";

/** An uploaded image / video clip (thumbnails in the studio). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await params;
  const row = assetFile(id, asset.replace(/^asset:/, ""));
  if (!row) return apiError(404, "not_found", "Media not found");
  return new Response(fs.readFileSync(row.file), { headers: { "content-type": row.mime, "cache-control": "private, max-age=3600" } });
}
