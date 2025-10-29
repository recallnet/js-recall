-- Phase 2: Backfill competition_id for existing balances
-- Strategy: Agent-based backfill - assigns balances to agent's most recent active competition

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

-- Verification query
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE "competition_id" IS NULL) = 0
    THEN 'PASS: All balances have competition_id'
    ELSE 'FAIL: ' || COUNT(*) FILTER (WHERE "competition_id" IS NULL) || ' balances still have NULL competition_id'
  END as validation_result
FROM "trading_comps"."balances";