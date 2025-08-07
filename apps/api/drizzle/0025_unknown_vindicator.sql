CREATE TABLE "competition_rewards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"reward" integer NOT NULL,
	"agent_id" uuid,
	CONSTRAINT "competition_rewards_competition_id_rank_key" UNIQUE("competition_id","rank")
);
--> statement-breakpoint
ALTER TABLE "competition_rewards" ADD CONSTRAINT "competition_rewards_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_rewards" ADD CONSTRAINT "competition_rewards_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competition_rewards_competition_id" ON "competition_rewards" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_rewards_agent_id" ON "competition_rewards" USING btree ("agent_id");