ALTER TABLE "conviction_claims" ADD COLUMN "wallet_address" varchar(42);--> statement-breakpoint
ALTER TABLE "stake_changes" ADD COLUMN "wallet_address" varchar(42);--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "wallet_address" varchar(42);--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "wallet_address" varchar(42);--> statement-breakpoint
CREATE INDEX "conviction_claims_wallet_address_idx" ON "conviction_claims" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "stake_changes_wallet_address_idx" ON "stake_changes" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "stakes_wallet_address_idx" ON "stakes" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_rewards_wallet_address" ON "rewards" USING btree ("wallet_address");

UPDATE "conviction_claims" SET "wallet_address" = lower(account);
UPDATE "stake_changes" SET "wallet_address" = '0x' || lower(encode("wallet", 'hex'));
UPDATE "stakes" SET "wallet_address" = '0x' || lower(encode("wallet", 'hex'));
UPDATE "rewards" SET "wallet_address" = lower(address);