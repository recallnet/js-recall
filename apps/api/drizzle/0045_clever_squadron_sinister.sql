ALTER TABLE "agent_score" DROP CONSTRAINT "unique_agent_score_agent_id";--> statement-breakpoint
ALTER TABLE "agent_score" ADD COLUMN "type" "competition_type" DEFAULT 'trading' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_score_history" ADD COLUMN "type" "competition_type" DEFAULT 'trading' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_agent_score_type" ON "agent_score" USING btree ("type");--> statement-breakpoint
ALTER TABLE "agent_score" ADD CONSTRAINT "unique_agent_score_agent_id_type" UNIQUE("agent_id","type");