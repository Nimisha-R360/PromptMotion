import type {
  CreateProjectResponse,
  CreateRevisionResponse,
  ProjectResponse,
} from "@promptmotion/shared";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { logJson } from "../common/pipeline-log.js";
import { type Database, InjectDatabase } from "../database/database.module.js";
import { plans, projects } from "../database/schema.js";
import { type GenerateJob, QUEUES, type ReviseJob } from "../queue/queues.js";

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly boss: PgBoss,
  ) {}

  /** Save the prompt as a new project and queue the planning job. Returns right away. */
  async create(prompt: string): Promise<CreateProjectResponse> {
    const [project] = await this.db.insert(projects).values({ prompt }).returning();
    logJson(this.logger, "② DB INSERT projects →", project);

    const job: GenerateJob = { projectId: project!.id };
    const jobId = await this.boss.send(QUEUES.generate, job);
    logJson(this.logger, `③ QUEUE send "${QUEUES.generate}" →`, { jobId, data: job });

    return { projectId: project!.id };
  }

  /** The project and its current plan. The web app polls this until the plan is ready. */
  async get(id: string): Promise<ProjectResponse> {
    const [row] = await this.db
      .select({ project: projects, plan: plans })
      .from(projects)
      .leftJoin(plans, eq(plans.id, projects.currentPlanId))
      .where(eq(projects.id, id));
    if (!row) throw new NotFoundException(`No project ${id}`);

    const { project, plan } = row;
    const response: ProjectResponse = {
      id: project.id,
      title: project.title,
      prompt: project.prompt,
      status: project.status,
      error: project.error,
      plan: plan?.plan ?? null,
      planVersion: plan?.version ?? null,
      planFeedback: plan?.feedback ?? null,
      createdAt: project.createdAt.toISOString(),
    };
    // Polled every second: only log once there's something new to see.
    if (project.status === "ready" || project.status === "failed") {
      logJson(this.logger, `⑦ GET /projects/${id} → (sent to the browser)`, response);
    }
    return response;
  }

  /**
   * Queue a new plan version from the viewer's feedback. Returns right away.
   * One run at a time: the project must be `ready` and have a plan.
   */
  async revise(id: string, feedback: string): Promise<CreateRevisionResponse> {
    const [current] = await this.db
      .select({ planId: plans.id, version: plans.version })
      .from(projects)
      .innerJoin(plans, eq(plans.id, projects.currentPlanId))
      .where(eq(projects.id, id));
    if (!current) {
      const [exists] = await this.db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id));
      throw exists
        ? new ConflictException("This project has no plan to revise yet.")
        : new NotFoundException(`No project ${id}`);
    }

    // Claim the project in one statement, so two quick clicks can't start two revisions.
    const [claimed] = await this.db
      .update(projects)
      .set({ status: "queued", error: null })
      .where(and(eq(projects.id, id), eq(projects.status, "ready")))
      .returning({ id: projects.id });
    if (!claimed) {
      throw new ConflictException("This project is busy. Wait for the current run to finish.");
    }
    logJson(this.logger, "R2 DB UPDATE projects → status: queued", {
      id,
      basedOnVersion: current.version,
    });

    const job: ReviseJob = { projectId: id, basePlanId: current.planId, feedback };
    const jobId = await this.boss.send(QUEUES.revise, job);
    logJson(this.logger, `R3 QUEUE send "${QUEUES.revise}" →`, { jobId, data: job });

    return { projectId: id, basedOnVersion: current.version };
  }
}
