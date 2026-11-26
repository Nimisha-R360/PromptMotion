import "server-only";
import { chatJson, LlmUnavailableError } from "@agents/llm";
import { startOptionsBrief } from "@backend/lib/start-options";
import type { Project } from "@backend/lib/types";
import type { SlideSpec } from "@backend/runtime/types";

/** Voiceover scripts: what a presenter says over each slide, written by the model from the slide's own words. */

const SYSTEM = `You write the voiceover for one slide of a short animated explainer video. A text-to-speech voice reads it aloud while the slide plays.
Answer with JSON that matches the schema. No markdown.

RULES
- 2 or 3 short sentences, 20 to 45 words in total (about 8 to 15 seconds spoken).
- Spoken English: warm, clear and natural, like a good presenter talking to the viewer.
- Explain the slide; never read its bullet points out word for word, and don't say "this slide" or "as you can see".
- Plain words only: no lists, emojis, symbols, URLs or abbreviations a voice can't read.
- Continue naturally from the previous slide's voiceover; don't repeat it.`;

const SCHEMA = { type: "object", properties: { narration: { type: "string" } }, required: ["narration"] };

/** What the slide shows, as the model should read it. */
function slideWords(s: SlideSpec) {
  return {
    title: s.title,
    subtitle: s.subtitle,
    body: s.body,
    bullets: s.bullets,
    cards: s.items?.map((it) => `${it.heading}: ${it.text}`),
    numbers: s.stats?.map((st) => `${st.value} ${st.label}`),
  };
}

/** Tidy model output for a voice: one paragraph, no markdown or emoji, at most ~60 words. */
export function cleanNarration(text: string): string {
  let t = text
    .replace(/[*_#`>~]|\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = t.split(" ");
  if (words.length > 60) {
    t = words.slice(0, 60).join(" ");
    const end = Math.max(t.lastIndexOf("."), t.lastIndexOf("!"), t.lastIndexOf("?"));
    t = end > 40 ? t.slice(0, end + 1) : `${t}.`;
  }
  return t;
}

/** A plain script from the slide's words, for when the model isn't available. */
export function fallbackNarration(s: SlideSpec, index: number, total: number): string {
  const strip = (x?: string) => (x ?? "").replace(/[.!?:;\s]+$/, "");
  const parts = [strip(s.title)];
  if (s.subtitle) parts.push(strip(s.subtitle));
  else if (s.body) parts.push(strip(s.body));
  const list = s.bullets?.length ? s.bullets : s.items?.length ? s.items.map((it) => it.heading) : s.stats?.map((st) => `${st.value} ${st.label}`);
  if (list?.length) parts.push(list.slice(0, 4).map(strip).join(", "));
  if (index === 0) parts[0] = `Welcome. ${parts[0]}`;
  if (index === total - 1 && total > 1) parts.push("Thanks for watching");
  return cleanNarration(parts.filter(Boolean).join(". ") + ".");
}

/** Write the voiceover for slide `index` (uses the slide's current design). */
export async function writeNarration(project: Project, index: number, spec: SlideSpec, signal?: AbortSignal): Promise<{ text: string; usedLlm: boolean }> {
  const total = project.slides.length;
  const prev = index > 0 ? project.slides[index - 1].spec?.narration : undefined;
  const where = index === 0 ? "the FIRST slide: open the video and say what it's about" : index === total - 1 ? "the LAST slide: wrap up and thank the viewer" : `slide ${index + 1} of ${total}`;
  const user = [
    `VIDEO: "${project.title}"${project.prompt ? ` — request: ${project.prompt.slice(0, 400)}` : ""}`,
    ...startOptionsBrief({ ...project.options, language: undefined }, "slide"),
    `This is ${where}.`,
    `SLIDE TEXT: ${JSON.stringify(slideWords(spec))}`,
    prev ? `PREVIOUS SLIDE'S VOICEOVER: "${prev}"` : "",
    "Write this slide's voiceover.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const raw = await chatJson<{ narration?: string }>({ system: SYSTEM, user, schema: SCHEMA, maxTokens: 160, temperature: 0.6, signal });
    const text = cleanNarration(raw.narration ?? "");
    if (text.split(" ").length >= 6) return { text, usedLlm: true };
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[voice] narration failed, using the slide text", e);
  }
  return { text: fallbackNarration(spec, index, total), usedLlm: false };
}
