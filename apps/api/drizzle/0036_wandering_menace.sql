ALTER TABLE "rewards" DROP CONSTRAINT "rewards_epoch_epochs_id_fk";
--> statement-breakpoint
ALTER TABLE "rewards_roots" DROP CONSTRAINT "rewards_roots_epoch_epochs_id_fk";
--> statement-breakpoint
ALTER TABLE "rewards_tree" DROP CONSTRAINT "rewards_tree_epoch_epochs_id_fk";
--> statement-breakpoint
DROP INDEX "idx_rewards_epoch";--> statement-breakpoint
DROP INDEX "uq_rewards_roots_epoch";--> statement-breakpoint
DROP INDEX "idx_rewards_tree_epoch_level_idx";--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "competition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards_roots" ADD COLUMN "competition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards_tree" ADD COLUMN "competition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_roots" ADD CONSTRAINT "rewards_roots_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_tree" ADD CONSTRAINT "rewards_tree_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rewards_competition_id" ON "rewards" USING btree ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rewards_roots_competition_id" ON "rewards_roots" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_rewards_tree_competition_id_level_idx" ON "rewards_tree" USING btree ("competition_id","level","idx");--> statement-breakpoint
ALTER TABLE "rewards" DROP COLUMN "epoch";--> statement-breakpoint
ALTER TABLE "rewards_roots" DROP COLUMN "epoch";--> statement-breakpoint
ALTER TABLE "rewards_tree" DROP COLUMN "epoch";