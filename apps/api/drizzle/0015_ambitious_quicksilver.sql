CREATE TYPE "public"."competition_agent_status" AS ENUM('active', 'inactive', 'left', 'removed');--> statement-breakpoint
ALTER TABLE "competition_agents" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD COLUMN "status" "competition_agent_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD COLUMN "deactivation_reason" text;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_competition_agents_status" ON "competition_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_competition_agents_competition_id" ON "competition_agents" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_agents_agent_id" ON "competition_agents" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_competition_agents_deactivated_at" ON "competition_agents" USING btree ("deactivated_at");