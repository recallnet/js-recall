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
ALTER TABLE "teams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "teams" CASCADE;--> statement-breakpoint
ALTER TABLE "competition_teams" RENAME TO "competition_agents";--> statement-breakpoint
ALTER TABLE "competition_agents" RENAME COLUMN "team_id" TO "agent_id";--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" RENAME COLUMN "team_id" TO "agent_id";--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" RENAME COLUMN "team_id" TO "agent_id";--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" RENAME COLUMN "team_id" TO "agent_id";--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" DROP CONSTRAINT "balances_team_id_token_address_key";--> statement-breakpoint
ALTER TABLE "competition_agents" DROP CONSTRAINT "competition_teams_competition_id_fkey";
--> statement-breakpoint
ALTER TABLE "competition_agents" DROP CONSTRAINT "competition_teams_team_id_fkey";
--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" DROP CONSTRAINT "balances_team_id_fkey";
--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" DROP CONSTRAINT "portfolio_snapshots_team_id_fkey";
--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" DROP CONSTRAINT "trades_team_id_fkey";
--> statement-breakpoint
DROP INDEX "trading_comps"."idx_balances_team_id";--> statement-breakpoint
DROP INDEX "trading_comps"."idx_portfolio_snapshots_team_competition";--> statement-breakpoint
DROP INDEX "trading_comps"."idx_trades_team_id";--> statement-breakpoint
ALTER TABLE "competition_agents" DROP CONSTRAINT "competition_teams_pkey";--> statement-breakpoint
ALTER TABLE "competition_agents" ADD CONSTRAINT "competition_agents_pkey" PRIMARY KEY("competition_id","agent_id");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admins_username" ON "admins" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_admins_email" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_admins_api_key" ON "admins" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_admins_status" ON "admins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_owner_id" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_agents_status" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_wallet_address" ON "agents" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_agents_api_key" ON "agents" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_users_wallet_address" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
ALTER TABLE "competition_agents" ADD CONSTRAINT "competition_agents_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_agents" ADD CONSTRAINT "competition_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" ADD CONSTRAINT "balances_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD CONSTRAINT "trades_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_balances_agent_id" ON "trading_comps"."balances" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_agent_competition" ON "trading_comps"."portfolio_snapshots" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_trades_agent_id" ON "trading_comps"."trades" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "trading_comps"."balances" ADD CONSTRAINT "balances_agent_id_token_address_key" UNIQUE("agent_id","token_address");