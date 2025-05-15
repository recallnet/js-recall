CREATE SCHEMA "trading_comps";
--> statement-breakpoint
CREATE TYPE "trading_comps"."cross_chain_trading_type" AS ENUM('disallowAll', 'disallowXParent', 'allow');--> statement-breakpoint
CREATE TABLE "competition_teams" (
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "competition_teams_pkey" PRIMARY KEY("competition_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teams_email_key" UNIQUE("email"),
	CONSTRAINT "teams_api_key_key" UNIQUE("api_key"),
	CONSTRAINT "teams_wallet_address_key" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric(30, 15) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"specific_chain" varchar(20) NOT NULL,
	CONSTRAINT "balances_team_id_token_address_key" UNIQUE("team_id","token_address")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."portfolio_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"total_value" numeric(30, 15) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."portfolio_token_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_snapshot_id" integer NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric(30, 15) NOT NULL,
	"value_usd" numeric(30, 15) NOT NULL,
	"price" numeric(30, 15) NOT NULL,
	"specific_chain" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(50) NOT NULL,
	"price" numeric(30, 15) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"chain" varchar(10),
	"specific_chain" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."trades" (
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
	"timestamp" timestamp with time zone DEFAULT now(),
	"from_chain" varchar(10),
	"to_chain" varchar(10),
	"from_specific_chain" varchar(20),
	"to_specific_chain" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."trading_competitions" (
	"competitionId" uuid PRIMARY KEY NOT NULL,
	"cross_chain_trading_type" "trading_comps"."cross_chain_trading_type" DEFAULT 'disallowAll' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" ADD CONSTRAINT "balances_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_token_values" ADD CONSTRAINT "portfolio_token_values_portfolio_snapshot_id_fkey" FOREIGN KEY ("portfolio_snapshot_id") REFERENCES "trading_comps"."portfolio_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD CONSTRAINT "trades_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD CONSTRAINT "trades_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trading_competitions" ADD CONSTRAINT "trading_competitions_competitionId_competitions_id_fk" FOREIGN KEY ("competitionId") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_competitions_status" ON "competitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_teams_active" ON "teams" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_teams_api_key" ON "teams" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_teams_is_admin" ON "teams" USING btree ("is_admin");--> statement-breakpoint
CREATE INDEX "idx_teams_metadata_ref_name" ON "teams" USING btree ((((metadata -> 'ref'::text) ->> 'name'::text)));--> statement-breakpoint
CREATE INDEX "idx_balances_specific_chain" ON "trading_comps"."balances" USING btree ("specific_chain");--> statement-breakpoint
CREATE INDEX "idx_balances_team_id" ON "trading_comps"."balances" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_team_competition" ON "trading_comps"."portfolio_snapshots" USING btree ("team_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_timestamp" ON "trading_comps"."portfolio_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_portfolio_token_values_snapshot_id" ON "trading_comps"."portfolio_token_values" USING btree ("portfolio_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_token_values_specific_chain" ON "trading_comps"."portfolio_token_values" USING btree ("specific_chain");--> statement-breakpoint
CREATE INDEX "idx_prices_chain" ON "trading_comps"."prices" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "idx_prices_specific_chain" ON "trading_comps"."prices" USING btree ("specific_chain");--> statement-breakpoint
CREATE INDEX "idx_prices_timestamp" ON "trading_comps"."prices" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_prices_token" ON "trading_comps"."prices" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_prices_token_chain" ON "trading_comps"."prices" USING btree ("token","chain");--> statement-breakpoint
CREATE INDEX "idx_prices_token_specific_chain" ON "trading_comps"."prices" USING btree ("token","specific_chain");--> statement-breakpoint
CREATE INDEX "idx_prices_token_timestamp" ON "trading_comps"."prices" USING btree ("token","timestamp");--> statement-breakpoint
CREATE INDEX "idx_trades_competition_id" ON "trading_comps"."trades" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_trades_from_chain" ON "trading_comps"."trades" USING btree ("from_chain");--> statement-breakpoint
CREATE INDEX "idx_trades_from_specific_chain" ON "trading_comps"."trades" USING btree ("from_specific_chain");--> statement-breakpoint
CREATE INDEX "idx_trades_team_id" ON "trading_comps"."trades" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_trades_timestamp" ON "trading_comps"."trades" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_trades_to_chain" ON "trading_comps"."trades" USING btree ("to_chain");--> statement-breakpoint
CREATE INDEX "idx_trades_to_specific_chain" ON "trading_comps"."trades" USING btree ("to_specific_chain");--> statement-breakpoint
CREATE INDEX "idx_competitions_cross_chain_trading" ON "trading_comps"."trading_competitions" USING btree ("cross_chain_trading_type");