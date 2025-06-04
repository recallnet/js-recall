ALTER TABLE "votes_available" ADD COLUMN "block_number" bigint;--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "transaction_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "log_index" integer;