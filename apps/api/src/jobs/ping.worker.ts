import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PgBoss } from "pg-boss";
import { PingJobSchema, QUEUES } from "../queue/queues.js";

/** Handles test `ping` jobs. The real generate / assets / render workers will look like this. */
@Injectable()
export class PingWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(PingWorker.name);

  constructor(private readonly boss: PgBoss) {}

  async onApplicationBootstrap() {
    await this.boss.work(QUEUES.ping, async ([job]) => {
      if (!job) return;
      const { message } = PingJobSchema.parse(job.data);
      this.logger.log(`ping job ${job.id}: "${message}"`);
      return { pong: message, handledAt: new Date().toISOString() };
    });
    this.logger.log(`Listening on queue "${QUEUES.ping}"`);
  }
}
