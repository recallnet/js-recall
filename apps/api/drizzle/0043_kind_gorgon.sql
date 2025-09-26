CREATE TABLE "trading_comps"."perps_risk_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"simple_return" numeric NOT NULL,
	"calmar_ratio" numeric NOT NULL,
	"annualized_return" numeric NOT NULL,
	"max_drawdown" numeric NOT NULL,
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
	"transfer_timestamp" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "idx_perps_transfers_tx_hash" UNIQUE("tx_hash")
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" ADD CONSTRAINT "perps_risk_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_transfer_history" ADD CONSTRAINT "perps_transfer_history_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_perps_metrics_agent_comp" ON "trading_comps"."perps_risk_metrics" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perps_metrics_calmar" ON "trading_comps"."perps_risk_metrics" USING btree ("competition_id","calmar_ratio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_perps_transfers_agent_comp" ON "trading_comps"."perps_transfer_history" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_perps_transfers_timestamp" ON "trading_comps"."perps_transfer_history" USING btree ("transfer_timestamp");--> statement-breakpoint
CREATE INDEX "idx_perps_transfers_agent_comp_timestamp" ON "trading_comps"."perps_transfer_history" USING btree ("agent_id","competition_id","transfer_timestamp");