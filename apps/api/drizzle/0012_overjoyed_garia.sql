ALTER TABLE "object_index" DROP CONSTRAINT "object_index_object_key_key";--> statement-breakpoint
DROP INDEX "idx_object_index_object_last_modified_at";--> statement-breakpoint
DROP INDEX "idx_object_index_competition_modified";--> statement-breakpoint
CREATE INDEX "idx_object_index_competition_agent" ON "object_index" USING btree ("competition_id","agent_id");--> statement-breakpoint
ALTER TABLE "object_index" DROP COLUMN "object_key";--> statement-breakpoint
ALTER TABLE "object_index" DROP COLUMN "bucket_name";--> statement-breakpoint
ALTER TABLE "object_index" DROP COLUMN "object_last_modified_at";--> statement-breakpoint
ALTER TABLE "object_index" DROP COLUMN "content_hash";--> statement-breakpoint
ALTER TABLE "object_index" DROP COLUMN "updated_at";--> statement-breakpoint
CREATE INDEX "idx_object_index_created_at" ON "object_index" USING btree ("created_at");