CREATE TABLE "competitions_leaderboard" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score" numeric(30, 15) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_rank" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"mu" numeric(6, 2) NOT NULL,
	"sigma" numeric(6, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_rank_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"mu" numeric(6, 2) NOT NULL,
	"sigma" numeric(6, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitions_leaderboard" ADD CONSTRAINT "competitions_leaderboard_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions_leaderboard" ADD CONSTRAINT "competitions_leaderboard_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rank" ADD CONSTRAINT "agent_rank_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rank_history" ADD CONSTRAINT "agent_rank_history_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rank_history" ADD CONSTRAINT "agent_rank_history_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competitions_leaderboard_agent_id" ON "competitions_leaderboard" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_competitions_leaderboard_competition_id" ON "competitions_leaderboard" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competitions_leaderboard_agent_competition" ON "competitions_leaderboard" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_agent_rank_agent_id" ON "agent_rank" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_rank_history_agent_id" ON "agent_rank_history" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_rank_history_competition_id" ON "agent_rank_history" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_agent_rank_history_agent_competition" ON "agent_rank_history" USING btree ("agent_id","competition_id");