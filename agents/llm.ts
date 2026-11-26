import "server-only";
import { activeCloud, cloudChat, describeProviderError, isProviderUnavailable, PROVIDER_NAME, recordCloudResult, verifyCloud, type LlmProvider } from "@agents/llm-providers";

/**
 * Client for the local llama.cpp model (OpenAI-compatible API: llama-cpp-python server or native llama-server).
 * Output is constrained with a JSON schema → GBNF grammar, so the small model can only emit valid component ids.
 */
export const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "http://127.0.0.1:8081/v1";
export const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5-3b-instruct";
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 240_000);

export class LlmUnavailableError extends Error {}

// ───────────── model activity + prompt-cache warmth (shared across requests) ─────────────

export type LlmPhase =
  | "warming"
  | "thinking" // agent is choosing the next action
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
  | "waiting"; // waiting for the user's approval / answer
export interface LlmActivity {
  projectId: string | null;
  phase: LlmPhase;
  label: string;
  startedAt: number;
}
interface LlmState {
  activity: LlmActivity | null;
  /**
   * System prompt most recently evaluated by the (single-slot) llama.cpp server — its tokens are in the KV cache,
   * so any prompt it starts with is "warm" (prompt eval is ~60 tok/s on CPU: a cold 2.5k-token prompt costs ~40s).
   */
  lastSystem: string | null;
  warming: Promise<void> | null;
  online: boolean;
  /** requests currently running on the model server (it can't answer health probes quickly while busy) */
  inflight: number;
}
declare global {
  var __pmLlm4: LlmState | undefined;
}
const state: LlmState = (globalThis.__pmLlm4 ??= { activity: null, lastSystem: null, warming: null, online: false, inflight: 0 });

/** Warm when the last evaluated prompt starts with this one (the agent prompt begins with the design guide). */
export const isWarm = (system: string) => !!activeCloud() || !!state.lastSystem?.startsWith(system); // cloud models have nothing to warm up
export function setActivity(a: Omit<LlmActivity, "startedAt"> | null) {
  state.activity = a ? { ...a, startedAt: state.activity?.projectId === a.projectId ? state.activity.startedAt : Date.now() } : null;
}

export async function llmStatus(
  system: string,
): Promise<{ online: boolean; model: string | null; url: string; warm: boolean; activity: LlmActivity | null; provider: LlmProvider; error?: string | null }> {
  const cloud = activeCloud();
  if (cloud) {
    const check = cloud.apiKey ? await verifyCloud({ ...cloud, apiKey: cloud.apiKey }) : { ok: false, error: `No ${PROVIDER_NAME[cloud.provider]} API key is set.` };
    return {
      online: check.ok,
      model: cloud.model,
      url: PROVIDER_NAME[cloud.provider],
      warm: true,
      activity: state.activity,
      provider: cloud.provider,
      error: check.error,
    };
  }
  try {
    const res = await fetch(`${LLM_BASE_URL}/models`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { data?: { id: string }[] };
    if (!state.online) state.lastSystem = null; // (re)started server → empty cache
    state.online = true;
    return { online: true, model: j.data?.[0]?.id ?? LLM_MODEL, url: LLM_BASE_URL, warm: isWarm(system), activity: state.activity, provider: "local" };
  } catch {
    // While a request is running the server may be too busy to answer the probe: that's busy, not offline.
    if (state.inflight > 0 && state.online) return { online: true, model: LLM_MODEL, url: LLM_BASE_URL, warm: isWarm(system), activity: state.activity, provider: "local" };
    state.online = false;
    state.lastSystem = null;
    return { online: false, model: null, url: LLM_BASE_URL, warm: false, activity: state.activity, provider: "local" };
  }
}

/**
 * Pre-evaluate the static designer system prompt so the first real request only pays for its own tokens.
 * llama.cpp reuses the longest matching prefix of the last evaluated prompt, so later designer calls hit the cache.
 */
export function warmUp(system: string): Promise<void> {
  if (isWarm(system) || state.warming || state.activity) return state.warming ?? Promise.resolve();
  state.inflight++;
  state.warming = fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ model: LLM_MODEL, stream: false, max_tokens: 1, temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: "ready" }] }),
  })
    .then((r) => {
      if (r.ok) state.lastSystem = system;
    })
    .catch(() => {})
    .finally(() => {
      state.inflight--;
      state.warming = null;
    });
  return state.warming;
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  /** full multi-turn conversation (agent); when given, `user` is ignored and `system` is prepended */
  history?: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  onProgress?: (tokens: number, partial: string) => void;
  signal?: AbortSignal;
}

/**
 * Schema-constrained completion. Uses a non-streaming request: llama-cpp-python's SSE endpoint drops the
 * connection when prompt evaluation of the (large) designer prompt takes longer than ~60s on CPU.
 * Progress to the browser is reported by the route via heartbeats instead.
 */
export async function chatJson<T>(opts: ChatJsonOptions): Promise<T> {
  const cloud = activeCloud();
  if (cloud) return cloudChatJson<T>(cloud, opts);
  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  state.inflight++;
  try {
    res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        temperature: opts.temperature ?? 0.7,
        top_p: 0.9,
        max_tokens: opts.maxTokens ?? 700,
        messages: [{ role: "system", content: opts.system }, ...(opts.history ?? [{ role: "user" as const, content: opts.user }])],
        // accepted by llama-cpp-python and llama.cpp's llama-server (converted to a GBNF grammar)
        response_format: { type: "json_object", schema: opts.schema },
      }),
    });
  } catch (e) {
    state.inflight--;
    if ((e as Error).name === "TimeoutError") throw new Error("The local model timed out.");
    throw new LlmUnavailableError(`Local model is not reachable at ${LLM_BASE_URL}`);
  }
  let body: { choices?: { message?: { content?: string } }[]; usage?: { completion_tokens?: number } };
  try {
    if (!res.ok) throw new LlmUnavailableError(`Local model error: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    body = await res.json();
  } finally {
    state.inflight--;
  }
  const text = body.choices?.[0]?.message?.content ?? "";
  state.lastSystem = opts.system; // this system prompt is now in llama.cpp's KV cache
  opts.onProgress?.(body.usage?.completion_tokens ?? 0, text);
  return parseJsonLoose<T>(text);
}

export function parseJsonLoose<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1)) as T;
    throw new Error("The model returned invalid JSON.");
  }
}

/** Same contract as chatJson, on Claude / ChatGPT (selected in the model settings). */
async function cloudChatJson<T>(cloud: NonNullable<ReturnType<typeof activeCloud>>, opts: ChatJsonOptions): Promise<T> {
  const name = PROVIDER_NAME[cloud.provider];
  if (!cloud.apiKey) throw new LlmUnavailableError(`${name} is selected but no API key is set.`);
  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS);
  let out: { text: string; outputTokens: number };
  state.inflight++;
  try {
    out = await cloudChat(
      { ...cloud, apiKey: cloud.apiKey },
      { system: opts.system, messages: opts.history ?? [{ role: "user", content: opts.user }], schema: opts.schema, signal },
    );
    recordCloudResult({ ...cloud, apiKey: cloud.apiKey }, null);
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new Error(`${name} timed out.`);
    // key / billing / model problems show up in the status badge until a request succeeds again
    const reason = describeProviderError(e, cloud);
    if (reason) recordCloudResult({ ...cloud, apiKey: cloud.apiKey }, reason);
    if (isProviderUnavailable(e)) throw new LlmUnavailableError(`${name} is not available: ${reason ?? (e as Error).message}`);
    throw e;
  } finally {
    state.inflight--;
  }
  opts.onProgress?.(out.outputTokens, out.text);
  return parseJsonLoose<T>(out.text);
}
