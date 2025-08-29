CREATE TABLE "indexing_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"raw_event_data" jsonb NOT NULL,
	"type" varchar(50) NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" "bytea" NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" "bytea" NOT NULL,
	"log_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stake_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"stake_id" bigint NOT NULL,
	"wallet" "bytea" NOT NULL,
	"delta_amount" bigint NOT NULL,
	"kind" varchar(24) NOT NULL,
	"tx_hash" "bytea" NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boost_balances" (
	"wallet" "bytea" PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boost_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" "bytea" NOT NULL,
	"delta_amount" bigint NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idem_key" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vote_assignments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "votes_available" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "votes_performed" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "vote_assignments" CASCADE;--> statement-breakpoint
DROP TABLE "votes_available" CASCADE;--> statement-breakpoint
DROP TABLE "votes_performed" CASCADE;--> statement-breakpoint
ALTER TABLE "stakes" DROP CONSTRAINT "stakes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "stakes" DROP CONSTRAINT "stakes_epoch_created_epochs_id_fk";
--> statement-breakpoint
DROP INDEX "idx_stakes_address";--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "id" bigint PRIMARY KEY;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stakes" ADD COLUMN "wallet" "bytea" NOT NULL;--> statement-breakpoint
ALTER TABLE "stake_changes" ADD CONSTRAINT "stake_changes_stake_id_stakes_id_fk" FOREIGN KEY ("stake_id") REFERENCES "public"."stakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_txhash_logindex_uq" ON "indexing_events" USING btree ("transaction_hash","log_index");--> statement-breakpoint
CREATE INDEX "events_blocknum_logindex_idx" ON "indexing_events" USING btree ("block_number","log_index");--> statement-breakpoint
CREATE INDEX "events_blocktime_logindex_idx" ON "indexing_events" USING btree ("block_timestamp","log_index");--> statement-breakpoint
CREATE INDEX "events_type_blocknum_idx" ON "indexing_events" USING btree ("type","block_number" DESC);--> statement-breakpoint
CREATE INDEX "events_block_number_idx" ON "indexing_events" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "events_block_hash_idx" ON "indexing_events" USING btree ("block_hash");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "indexing_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stake_changes_event_uq" ON "stake_changes" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "stake_changes_stake_idx" ON "stake_changes" USING btree ("stake_id");--> statement-breakpoint
CREATE INDEX "stake_changes_wallet_idx" ON "stake_changes" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "stake_changes_wallet_created_idx" ON "stake_changes" USING btree ("wallet","created_at" DESC);--> statement-breakpoint
CREATE INDEX "stake_changes_block_idx" ON "stake_changes" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "stake_changes_tx_hash_idx" ON "stake_changes" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "boost_balances_updated_at_idx" ON "boost_balances" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "boost_balances_created_at_idx" ON "boost_balances" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "boost_changes_wallet_idem_uq" ON "boost_changes" USING btree ("wallet","idem_key");--> statement-breakpoint
CREATE INDEX "boost_changes_wallet_created_idx" ON "boost_changes" USING btree ("wallet","created_at" DESC);--> statement-breakpoint
CREATE INDEX "boost_changes_wallet_idx" ON "boost_changes" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "boost_changes_created_at_idx" ON "boost_changes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stakes_wallet_idx" ON "stakes" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "stakes_status_idx" ON "stakes" USING btree ("unstaked_at","withdrawn_at");--> statement-breakpoint
CREATE INDEX "stakes_created_at_idx" ON "stakes" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "token_id";--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "epoch_created";
