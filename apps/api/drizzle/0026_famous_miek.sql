ALTER TABLE "agents" ADD COLUMN "handle" varchar(15);--> statement-breakpoint
CREATE INDEX "idx_agents_handle" ON "agents" USING btree ("handle");