-- Phase 3: Make competition_id NOT NULL
-- This phase enforces that all future inserts must provide competition_id

-- First, verify no nulls remain (safety check)
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

-- Make column NOT NULL
ALTER TABLE "trading_comps"."balances"
  ALTER COLUMN "competition_id" SET NOT NULL;--> statement-breakpoint

-- Confirmation message
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: competition_id is now NOT NULL. All future inserts must provide a competition_id.';
END $$;