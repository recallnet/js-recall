ALTER TABLE "agents" ADD COLUMN "api_key_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "idx_agents_api_key_hash" ON "agents" USING btree ("api_key_hash");