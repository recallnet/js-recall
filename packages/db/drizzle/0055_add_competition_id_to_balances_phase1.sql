-- Phase 1: Add nullable competition_id column with indexes and foreign key
-- This phase is zero-downtime and backwards compatible

-- Add the column as nullable
ALTER TABLE "trading_comps"."balances"
  ADD COLUMN "competition_id" uuid;--> statement-breakpoint

-- Add index on competition_id for query performance
CREATE INDEX "idx_balances_competition_id"
  ON "trading_comps"."balances" USING btree ("competition_id");--> statement-breakpoint

-- Add compound index on (agent_id, competition_id) for common queries
CREATE INDEX "idx_balances_agent_competition"
  ON "trading_comps"."balances" USING btree ("agent_id", "competition_id");--> statement-breakpoint

-- Add foreign key constraint with CASCADE delete
ALTER TABLE "trading_comps"."balances"
  ADD CONSTRAINT "balances_competition_id_fkey"
  FOREIGN KEY ("competition_id")
  REFERENCES "public"."competitions"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;--> statement-breakpoint

-- Note: Old code still works because column is nullable