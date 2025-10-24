CREATE TYPE "trading_comps"."evaluation_metric" AS ENUM('calmar_ratio', 'sortino_ratio', 'simple_return');--> statement-breakpoint
CREATE TABLE "trading_comps"."risk_metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"calmar_ratio" numeric,
	"sortino_ratio" numeric,
	"simple_return" numeric,
	"annualized_return" numeric,
	"max_drawdown" numeric,
	"downside_deviation" numeric
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_competition_config" ADD COLUMN "evaluation_metric" "trading_comps"."evaluation_metric" DEFAULT 'calmar_ratio' NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_competitions_leaderboard" ADD COLUMN "sortino_ratio" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_competitions_leaderboard" ADD COLUMN "downside_deviation" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" ADD COLUMN "sortino_ratio" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" ADD COLUMN "downside_deviation" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."risk_metrics_snapshots" ADD CONSTRAINT "risk_metrics_snapshots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_risk_snapshots_agent_comp" ON "trading_comps"."risk_metrics_snapshots" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_risk_snapshots_timestamp" ON "trading_comps"."risk_metrics_snapshots" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_risk_snapshots_comp_time" ON "trading_comps"."risk_metrics_snapshots" USING btree ("competition_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_risk_snapshots_agent_comp_time" ON "trading_comps"."risk_metrics_snapshots" USING btree ("agent_id","competition_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_perps_metrics_sortino" ON "trading_comps"."perps_risk_metrics" USING btree ("competition_id","sortino_ratio" DESC NULLS LAST);