ALTER TABLE "agents" ADD COLUMN "is_rewards_ineligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "rewards_ineligibility_reason" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "rewards_ineligible" text[];--> statement-breakpoint
CREATE INDEX "idx_agents_rewards_ineligible" ON "agents" USING btree ("is_rewards_ineligible");