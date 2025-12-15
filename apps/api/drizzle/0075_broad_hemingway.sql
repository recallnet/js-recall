DROP INDEX "idx_rewards_address";--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "wallet_address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" DROP COLUMN "address";