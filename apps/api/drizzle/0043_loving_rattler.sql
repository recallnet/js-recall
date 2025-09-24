CREATE TABLE "trading_comps"."perps_risk_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"time_weighted_return" numeric NOT NULL,
	"calmar_ratio" numeric NOT NULL,
	"annualized_return" numeric NOT NULL,
	"max_drawdown" numeric NOT NULL,
	"transfer_count" integer DEFAULT 0 NOT NULL,
	"period_count" integer DEFAULT 1 NOT NULL,
	"calculation_timestamp" timestamp with time zone DEFAULT now(),
	"snapshot_count" integer NOT NULL,
	CONSTRAINT "idx_perps_metrics_unique" UNIQUE("agent_id","competition_id")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."perps_transfer_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric NOT NULL,
	"asset" varchar(10) NOT NULL,
	"from_address" varchar(100) NOT NULL,
	"to_address" varchar(100) NOT NULL,
	"tx_hash" varchar(100) NOT NULL,
	"chain_id" integer NOT NULL,
	"equity_before" numeric NOT NULL,
	"equity_after" numeric NOT NULL,
	"transfer_timestamp" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "idx_perps_transfers_tx_hash" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."perps_twr_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metrics_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"period_return" numeric NOT NULL,
	"starting_equity" numeric NOT NULL,
	"ending_equity" numeric NOT NULL,
	"transfer_id" uuid,
	"sequence_number" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" ADD CONSTRAINT "perps_risk_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_transfer_history" ADD CONSTRAINT "perps_transfer_history_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_twr_periods" ADD CONSTRAINT "perps_twr_periods_metrics_id_perps_risk_metrics_id_fk" FOREIGN KEY ("metrics_id") REFERENCES "trading_comps"."perps_risk_metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_twr_periods" ADD CONSTRAINT "perps_twr_periods_transfer_id_perps_transfer_history_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "trading_comps"."perps_transfer_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_perps_metrics_agent_comp" ON "trading_comps"."perps_risk_metrics" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perps_metrics_calmar" ON "trading_comps"."perps_risk_metrics" USING btree ("competition_id","calmar_ratio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_perps_transfers_agent_comp" ON "trading_comps"."perps_transfer_history" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perps_transfers_timestamp" ON "trading_comps"."perps_transfer_history" USING btree ("transfer_timestamp");--> statement-breakpoint
CREATE INDEX "idx_perps_transfers_agent_comp_timestamp" ON "trading_comps"."perps_transfer_history" USING btree ("agent_id","competition_id","transfer_timestamp");--> statement-breakpoint
CREATE INDEX "idx_twr_periods_metrics" ON "trading_comps"."perps_twr_periods" USING btree ("metrics_id");--> statement-breakpoint
CREATE INDEX "idx_twr_periods_sequence" ON "trading_comps"."perps_twr_periods" USING btree ("metrics_id","sequence_number");