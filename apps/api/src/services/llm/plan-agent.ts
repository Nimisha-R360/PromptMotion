import type Anthropic from "@anthropic-ai/sdk";
import { type VideoPlan, VideoPlanSchema } from "@promptmotion/shared";
import { MAX_OUTPUT_TOKENS, MAX_TURNS, PLAN_EFFORT, PLAN_MODEL } from "./plan-model.js";
import { NUDGE_MESSAGE, type PlanRequest, SYSTEM_PROMPT, buildUserMessage } from "./plan-prompt.js";
import { checkPlanRules } from "./plan-rules.js";
import { SUBMIT_PLAN_TOOL_NAME, submitPlanTool } from "./plan-tool.js";
import { estimateCostUsd } from "./pricing.js";

/** The one SDK call the agent needs. In the app this is `client.beta.messages`. */
export type MessagesApi = {
  create(
    params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Beta.BetaMessage>;
};

export type PlanRunStats = {
  /** The model that answered last (differs from PLAN_MODEL if a fallback ran). */
  model: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number | null;
  latencyMs: number;
  stopReason: string | null;
  /** The last plan Claude submitted, valid or not. */
  rawOutput: unknown;
};

export type PlanRunResult =
  | { ok: true; plan: VideoPlan; stats: PlanRunStats }
  | { ok: false; error: string; stats: PlanRunStats };

/** Zod problems plus our extra rules, as plain sentences for Claude. */
const findProblems = (input: unknown): { plan?: VideoPlan; problems: string[] } => {
  const parsed = VideoPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(plan)"}: ${issue.message}`,
      ),
    };
  }
  const problems = checkPlanRules(parsed.data);
  return problems.length ? { problems } : { plan: parsed.data, problems: [] };
};

/**
 * Turns a prompt into a valid VideoPlan.
 *
 * Claude gets one tool, submit_plan. Each submission is checked with VideoPlanSchema and
 * checkPlanRules. If it fails, the problems go back as an error tool result and Claude
 * tries again, up to MAX_TURNS API calls. The loop stops as soon as a plan is valid.
 */
export class PlanAgent {
  constructor(private readonly messagesApi: MessagesApi) {}

  async run(request: PlanRequest): Promise<PlanRunResult> {
    const startedAt = Date.now();
    const stats: PlanRunStats = {
      model: PLAN_MODEL,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      stopReason: null,
      rawOutput: null,
    };
    const finish = (result: { ok: true; plan: VideoPlan } | { ok: false; error: string }) => {
      stats.latencyMs = Date.now() - startedAt;
      return { ...result, stats } as PlanRunResult;
    };

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: buildUserMessage(request) },
    ];

    while (stats.turns < MAX_TURNS) {
      stats.turns += 1;

      const response = await this.messagesApi.create({
        model: PLAN_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        output_config: { effort: PLAN_EFFORT },
        // If Claude declines on a safety classifier, the API retries on a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Tools and system prompt never change, so they're cached across requests.
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [submitPlanTool],
        // Opus 5.5 can't be forced to call a tool; the prompt asks for it and we check below.
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        messages,
      });

      stats.model = response.model;
      stats.stopReason = response.stop_reason;
      stats.inputTokens += response.usage.input_tokens;
      stats.outputTokens += response.usage.output_tokens;
      stats.cacheCreationInputTokens += response.usage.cache_creation_input_tokens ?? 0;
      stats.cacheReadInputTokens += response.usage.cache_read_input_tokens ?? 0;
      const cost = estimateCostUsd(response.model, response.usage);
      stats.costUsd = stats.costUsd === null || cost === null ? null : stats.costUsd + cost;

      if (response.stop_reason === "refusal") {
        return finish({ ok: false, error: "Claude declined to plan this video." });
      }
      if (response.stop_reason === "max_tokens") {
        return finish({ ok: false, error: "The response was cut off before the plan finished." });
      }

      // Keep the full content (including thinking blocks) so the conversation stays valid.
      messages.push({ role: "assistant", content: response.content });

      const call = response.content.find(
        (block): block is Anthropic.Beta.BetaToolUseBlock =>
          block.type === "tool_use" && block.name === SUBMIT_PLAN_TOOL_NAME,
      );
      if (!call) {
        messages.push({ role: "user", content: NUDGE_MESSAGE });
        continue;
      }

      stats.rawOutput = call.input;
      const { plan, problems } = findProblems(call.input);
      if (plan) return finish({ ok: true, plan });

      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: call.id,
            is_error: true,
            content: `The plan was rejected. Fix these problems and call submit_plan again:\n- ${problems.join("\n- ")}`,
          },
        ],
      });
    }

    return finish({ ok: false, error: `No valid plan after ${MAX_TURNS} attempts.` });
  }
}
