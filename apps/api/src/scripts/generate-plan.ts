// Turn a prompt into a plan from the command line: pnpm plan "a video about volcanoes"
// Prints the plan as JSON, and a summary of the run. Each run is saved in `generations`.
import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppConfigModule } from "../config/config.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { LlmModule } from "../services/llm/llm.module.js";
import { LlmService, PlanGenerationError } from "../services/llm/llm.service.js";

@Module({ imports: [AppConfigModule, DatabaseModule, LlmModule] })
class PlanScriptModule {}

const prompt = process.argv.slice(2).join(" ").trim();
if (!prompt) {
  console.error('Usage: pnpm plan "a 30-second video about volcanoes"');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(PlanScriptModule, {
  logger: ["error", "warn"],
});
try {
  const { plan, generationId, run } = await app.get(LlmService).generatePlan(prompt);
  console.log(JSON.stringify(plan, null, 2));
  const { stats } = run;
  const totalSec = plan.scenes.reduce((total, scene) => total + scene.durationSec, 0);
  console.error(
    [
      "",
      `Generation ${generationId}`,
      `  ${plan.scenes.length} scenes, ${totalSec.toFixed(1)}s total`,
      `  ${stats.turns} turn(s), ${(stats.latencyMs / 1000).toFixed(1)}s, model ${stats.model}`,
      `  tokens: ${stats.inputTokens} in, ${stats.outputTokens} out, ${stats.cacheReadInputTokens} cache read, ${stats.cacheCreationInputTokens} cache write`,
      `  estimated cost: ${stats.costUsd === null ? "unknown" : `$${stats.costUsd.toFixed(4)}`}`,
    ].join("\n"),
  );
} catch (error) {
  if (error instanceof PlanGenerationError) {
    console.error(`Failed (generation ${error.generationId}): ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  await app.close();
}
