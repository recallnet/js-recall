CREATE TYPE "public"."cross_chain_trading_type" AS ENUM('disallowAll', 'disallowXParent', 'allow');--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "cross_chain_trading_type" "cross_chain_trading_type" DEFAULT 'disallowAll' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_competitions_cross_chain_trading" ON "competitions" USING btree ("cross_chain_trading_type");--> statement-breakpoint
ALTER TABLE "competitions" DROP COLUMN "allow_cross_chain_trading";