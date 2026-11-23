CREATE TYPE "public"."plan_source" AS ENUM('llm', 'user_edit', 'assets');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('queued', 'planning', 'validating', 'assets', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"plan" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"source" "plan_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_project_version_unique" UNIQUE("project_id","version")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text,
	"prompt" text NOT NULL,
	"status" "project_status" DEFAULT 'queued' NOT NULL,
	"current_plan_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_current_plan_id_plans_id_fk" FOREIGN KEY ("current_plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");