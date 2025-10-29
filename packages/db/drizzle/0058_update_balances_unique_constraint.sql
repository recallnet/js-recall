-- Phase 4: Update unique constraint to include competition_id
-- WARNING: BREAKING CHANGE - Deploy new code immediately after this migration

-- Drop old unique constraint
ALTER TABLE "trading_comps"."balances"
  DROP CONSTRAINT IF EXISTS "balances_agent_id_token_address_key";--> statement-breakpoint

-- Add new unique constraint including competition_id
ALTER TABLE "trading_comps"."balances"
  ADD CONSTRAINT "balances_agent_id_token_address_competition_id_key"
  UNIQUE ("agent_id", "token_address", "competition_id");--> statement-breakpoint

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: Unique constraint updated to (agent_id, token_address, competition_id)';
  RAISE WARNING 'DEPLOY NEW CODE NOW: Old code will fail with unique constraint violations';
END $$;