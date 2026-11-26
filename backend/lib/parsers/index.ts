import "server-only";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import path from "node:path";
import type { SlideBrief } from "@/lib/types";
import { IMAGE_MIME } from "@/lib/assets";

export interface ParsedImage {
  data: Buffer;
  mime: string;
}
export interface ParsedSlide {
  brief: Omit<SlideBrief, "image">;
  image?: ParsedImage;
}
export interface ParsedDeck {
  title: string;
  slides: ParsedSlide[];
}

export const SUPPORTED = [".pptx", ".pdf", ".md", ".markdown", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/^[•▪◦●■\-*–]\s*/, "").trim();

/** Turn loose text lines into a brief: long single paragraphs become body, the rest bullets. */
function briefFrom(title: string, lines: string[], subtitle?: string): Omit<SlideBrief, "image"> {
  const clean = lines.map(tidy).filter((l) => l && l !== title);
  const long = clean.filter((l) => l.length > 140);
  const brief: Omit<SlideBrief, "image"> = { title: tidy(title).slice(0, 120) || "Untitled", locked: true };
  if (subtitle) brief.subtitle = tidy(subtitle);
  if (clean.length === 1 && clean[0].length <= 90 && !subtitle) brief.subtitle = clean[0];
  else if (clean.length === 1 && clean[0].length > 90) brief.body = clean[0];
  else if (long.length && long.length === clean.length) brief.body = long.join(" ").slice(0, 400);
  else if (clean.length) brief.bullets = clean.slice(0, 6).map((l) => l.slice(0, 160));
  return brief;
}

// ───────────── PPTX ─────────────
type XNode = Record<string, unknown>;
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function collect(node: unknown, name: string, out: XNode[] = []): XNode[] {
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node as XNode)) {
    if (k === name) arr(v as XNode | XNode[]).forEach((n) => out.push(n));
    if (typeof v === "object") collect(v, name, out);
  }
  return out;
}

function paragraphText(p: XNode): string {
  const runs = [...arr(p["a:r"] as XNode | XNode[]), ...arr(p["a:fld"] as XNode | XNode[])];
  return runs
    .map((r) => {
      const t = r["a:t"];
      return typeof t === "object" && t ? String((t as XNode)["#text"] ?? "") : String(t ?? "");
    })
    .join("");
}

async function parsePptx(buf: Buffer, name: string): Promise<ParsedDeck> {
  const zip = await JSZip.loadAsync(buf);
  const pres = xml.parse((await zip.file("ppt/presentation.xml")?.async("string")) ?? "");
  const rels = xml.parse((await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "");
  const relMap = new Map<string, string>(arr(rels?.Relationships?.Relationship as XNode | XNode[]).map((r) => [String(r["@_Id"]), String(r["@_Target"])]));
  const ids = collect(pres, "p:sldId").map((n) => String(n["@_r:id"]));
  const slidePaths = ids.map((id) => relMap.get(id)).filter(Boolean).map((t) => path.posix.join("ppt", t!));

  const slides: ParsedSlide[] = [];
  for (const sp of slidePaths) {
    const doc = xml.parse((await zip.file(sp)?.async("string")) ?? "");
    let title = "";
    let subtitle = "";
    const lines: string[] = [];
    for (const shape of collect(doc, "p:sp")) {
      const ph = collect(shape, "p:ph")[0];
      const type = ph ? String(ph["@_type"] ?? "body") : "";
      const paras = collect(shape["p:txBody"], "a:p").map(paragraphText).map((s) => s.trim()).filter(Boolean);
      if (!paras.length) continue;
      if ((type === "title" || type === "ctrTitle") && !title) title = paras.join(" ");
      else if (type === "subTitle" && !subtitle) subtitle = paras.join(" ");
      else if (type === "sldNum" || type === "dt" || type === "ftr") continue;
      else lines.push(...paras);
    }
    if (!title && lines.length) title = lines.shift()!;

    // first picture on the slide
    let image: ParsedImage | undefined;
    const blip = collect(doc, "a:blip")[0];
    const embed = blip?.["@_r:embed"];
    if (embed) {
      const relPath = path.posix.join(path.posix.dirname(sp), "_rels", path.posix.basename(sp) + ".rels");
      const srels = xml.parse((await zip.file(relPath)?.async("string")) ?? "");
      const target = arr(srels?.Relationships?.Relationship as XNode | XNode[]).find((r) => r["@_Id"] === embed)?.["@_Target"];
      if (target) {
        const media = path.posix.normalize(path.posix.join(path.posix.dirname(sp), String(target)));
        const ext = path.extname(media).slice(1).toLowerCase();
        const file = zip.file(media);
        if (file && IMAGE_MIME[ext]) image = { data: Buffer.from(await file.async("uint8array")), mime: IMAGE_MIME[ext] };
      }
    }
    if (!title && !lines.length && !image) continue;
    slides.push({ brief: briefFrom(title || `Slide ${slides.length + 1}`, lines, subtitle || undefined), image });
  }
  return { title: slides[0]?.brief.title ?? name, slides };
}

// ───────────── PDF ─────────────
async function parsePdf(buf: Buffer, name: string): Promise<ParsedDeck> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const slides: ParsedSlide[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 40); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // group text items into lines by y, remember font size
    const rows = new Map<number, { size: number; text: string; x: number }[]>();
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 4) * 4;
      const size = Math.abs(it.transform[3]) || Math.abs(it.transform[0]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ size, text: it.str, x: it.transform[4] });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => ({ size: Math.max(...parts.map((q) => q.size)), text: parts.sort((a, b) => a.x - b.x).map((q) => q.text).join(" ").replace(/\s+/g, " ").trim() }))
      .filter((l) => l.text);
    if (!lines.length) continue;
    const maxSize = Math.max(...lines.map((l) => l.size));
    const titleLines = lines.filter((l) => l.size >= maxSize * 0.92).slice(0, 2);
    const rest = lines.filter((l) => !titleLines.includes(l));
    // merge wrapped lines: a line that doesn't start with a bullet glyph continues the previous one when short gap
    const merged: string[] = [];
    for (const l of rest) {
      // a wrapped line: previous line is long and this one continues mid-sentence
      const prev = merged[merged.length - 1];
      const continues = prev && prev.length >= 60 && !/[.!?:]$/.test(prev) && /^[a-z(,]/.test(l.text);
      if (continues) merged[merged.length - 1] += " " + l.text;
      else merged.push(l.text);
    }
    slides.push({ brief: briefFrom(titleLines.map((l) => l.text).join(" "), merged) });
  }
  return { title: slides[0]?.brief.title ?? name, slides };
}

// ───────────── Markdown / text ─────────────
function parseMarkdown(text: string, name: string): ParsedDeck {
  const chunks = text
    .replace(/\r/g, "")
    .split(/\n(?:---+|\*\*\*+)\n|\n(?=#{1,2}\s)/)
    .map((c) => c.trim())
    .filter(Boolean);
  const slides: ParsedSlide[] = chunks.map((chunk, i) => {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const h = lines.findIndex((l) => /^#{1,6}\s/.test(l));
    const title = h >= 0 ? lines[h].replace(/^#+\s*/, "") : lines[0] ?? `Slide ${i + 1}`;
    const rest = lines.filter((_, j) => j !== (h >= 0 ? h : 0));
    const sub = rest.find((l) => /^#{3,6}\s/.test(l));
    const quote = rest.filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s*/, "")).join(" ");
    const bullets = rest.filter((l) => /^([-*+]|\d+[.)])\s/.test(l)).map((l) => l.replace(/^([-*+]|\d+[.)])\s+/, ""));
    const para = rest.filter((l) => !/^([-*+]|\d+[.)])\s|^>|^#|^!\[/.test(l)).join(" ");
    const brief = briefFrom(title, bullets, sub?.replace(/^#+\s*/, ""));
    if (quote) brief.body = quote;
    else if (para && !brief.bullets) brief.body = para.slice(0, 400);
    else if (para && !brief.subtitle) brief.subtitle = para.slice(0, 160);
    return { brief };
  });
  return { title: slides[0]?.brief.title ?? name, slides };
}

// ───────────── entry ─────────────
export async function parseUpload(files: { name: string; data: Buffer }[]): Promise<ParsedDeck> {
  const images = files.filter((f) => IMAGE_MIME[path.extname(f.name).slice(1).toLowerCase()]);
  if (images.length === files.length) {
    // a set of slide images/screenshots: one slide per image
    return {
      title: "Image slides",
      slides: images.map((f) => ({
        brief: { title: path.basename(f.name, path.extname(f.name)).replace(/[-_]+/g, " ").replace(/^\d+\s*/, "") || "Slide", locked: true },
        image: { data: f.data, mime: IMAGE_MIME[path.extname(f.name).slice(1).toLowerCase()] },
      })),
    };
  }
  const f = files[0];
  const ext = path.extname(f.name).toLowerCase();
  const base = path.basename(f.name, ext);
  if (ext === ".pptx") return parsePptx(f.data, base);
  if (ext === ".pdf") return parsePdf(f.data, base);
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") return parseMarkdown(f.data.toString("utf8"), base);
  throw new Error(`Unsupported file type ${ext}. Use ${SUPPORTED.join(", ")}`);
}
