CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'in_progress', 'final');--> statement-breakpoint
CREATE TYPE "public"."nfl_team" AS ENUM('ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS');--> statement-breakpoint
CREATE TYPE "public"."play_outcome" AS ENUM('run', 'pass');--> statement-breakpoint
CREATE TYPE "public"."play_status" AS ENUM('open', 'locked', 'resolved');--> statement-breakpoint
ALTER TYPE "public"."competition_type" ADD VALUE 'nfl';--> statement-breakpoint
CREATE TABLE "competition_aggregate_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"average_brier_score" numeric(10, 6) NOT NULL,
	"games_scored" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_aggregate_scores_competition_id_agent_id_key" UNIQUE("competition_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "competition_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_games_competition_id_game_id_key" UNIQUE("competition_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "game_plays" (
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
	"team" text NOT NULL,
	"opponent" text NOT NULL,
	"description" text,
	"lock_time" timestamp with time zone NOT NULL,
	"status" "play_status" DEFAULT 'open' NOT NULL,
	"actual_outcome" "play_outcome",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_plays_game_id_sequence_key" UNIQUE("game_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "game_prediction_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"time_weighted_brier_score" numeric(10, 6) NOT NULL,
	"final_prediction" text,
	"final_confidence" numeric(4, 3),
	"prediction_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_prediction_scores_competition_id_game_id_agent_id_key" UNIQUE("competition_id","game_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "game_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"predicted_winner" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_game_id" integer NOT NULL,
	"game_key" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"venue" text,
	"status" "game_status" DEFAULT 'scheduled' NOT NULL,
	"winner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_global_game_id_unique" UNIQUE("global_game_id"),
	CONSTRAINT "games_global_game_id_key" UNIQUE("global_game_id")
);
--> statement-breakpoint
ALTER TABLE "competition_aggregate_scores" ADD CONSTRAINT "competition_aggregate_scores_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_aggregate_scores" ADD CONSTRAINT "competition_aggregate_scores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_games" ADD CONSTRAINT "competition_games_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_games" ADD CONSTRAINT "competition_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_prediction_scores" ADD CONSTRAINT "game_prediction_scores_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_prediction_scores" ADD CONSTRAINT "game_prediction_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_prediction_scores" ADD CONSTRAINT "game_prediction_scores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_predictions" ADD CONSTRAINT "game_predictions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_predictions" ADD CONSTRAINT "game_predictions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_predictions" ADD CONSTRAINT "game_predictions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competition_aggregate_scores_competition_id" ON "competition_aggregate_scores" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_aggregate_scores_agent_id" ON "competition_aggregate_scores" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_competition_games_competition_id" ON "competition_games" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_games_game_id" ON "competition_games" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_plays_game_id" ON "game_plays" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_plays_provider_play_id" ON "game_plays" USING btree ("provider_play_id");--> statement-breakpoint
CREATE INDEX "idx_game_plays_status_lock_time" ON "game_plays" USING btree ("status","lock_time");--> statement-breakpoint
CREATE INDEX "idx_game_plays_status" ON "game_plays" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_game_plays_play_type" ON "game_plays" USING btree ("play_type");--> statement-breakpoint
CREATE INDEX "idx_game_prediction_scores_competition_id" ON "game_prediction_scores" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_game_prediction_scores_game_id" ON "game_prediction_scores" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_prediction_scores_agent_id" ON "game_prediction_scores" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_competition_id_game_id_agent_id_created_at" ON "game_predictions" USING btree ("competition_id","game_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_game_id_agent_id" ON "game_predictions" USING btree ("game_id","agent_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_competition_id" ON "game_predictions" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_game_id" ON "game_predictions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_predictions_agent_id" ON "game_predictions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_games_global_game_id" ON "games" USING btree ("global_game_id");--> statement-breakpoint
CREATE INDEX "idx_games_game_key" ON "games" USING btree ("game_key");--> statement-breakpoint
CREATE INDEX "idx_games_status" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_games_start_time" ON "games" USING btree ("start_time");