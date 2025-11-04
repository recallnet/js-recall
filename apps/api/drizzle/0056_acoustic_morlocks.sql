CREATE TYPE "public"."allocation_unit" AS ENUM('RECALL', 'USDC', 'USD');--> statement-breakpoint
CREATE TYPE "public"."display_state" AS ENUM('active', 'waitlist', 'cancelled', 'pending', 'paused');--> statement-breakpoint
CREATE TYPE "public"."engine_type" AS ENUM('spot_paper_trading', 'perpetual_futures', 'spot_live_trading');--> statement-breakpoint
CREATE TABLE "arenas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"classification" jsonb NOT NULL,
	"kind" text DEFAULT 'Competition' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arenas_id_key" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "competition_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"details" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_partners_competition_id_position" UNIQUE("competition_id","position")
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "arena_id" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "vips" text[];--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "allowlist" text[];--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "blocklist" text[];--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "min_recall_rank" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "allowlist_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "agent_allocation" numeric(30, 15);--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "agent_allocation_unit" "allocation_unit";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "booster_allocation" numeric(30, 15);--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "booster_allocation_unit" "allocation_unit";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "reward_rules" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "reward_details" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_id" "engine_type";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_version" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "display_state" "display_state";--> statement-breakpoint
ALTER TABLE "competition_partners" ADD CONSTRAINT "competition_partners_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_arenas_id" ON "arenas" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_competition_partners_competition_id" ON "competition_partners" USING btree ("competition_id");--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "public"."arenas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competitions_arena_id" ON "competitions" USING btree ("arena_id");--> statement-breakpoint
CREATE INDEX "idx_competitions_engine_id" ON "competitions" USING btree ("engine_id");