import "server-only";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { db, DATA_DIR } from "@/lib/db";
import type { SlideSpec } from "@/runtime/types";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function saveAsset(projectId: string, data: Buffer, mime: string): string {
  const ext = Object.entries(IMAGE_MIME).find(([, m]) => m === mime)?.[0] ?? "bin";
  const id = nanoid(10);
  const dir = path.join(UPLOAD_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.${ext}`);
  fs.writeFileSync(file, data);
  db.prepare(`INSERT INTO assets (id, project_id, mime, file, bytes) VALUES (?, ?, ?, ?, ?)`).run(id, projectId, mime, file, data.length);
  return `asset:${id}`;
}

const dataUriCache = new Map<string, string>();
function assetDataUri(ref: string, projectId: string): string | undefined {
  const id = ref.slice("asset:".length);
  if (dataUriCache.has(id)) return dataUriCache.get(id);
  const row = db.prepare(`SELECT mime, file FROM assets WHERE id = ? AND project_id = ?`).get(id, projectId) as { mime: string; file: string } | undefined;
  if (!row || !fs.existsSync(row.file)) return undefined;
  const uri = `data:${row.mime};base64,${fs.readFileSync(row.file).toString("base64")}`;
  if (dataUriCache.size > 200) dataUriCache.clear();
  dataUriCache.set(id, uri);
  return uri;
}

/** Inline uploaded images so the exported HTML is fully standalone. */
export function resolveAssets(spec: SlideSpec, projectId: string): SlideSpec {
  if (!spec.image?.startsWith("asset:")) return spec;
  return { ...spec, image: assetDataUri(spec.image, projectId) };
}

export function deleteProjectAssets(projectId: string) {
  fs.rmSync(path.join(UPLOAD_DIR, projectId), { recursive: true, force: true });
}
