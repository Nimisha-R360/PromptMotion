import type { Item, Layout, SlideSpec, Stat } from "@/runtime/types";

export type ProjectMode = "prompt" | "upload";
export type ProjectStage = "outline" | "outline_review" | "designing" | "complete";
export type SlideStatus = "pending" | "review" | "approved";
export type Mood = "calm" | "energetic" | "playful" | "elegant" | "techy" | "bold";
export const MOODS: Mood[] = ["energetic", "calm", "playful", "elegant", "techy", "bold"];

/** What a slide should say — from the LLM outline (prompt mode) or parsed from an upload. */
export interface SlideBrief {
  layout?: Layout;
  title: string;
  goal?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  items?: Item[];
  stats?: Stat[];
  /** `asset:<id>` */
  image?: string;
  /** true when content is fixed (uploaded slides): the designer must not rewrite it */
  locked?: boolean;
}

export interface Slide {
  id: number;
  index: number;
  status: SlideStatus;
  brief: SlideBrief;
  spec: SlideSpec | null;
  revision: number;
  updatedAt: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  kind: "text" | "outline" | "slide_review" | "complete" | "error" | "status" | "question";
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  mode: ProjectMode;
  stage: ProjectStage;
  theme: string;
  slideCount: number;
  approvedCount: number;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  mode: ProjectMode;
  prompt: string;
  theme: string;
  mood: Mood;
  stage: ProjectStage;
  currentIndex: number;
  sourceName: string | null;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  messages: Message[];
}
