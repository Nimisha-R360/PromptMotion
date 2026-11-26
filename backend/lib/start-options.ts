import { z } from "zod";
import type { Layout } from "../runtime/types";
import { MOODS, type Mood } from "./types";

/**
 * "Start faster" options chosen on the start screen: a template (kind of video) plus audience, length, mood and
 * language. Stored per project and turned into short instructions for the model (outline and every slide).
 * Shared by the browser (start screen) and the server (validation, prompts).
 */

export const TEMPLATE_IDS = ["lesson", "explainer", "launch", "reel", "report"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface Template {
  id: TemplateId;
  name: string;
  /** one line for the start screen */
  description: string;
  /** defaults applied when the template is picked */
  slides: number;
  mood: Mood;
  audience: Audience;
  /** what this kind of video contains, for the model */
  guide: string;
  /** suggested slide layouts, for the model (it adapts them to the topic) */
  structure: Layout[];
  placeholder: string;
}

export const AUDIENCES = ["Kids", "Students", "General public", "Professionals", "Customers"] as const;
export type Audience = (typeof AUDIENCES)[number];
const AUDIENCE_HINT: Record<Audience, string> = {
  Kids: "children aged 8-12: very simple words, short sentences, fun comparisons",
  Students: "school students: clear step-by-step explanations, explain each term simply",
  "General public": "adults with no special knowledge: plain language, everyday examples",
  Professionals: "experts: precise and concise, skip the basics",
  Customers: "potential buyers: benefits first, plain language, no jargon",
};

export const LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Portuguese", "Japanese"] as const;
export type Language = (typeof LANGUAGES)[number];

export const SLIDE_COUNTS = [3, 4, 5, 6, 7, 8, 10] as const;
export const MIN_SLIDES = 2;
export const MAX_SLIDES = 12;

export const TEMPLATES: Template[] = [
  {
    id: "lesson",
    name: "Lesson",
    description: "Teach a topic step by step",
    slides: 6,
    mood: "calm",
    audience: "Students",
    guide:
      "A lesson: open with a question or hook, explain the key ideas one per slide in a logical order, include a simple example or analogy, end with a short recap. Use correct facts.",
    structure: ["hero", "title-bullets", "cards", "timeline", "title-bullets", "closing"],
    placeholder: "e.g. Explain the atomic model for 9th graders",
  },
  {
    id: "explainer",
    name: "Explainer",
    description: "Explain how something works",
    slides: 5,
    mood: "energetic",
    audience: "General public",
    guide: "An explainer: what it is, why it matters, how it works step by step, a real-world example, one clear takeaway.",
    structure: ["hero", "title-bullets", "timeline", "cards", "closing"],
    placeholder: "e.g. How does a credit score work?",
  },
  {
    id: "launch",
    name: "Product launch",
    description: "Announce a product or feature",
    slides: 5,
    mood: "bold",
    audience: "Customers",
    guide: "A product launch: the problem, the product, three key features, proof or pricing, a clear call to action.",
    structure: ["hero", "title-bullets", "cards", "stats", "closing"],
    placeholder: "e.g. Launch video for 'Nimbus', an AI note-taking app, from $8/month",
  },
  {
    id: "reel",
    name: "Social reel",
    description: "Short and punchy for social media",
    slides: 4,
    mood: "energetic",
    audience: "General public",
    guide:
      "A social media reel: a scroll-stopping hook on slide 1, one idea per slide, very few words (max 6 per bullet), end with a call to action such as follow or share.",
    structure: ["hero", "big-number", "title-bullets", "closing"],
    placeholder: "e.g. 3 quick tips to sleep better tonight",
  },
  {
    id: "report",
    name: "Report",
    description: "Share results with a team",
    slides: 6,
    mood: "elegant",
    audience: "Professionals",
    guide: "A report: the headline result, key metrics, the trend over time, highlights, challenges, next steps. Use the exact numbers given.",
    structure: ["hero", "stats", "chart", "cards", "title-bullets", "closing"],
    placeholder: "e.g. Q3 review: revenue $4.2M (+38%), 1,200 new customers, churn 2.1%",
  },
];

export const getTemplate = (id: string | undefined) => TEMPLATES.find((t) => t.id === id);

export const StartOptionsSchema = z.object({
  template: z.enum(TEMPLATE_IDS).optional(),
  audience: z.enum(AUDIENCES).optional(),
  slides: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES).optional(),
  mood: z.enum(MOODS as [Mood, ...Mood[]]).optional(),
  language: z.enum(LANGUAGES).optional(),
});
export type StartOptions = z.infer<typeof StartOptionsSchema>;

/** Read stored options defensively (old rows, hand-edited data). */
export function parseStartOptions(raw: unknown): StartOptions {
  const parsed = StartOptionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export const hasStartOptions = (o: StartOptions | undefined) => !!o && Object.values(o).some((v) => v !== undefined);

/** Short label for the UI, e.g. "Lesson · Students · 6 slides · calm · Hindi". */
export function startOptionsLabel(o: StartOptions): string {
  return [getTemplate(o.template)?.name, o.audience, o.slides ? `${o.slides} slides` : undefined, o.mood, o.language].filter(Boolean).join(" · ");
}

/** The template's suggested layouts stretched or trimmed to `count` slides: first and last stay (hero … closing). */
export function structureFor(t: Template, count = t.slides): Layout[] {
  const first = t.structure[0];
  const last = t.structure[t.structure.length - 1];
  const middle = t.structure.slice(1, -1);
  if (count <= 1) return [first];
  return [first, ...Array.from({ length: count - 2 }, (_, i) => middle[i % middle.length]), last];
}

/**
 * Instructions for the model. "outline" also gets the suggested structure (fitted to `count` slides); "slide" gets
 * what affects the wording. English is the default language, so it adds no line.
 */
export function startOptionsBrief(o: StartOptions, stage: "outline" | "slide", count?: number): string[] {
  const t = getTemplate(o.template);
  const lines: string[] = [];
  if (t) lines.push(`FORMAT: ${t.name}. ${t.guide}`);
  if (t && stage === "outline") lines.push(`Suggested slide layouts, in order (adapt them to the topic): ${structureFor(t, count ?? o.slides).join(" → ")}.`);
  if (o.audience) lines.push(`AUDIENCE: ${o.audience}, ${AUDIENCE_HINT[o.audience]}.`);
  if (o.mood && stage === "outline") lines.push(`MOOD: ${o.mood}.`);
  if (o.language && o.language !== "English") {
    lines.push(stage === "outline" ? `LANGUAGE: write every slide title in ${o.language}.` : `LANGUAGE: write all slide text (title, subtitle, bullets, cards, labels, note) in ${o.language}.`);
  }
  return lines;
}
