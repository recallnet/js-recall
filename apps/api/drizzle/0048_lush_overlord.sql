CREATE TABLE "competition_prize_pools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"agent_pool" numeric(78, 0) NOT NULL,
	"user_pool" numeric(78, 0) NOT NULL,
	CONSTRAINT "competition_prize_pools_competition_id_key" UNIQUE("competition_id")
);
--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "competition_prize_pools" ADD CONSTRAINT "competition_prize_pools_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rewards_user_id" ON "rewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rewards_agent_id" ON "rewards" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rewards_competition_id_address" ON "rewards" USING btree ("competition_id","address");