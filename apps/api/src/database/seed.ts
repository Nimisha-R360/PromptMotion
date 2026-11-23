// Inserts the sample project so everyone can test without the LLM.
// Run with `pnpm db:seed`. Safe to run more than once.
import { samplePlan } from "@promptmotion/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadEnv } from "../config/env.js";
import { plans, projects } from "./schema.js";

/** Fixed id, so docs and tests can refer to the sample project. */
export const SAMPLE_PROJECT_ID = "00000000-0000-4000-8000-000000000001";

const env = loadEnv();
const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool);

try {
  await db.transaction(async (tx) => {
    await tx
      .insert(projects)
      .values({
        id: SAMPLE_PROJECT_ID,
        title: samplePlan.title,
        prompt: "A short explainer on why the sky is blue, for curious kids",
        status: "ready",
      })
      .onConflictDoNothing();

    // Stands in for a plan the LLM would have written.
    const [plan] = await tx
      .insert(plans)
      .values({ projectId: SAMPLE_PROJECT_ID, version: 1, plan: samplePlan, source: "llm" })
      .onConflictDoNothing()
      .returning({ id: plans.id });

    if (plan) {
      await tx
        .update(projects)
        .set({ currentPlanId: plan.id })
        .where(eq(projects.id, SAMPLE_PROJECT_ID));
    }
  });
  console.log(`Seeded sample project ${SAMPLE_PROJECT_ID}`);
} finally {
  await pool.end();
}
