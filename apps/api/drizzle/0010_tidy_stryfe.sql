ALTER TABLE "agent_rank" ALTER COLUMN "mu" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "agent_rank" ALTER COLUMN "sigma" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "agent_rank_history" ALTER COLUMN "mu" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "agent_rank_history" ALTER COLUMN "sigma" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "agent_rank" ADD COLUMN "ordinal" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_rank_history" ADD COLUMN "ordinal" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_rank" ADD CONSTRAINT "unique_agent_rank_agent_id" UNIQUE("agent_id");