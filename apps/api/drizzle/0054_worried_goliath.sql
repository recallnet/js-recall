ALTER TABLE "trading_comps"."perps_risk_metrics" ADD COLUMN "sortino_ratio" numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" ADD COLUMN "downside_deviation" numeric;--> statement-breakpoint
CREATE INDEX "idx_perps_metrics_sortino" ON "trading_comps"."perps_risk_metrics" USING btree ("competition_id","sortino_ratio" DESC NULLS LAST);