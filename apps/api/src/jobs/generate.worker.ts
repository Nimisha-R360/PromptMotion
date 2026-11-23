import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { logJson } from "../common/pipeline-log.js";
import { type Database, InjectDatabase } from "../database/database.module.js";
import { generations, plans, projects } from "../database/schema.js";
import { GenerateJobSchema, QUEUES } from "../queue/queues.js";
import { LlmService, PlanGenerationError } from "../services/llm/llm.service.js";

/** Handles `generate` jobs: prompt → plan (Claude) → saved in the database. */
@Injectable()
export class GenerateWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(GenerateWorker.name);

  constructor(
    private readonly boss: PgBoss,
    private readonly llm: LlmService,
    @InjectDatabase() private readonly db: Database,
  ) {}

  async onApplicationBootstrap() {
    await this.boss.work(QUEUES.generate, { pollingIntervalSeconds: 1 }, async ([job]) => {
      if (!job) return;
      const { projectId } = GenerateJobSchema.parse(job.data);
      await this.generate(job.id, projectId);
    });
    this.logger.log(`Listening on queue "${QUEUES.generate}"`);
  }

  private async generate(jobId: string, projectId: string) {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      this.logger.warn(`Project ${projectId} no longer exists; skipping job ${jobId}`);
      return;
    }

    await this.db.update(projects).set({ status: "planning" }).where(eq(projects.id, projectId));
    logJson(this.logger, "④ WORKER picked up job → status: planning", {
      jobId,
      projectId,
      prompt: project.prompt,
    });

    try {
      const { plan, generationId } = await this.llm.generatePlan(project.prompt, { projectId });
      logJson(this.logger, "⑤ PLANNER returned a valid plan (this JSON goes to the DB)", plan);

      const planRow = await this.db.transaction(async (tx) => {
        // A new project's first plan is version 1. Edits will add versions later.
        const [row] = await tx
          .insert(plans)
          .values({ projectId, version: 1, plan, source: "llm" })
          .returning();
        await tx
          .update(projects)
          .set({ status: "ready", title: plan.title, currentPlanId: row!.id, error: null })
          .where(eq(projects.id, projectId));
        await tx
          .update(generations)
          .set({ planId: row!.id })
          .where(eq(generations.id, generationId));
        return row!;
      });

      logJson(this.logger, "⑥ DB INSERT plans → (and projects.status = ready)", planRow);
    } catch (error) {
      const message =
        error instanceof PlanGenerationError
          ? error.message
          : "Something went wrong while planning.";
      await this.db
        .update(projects)
        .set({ status: "failed", error: message })
        .where(eq(projects.id, projectId));
      this.logger.error(`Project ${projectId} failed: ${message}`);
      if (!(error instanceof PlanGenerationError)) this.logger.error(error);
    }
  }
}
