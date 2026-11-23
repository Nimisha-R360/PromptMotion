import type { VideoPlan } from "@promptmotion/shared";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const projectStatus = pgEnum("project_status", [
  "queued",
  "planning",
  "validating",
  "assets",
  "ready",
  "failed",
]);

export const planSource = pgEnum("plan_source", ["llm", "user_edit", "assets"]);

/** One row per video. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nullable until auth exists. */
    userId: uuid("user_id"),
    title: text("title"),
    prompt: text("prompt").notNull(),
    status: projectStatus("status").notNull().default("queued"),
    currentPlanId: uuid("current_plan_id").references((): AnyPgColumn => plans.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)],
);

/** Every version of a project's plan. Rows are never changed: an edit adds a new version. */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    plan: jsonb("plan").$type<VideoPlan>().notNull(),
    /** Lets old plans be upgraded when VideoPlanSchema changes. */
    schemaVersion: integer("schema_version").notNull().default(1),
    source: planSource("source").notNull(),
    /** The viewer's feedback this version answers. Null for a project's first plan. */
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("plans_project_version_unique").on(table.projectId, table.version)],
);

export const generationStatus = pgEnum("generation_status", ["succeeded", "failed"]);

/** plan: a first plan from a prompt. revise: a new version from the viewer's feedback. */
export const generationKind = pgEnum("generation_kind", ["plan", "revise"]);

/** One row per LLM planning run: what it cost, how long it took, and what came back. */
export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for runs started outside a project, e.g. `pnpm plan`. */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    /** The plan this run produced, if it succeeded and was saved. */
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    kind: generationKind("kind").notNull().default("plan"),
    /** What the viewer typed for this run: the prompt (plan) or the feedback (revise). */
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    status: generationStatus("status").notNull(),
    /** API calls made in the loop (1 = the first plan was valid). */
    turns: integer("turns").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
    cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
    /** Estimate from list prices; null if the model isn't in the price table. */
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    latencyMs: integer("latency_ms").notNull(),
    stopReason: text("stop_reason"),
    error: text("error"),
    /** The last plan Claude submitted (valid or not), for debugging. */
    rawOutput: jsonb("raw_output"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("generations_project_id_idx").on(table.projectId)],
);
