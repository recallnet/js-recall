-- Remove block_hash and source columns from conviction_claims table
-- block_hash is redundant since we have the transaction hash which is globally unique
-- source is no longer needed since we only store data from transaction processing

ALTER TABLE "conviction_claims" DROP COLUMN IF EXISTS "block_hash";
ALTER TABLE "conviction_claims" DROP COLUMN IF EXISTS "source";
