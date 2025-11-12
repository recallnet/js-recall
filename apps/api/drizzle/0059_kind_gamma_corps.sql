CREATE TABLE "airdrop_claims" (
	"address" varchar(42) PRIMARY KEY NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"season" integer NOT NULL,
	"proof" text NOT NULL,
	"category" varchar(255) DEFAULT '',
	"sybil_classification" varchar(20) DEFAULT 'approved' NOT NULL,
	"flagged_at" timestamp with time zone,
	"flagging_reason" text,
	"power_user" boolean DEFAULT false NOT NULL,
	"recall_snapper" boolean DEFAULT false NOT NULL,
	"ai_builder" boolean DEFAULT false NOT NULL,
	"ai_explorer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_status" (
	"address" varchar(42) PRIMARY KEY NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone,
	"transaction_hash" varchar(66),
	"staking_duration" integer,
	"staked_amount" varchar(78),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merkle_metadata" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"merkle_root" varchar(66) NOT NULL,
	"total_amount" varchar(78) NOT NULL,
	"total_rows" integer NOT NULL,
	"unique_addresses" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_sybil_classification" ON "airdrop_claims" USING btree ("sybil_classification");--> statement-breakpoint
CREATE INDEX "idx_season" ON "airdrop_claims" USING btree ("season");--> statement-breakpoint
CREATE INDEX "idx_amount" ON "airdrop_claims" USING btree ("amount");--> statement-breakpoint
CREATE INDEX "idx_address_lower" ON "airdrop_claims" USING btree ("address");--> statement-breakpoint
CREATE INDEX "idx_claimed" ON "claim_status" USING btree ("claimed");--> statement-breakpoint
CREATE INDEX "idx_claimed_at" ON "claim_status" USING btree ("claimed_at");