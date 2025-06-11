ALTER TABLE "votes_available" DROP CONSTRAINT "votes_available_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "withdrawn_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "epoch_created" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "token_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "staked_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "can_unstake_after" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "unstaked_at" timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "can_withdraw_after" timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "relocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "address" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "block_number" bigint;--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "transaction_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "log_index" integer;--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "withdrawal_at";--> statement-breakpoint
ALTER TABLE "votes_available" DROP COLUMN "user_id";--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'votes_available_pkey'
          AND table_name = 'votes_available'
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
ALTER TABLE votes_available DROP CONSTRAINT votes_available_pkey;
END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "votes_available" ADD CONSTRAINT "votes_available_pkey" PRIMARY KEY("address","epoch");
