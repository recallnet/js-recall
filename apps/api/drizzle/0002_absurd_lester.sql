ALTER TABLE "competitions" ADD COLUMN "cross_chain_trading_type" varchar(20) DEFAULT 'DISALLOWALL' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_competitions_cross_chain_trading" ON "competitions" USING btree ("cross_chain_trading_type");--> statement-breakpoint
ALTER TABLE "competitions" DROP COLUMN "allow_cross_chain_trading";