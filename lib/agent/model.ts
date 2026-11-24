import "server-only";
import { nanoid } from "nanoid";
import {
  Model,
  ModelMessageStartEvent,
  ModelContentBlockStartEvent,
  ModelContentBlockDeltaEvent,
  ModelContentBlockStopEvent,
  ModelMessageStopEvent,
  ModelMetadataEvent,
  type BaseModelConfig,
  type Message,
  type ModelStreamEvent,
  type StreamOptions,
  type ToolSpec,
} from "@strands-agents/sdk";
import { chatJson } from "@/lib/llm";

/**
 * Strands model provider for the local llama.cpp server (Qwen2.5-3B-Instruct).
 *
 * Small local models are unreliable at free-form tool calling, so every turn is ONE grammar-constrained
 * completion: the JSON schema is `{"calls":[anyOf(<tool name const + that tool's argument schema>)]}`.
 * The model therefore can only emit existing tools with valid arguments — the calls are then replayed to
 * Strands as regular tool-use stream events, so the Agent loop, tools, hooks and memory work unchanged.
 */
export interface LocalGrammarModelConfig extends BaseModelConfig {
  /** max tool calls per turn */
  maxCalls?: number;
}

type Turn = { role: "user" | "assistant"; content: string };

/** Separates the static part of a system prompt from the per-turn dynamic part (see systemWithTools). */
export const DYNAMIC_MARKER = "\n<<DYNAMIC>>\n";

const stripSchema = (s: unknown): unknown => {
  if (Array.isArray(s)) return s.map(stripSchema);
  if (!s || typeof s !== "object") return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (k === "$schema" || k === "additionalProperties" || (k === "description" && typeof v === "string")) continue;
    out[k] = stripSchema(v);
  }
  return out;
};

export class LocalGrammarModel extends Model<LocalGrammarModelConfig> {
  private config: LocalGrammarModelConfig;
  constructor(config: LocalGrammarModelConfig = {}) {
    super();
    this.config = { modelId: "qwen2.5-3b-instruct", maxTokens: 320, temperature: 0.25, maxCalls: 3, ...config };
  }
  updateConfig(c: LocalGrammarModelConfig) {
    this.config = { ...this.config, ...c };
  }
  getConfig() {
    return this.config;
  }

  /** Strands messages → compact chat turns (tool calls as JSON, tool results as short user turns). */
  static toTurns(messages: Message[]): Turn[] {
    const names = new Map<string, string>();
    const turns: Turn[] = [];
    for (const m of messages) {
      const parts: string[] = [];
      if (m.role === "assistant") {
        const calls: { tool: string; args: unknown }[] = [];
        for (const b of m.content) {
          if (b.type === "toolUseBlock") {
            names.set(b.toolUseId, b.name);
            calls.push({ tool: b.name, args: b.input });
          } else if (b.type === "textBlock" && b.text.trim()) parts.push(b.text.trim());
        }
        turns.push({ role: "assistant", content: calls.length ? JSON.stringify({ calls }) : parts.join("\n") || "{}" });
      } else {
        for (const b of m.content) {
          if (b.type === "textBlock") parts.push(b.text);
          else if (b.type === "toolResultBlock") {
            const body = b.content
              .map((c) => (c.type === "textBlock" ? c.text : c.type === "jsonBlock" ? JSON.stringify(c.json) : ""))
              .join(" ")
              .slice(0, 400);
            parts.push(`TOOL RESULT ${names.get(b.toolUseId) ?? ""} (${b.status}): ${body}`);
          }
        }
        if (parts.length) turns.push({ role: "user", content: parts.join("\n") });
      }
    }
    // chat templates expect alternating roles: merge consecutive same-role turns
    return turns.reduce<Turn[]>((acc, t) => {
      const last = acc[acc.length - 1];
      if (last && last.role === t.role) last.content += "\n" + t.content;
      else acc.push({ ...t });
      return acc;
    }, []);
  }

  static callsSchema(specs: ToolSpec[], maxCalls: number) {
    return {
      type: "object",
      properties: {
        calls: {
          type: "array",
          minItems: 1,
          maxItems: maxCalls,
          items: {
            anyOf: specs.map((s) => ({
              type: "object",
              properties: { tool: { const: s.name }, args: stripSchema(s.inputSchema ?? { type: "object", properties: {} }) },
              required: ["tool", "args"],
            })),
          },
        },
      },
      required: ["calls"],
    };
  }

  /** Tool catalog shown to the model (the grammar enforces the exact argument shapes). */
  static describeTools(specs: ToolSpec[]) {
    return specs
      .map((s) => {
        const props = (s.inputSchema as { properties?: Record<string, { type?: string; enum?: unknown[] }> })?.properties ?? {};
        const args = Object.entries(props)
          .map(([k, v]) => `${k}${v.enum && v.enum.length <= 12 ? `=${v.enum.join("|")}` : v.type ? `:${v.type}` : ""}`)
          .join(", ");
        return `- ${s.name}(${args}): ${s.description}`;
      })
      .join("\n");
  }

  /**
   * System prompt layout for prompt caching: [static rules + tool list] is identical every turn (cached by the
   * server's RAM prompt cache), the per-turn dynamic part (project state) goes last.
   */
  static systemWithTools(staticPart: string, specs: ToolSpec[]) {
    return staticPart + (specs.length ? `\nTOOLS (reply ONLY with {"calls":[{"tool":..., "args":{...}}]}):\n${LocalGrammarModel.describeTools(specs)}` : "");
  }

  async *stream(messages: Message[], options: StreamOptions = {}): AsyncIterable<ModelStreamEvent> {
    const specs = options.toolSpecs ?? [];
    const raw = typeof options.systemPrompt === "string" ? options.systemPrompt : "";
    const [staticPart, dynamicPart] = raw.split(DYNAMIC_MARKER);
    const system = LocalGrammarModel.systemWithTools(staticPart, specs) + (dynamicPart ? `\n\n${dynamicPart}` : "");
    const history = LocalGrammarModel.toTurns(messages);
    if (!history.length || history[history.length - 1].role !== "user") history.push({ role: "user", content: "Continue." });

    yield new ModelMessageStartEvent({ type: "modelMessageStartEvent", role: "assistant" });
    let outputTokens = 0;
    const started = Date.now();

    if (!specs.length) {
      // plain text turn (not used by the director, kept for completeness)
      const out = await chatJson<{ text: string }>({
        system,
        user: "",
        history,
        schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        signal: options.cancelSignal,
        onProgress: (n) => (outputTokens = n),
      });
      yield new ModelContentBlockDeltaEvent({ type: "modelContentBlockDeltaEvent", delta: { type: "textDelta", text: out.text ?? "" } });
      yield new ModelContentBlockStopEvent({ type: "modelContentBlockStopEvent" });
      yield new ModelMessageStopEvent({ type: "modelMessageStopEvent", stopReason: "endTurn" });
    } else {
      const out = await chatJson<{ calls?: { tool: string; args: unknown }[] }>({
        system,
        user: "",
        history,
        schema: LocalGrammarModel.callsSchema(specs, this.config.maxCalls ?? 3),
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        signal: options.cancelSignal,
        onProgress: (n) => (outputTokens = n),
      });
      const valid = new Set(specs.map((s) => s.name));
      const calls = (out.calls ?? []).filter((c) => c && valid.has(c.tool));
      for (const c of calls) {
        yield new ModelContentBlockStartEvent({ type: "modelContentBlockStartEvent", start: { type: "toolUseStart", name: c.tool, toolUseId: `tooluse_${nanoid(10)}` } });
        yield new ModelContentBlockDeltaEvent({ type: "modelContentBlockDeltaEvent", delta: { type: "toolUseInputDelta", input: JSON.stringify(c.args ?? {}) } });
        yield new ModelContentBlockStopEvent({ type: "modelContentBlockStopEvent" });
      }
      yield new ModelMessageStopEvent({ type: "modelMessageStopEvent", stopReason: calls.length ? "toolUse" : "endTurn" });
    }
    yield new ModelMetadataEvent({
      type: "modelMetadataEvent",
      usage: { inputTokens: 0, outputTokens, totalTokens: outputTokens },
      metrics: { latencyMs: Date.now() - started },
    });
  }
}
