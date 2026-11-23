import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { and, eq, max } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { logJson } from "../common/pipeline-log.js";
import { type Database, InjectDatabase } from "../database/database.module.js";
import { generations, plans, projects } from "../database/schema.js";
import { QUEUES, type ReviseJob, ReviseJobSchema } from "../queue/queues.js";
import { LlmService, PlanGenerationError } from "../services/llm/llm.service.js";

/**
 * Handles `revise` jobs: current plan + viewer feedback → a new plan version.
 * If it fails, the previous version stays current and the project goes back to `ready`.
 */
@Injectable()
export class ReviseWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReviseWorker.name);

  constructor(
    private readonly boss: PgBoss,
    private readonly llm: LlmService,
    @InjectDatabase() private readonly db: Database,
  ) {}

  async onApplicationBootstrap() {
    await this.boss.work(QUEUES.revise, { pollingIntervalSeconds: 1 }, async ([job]) => {
      if (!job) return;
      await this.revise(job.id, ReviseJobSchema.parse(job.data));
    });
    this.logger.log(`Listening on queue "${QUEUES.revise}"`);
  }

  private async revise(jobId: string, { projectId, basePlanId, feedback }: ReviseJob) {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      this.logger.warn(`Project ${projectId} no longer exists; skipping job ${jobId}`);
      return;
    }
    const [basePlan] = await this.db
      .select()
      .from(plans)
      .where(and(eq(plans.id, basePlanId), eq(plans.projectId, projectId)));
    if (!basePlan) {
      await this.fail(projectId, "The plan to revise no longer exists.");
      return;
    }

    await this.db.update(projects).set({ status: "planning" }).where(eq(projects.id, projectId));
    logJson(this.logger, "R4 WORKER picked up revise → status: planning", {
      jobId,
      projectId,
      basedOnVersion: basePlan.version,
      feedback,
    });

    try {
      const { plan, generationId } = await this.llm.revisePlan(
        project.prompt,
        basePlan.plan,
        feedback,
        { projectId },
      );
      logJson(this.logger, "R5 PLANNER returned the revised plan", plan);

      const planRow = await this.db.transaction(async (tx) => {
        const [latest] = await tx
          .select({ version: max(plans.version) })
          .from(plans)
          .where(eq(plans.projectId, projectId));
        const [row] = await tx
          .insert(plans)
          .values({
            projectId,
            version: (latest?.version ?? 0) + 1,
            plan,
            source: "llm",
            feedback,
          })
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

      logJson(this.logger, `R6 DB INSERT plans → version ${planRow.version}`, planRow);
    } catch (error) {
      const message =
        error instanceof PlanGenerationError
          ? error.message
          : "Something went wrong while revising.";
      await this.fail(projectId, message);
      if (!(error instanceof PlanGenerationError)) this.logger.error(error);
    }
  }

  /** Keep the previous version and tell the viewer what went wrong. */
  private async fail(projectId: string, message: string) {
    await this.db
      .update(projects)
      .set({ status: "ready", error: `Couldn't apply your feedback: ${message}` })
      .where(eq(projects.id, projectId));
    this.logger.error(`Revision for project ${projectId} failed: ${message}`);
  }
}
