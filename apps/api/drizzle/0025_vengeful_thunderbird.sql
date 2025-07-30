ALTER TABLE "agents" ADD COLUMN "handle" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_agents_handle" ON "agents" USING btree ("handle");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_handle_key" UNIQUE("handle");