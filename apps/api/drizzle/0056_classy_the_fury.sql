-- Multi-competition support for balances table
-- WARNING: BREAKING CHANGE - This migration requires coordinated deployment
--
-- DEPLOYMENT PLAN:
-- 1. Run this migration (it's backwards compatible during transition)
-- 2. Deploy new code immediately after migration completes
-- 3. Old code will fail after step 1 - minimize downtime window
--
-- This migration:
-- - Adds competition_id column (nullable first)
-- - Backfills competition_id from existing agent data
-- - Makes competition_id NOT NULL
-- - Updates unique constraint to include competition_id

--> statement-breakpoint

-- Phase 1: Add nullable competition_id column with indexes and foreign key
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

-- Phase 2: Backfill competition_id for existing balances
DO $$
DECLARE
  affected_rows INTEGER;
  null_count INTEGER;
BEGIN
  -- Backfill: For each agent, assign their balances to their most recent active competition
  UPDATE "trading_comps"."balances" b
  SET "competition_id" = (
    SELECT ca."competition_id"
    FROM "public"."competition_agents" ca
    WHERE ca."agent_id" = b."agent_id"
    AND ca."status" = 'active'
    ORDER BY ca."created_at" DESC
    LIMIT 1
  )
  WHERE b."competition_id" IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'Backfilled % balance rows with competition_id', affected_rows;

  -- Check if any nulls remain (orphaned balances)
  SELECT COUNT(*) INTO null_count
  FROM "trading_comps"."balances"
  WHERE "competition_id" IS NULL;

  IF null_count > 0 THEN
    RAISE WARNING 'WARNING: % balances still have NULL competition_id. These are orphaned balances for agents not in any active competition.', null_count;
    RAISE WARNING 'Options: 1) Manually assign to a competition, 2) Delete them, 3) Create a "legacy" competition';
  ELSE
    RAISE NOTICE 'SUCCESS: All balances have been assigned a competition_id';
  END IF;
END $$;--> statement-breakpoint

-- Phase 3: Make competition_id NOT NULL
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM "trading_comps"."balances"
  WHERE "competition_id" IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot make competition_id NOT NULL: % rows still have NULL values. Run Phase 2 backfill first.', null_count;
  END IF;

  RAISE NOTICE 'Verification passed: No NULL values found. Proceeding with NOT NULL constraint.';
END $$;--> statement-breakpoint

ALTER TABLE "trading_comps"."balances"
  ALTER COLUMN "competition_id" SET NOT NULL;--> statement-breakpoint

-- Phase 4: Update unique constraint to include competition_id
ALTER TABLE "trading_comps"."balances"
  DROP CONSTRAINT IF EXISTS "balances_agent_id_token_address_key";--> statement-breakpoint

ALTER TABLE "trading_comps"."balances"
  ADD CONSTRAINT "balances_agent_id_token_address_competition_id_key"
  UNIQUE ("agent_id", "token_address", "competition_id");--> statement-breakpoint

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: Multi-competition migration complete';
  RAISE WARNING 'DEPLOY NEW CODE NOW: Old code will fail with unique constraint violations';
END $$;
