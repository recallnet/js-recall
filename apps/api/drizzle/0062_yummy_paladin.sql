CREATE TABLE "airdrop_allocations" (
	"address" varchar(42) NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"season" integer NOT NULL,
	"proof" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" varchar(255) DEFAULT '',
	"sybil_classification" varchar(20) DEFAULT 'approved' NOT NULL,
	"flagged_at" timestamp with time zone,
	"flagging_reason" text,
	"power_user" boolean DEFAULT false NOT NULL,
	"recall_snapper" boolean DEFAULT false NOT NULL,
	"ai_builder" boolean DEFAULT false NOT NULL,
	"ai_explorer" boolean DEFAULT false NOT NULL,
	"ineligible_reason" text,
	"ineligible_reward" numeric(78, 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airdrop_allocations_address_season_pk" PRIMARY KEY("address","season")
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
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	CONSTRAINT "seasons_number_unique" UNIQUE("number"),
	CONSTRAINT "seasons_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO seasons (number, name, start_date, end_date)
	VALUES (0, 'Genesis', '2025-10-13T00:00:00Z', null)
	ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "airdrop_allocations" ADD CONSTRAINT "airdrop_allocations_season_seasons_number_fk" FOREIGN KEY ("season") REFERENCES "public"."seasons"("number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sybil_classification" ON "airdrop_allocations" USING btree ("sybil_classification");--> statement-breakpoint
CREATE INDEX "idx_season" ON "airdrop_allocations" USING btree ("season");--> statement-breakpoint
CREATE INDEX "idx_amount" ON "airdrop_allocations" USING btree ("amount");--> statement-breakpoint
CREATE INDEX "idx_address_lower" ON "airdrop_allocations" USING btree ("address");--> statement-breakpoint
ALTER TABLE "conviction_claims" ADD CONSTRAINT "conviction_claims_season_seasons_number_fk" FOREIGN KEY ("season") REFERENCES "public"."seasons"("number") ON DELETE restrict ON UPDATE no action;