ALTER TABLE "stakes" ALTER COLUMN "withdrawn_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "epoch_created" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "token_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "staked_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "can_unstake_after" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "unstaked_at" timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "can_withdraw_after" timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "relocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "withdrawal_at";