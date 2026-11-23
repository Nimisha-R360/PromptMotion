import Anthropic from "@anthropic-ai/sdk";
import { samplePlan, type VideoPlan } from "@promptmotion/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.js";
import { type Database, InjectDatabase } from "../../database/database.module.js";
import { generations } from "../../database/schema.js";
import { PLAN_MODEL } from "./plan-model.js";
import { PlanAgent, type PlanRunResult } from "./plan-agent.js";
import type { PlanRequest } from "./plan-prompt.js";

type PlanResult = { plan: VideoPlan; generationId: string; run: PlanRunResult };

export class PlanGenerationError extends Error {
  constructor(
    message: string,
    readonly generationId: string,
  ) {
    super(message);
    this.name = "PlanGenerationError";
  }
}

/** Plain-language message for SDK errors. Most specific first. */
const describeApiError = (error: unknown): string => {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Claude rejected the credentials. Set ANTHROPIC_API_KEY in the repo-root .env.";
  }
  if (error instanceof Anthropic.RateLimitError)
    return "Claude rate limit reached. Try again shortly.";
  if (error instanceof Anthropic.BadRequestError)
    return `Claude rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach the Claude API.";
  if (error instanceof Anthropic.APIError)
    return `Claude API error ${error.status}: ${error.message}`;
  if (error instanceof Anthropic.AnthropicError) return error.message;
  return error instanceof Error ? error.message : String(error);
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client?: Anthropic;

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectDatabase() private readonly db: Database,
  ) {}

  /** Created on first use, so the API can start without Claude credentials. */
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get("ANTHROPIC_API_KEY", { infer: true });
      // An empty ANTHROPIC_API_KEY in .env would shadow other credentials (e.g. `ant auth login`).
      if (!apiKey) delete process.env.ANTHROPIC_API_KEY;
      this.client = new Anthropic(apiKey ? { apiKey } : {});
    }
    return this.client;
  }

  /**
   * MOCK_LLM=true: pretend Claude answered. No API call, no cost.
   * A new plan is samplePlan. A revision writes the feedback into the title scene's subheading,
   * so you can see the change in the preview.
   */
  private async mockRun(request: PlanRequest, startedAt: number): Promise<PlanRunResult> {
    this.logger.warn("MOCK_LLM is on: not calling Claude.");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let plan: VideoPlan = samplePlan;
    if ("feedback" in request) {
      plan = structuredClone(request.currentPlan);
      const note = `Revised: ${request.feedback}`.slice(0, 80);
      const titleScene = plan.scenes.find((scene) => scene.type === "title");
      if (titleScene?.type === "title") titleScene.subheading = note;
      else plan.title = `${plan.title} (revised)`;
    }

    return {
      ok: true,
      plan,
      stats: {
        model: "mock",
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
        stopReason: null,
        rawOutput: plan,
      },
    };
  }

  /**
   * Turn a prompt into a valid plan. Every run, success or failure, is saved in `generations`.
   * Throws PlanGenerationError on failure.
   */
  generatePlan(prompt: string, options: { projectId?: string } = {}): Promise<PlanResult> {
    return this.runAndRecord({ prompt }, options);
  }

  /**
   * Apply the viewer's feedback to an existing plan. Same checks and logging as generatePlan.
   * Throws PlanGenerationError on failure.
   */
  revisePlan(
    prompt: string,
    currentPlan: VideoPlan,
    feedback: string,
    options: { projectId?: string } = {},
  ): Promise<PlanResult> {
    return this.runAndRecord({ prompt, currentPlan, feedback }, options);
  }

  private async runAndRecord(
    request: PlanRequest,
    options: { projectId?: string },
  ): Promise<PlanResult> {
    const isRevision = "feedback" in request;
    let run: PlanRunResult;
    const startedAt = Date.now();
    try {
      run = this.config.get("MOCK_LLM", { infer: true })
        ? await this.mockRun(request, startedAt)
        : await new PlanAgent(this.getClient().beta.messages).run(request);
    } catch (error) {
      const noKey = !this.config.get("ANTHROPIC_API_KEY", { infer: true });
      // The SDK throws a plain Error when it finds no credentials, before any request is sent.
      const isClientSetupError = !(error instanceof Anthropic.APIError);
      run = {
        ok: false,
        error:
          noKey && isClientSetupError
            ? `No Claude credentials found. Set ANTHROPIC_API_KEY in the repo-root .env. (${describeApiError(error)})`
            : describeApiError(error),
        stats: {
          model: PLAN_MODEL,
          turns: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          costUsd: null,
          latencyMs: Date.now() - startedAt,
          stopReason: null,
          rawOutput: null,
        },
      };
    }

    const { stats } = run;
    const [row] = await this.db
      .insert(generations)
      .values({
        projectId: options.projectId,
        kind: isRevision ? "revise" : "plan",
        prompt: isRevision ? request.feedback : request.prompt,
        model: stats.model,
        status: run.ok ? "succeeded" : "failed",
        turns: stats.turns,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        cacheCreationInputTokens: stats.cacheCreationInputTokens,
        cacheReadInputTokens: stats.cacheReadInputTokens,
        costUsd: stats.costUsd === null ? null : stats.costUsd.toFixed(6),
        latencyMs: stats.latencyMs,
        stopReason: stats.stopReason,
        error: run.ok ? null : run.error,
        rawOutput: stats.rawOutput,
      })
      .returning({ id: generations.id });
    const generationId = row!.id;

    if (!run.ok) {
      this.logger.warn(`Generation ${generationId} failed: ${run.error}`);
      throw new PlanGenerationError(run.error, generationId);
    }
    this.logger.log(
      `Generation ${generationId}: ${run.plan.scenes.length} scenes in ${stats.turns} turn(s), ${stats.latencyMs}ms`,
    );
    return { plan: run.plan, generationId, run };
  }
}
