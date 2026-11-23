import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service.js";

/** Turns prompts into video plans with Claude. Needs the database and config modules. */
@Module({ providers: [LlmService], exports: [LlmService] })
export class LlmModule {}
