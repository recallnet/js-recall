CREATE TYPE "trading_comps"."spot_live_data_source" AS ENUM('rpc_direct', 'envio_indexing', 'hybrid');--> statement-breakpoint
CREATE TYPE "trading_comps"."trade_type" AS ENUM('simulated', 'spot_live');--> statement-breakpoint
ALTER TYPE "public"."competition_type" ADD VALUE 'spot_live_trading';--> statement-breakpoint
CREATE TABLE "trading_comps"."spot_live_allowed_protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"specific_chain" varchar(20) NOT NULL,
	"protocol" varchar(50) NOT NULL,
	"router_address" varchar(66) NOT NULL,
	"swap_event_signature" varchar(66) NOT NULL,
	"factory_address" varchar(66),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "spot_live_protocols_unique" UNIQUE("competition_id","specific_chain","router_address")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."spot_live_allowed_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"specific_chain" varchar(20) NOT NULL,
	"token_address" varchar(66) NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "spot_live_tokens_unique" UNIQUE("competition_id","specific_chain","token_address")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."spot_live_competition_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"specific_chain" varchar(20) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "spot_live_chains_unique" UNIQUE("competition_id","specific_chain")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."spot_live_competition_config" (
	"competition_id" uuid PRIMARY KEY NOT NULL,
	"data_source" "trading_comps"."spot_live_data_source" NOT NULL,
	"data_source_config" jsonb NOT NULL,
	"self_funding_threshold_usd" numeric DEFAULT '10.00',
	"min_funding_threshold" numeric,
	"inactivity_hours" integer DEFAULT 24,
	"sync_interval_minutes" integer DEFAULT 5,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."spot_live_self_funding_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"detection_method" varchar(50) NOT NULL,
	"violation_type" varchar(50) NOT NULL,
	"detected_value" numeric NOT NULL,
	"threshold_value" numeric NOT NULL,
	"specific_chain" varchar(20),
	"tx_hash" varchar(100),
	"transfer_snapshot" jsonb,
	"detected_at" timestamp with time zone DEFAULT now(),
	"reviewed" boolean DEFAULT false,
	"review_note" text,
	"action_taken" varchar(50),
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."spot_live_transfer_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"specific_chain" varchar(20) NOT NULL,
	"token_address" varchar(66) NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"amount" numeric NOT NULL,
	"amount_usd" numeric,
	"from_address" varchar(66) NOT NULL,
	"to_address" varchar(66) NOT NULL,
	"tx_hash" varchar(100) NOT NULL,
	"block_number" integer NOT NULL,
	"transfer_timestamp" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "spot_live_transfers_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "trade_type" "trading_comps"."trade_type" DEFAULT 'simulated';--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "tx_hash" varchar(100);--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "block_number" integer;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "protocol" varchar(50);--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "gas_used" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "gas_price" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "gas_cost_usd" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_allowed_protocols" ADD CONSTRAINT "spot_live_allowed_protocols_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_allowed_tokens" ADD CONSTRAINT "spot_live_allowed_tokens_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_competition_chains" ADD CONSTRAINT "spot_live_competition_chains_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_competition_config" ADD CONSTRAINT "spot_live_competition_config_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_self_funding_alerts" ADD CONSTRAINT "spot_live_self_funding_alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_self_funding_alerts" ADD CONSTRAINT "spot_live_self_funding_alerts_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_self_funding_alerts" ADD CONSTRAINT "spot_live_self_funding_alerts_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_transfer_history" ADD CONSTRAINT "spot_live_transfer_history_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."spot_live_transfer_history" ADD CONSTRAINT "spot_live_transfer_history_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_spot_live_protocols_competition_id" ON "trading_comps"."spot_live_allowed_protocols" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_spot_live_protocols_chain" ON "trading_comps"."spot_live_allowed_protocols" USING btree ("competition_id","specific_chain");--> statement-breakpoint
CREATE INDEX "idx_spot_live_tokens_competition_id" ON "trading_comps"."spot_live_allowed_tokens" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_spot_live_tokens_chain" ON "trading_comps"."spot_live_allowed_tokens" USING btree ("competition_id","specific_chain");--> statement-breakpoint
CREATE INDEX "idx_spot_live_chains_competition_id" ON "trading_comps"."spot_live_competition_chains" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_spot_live_config_competition_id" ON "trading_comps"."spot_live_competition_config" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_spot_live_alerts_agent_comp" ON "trading_comps"."spot_live_self_funding_alerts" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_spot_live_alerts_comp_reviewed" ON "trading_comps"."spot_live_self_funding_alerts" USING btree ("competition_id","reviewed");--> statement-breakpoint
CREATE INDEX "idx_spot_live_alerts_detected" ON "trading_comps"."spot_live_self_funding_alerts" USING btree ("detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_spot_live_alerts_violation_type" ON "trading_comps"."spot_live_self_funding_alerts" USING btree ("violation_type");--> statement-breakpoint
CREATE INDEX "idx_spot_live_transfers_agent_comp" ON "trading_comps"."spot_live_transfer_history" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_spot_live_transfers_timestamp" ON "trading_comps"."spot_live_transfer_history" USING btree ("transfer_timestamp");--> statement-breakpoint
CREATE INDEX "idx_spot_live_transfers_agent_comp_timestamp" ON "trading_comps"."spot_live_transfer_history" USING btree ("agent_id","competition_id","transfer_timestamp");--> statement-breakpoint
CREATE INDEX "idx_spot_live_transfers_type" ON "trading_comps"."spot_live_transfer_history" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_trades_trade_type" ON "trading_comps"."trades" USING btree ("trade_type");--> statement-breakpoint
CREATE INDEX "idx_trades_tx_hash" ON "trading_comps"."trades" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_trades_block_number" ON "trading_comps"."trades" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "idx_trades_type_competition_timestamp" ON "trading_comps"."trades" USING btree ("trade_type","competition_id","timestamp" DESC);--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD CONSTRAINT "trades_tx_hash_competition_agent_unique" UNIQUE("tx_hash","competition_id","agent_id");