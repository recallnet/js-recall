ALTER TABLE "agent_score" DROP CONSTRAINT "unique_agent_score_agent_id_type";--> statement-breakpoint
ALTER TABLE "agent_score" ADD COLUMN "arena_id" text;--> statement-breakpoint
ALTER TABLE "agent_score" ADD CONSTRAINT "agent_score_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "public"."arenas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_score_arena_id" ON "agent_score" USING btree ("arena_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_agent_score_global" ON "agent_score" ("agent_id", "type") WHERE "arena_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_agent_score_arena" ON "agent_score" ("agent_id", "arena_id") WHERE "arena_id" IS NOT NULL;