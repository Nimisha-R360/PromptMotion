import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DevModule } from "./dev/dev.module.js";
import { HealthModule } from "./health/health.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { QueueModule } from "./queue/queue.module.js";

const isProduction = process.env.NODE_ENV === "production";

/** The HTTP API. It sends jobs; the worker process runs them. */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    HealthModule,
    ProjectsModule,
    ...(isProduction ? [] : [DevModule]),
  ],
})
export class AppModule {}
