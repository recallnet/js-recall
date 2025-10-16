ALTER TABLE "agents" DROP CONSTRAINT "agents_wallet_address_key";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_privy_id_key";--> statement-breakpoint
DROP INDEX "trading_comps"."idx_portfolio_snapshots_competition_agent_timestamp";--> statement-breakpoint
CREATE INDEX "idx_portfolio_snapshots_competition_agent_timestamp" ON "trading_comps"."portfolio_snapshots" USING btree ("competition_id","agent_id","timestamp" desc);