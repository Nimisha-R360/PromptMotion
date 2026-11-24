import fs from "node:fs";
import path from "node:path";
import type { VideoSpec } from "@/runtime/types";
import { GOOGLE_FONTS_HREF, getTheme } from "@/runtime/themes";
import { slotsFor } from "@/runtime/layouts";
import { usesOnda } from "@/runtime/cards";

const DIST = path.join(process.cwd(), "runtime-dist");
const cache = new Map<string, { mtime: number; code: string }>();

/** A bundle from runtime-dist, re-read when rebuilt. */
function bundle(file: string): string {
  const p = path.join(DIST, file);
  const stat = fs.statSync(p, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Runtime bundle ${file} missing — run \`npm run build:runtime\`.`);
  const hit = cache.get(file);
  if (hit && hit.mtime === stat.mtimeMs) return hit.code;
  const code = fs.readFileSync(p, "utf8");
  cache.set(file, { mtime: stat.mtimeMs, code });
  return code;
}

/** The bundled player runtime (anime.js + Motion + GSAP + Remotion primitives). */
export const runtimeCode = () => bundle("pm-runtime.js");
/** The Onda add-on (React + Remotion + Onda cards and charts): only for pages whose slides use one. */
export const ondaCode = () => bundle("pm-onda.js");

const REMOCN_DIR = path.join(process.cwd(), "runtime-dist", "remocn");
const fileCache = new Map<string, { mtime: number; code: string }>();
function readCached(file: string): string | null {
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  const hit = fileCache.get(file);
  if (hit && hit.mtime === stat.mtimeMs) return hit.code;
  const code = fs.readFileSync(file, "utf8");
  fileCache.set(file, { mtime: stat.mtimeMs, code });
  return code;
}

/**
 * remocn components used by the video: the shared host (React + Remotion + <Player>) and one bundle per component
 * (built by scripts/build-remocn.mjs). Only inlined when a slide uses one; a missing bundle falls back to a core effect.
 */
export function remocnCode(spec: VideoSpec): string[] {
  const ids = new Set<string>();
  for (const s of spec.slides)
    for (const slot of slotsFor(s.layout)) {
      const id = s.animations?.[slot];
      if (typeof id === "string" && id.startsWith("remocn.")) ids.add(id.slice(7));
    }
  if (!ids.size) return [];
  const host = readCached(path.join(REMOCN_DIR, "host.js"));
  if (!host) {
    console.warn("[compose] remocn bundles missing — run `npm run build:runtime`.");
    return [];
  }
  const comps = [...ids].filter((id) => /^[a-z0-9-]+$/.test(id)).map((id) => readCached(path.join(REMOCN_DIR, "c", `${id}.js`))).filter((c): c is string => !!c);
  return [host, ...comps];
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** JSON safe to embed inside <script> */
const LS = new RegExp(String.fromCharCode(0x2028), "g");
const PS = new RegExp(String.fromCharCode(0x2029), "g");
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(LS, "\\u2028").replace(PS, "\\u2029");

/** Build a fully standalone, offline-capable HTML "video" page. */
export function composeHtml(spec: VideoSpec): string {
  const theme = getTheme(spec.theme);
  const code = runtimeCode().replace(/<\/script/gi, "<\\/script");
  const remocn = remocnCode(spec)
    .map((c) => `<script>${c.replace(/<\/script/gi, "<\\/script")}</script>\n`)
    .join("");
  // add-ons load first: the player draws remocn components and Onda cards/charts while it builds the slides
  const onda = spec.slides.some(usesOnda) ? `<script>${ondaCode().replace(/<\/script/gi, "<\\/script")}</script>\n` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Prompt Motion">
<title>${escapeHtml(spec.title || "Prompt Motion video")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">
<style>html,body{background:${theme.bg}}</style>
</head>
<body>
<script id="pm-spec" type="application/json">${safeJson(spec)}</script>
${remocn}${onda}<script>${code}</script>
</body>
</html>`;
}
