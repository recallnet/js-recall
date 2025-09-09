-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP INDEX "idx_votes_user_competition";--> statement-breakpoint
DROP INDEX "trading_comps"."idx_trades_agent_id";--> statement-breakpoint
-- Create GIN index with custom name to avoid Drizzle sync issues
CREATE INDEX IF NOT EXISTS "agents_name_trgm_idx" ON "agents" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_competition_agents_competition_status" ON "competition_agents" USING btree ("competition_id","status");--> statement-breakpoint
CREATE INDEX "idx_competitions_status_type_id" ON "competitions" USING btree ("status","type","id");--> statement-breakpoint
CREATE INDEX "idx_competitions_status_end_date" ON "competitions" USING btree ("status","end_date");--> statement-breakpoint
CREATE INDEX "idx_competitions_leaderboard_competition_rank" ON "competitions_leaderboard" USING btree ("competition_id","rank");--> statement-breakpoint
CREATE INDEX "idx_votes_user_created" ON "votes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_votes_user_competition_created" ON "votes" USING btree ("user_id","competition_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_trades_competition_agent_timestamp" ON "trading_comps"."trades" USING btree ("competition_id","agent_id","timestamp" DESC);
