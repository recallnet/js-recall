CREATE SCHEMA "trading_comps";
--> statement-breakpoint
CREATE TYPE "trading_comps"."cross_chain_trading_type" AS ENUM('disallowAll', 'disallowXParent', 'allow');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"api_key" varchar(400),
	"name" varchar(100),
	"image_url" text,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username"),
	CONSTRAINT "admins_email_unique" UNIQUE("email"),
	CONSTRAINT "admins_api_key_unique" UNIQUE("api_key"),
	CONSTRAINT "admins_username_key" UNIQUE("username"),
	CONSTRAINT "admins_email_key" UNIQUE("email"),
	CONSTRAINT "admins_api_key_key" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"wallet_address" varchar(42),
	"name" varchar(100) NOT NULL,
	"description" text,
	"image_url" text,
	"api_key" varchar(400) NOT NULL,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"deactivation_reason" text,
	"deactivation_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_owner_id_name_key" UNIQUE("owner_id","name"),
	CONSTRAINT "agents_api_key_key" UNIQUE("api_key"),
	CONSTRAINT "agents_wallet_address_key" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "competition_agents" (
	"competition_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "competition_agents_pkey" PRIMARY KEY("competition_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"external_link" text,
	"image_url" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"name" varchar(100),
	"email" varchar(100),
	"image_url" text,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "users_wallet_address_key" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"specific_chain" varchar(20) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	CONSTRAINT "balances_agent_id_token_address_key" UNIQUE("agent_id","token_address")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."portfolio_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"total_value" numeric(30, 15) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."portfolio_token_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_snapshot_id" integer NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric NOT NULL,
	"value_usd" numeric(30, 15) NOT NULL,
	"price" numeric NOT NULL,
	"specific_chain" varchar(20),
	"symbol" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(50) NOT NULL,
	"price" numeric NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"chain" varchar(10),
	"specific_chain" varchar(20),
	"symbol" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."trades" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"from_token" varchar(50) NOT NULL,
	"to_token" varchar(50) NOT NULL,
	"from_amount" numeric NOT NULL,
	"to_amount" numeric NOT NULL,
	"price" numeric NOT NULL,
	"trade_amount_usd" numeric NOT NULL,
	"to_token_symbol" varchar(20) NOT NULL,
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
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD CONSTRAINT "competition_agents_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD CONSTRAINT "competition_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" ADD CONSTRAINT "balances_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_token_values" ADD CONSTRAINT "portfolio_token_values_portfolio_snapshot_id_fkey" FOREIGN KEY ("portfolio_snapshot_id") REFERENCES "trading_comps"."portfolio_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD CONSTRAINT "trades_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD CONSTRAINT "trades_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trading_competitions" ADD CONSTRAINT "trading_competitions_competitionId_competitions_id_fk" FOREIGN KEY ("competitionId") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_admins_username" ON "admins" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_admins_email" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_admins_api_key" ON "admins" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_admins_status" ON "admins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_owner_id" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_agents_status" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_wallet_address" ON "agents" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_agents_api_key" ON "agents" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_competitions_status" ON "competitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_wallet_address" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_balances_specific_chain" ON "trading_comps"."balances" USING btree ("specific_chain");--> statement-breakpoint
CREATE INDEX "idx_balances_agent_id" ON "trading_comps"."balances" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_agent_competition" ON "trading_comps"."portfolio_snapshots" USING btree ("agent_id","competition_id");--> statement-breakpoint
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
CREATE INDEX "idx_trades_agent_id" ON "trading_comps"."trades" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_trades_timestamp" ON "trading_comps"."trades" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_trades_to_chain" ON "trading_comps"."trades" USING btree ("to_chain");--> statement-breakpoint
CREATE INDEX "idx_trades_to_specific_chain" ON "trading_comps"."trades" USING btree ("to_specific_chain");--> statement-breakpoint
CREATE INDEX "idx_competitions_cross_chain_trading" ON "trading_comps"."trading_competitions" USING btree ("cross_chain_trading_type");