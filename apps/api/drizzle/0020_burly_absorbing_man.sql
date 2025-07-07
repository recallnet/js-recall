ALTER TABLE "agent_rank" RENAME TO "agent_score";--> statement-breakpoint
ALTER TABLE "agent_rank_history" RENAME TO "agent_score_history";--> statement-breakpoint
ALTER TABLE "agent_score" DROP CONSTRAINT "unique_agent_rank_agent_id";--> statement-breakpoint
ALTER TABLE "agent_score" DROP CONSTRAINT "agent_rank_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "agent_score_history" DROP CONSTRAINT "agent_rank_history_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "agent_score_history" DROP CONSTRAINT "agent_rank_history_competition_id_fkey";
--> statement-breakpoint
ALTER TABLE "object_index" ALTER COLUMN "data_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."sync_data_type";--> statement-breakpoint
CREATE TYPE "public"."sync_data_type" AS ENUM('trade', 'agent_score_history', 'agent_score', 'competitions_leaderboard', 'portfolio_snapshot');--> statement-breakpoint
ALTER TABLE "object_index" ALTER COLUMN "data_type" SET DATA TYPE "public"."sync_data_type" USING "data_type"::"public"."sync_data_type";--> statement-breakpoint
DROP INDEX "idx_agent_rank_agent_id";--> statement-breakpoint
DROP INDEX "idx_agent_rank_history_agent_id";--> statement-breakpoint
DROP INDEX "idx_agent_rank_history_competition_id";--> statement-breakpoint
DROP INDEX "idx_agent_rank_history_agent_competition";--> statement-breakpoint
ALTER TABLE "agent_score" ADD CONSTRAINT "agent_score_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_score_history" ADD CONSTRAINT "agent_score_history_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_score_history" ADD CONSTRAINT "agent_score_history_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_score_agent_id" ON "agent_score" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_score_history_agent_id" ON "agent_score_history" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_score_history_competition_id" ON "agent_score_history" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_agent_score_history_agent_competition" ON "agent_score_history" USING btree ("agent_id","competition_id");--> statement-breakpoint
ALTER TABLE "agent_score" ADD CONSTRAINT "unique_agent_score_agent_id" UNIQUE("agent_id");