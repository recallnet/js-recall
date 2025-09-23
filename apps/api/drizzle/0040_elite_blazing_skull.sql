CREATE TABLE "agent_boost_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"total" numeric(78, 0) DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_boosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_boost_total_id" uuid NOT NULL,
	"change_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "boost_balances_wallet_competition_uniq";--> statement-breakpoint
ALTER TABLE "stake_changes" ALTER COLUMN "delta_amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "boost_balances" ALTER COLUMN "balance" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "boost_balances" ALTER COLUMN "balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "boost_changes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "boost_changes" ALTER COLUMN "delta_amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "epochs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "rewards_roots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "rewards_tree" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "boost_balances" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "boost_changes" ADD COLUMN "wallet" "bytea" NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_boost_totals" ADD CONSTRAINT "agent_boost_totals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_boost_totals" ADD CONSTRAINT "agent_boost_totals_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_boosts" ADD CONSTRAINT "agent_boosts_agent_boost_total_id_agent_boost_totals_id_fk" FOREIGN KEY ("agent_boost_total_id") REFERENCES "public"."agent_boost_totals"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_boosts" ADD CONSTRAINT "agent_boosts_change_id_boost_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."boost_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_boost_totals_agent_id_idx" ON "agent_boost_totals" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_boost_totals_competition_id_idx" ON "agent_boost_totals" USING btree ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_boost_totals_agent_id_competition_id_idx" ON "agent_boost_totals" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "agent_boosts_agent_boost_total_id_idx" ON "agent_boosts" USING btree ("agent_boost_total_id");--> statement-breakpoint
CREATE INDEX "agent_boosts_change_idx" ON "agent_boosts" USING btree ("change_id");--> statement-breakpoint
CREATE INDEX "agent_boosts_created_at_idx" ON "agent_boosts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_boosts_agent_boost_total_id_change_id_idx" ON "agent_boosts" USING btree ("agent_boost_total_id","change_id");--> statement-breakpoint
ALTER TABLE "boost_balances" ADD CONSTRAINT "boost_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boost_balances_user_competition_uniq" ON "boost_balances" USING btree ("user_id","competition_id");--> statement-breakpoint
CREATE INDEX "boost_changes_wallet_idx" ON "boost_changes" USING btree ("wallet");--> statement-breakpoint
ALTER TABLE "boost_balances" DROP COLUMN "wallet";