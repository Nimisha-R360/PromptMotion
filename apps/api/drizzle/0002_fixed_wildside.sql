CREATE TYPE "public"."generation_kind" AS ENUM('plan', 'revise');--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "kind" "generation_kind" DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "feedback" text;