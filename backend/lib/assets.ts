import "server-only";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { db, DATA_DIR } from "@/lib/db";
import type { SlideSpec } from "@/runtime/types";
import type { MediaAsset } from "@/lib/types";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** video clips ("scenes") the user can attach for the agent to place on slides */
export const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
/** voiceover audio made by the local voice model (lib/voice/tts.ts) */
export const AUDIO_MIME: Record<string, string> = { mp3: "audio/mpeg" };
/** mime of an attachable media file (image or video clip) from its name, or undefined */
export const mediaMime = (fileName: string) => {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  return IMAGE_MIME[ext] ?? VIDEO_MIME[ext];
};

export function saveAsset(projectId: string, data: Buffer, mime: string, name = ""): string {
  const ext = Object.entries({ ...IMAGE_MIME, ...VIDEO_MIME, ...AUDIO_MIME }).find(([, m]) => m === mime)?.[0] ?? "bin";
  const id = nanoid(10);
  const dir = path.join(UPLOAD_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.${ext}`);
  fs.writeFileSync(file, data);
  db.prepare(`INSERT INTO assets (id, project_id, mime, file, bytes, name) VALUES (?, ?, ?, ?, ?, ?)`).run(id, projectId, mime, file, data.length, name.slice(0, 200));
  return `asset:${id}`;
}


/** Images / video clips uploaded to a project (attached in the chat, or from an uploaded deck). */
export function listMedia(projectId: string): MediaAsset[] {
  const rows = db.prepare(`SELECT id, name, mime, bytes FROM assets WHERE project_id = ? ORDER BY created_at, rowid`).all(projectId) as { id: string; name: string; mime: string; bytes: number }[];
  return rows
    .filter((r) => r.mime.startsWith("image/") || r.mime.startsWith("video/"))
    .map((r, i) => ({ ref: `asset:${r.id}`, name: r.name || `media ${i + 1}`, mime: r.mime, kind: r.mime.startsWith("video/") ? "video" : "image", bytes: r.bytes }));
}

/** The stored file of one asset (for serving thumbnails in the studio). */
export function assetFile(projectId: string, assetId: string): { mime: string; file: string } | undefined {
  const row = db.prepare(`SELECT mime, file FROM assets WHERE id = ? AND project_id = ?`).get(assetId, projectId) as { mime: string; file: string } | undefined;
  return row && fs.existsSync(row.file) ? row : undefined;
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

/** Remove one stored asset (e.g. a voiceover replaced by a new recording). */
export function deleteAsset(projectId: string, ref: string | undefined) {
  if (!ref?.startsWith("asset:")) return;
  const id = ref.slice("asset:".length);
  const row = db.prepare(`SELECT file FROM assets WHERE id = ? AND project_id = ?`).get(id, projectId) as { file: string } | undefined;
  if (!row) return;
  db.prepare(`DELETE FROM assets WHERE id = ? AND project_id = ?`).run(id, projectId);
  fs.rmSync(row.file, { force: true });
  dataUriCache.delete(id);
}

/** Inline uploaded images and voiceover audio so the exported HTML is fully standalone. */
export function resolveAssets(spec: SlideSpec, projectId: string): SlideSpec {
  const isRef = (x?: string) => !!x?.startsWith("asset:");
  if (!isRef(spec.image) && !spec.images?.some(isRef) && !isRef(spec.voice?.src)) return spec;
  const resolve = (x: string) => (isRef(x) ? assetDataUri(x, projectId) : x);
  const voiceSrc = spec.voice && resolve(spec.voice.src);
  return {
    ...spec,
    image: spec.image ? resolve(spec.image) : undefined,
    ...(spec.images ? { images: spec.images.map(resolve).filter((x): x is string => !!x) } : {}),
    // a recording whose file is gone is left out (the slide plays silently)
    voice: spec.voice && voiceSrc ? { ...spec.voice, src: voiceSrc } : undefined,
  };
}

export function deleteProjectAssets(projectId: string) {
  fs.rmSync(path.join(UPLOAD_DIR, projectId), { recursive: true, force: true });
}
