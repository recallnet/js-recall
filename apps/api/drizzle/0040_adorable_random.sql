ALTER TABLE "stake_changes" ALTER COLUMN "delta_amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);