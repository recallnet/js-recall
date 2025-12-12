ALTER TABLE "trading_comps"."perpetual_positions" DROP CONSTRAINT "perpetual_positions_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_account_summaries" DROP CONSTRAINT "perps_account_summaries_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" DROP CONSTRAINT "perps_risk_metrics_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_self_funding_alerts" DROP CONSTRAINT "perps_self_funding_alerts_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_transfer_history" DROP CONSTRAINT "perps_transfer_history_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_comps"."risk_metrics_snapshots" DROP CONSTRAINT "risk_metrics_snapshots_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_comps"."perpetual_positions" ADD CONSTRAINT "perpetual_positions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_account_summaries" ADD CONSTRAINT "perps_account_summaries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_risk_metrics" ADD CONSTRAINT "perps_risk_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_self_funding_alerts" ADD CONSTRAINT "perps_self_funding_alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_transfer_history" ADD CONSTRAINT "perps_transfer_history_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_comps"."risk_metrics_snapshots" ADD CONSTRAINT "risk_metrics_snapshots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;