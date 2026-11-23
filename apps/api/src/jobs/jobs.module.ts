import { Module } from "@nestjs/common";
import { LlmModule } from "../services/llm/llm.module.js";
import { GenerateWorker } from "./generate.worker.js";
import { PingWorker } from "./ping.worker.js";
import { ReviseWorker } from "./revise.worker.js";

/** Every job handler. Only the worker process imports this module. */
@Module({ imports: [LlmModule], providers: [PingWorker, GenerateWorker, ReviseWorker] })
export class JobsModule {}
