import { Global, Injectable, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PgBoss } from "pg-boss";
import type { Env } from "../config/env.js";
import { QUEUES } from "./queues.js";

@Injectable()
class BossShutdown implements OnApplicationShutdown {
  constructor(private readonly boss: PgBoss) {}

  async onApplicationShutdown() {
    await this.boss.stop();
  }
}

/** pg-boss: a job queue stored in Postgres. Inject `PgBoss` to send jobs or register workers. */
@Global()
@Module({
  providers: [
    {
      provide: PgBoss,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<Env, true>) => {
        const logger = new Logger("PgBoss");
        const boss = new PgBoss(config.get("DATABASE_URL", { infer: true }));
        boss.on("error", (error) => logger.error(error));
        await boss.start();
        await boss.createQueue(QUEUES.ping);
        // No automatic retries: a retry would pay for another Claude run without anyone asking.
        await boss.createQueue(QUEUES.generate, { retryLimit: 0 });
        await boss.createQueue(QUEUES.revise, { retryLimit: 0 });
        return boss;
      },
    },
    BossShutdown,
  ],
  exports: [PgBoss],
})
export class QueueModule {}
