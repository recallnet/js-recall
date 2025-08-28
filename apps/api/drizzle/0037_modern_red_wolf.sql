CREATE TYPE "trading_comps"."live_trading_chains" AS ENUM('eth', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche', 'base', 'linea', 'zksync', 'scroll', 'mantle', 'svm');--> statement-breakpoint
CREATE TYPE "trading_comps"."trade_type" AS ENUM('simulated', 'on_chain');--> statement-breakpoint
CREATE TABLE "trading_comps"."indexer_sync_progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"last_synced_timestamp" bigint NOT NULL,
	"last_sync_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "indexer_sync_progress_competition_unique" UNIQUE("competition_id")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."live_competition_config" (
	"competition_id" uuid PRIMARY KEY NOT NULL,
	"supported_chains" "trading_comps"."live_trading_chains"[] DEFAULT '{"eth","base","arbitrum","optimism","polygon"}' NOT NULL,
	"scan_interval_seconds" integer DEFAULT 120,
	"min_trades_per_day" integer DEFAULT 1,
	"self_funding_threshold_usd" numeric DEFAULT 10,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."self_funding_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"token_address" varchar(66) NOT NULL,
	"chain" varchar(20) NOT NULL,
	"amount_increased" numeric,
	"value_usd" numeric,
	"tx_hash" varchar(66),
	"detected_at" timestamp with time zone DEFAULT now(),
	"reviewed" boolean DEFAULT false,
	"review_note" text
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "trade_type" "trading_comps"."trade_type" DEFAULT 'simulated';--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "on_chain_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "block_number" bigint;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "gas_used" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "gas_price" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "gas_cost_usd" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trading_comps"."indexer_sync_progress" ADD CONSTRAINT "indexer_sync_progress_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."live_competition_config" ADD CONSTRAINT "live_competition_config_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."self_funding_alerts" ADD CONSTRAINT "self_funding_alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."self_funding_alerts" ADD CONSTRAINT "self_funding_alerts_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_indexer_sync_progress_competition" ON "trading_comps"."indexer_sync_progress" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_self_funding_alerts_agent_id" ON "trading_comps"."self_funding_alerts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_self_funding_alerts_competition_id" ON "trading_comps"."self_funding_alerts" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_self_funding_alerts_reviewed" ON "trading_comps"."self_funding_alerts" USING btree ("reviewed");--> statement-breakpoint
CREATE INDEX "idx_self_funding_alerts_detected_at" ON "trading_comps"."self_funding_alerts" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_self_funding_alerts_competition_reviewed" ON "trading_comps"."self_funding_alerts" USING btree ("competition_id","reviewed");--> statement-breakpoint
CREATE INDEX "idx_self_funding_alerts_competition_detected_at" ON "trading_comps"."self_funding_alerts" USING btree ("competition_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_trades_trade_type" ON "trading_comps"."trades" USING btree ("trade_type");--> statement-breakpoint
CREATE INDEX "idx_trades_on_chain_tx_hash" ON "trading_comps"."trades" USING btree ("on_chain_tx_hash");--> statement-breakpoint
CREATE INDEX "idx_trades_block_number" ON "trading_comps"."trades" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "idx_trades_competition_trade_type" ON "trading_comps"."trades" USING btree ("competition_id","trade_type");--> statement-breakpoint
CREATE INDEX "idx_trades_agent_trade_type" ON "trading_comps"."trades" USING btree ("agent_id","trade_type");