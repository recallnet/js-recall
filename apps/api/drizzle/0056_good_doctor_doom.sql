CREATE TABLE "arenas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"classification" jsonb NOT NULL,
	"kind" text DEFAULT 'Competition' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arenas_id_key" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "arena_id" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_id" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_version" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "engine_config" jsonb;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "participation_config" jsonb;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "partners" jsonb;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "rewards" jsonb;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "display_state" text;--> statement-breakpoint
CREATE INDEX "idx_arenas_id" ON "arenas" USING btree ("id");--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "public"."arenas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competitions_arena_id" ON "competitions" USING btree ("arena_id");--> statement-breakpoint
CREATE INDEX "idx_competitions_engine_id" ON "competitions" USING btree ("engine_id");