import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { db } from "@backend/lib/db";

/**
 * Optional cloud models for the agents: Claude (Anthropic API), ChatGPT (OpenAI API) or Groq (Groq API, OpenAI-compatible).
 * The provider + API keys are stored in the local SQLite `app_settings` table (falling back to env vars), and
 * `chatJson` in lib/llm.ts routes every request through `cloudChat` when a cloud provider is selected.
 */
export type LlmProvider = "local" | "anthropic" | "openai" | "groq";
export type CloudProvider = Exclude<LlmProvider, "local">;
export const LLM_PROVIDERS: LlmProvider[] = ["local", "anthropic", "openai", "groq"];

export const DEFAULT_MODELS: Record<Exclude<LlmProvider, "local">, string> = {
  anthropic: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
  openai: process.env.OPENAI_MODEL ?? "gpt-5",
  groq: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
};

export interface LlmSettings {
  provider: LlmProvider;
  anthropicApiKey: string | null;
  anthropicModel: string;
  openaiApiKey: string | null;
  openaiModel: string;
  groqApiKey: string | null;
  groqModel: string;
}

/** What the browser may see: never the keys themselves. */
export interface PublicLlmSettings {
  provider: LlmProvider;
  anthropicModel: string;
  openaiModel: string;
  groqModel: string;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  hasGroqKey: boolean;
}

const KEYS = ["provider", "anthropicApiKey", "anthropicModel", "openaiApiKey", "openaiModel", "groqApiKey", "groqModel"] as const;
type SettingKey = (typeof KEYS)[number];

function readAll(): Partial<Record<SettingKey, string>> {
  const rows = db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'llm.%'").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key.slice(4), r.value]));
}

export function getLlmSettings(): LlmSettings {
  const s = readAll();
  const envProvider = process.env.LLM_PROVIDER as LlmProvider | undefined;
  const provider = (s.provider ?? envProvider) as LlmProvider | undefined;
  return {
    provider: provider && LLM_PROVIDERS.includes(provider) ? provider : "local",
    anthropicApiKey: s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || null,
    anthropicModel: s.anthropicModel || DEFAULT_MODELS.anthropic,
    openaiApiKey: s.openaiApiKey || process.env.OPENAI_API_KEY || null,
    openaiModel: s.openaiModel || DEFAULT_MODELS.openai,
    groqApiKey: s.groqApiKey || process.env.GROQ_API_KEY || null,
    groqModel: s.groqModel || DEFAULT_MODELS.groq,
  };
}

export function publicLlmSettings(s: LlmSettings = getLlmSettings()): PublicLlmSettings {
  return {
    provider: s.provider,
    anthropicModel: s.anthropicModel,
    openaiModel: s.openaiModel,
    groqModel: s.groqModel,
    hasAnthropicKey: !!s.anthropicApiKey,
    hasOpenaiKey: !!s.openaiApiKey,
    hasGroqKey: !!s.groqApiKey,
  };
}

/** Partial update. An empty string clears a stored value (keys/models fall back to env vars / defaults). */
export function saveLlmSettings(patch: Partial<Record<SettingKey, string | null>>): LlmSettings {
  const upsert = db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
  );
  const del = db.prepare("DELETE FROM app_settings WHERE key = ?");
  db.transaction(() => {
    for (const k of KEYS) {
      if (!(k in patch) || patch[k] === undefined) continue;
      const v = patch[k]?.trim() ?? "";
      if (v) upsert.run(`llm.${k}`, v);
      else del.run(`llm.${k}`);
    }
  })();
  resetClients();
  return getLlmSettings();
}

/** The active cloud provider (with its key + model), or null when the local model is selected. */
export function activeCloud(s: LlmSettings = getLlmSettings()): { provider: CloudProvider; apiKey: string | null; model: string } | null {
  if (s.provider === "anthropic") return { provider: "anthropic", apiKey: s.anthropicApiKey, model: s.anthropicModel };
  if (s.provider === "openai") return { provider: "openai", apiKey: s.openaiApiKey, model: s.openaiModel };
  if (s.provider === "groq") return { provider: "groq", apiKey: s.groqApiKey, model: s.groqModel };
  return null;
}

export const PROVIDER_NAME: Record<LlmProvider, string> = { local: "Local model", anthropic: "Claude", openai: "ChatGPT", groq: "Groq" };

// ───────────── clients ─────────────

let anthropicClient: { key: string; client: Anthropic } | null = null;
let openaiClient: { key: string; client: OpenAI } | null = null;
let groqClient: { key: string; client: OpenAI } | null = null;
function resetClients() {
  anthropicClient = null;
  openaiClient = null;
  groqClient = null;
}
const anthropicFor = (apiKey: string) =>
  (anthropicClient?.key === apiKey ? anthropicClient : (anthropicClient = { key: apiKey, client: new Anthropic({ apiKey }) })).client;
const openaiFor = (apiKey: string) => (openaiClient?.key === apiKey ? openaiClient : (openaiClient = { key: apiKey, client: new OpenAI({ apiKey }) })).client;
/** Groq speaks the OpenAI Chat Completions API, so it reuses the OpenAI SDK with Groq's base URL. */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const groqFor = (apiKey: string) => (groqClient?.key === apiKey ? groqClient : (groqClient = { key: apiKey, client: new OpenAI({ apiKey, baseURL: GROQ_BASE_URL }) })).client;
/** Client for an OpenAI-compatible provider (ChatGPT or Groq). */
const chatClientFor = (provider: "openai" | "groq", apiKey: string) => (provider === "groq" ? groqFor(apiKey) : openaiFor(apiKey));

/** Errors that mean "this provider can't be used right now" (bad key, no network, rate limit, outage) → rule-based fallback. */
export function isProviderUnavailable(e: unknown): boolean {
  if (e instanceof Anthropic.APIError) return e instanceof Anthropic.APIConnectionError || e.status === 401 || e.status === 403 || e.status === 429 || (e.status ?? 0) >= 500;
  if (e instanceof OpenAI.APIError) return e instanceof OpenAI.APIConnectionError || e.status === 401 || e.status === 403 || e.status === 429 || (e.status ?? 0) >= 500;
  return false;
}

// ───────────── schema adaptation ─────────────

/**
 * Structured outputs accept a subset of JSON Schema: every object needs `additionalProperties: false`, and
 * array size / numeric / string-length constraints are not supported (the prompts already state the limits).
 */
function cloudSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(cloudSchema);
  if (!s || typeof s !== "object") return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (["$schema", "maxItems", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern"].includes(k)) continue;
    if (k === "minItems" && typeof v === "number" && v > 1) continue;
    out[k] = k === "properties" && v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([p, ps]) => [p, cloudSchema(ps)])) : cloudSchema(v);
  }
  if (out.type === "object") {
    out.additionalProperties = false;
    out.properties ??= {};
  }
  return out;
}

// ───────────── completion ─────────────

export interface CloudChatOptions {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = /^claude-(fable-5-[12]|opus-5|opus-5-5|sonnet-5-5)$/;

/** One schema-constrained completion on the active cloud provider. Returns the raw JSON text. */
export async function cloudChat(
  cloud: { provider: CloudProvider; apiKey: string; model: string },
  opts: CloudChatOptions,
): Promise<{ text: string; outputTokens: number }> {
  const schema = cloudSchema(opts.schema) as Record<string, unknown>;
  // the API needs the conversation to start with a user turn
  const messages = opts.messages.length && opts.messages[0].role === "user" ? opts.messages : [{ role: "user" as const, content: "Continue." }, ...opts.messages];

  if (cloud.provider === "anthropic") {
    const client = anthropicFor(cloud.apiKey);
    const res = await client.beta.messages.create(
      {
        model: cloud.model,
        max_tokens: 16000,
        system: opts.system,
        messages,
        // short, schema-shaped answers: low effort keeps the studio responsive
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        ...(FALLBACK_MODELS.test(cloud.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal: opts.signal },
    );
    if (res.stop_reason === "refusal") throw new Error("Claude declined this request.");
    if (res.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (max_tokens).");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { text, outputTokens: res.usage.output_tokens };
  }

  const client = chatClientFor(cloud.provider, cloud.apiKey);
  const name = PROVIDER_NAME[cloud.provider];
  const res = await client.chat.completions.create(
    {
      model: cloud.model,
      max_completion_tokens: 16000,
      messages: [{ role: "system", content: opts.system }, ...messages],
      // non-strict: strict mode would require every property to be listed as required
      response_format: { type: "json_schema", json_schema: { name: "output", schema, strict: false } },
    },
    { signal: opts.signal },
  );
  const choice = res.choices[0];
  if (choice?.message?.refusal) throw new Error(`${name} declined this request: ${choice.message.refusal}`);
  if (choice?.finish_reason === "length") throw new Error(`${name}'s answer was cut off (max tokens).`);
  return { text: choice?.message?.content ?? "", outputTokens: res.usage?.completion_tokens ?? 0 };
}

/**
 * Turns a provider error into a user-facing reason, or null when it is transient (network blip, timeout, outage):
 * those must not mark a valid key as unavailable.
 */
export function describeProviderError(e: unknown, cloud: { provider: CloudProvider; model: string }): string | null {
  const name = PROVIDER_NAME[cloud.provider];
  const isApiErr = e instanceof Anthropic.APIError || e instanceof OpenAI.APIError;
  if (!isApiErr) return null;
  if (e instanceof Anthropic.APIConnectionError || e instanceof OpenAI.APIConnectionError) return null;
  const status = (e as { status?: number }).status ?? 0;
  const msg = String((e as Error).message ?? "");
  const code = String((e as { code?: unknown }).code ?? "");
  if (code === "insufficient_quota") return `${name} account has no credits left — add billing to continue.`;
  if (status === 401 && /invalidated|revoked/i.test(code + " " + msg)) return `This ${name} API key has been revoked — create a new one.`;
  if (status === 401) return `Invalid ${name} API key.`;
  if (status === 403) return `This ${name} API key is not allowed to use ${cloud.model}.`;
  if (status === 404) return `Model "${cloud.model}" was not found for this ${name} API key.`;
  if (status === 429 && /credit|quota|billing/i.test(msg)) return `${name} account has no credits left — add billing to continue.`;
  if (status === 429) return null; // plain rate limit: the key itself is fine
  if (status === 400 && /credit|billing/i.test(msg)) return `${name} account has no credits left — add billing to continue.`;
  if (status >= 500) return null;
  return msg || `${name} rejected the request (${status}).`;
}

/** Last definitive failure seen on a real request, per provider+key (cleared by the next success). */
const lastErrors = new Map<string, string>();
const cloudId = (c: { provider: string; apiKey: string; model: string }) => `${c.provider}:${c.model}:${c.apiKey}`;
export function recordCloudResult(cloud: { provider: CloudProvider; apiKey: string; model: string }, error: string | null) {
  if (error) lastErrors.set(cloudId(cloud), error);
  else lastErrors.delete(cloudId(cloud));
}

export interface CloudCheck {
  /** the key can be used with this model right now */
  ok: boolean;
  /** why not (invalid key, no credits, unknown model …) */
  error: string | null;
  /** false when the provider could not be reached at all (network / timeout / outage) */
  reachable: boolean;
}

/**
 * Validates a key + model with one tiny real request (1–16 output tokens). Unlike listing models, this also
 * catches accounts without credits and models the key may not use.
 */
async function probeCloud(cloud: { provider: CloudProvider; apiKey: string; model: string }): Promise<CloudCheck> {
  if (!cloud.apiKey.trim()) return { ok: false, error: `No ${PROVIDER_NAME[cloud.provider]} API key is set.`, reachable: true };
  if (!cloud.model.trim()) return { ok: false, error: "No model name is set.", reachable: true };
  try {
    const opts = { timeout: 20_000, maxRetries: 2 };
    if (cloud.provider === "anthropic") {
      await anthropicFor(cloud.apiKey).messages.create({ model: cloud.model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }, opts);
    } else {
      await chatClientFor(cloud.provider, cloud.apiKey).chat.completions.create({ model: cloud.model, max_completion_tokens: 16, messages: [{ role: "user", content: "ping" }] }, opts);
    }
    return { ok: true, error: null, reachable: true };
  } catch (e) {
    const error = describeProviderError(e, cloud);
    if (error) return { ok: false, error, reachable: true };
    console.warn(`[llm] ${cloud.provider} validation could not reach the API:`, (e as Error).message);
    return { ok: false, error: `Couldn't reach ${PROVIDER_NAME[cloud.provider]} — check your internet connection and try again.`, reachable: false };
  }
}

const verified = new Map<string, CloudCheck & { at: number }>();

/** The key + model that would be used for `provider` if `patch` were saved (blank fields fall back to stored / env / default). */
export function resolveCloud(
  provider: CloudProvider,
  patch: { apiKey?: string; model?: string } = {},
  s: LlmSettings = getLlmSettings(),
): { provider: CloudProvider; apiKey: string; model: string } {
  const stored = {
    anthropic: { apiKey: s.anthropicApiKey, model: s.anthropicModel },
    openai: { apiKey: s.openaiApiKey, model: s.openaiModel },
    groq: { apiKey: s.groqApiKey, model: s.groqModel },
  }[provider];
  return {
    provider,
    apiKey: patch.apiKey?.trim() || stored.apiKey || "",
    model: patch.model?.trim() || stored.model || DEFAULT_MODELS[provider],
  };
}

/** Validates now (no cache) and remembers the result for the status badge. Used by "Test key" and Save. */
export async function validateCloud(cloud: { provider: CloudProvider; apiKey: string; model: string }): Promise<CloudCheck> {
  const result = await probeCloud(cloud);
  const id = cloudId(cloud);
  if (result.reachable) {
    verified.set(id, { ...result, at: Date.now() });
    recordCloudResult(cloud, result.error);
  }
  return result;
}

/**
 * Status-badge check: the last validation result, re-validated every 10 min (or 30 s after a failure).
 * A network blip keeps the last known state instead of flipping a valid key to "unavailable".
 */
export async function verifyCloud(cloud: { provider: CloudProvider; apiKey: string; model: string }): Promise<CloudCheck> {
  const id = cloudId(cloud);
  const hit = verified.get(id);
  const last = lastErrors.get(id);
  if (last) {
    if (hit && Date.now() - hit.at < 30_000) return { ok: false, error: last, reachable: true };
  } else if (hit && Date.now() - hit.at < (hit.ok ? 10 * 60_000 : 30_000)) return hit;
  const result = await validateCloud(cloud);
  if (!result.reachable) return hit ? { ...hit, reachable: false } : { ok: true, error: null, reachable: false };
  return result;
}
