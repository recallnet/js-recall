ALTER TABLE "competitions" ADD COLUMN "engine_id" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_version" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_config" jsonb;--> statement-breakpoint
CREATE INDEX "idx_competitions_engine_id" ON "competitions" USING btree ("engine_id");