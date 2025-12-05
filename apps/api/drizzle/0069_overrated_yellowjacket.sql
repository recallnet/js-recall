ALTER TABLE "agent_boosts" DROP CONSTRAINT "agent_boosts_agent_boost_total_id_agent_boost_totals_id_fk";
--> statement-breakpoint
ALTER TABLE "boost_changes" DROP CONSTRAINT "boost_changes_balance_id_boost_balances_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_boosts" ADD CONSTRAINT "agent_boosts_agent_boost_total_id_agent_boost_totals_id_fk" FOREIGN KEY ("agent_boost_total_id") REFERENCES "public"."agent_boost_totals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "boost_changes" ADD CONSTRAINT "boost_changes_balance_id_boost_balances_id_fk" FOREIGN KEY ("balance_id") REFERENCES "public"."boost_balances"("id") ON DELETE cascade ON UPDATE cascade;