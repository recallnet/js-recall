CREATE TABLE "agent_nonces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"nonce" varchar(100) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "agent_nonces_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "amount" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "stakes" ALTER COLUMN "amount" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "vote_assignments" ALTER COLUMN "amount" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "votes_available" ALTER COLUMN "amount" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "votes_performed" ALTER COLUMN "amount" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "agent_nonces" ADD CONSTRAINT "agent_nonces_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_nonces_agent_id" ON "agent_nonces" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_nonces_nonce" ON "agent_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "idx_agent_nonces_expires_at" ON "agent_nonces" USING btree ("expires_at");