CREATE TABLE "conviction_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"claimed_amount" numeric(78, 0) NOT NULL,
	"season" integer NOT NULL,
	"duration" bigint,
	"block_number" bigint NOT NULL,
	"block_hash" "bytea" NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conviction_claims_account_idx" ON "conviction_claims" USING btree ("account");--> statement-breakpoint
CREATE INDEX "conviction_claims_season_idx" ON "conviction_claims" USING btree ("season");--> statement-breakpoint
CREATE INDEX "conviction_claims_block_number_idx" ON "conviction_claims" USING btree ("block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "conviction_claims_tx_hash_unique" ON "conviction_claims" USING btree ("transaction_hash");