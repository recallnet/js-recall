CREATE TABLE "trading_comps"."perps_competitions_leaderboard" (
	"competitions_leaderboard_id" uuid PRIMARY KEY NOT NULL,
	"calmar_ratio" numeric,
	"simple_return" numeric,
	"max_drawdown" numeric,
	"total_equity" numeric NOT NULL,
	"total_pnl" numeric,
	"has_risk_metrics" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."perps_competitions_leaderboard" ADD CONSTRAINT "perps_competitions_leaderboard_competitions_leaderboard_id_competitions_leaderboard_id_fk" FOREIGN KEY ("competitions_leaderboard_id") REFERENCES "public"."competitions_leaderboard"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_perps_competitions_leaderboard_calmar" ON "trading_comps"."perps_competitions_leaderboard" USING btree ("calmar_ratio");