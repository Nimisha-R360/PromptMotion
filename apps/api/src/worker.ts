import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module.js";

// Loads the modules but opens no HTTP port. Job handlers start in onApplicationBootstrap.
const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
new Logger("Worker").log("Worker started");
