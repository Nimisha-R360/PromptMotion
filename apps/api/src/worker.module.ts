import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { QueueModule } from "./queue/queue.module.js";

/** The background worker: same code and modules as the API, plus the job handlers, but no HTTP. */
@Module({
  imports: [AppConfigModule, DatabaseModule, QueueModule, JobsModule],
})
export class WorkerModule {}
