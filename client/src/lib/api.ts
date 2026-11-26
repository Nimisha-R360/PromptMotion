import type { Project, ProjectSummary, SlideTextPatch } from "@backend/lib/types";
import type { StartOptions } from "@backend/lib/start-options";
import type { ComponentMeta, FrameworkInfo, Primitive } from "@backend/runtime/registry";
import type { Theme } from "@backend/runtime/themes";

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
  /** which model the agents run on */
  provider?: LlmProvider;
  /** why the cloud provider can't be used (bad key, no credits, unknown model) */
  error?: string | null;
}

export type LlmProvider = "local" | "anthropic" | "openai" | "groq";
export interface LlmSettings {
  provider: LlmProvider;
  anthropicModel: string;
  openaiModel: string;
  groqModel: string;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  hasGroqKey: boolean;
}
export type LlmSettingsPatch = Partial<{ provider: LlmProvider; anthropicApiKey: string; anthropicModel: string; openaiApiKey: string; openaiModel: string; groqApiKey: string; groqModel: string }>;

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
  llmSettings: () => fetch("/api/llm/settings", { cache: "no-store" }).then(json<LlmSettings>),
  saveLlmSettings: (body: LlmSettingsPatch) =>
    fetch("/api/llm/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<LlmSettings>),
  validateLlmKey: (body: { provider: Exclude<LlmProvider, "local">; apiKey?: string; model?: string }) =>
    post("/api/llm/validate", body).then(json<{ ok: boolean; error: string | null; reachable: boolean; model: string }>),
  projects: () => fetch("/api/projects", { cache: "no-store" }).then(json<{ data: ProjectSummary[] }>),
  project: (id: string) => fetch(`/api/projects/${id}`, { cache: "no-store" }).then(json<Project>),
  create: (prompt: string, options?: StartOptions) => post("/api/projects", { prompt, options }).then(json<Project>),
  upload: (files: File[], instructions?: string) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (instructions) fd.append("instructions", instructions);
    return fetch("/api/uploads", { method: "POST", body: fd }).then(json<Project>);
  },
  /** attach images / video clips to a project (the agent places them on slides) */
  attachMedia: (id: string, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return fetch(`/api/projects/${id}/media`, { method: "POST", body: fd }).then(json<{ refs: string[]; project: Project }>);
  },
  patch: (id: string, body: { title?: string; theme?: string; mood?: string }) =>
    fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<Project>),
  remove: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }).then(json<void>),
  approveOutline: (id: string) => post(`/api/projects/${id}/outline/approve`).then(json<Project>),
  approveSlide: (id: string, index: number) => post(`/api/projects/${id}/slides/${index}/approve`).then(json<Project>),
  patchSlide: (id: string, index: number, body: { text?: SlideTextPatch; animations?: Record<string, string>; layout?: string; duration?: number; style?: string; card?: string | null }) =>
    fetch(`/api/projects/${id}/slides/${index}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json<Project>),
};

/** images / video clips the chat can attach for the agent (other files are uploaded as a slide deck) */
export const MEDIA_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".m4v", ".webm", ".mov"];
export const isMediaFile = (f: File) => MEDIA_EXT.some((e) => f.name.toLowerCase().endsWith(e));
/** URL of an uploaded media file (`asset:<id>`) for thumbnails */
export const mediaUrl = (projectId: string, ref: string) => `/api/projects/${projectId}/media/${encodeURIComponent(ref.replace(/^asset:/, ""))}`;

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
