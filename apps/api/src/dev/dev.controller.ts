import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { PgBoss } from "pg-boss";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { type PingJob, PingJobSchema, QUEUES } from "../queue/queues.js";

/** Development-only routes for checking the job queue. Not loaded in production. */
@Controller("dev")
export class DevController {
  constructor(private readonly boss: PgBoss) {}

  /** Queue a `ping` job. The worker process picks it up. */
  @Post("jobs/ping")
  @HttpCode(202)
  async sendPing(@Body(new ZodValidationPipe(PingJobSchema)) body: PingJob) {
    const jobId = await this.boss.send(QUEUES.ping, body);
    return { jobId };
  }

  /** See whether a `ping` job finished, and what the worker returned. */
  @Get("jobs/ping/:id")
  async getPing(@Param("id", new ParseUUIDPipe()) id: string) {
    const [job] = await this.boss.findJobs(QUEUES.ping, { id });
    if (!job) throw new NotFoundException(`No ping job ${id}`);
    return { id: job.id, state: job.state, output: job.output ?? null };
  }
}
