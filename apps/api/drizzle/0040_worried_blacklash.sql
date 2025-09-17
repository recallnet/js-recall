CREATE TYPE "trading_comps"."perps_data_source" AS ENUM('external_api', 'onchain_indexing', 'hybrid');--> statement-breakpoint
ALTER TYPE "public"."competition_type" ADD VALUE 'perpetual_futures';--> statement-breakpoint
CREATE TABLE "trading_comps"."perpetual_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"provider_position_id" varchar(100),
	"provider_trade_id" varchar(100),
	"asset" varchar(20) NOT NULL,
	"is_long" boolean NOT NULL,
	"leverage" numeric,
	"position_size" numeric NOT NULL,
	"collateral_amount" numeric NOT NULL,
	"entry_price" numeric NOT NULL,
	"current_price" numeric,
	"liquidation_price" numeric,
	"pnl_usd_value" numeric,
	"pnl_percentage" numeric,
	"status" varchar(20) DEFAULT 'Open' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_updated_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"captured_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "perp_positions_provider_id" UNIQUE("provider_position_id")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."perps_account_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"initial_capital" numeric,
	"total_equity" numeric NOT NULL,
	"available_balance" numeric,
	"margin_used" numeric,
	"total_pnl" numeric,
	"total_realized_pnl" numeric,
	"total_unrealized_pnl" numeric,
	"total_volume" numeric,
	"total_fees_paid" numeric,
	"total_trades" integer,
	"average_trade_size" numeric,
	"open_positions_count" integer,
	"closed_positions_count" integer,
	"liquidated_positions_count" integer,
	"roi" numeric,
	"roi_percent" numeric,
	"account_status" varchar(20),
	"raw_data" jsonb,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."perps_competition_config" (
	"competition_id" uuid PRIMARY KEY NOT NULL,
	"data_source" "trading_comps"."perps_data_source" NOT NULL,
	"data_source_config" jsonb NOT NULL,
	"initial_capital" numeric DEFAULT '500.00' NOT NULL,
	"self_funding_threshold_usd" numeric DEFAULT '10.00',
	"inactivity_hours" integer DEFAULT 24,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."perps_self_funding_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"expected_equity" numeric NOT NULL,
	"actual_equity" numeric NOT NULL,
	"unexplained_amount" numeric NOT NULL,
	"account_snapshot" jsonb NOT NULL,
	"detection_method" varchar(50),
	"detected_at" timestamp with time zone DEFAULT now(),
	"reviewed" boolean DEFAULT false,
	"review_note" text,
	"action_taken" varchar(50),
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."perpetual_positions" ADD CONSTRAINT "perpetual_positions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_account_summaries" ADD CONSTRAINT "perps_account_summaries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_competition_config" ADD CONSTRAINT "perps_competition_config_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_self_funding_alerts" ADD CONSTRAINT "perps_self_funding_alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_self_funding_alerts" ADD CONSTRAINT "perps_self_funding_alerts_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_perp_positions_agent_comp" ON "trading_comps"."perpetual_positions" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perp_positions_comp" ON "trading_comps"."perpetual_positions" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_perp_positions_status" ON "trading_comps"."perpetual_positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_perp_positions_created" ON "trading_comps"."perpetual_positions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_perps_summaries_agent_comp" ON "trading_comps"."perps_account_summaries" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perps_summaries_timestamp" ON "trading_comps"."perps_account_summaries" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_perps_summaries_agent_comp_timestamp" ON "trading_comps"."perps_account_summaries" USING btree ("agent_id","competition_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_perps_alerts_agent_comp" ON "trading_comps"."perps_self_funding_alerts" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perps_alerts_comp_reviewed" ON "trading_comps"."perps_self_funding_alerts" USING btree ("competition_id","reviewed");--> statement-breakpoint
CREATE INDEX "idx_perps_alerts_detected" ON "trading_comps"."perps_self_funding_alerts" USING btree ("detected_at" DESC NULLS LAST);