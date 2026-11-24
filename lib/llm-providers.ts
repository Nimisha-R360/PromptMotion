import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { db } from "@/lib/db";

/**
 * Optional cloud models for the agents: Claude (Anthropic API) or ChatGPT (OpenAI API).
 * The provider + API keys are stored in the local SQLite `app_settings` table (falling back to env vars), and
 * `chatJson` in lib/llm.ts routes every request through `cloudChat` when a cloud provider is selected.
 */
export type LlmProvider = "local" | "anthropic" | "openai";
export const LLM_PROVIDERS: LlmProvider[] = ["local", "anthropic", "openai"];

export const DEFAULT_MODELS: Record<Exclude<LlmProvider, "local">, string> = {
  anthropic: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
  openai: process.env.OPENAI_MODEL ?? "gpt-5",
};

export interface LlmSettings {
  provider: LlmProvider;
  anthropicApiKey: string | null;
  anthropicModel: string;
  openaiApiKey: string | null;
  openaiModel: string;
}

/** What the browser may see: never the keys themselves. */
export interface PublicLlmSettings {
  provider: LlmProvider;
  anthropicModel: string;
  openaiModel: string;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
}

const KEYS = ["provider", "anthropicApiKey", "anthropicModel", "openaiApiKey", "openaiModel"] as const;
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
  };
}

export function publicLlmSettings(s: LlmSettings = getLlmSettings()): PublicLlmSettings {
  return {
    provider: s.provider,
    anthropicModel: s.anthropicModel,
    openaiModel: s.openaiModel,
    hasAnthropicKey: !!s.anthropicApiKey,
    hasOpenaiKey: !!s.openaiApiKey,
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
export function activeCloud(s: LlmSettings = getLlmSettings()): { provider: "anthropic" | "openai"; apiKey: string | null; model: string } | null {
  if (s.provider === "anthropic") return { provider: "anthropic", apiKey: s.anthropicApiKey, model: s.anthropicModel };
  if (s.provider === "openai") return { provider: "openai", apiKey: s.openaiApiKey, model: s.openaiModel };
  return null;
}

export const PROVIDER_NAME: Record<LlmProvider, string> = { local: "Local model", anthropic: "Claude", openai: "ChatGPT" };

// ───────────── clients ─────────────

let anthropicClient: { key: string; client: Anthropic } | null = null;
let openaiClient: { key: string; client: OpenAI } | null = null;
function resetClients() {
  anthropicClient = null;
  openaiClient = null;
}
const anthropicFor = (apiKey: string) =>
  (anthropicClient?.key === apiKey ? anthropicClient : (anthropicClient = { key: apiKey, client: new Anthropic({ apiKey }) })).client;
const openaiFor = (apiKey: string) => (openaiClient?.key === apiKey ? openaiClient : (openaiClient = { key: apiKey, client: new OpenAI({ apiKey }) })).client;

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
  cloud: { provider: "anthropic" | "openai"; apiKey: string; model: string },
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

  const client = openaiFor(cloud.apiKey);
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
  if (choice?.message?.refusal) throw new Error(`ChatGPT declined this request: ${choice.message.refusal}`);
  if (choice?.finish_reason === "length") throw new Error("ChatGPT's answer was cut off (max tokens).");
  return { text: choice?.message?.content ?? "", outputTokens: res.usage?.completion_tokens ?? 0 };
}

/** Cheap key/connectivity check for the status badge (cached briefly so polling doesn't hit the API each time). */
const verified = new Map<string, { ok: boolean; at: number }>();
export async function verifyCloud(cloud: { provider: "anthropic" | "openai"; apiKey: string; model: string }): Promise<boolean> {
  const id = `${cloud.provider}:${cloud.model}:${cloud.apiKey}`;
  const hit = verified.get(id);
  if (hit && Date.now() - hit.at < (hit.ok ? 10 * 60_000 : 30_000)) return hit.ok;
  let ok = false;
  try {
    if (cloud.provider === "anthropic") await anthropicFor(cloud.apiKey).models.retrieve(cloud.model, {}, { timeout: 5000 });
    else await openaiFor(cloud.apiKey).models.retrieve(cloud.model, { timeout: 5000 });
    ok = true;
  } catch {
    ok = false;
  }
  verified.set(id, { ok, at: Date.now() });
  return ok;
}
