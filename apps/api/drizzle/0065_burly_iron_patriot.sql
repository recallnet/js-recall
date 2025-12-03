ALTER TABLE "sports"."nfl_game_plays" ADD COLUMN "away_score" integer;--> statement-breakpoint
ALTER TABLE "sports"."nfl_game_plays" ADD COLUMN "home_score" integer;--> statement-breakpoint
ALTER TABLE "sports"."nfl_games" ADD COLUMN "away_team_money_line" integer;--> statement-breakpoint
ALTER TABLE "sports"."nfl_games" ADD COLUMN "home_team_money_line" integer;