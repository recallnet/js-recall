-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "playing_with_neon" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" real
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric(30, 15) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"specific_chain" varchar(20),
	CONSTRAINT "balances_team_id_token_address_key" UNIQUE("team_id","token_address")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"from_token" varchar(50) NOT NULL,
	"to_token" varchar(50) NOT NULL,
	"from_amount" numeric(30, 15) NOT NULL,
	"to_amount" numeric(30, 15) NOT NULL,
	"price" numeric(30, 15) NOT NULL,
	"success" boolean NOT NULL,
	"error" text,
	"reason" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"from_chain" varchar(10),
	"to_chain" varchar(10),
	"from_specific_chain" varchar(20),
	"to_specific_chain" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(50) NOT NULL,
	"price" numeric(30, 15) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"chain" varchar(10),
	"specific_chain" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"total_value" numeric(30, 15) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_token_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_snapshot_id" integer NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric(30, 15) NOT NULL,
	"value_usd" numeric(30, 15) NOT NULL,
	"price" numeric(30, 15) NOT NULL,
	"specific_chain" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"contact_person" varchar(100) NOT NULL,
	"api_key" varchar(400) NOT NULL,
	"wallet_address" varchar(42),
	"bucket_addresses" text[],
	"metadata" jsonb,
	"is_admin" boolean DEFAULT false,
	"active" boolean DEFAULT false,
	"deactivation_reason" text,
	"deactivation_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "teams_email_key" UNIQUE("email"),
	CONSTRAINT "teams_api_key_key" UNIQUE("api_key"),
	CONSTRAINT "teams_wallet_address_key" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "competition_teams" (
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "competition_teams_pkey" PRIMARY KEY("competition_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_token_values" ADD CONSTRAINT "portfolio_token_values_portfolio_snapshot_id_fkey" FOREIGN KEY ("portfolio_snapshot_id") REFERENCES "public"."portfolio_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_balances_specific_chain" ON "balances" USING btree ("specific_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_balances_team_id" ON "balances" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_competition_id" ON "trades" USING btree ("competition_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_from_chain" ON "trades" USING btree ("from_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_from_specific_chain" ON "trades" USING btree ("from_specific_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_team_id" ON "trades" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_timestamp" ON "trades" USING btree ("timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_to_chain" ON "trades" USING btree ("to_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_trades_to_specific_chain" ON "trades" USING btree ("to_specific_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_chain" ON "prices" USING btree ("chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_specific_chain" ON "prices" USING btree ("specific_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_timestamp" ON "prices" USING btree ("timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_token" ON "prices" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_token_chain" ON "prices" USING btree ("token" text_ops,"chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_token_specific_chain" ON "prices" USING btree ("token" text_ops,"specific_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_prices_token_timestamp" ON "prices" USING btree ("token" timestamptz_ops,"timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_team_competition" ON "portfolio_snapshots" USING btree ("team_id" uuid_ops,"competition_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_timestamp" ON "portfolio_snapshots" USING btree ("timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_portfolio_token_values_snapshot_id" ON "portfolio_token_values" USING btree ("portfolio_snapshot_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_portfolio_token_values_specific_chain" ON "portfolio_token_values" USING btree ("specific_chain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_competitions_status" ON "competitions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_teams_active" ON "teams" USING btree ("active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_teams_api_key" ON "teams" USING btree ("api_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_teams_is_admin" ON "teams" USING btree ("is_admin" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_teams_metadata_ref_name" ON "teams" USING btree ((((metadata -> 'ref'::text) ->> 'name'::text)) text_ops);
*/