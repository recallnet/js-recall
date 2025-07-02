CREATE TABLE "trading_comps"."trading_competitions_leaderboard" (
	"competitions_leaderboard_id" uuid PRIMARY KEY NOT NULL,
	"pnl" numeric(30, 15) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_snapshots" ALTER COLUMN "timestamp" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions_leaderboard" ADD COLUMN "total_agents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_comps"."trading_competitions_leaderboard" ADD CONSTRAINT "trading_competitions_leaderboard_competitions_leaderboard_id_competitions_leaderboard_id_fk" FOREIGN KEY ("competitions_leaderboard_id") REFERENCES "public"."competitions_leaderboard"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_trading_competitions_leaderboard_pnl" ON "trading_comps"."trading_competitions_leaderboard" USING btree ("pnl");