CREATE SCHEMA "sports";
--> statement-breakpoint
CREATE TYPE "sports"."game_status" AS ENUM('scheduled', 'in_progress', 'final');--> statement-breakpoint
CREATE TYPE "sports"."nfl_team" AS ENUM('ARI', 'ATL', 'BAL', 'BUF', 'BYE', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS');--> statement-breakpoint
ALTER TYPE "public"."competition_type" ADD VALUE 'sports_prediction';--> statement-breakpoint
CREATE TABLE "sports"."competition_aggregate_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"average_brier_score" numeric(10, 6) NOT NULL,
	"games_scored" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_aggregate_scores_competition_id_agent_id_key" UNIQUE("competition_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "sports"."competition_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_games_competition_id_game_id_key" UNIQUE("competition_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "sports"."game_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"provider_play_id" text,
	"sequence" integer NOT NULL,
	"quarter_name" text NOT NULL,
	"time_remaining_minutes" integer,
	"time_remaining_seconds" integer,
	"play_time" timestamp with time zone,
	"down" integer,
	"distance" integer,
	"yard_line" integer,
	"yard_line_territory" text,
	"yards_to_end_zone" integer,
	"play_type" text,
	"team" "sports"."nfl_team" NOT NULL,
	"opponent" "sports"."nfl_team" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_plays_game_id_sequence_key" UNIQUE("game_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "sports"."game_prediction_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"time_weighted_brier_score" numeric(10, 6) NOT NULL,
	"final_prediction" "sports"."nfl_team",
	"final_confidence" numeric(4, 3),
	"prediction_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_prediction_scores_competition_id_game_id_agent_id_key" UNIQUE("competition_id","game_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "sports"."game_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"predicted_winner" "sports"."nfl_team" NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports"."games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_game_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"home_team" "sports"."nfl_team" NOT NULL,
	"away_team" "sports"."nfl_team" NOT NULL,
	"spread" numeric(10, 2),
	"over_under" numeric(10, 2),
	"venue" text,
	"status" "sports"."game_status" DEFAULT 'scheduled' NOT NULL,
	"winner" "sports"."nfl_team",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_provider_game_id_unique" UNIQUE("provider_game_id"),
	CONSTRAINT "games_provider_game_id_key" UNIQUE("provider_game_id")
);
--> statement-breakpoint
ALTER TABLE "sports"."competition_aggregate_scores" ADD CONSTRAINT "competition_aggregate_scores_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."competition_aggregate_scores" ADD CONSTRAINT "competition_aggregate_scores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."competition_games" ADD CONSTRAINT "competition_games_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."competition_games" ADD CONSTRAINT "competition_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "sports"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_plays" ADD CONSTRAINT "game_plays_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "sports"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_prediction_scores" ADD CONSTRAINT "game_prediction_scores_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_prediction_scores" ADD CONSTRAINT "game_prediction_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "sports"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_prediction_scores" ADD CONSTRAINT "game_prediction_scores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_predictions" ADD CONSTRAINT "game_predictions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_predictions" ADD CONSTRAINT "game_predictions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "sports"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports"."game_predictions" ADD CONSTRAINT "game_predictions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competition_aggregate_scores_competition_id" ON "sports"."competition_aggregate_scores" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_aggregate_scores_agent_id" ON "sports"."competition_aggregate_scores" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_competition_games_competition_id" ON "sports"."competition_games" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_games_game_id" ON "sports"."competition_games" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_plays_game_id" ON "sports"."game_plays" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_plays_provider_play_id" ON "sports"."game_plays" USING btree ("provider_play_id");--> statement-breakpoint
CREATE INDEX "idx_game_plays_play_type" ON "sports"."game_plays" USING btree ("play_type");--> statement-breakpoint
CREATE INDEX "idx_game_prediction_scores_competition_id" ON "sports"."game_prediction_scores" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_game_prediction_scores_game_id" ON "sports"."game_prediction_scores" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_prediction_scores_agent_id" ON "sports"."game_prediction_scores" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_competition_id_game_id_agent_id_created_at" ON "sports"."game_predictions" USING btree ("competition_id","game_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_game_id_agent_id" ON "sports"."game_predictions" USING btree ("game_id","agent_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_competition_id" ON "sports"."game_predictions" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_game_id" ON "sports"."game_predictions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_agent_id" ON "sports"."game_predictions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_games_provider_game_id" ON "sports"."games" USING btree ("provider_game_id");--> statement-breakpoint
CREATE INDEX "idx_games_status" ON "sports"."games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_games_start_time" ON "sports"."games" USING btree ("start_time");