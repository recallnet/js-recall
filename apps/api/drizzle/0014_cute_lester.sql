ALTER TABLE "object_index" DROP CONSTRAINT "object_index_competition_id_fkey";
--> statement-breakpoint
ALTER TABLE "object_index" DROP CONSTRAINT "object_index_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "object_index" ALTER COLUMN "competition_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "object_index" ALTER COLUMN "agent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "object_index" ADD CONSTRAINT "object_index_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_index" ADD CONSTRAINT "object_index_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;