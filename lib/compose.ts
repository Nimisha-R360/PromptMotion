import fs from "node:fs";
import path from "node:path";
import type { VideoSpec } from "@/runtime/types";
import { GOOGLE_FONTS_HREF, getTheme } from "@/runtime/themes";

const RUNTIME_PATH = path.join(process.cwd(), "runtime-dist", "pm-runtime.js");
let cache: { mtime: number; code: string } | null = null;

/** The bundled player runtime (anime.js + Motion + GSAP + Remotion primitives), re-read when rebuilt. */
export function runtimeCode(): string {
  const stat = fs.statSync(RUNTIME_PATH, { throwIfNoEntry: false });
  if (!stat) throw new Error("Runtime bundle missing — run `npm run build:runtime`.");
  if (!cache || cache.mtime !== stat.mtimeMs) cache = { mtime: stat.mtimeMs, code: fs.readFileSync(RUNTIME_PATH, "utf8") };
  return cache.code;
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
<script>${code}</script>
</body>
</html>`;
}
