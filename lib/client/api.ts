"use client";
import type { Project, ProjectSummary } from "@/lib/types";
import type { ComponentMeta, FrameworkInfo, Primitive } from "@/runtime/registry";
import type { Theme } from "@/runtime/themes";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  throw new ApiError(res.status, body?.error?.code ?? "error", body?.error?.message ?? `Request failed (${res.status})`);
}

const post = (url: string, body?: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export type LlmPhase =
  | "warming"
  | "thinking"
  | "planning"
  | "revising"
  | "designing"
  | "redesigning"
  | "editing"
  | "applying"
  | "theming"
  | "splitting"
  | "answering"
  | "validating"
  | "waiting";
export interface LlmStatus {
  online: boolean;
  model: string | null;
  url: string;
  /** design guide already in the model's prompt cache */
  warm: boolean;
  /** what the model is doing right now (any tab / project) */
  activity: { projectId: string | null; phase: LlmPhase; label: string; startedAt: number } | null;
}

export interface Registry {
  frameworks: FrameworkInfo[];
  components: ComponentMeta[];
  primitives: Primitive[];
  themes: Theme[];
  layouts: { id: string; description: string }[];
}

export const api = {
  registry: () => fetch("/api/registry").then(json<Registry>),
  llm: () => fetch("/api/llm", { cache: "no-store" }).then(json<LlmStatus>),
  projects: () => fetch("/api/projects", { cache: "no-store" }).then(json<{ data: ProjectSummary[] }>),
  project: (id: string) => fetch(`/api/projects/${id}`, { cache: "no-store" }).then(json<Project>),
  create: (prompt: string) => post("/api/projects", { prompt }).then(json<Project>),
  upload: (files: File[], instructions?: string) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (instructions) fd.append("instructions", instructions);
    return fetch("/api/uploads", { method: "POST", body: fd }).then(json<Project>);
  },
  patch: (id: string, body: { title?: string; theme?: string; mood?: string }) =>
    fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<Project>),
  remove: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }).then(json<void>),
  approveOutline: (id: string) => post(`/api/projects/${id}/outline/approve`).then(json<Project>),
  approveSlide: (id: string, index: number) => post(`/api/projects/${id}/slides/${index}/approve`).then(json<Project>),
  patchSlide: (id: string, index: number, body: { animations?: Record<string, string>; layout?: string; duration?: number; style?: string }) =>
    fetch(`/api/projects/${id}/slides/${index}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<Project>),
};

export interface StreamHandlers {
  onStatus?: (text: string, phase?: string) => void;
  onProgress?: (tokens: number) => void;
  /** agent tool call started */
  onTool?: (name: string, args: unknown) => void;
}

/** POST to an SSE endpoint and resolve with the final project from the `done` event. */
export async function streamProject(url: string, body: unknown, h: StreamHandlers, signal?: AbortSignal): Promise<Project> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal });
  if (!res.ok || !res.body) await json(res);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: Project | null = null;
  let error: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const event = raw.match(/^event: (.*)$/m)?.[1];
      const dataLine = raw.match(/^data: (.*)$/m)?.[1];
      if (!event || !dataLine) continue;
      const data = JSON.parse(dataLine);
      if (event === "status") h.onStatus?.(data.text, data.phase);
      else if (event === "progress") h.onProgress?.(data.tokens);
      else if (event === "tool") h.onTool?.(data.name, data.args);
      else if (event === "done") result = data as Project;
      else if (event === "error") error = data.message;
    }
  }
  if (error) throw new ApiError(500, "generation_failed", error);
  if (!result) throw new ApiError(500, "generation_failed", "The stream ended unexpectedly");
  return result;
}
