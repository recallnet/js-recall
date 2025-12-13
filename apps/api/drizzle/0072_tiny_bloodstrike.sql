CREATE SCHEMA "eigenai";
--> statement-breakpoint
CREATE TYPE "eigenai"."verification_status" AS ENUM('verified', 'invalid', 'pending');--> statement-breakpoint
CREATE TABLE "eigenai"."agent_badge_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"is_badge_active" boolean DEFAULT false NOT NULL,
	"signatures_last_24h" integer DEFAULT 0 NOT NULL,
	"last_verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eigenai"."signature_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"chain_id" text NOT NULL,
	"request_prompt" text NOT NULL,
	"response_model" text NOT NULL,
	"response_output" text NOT NULL,
	"verification_status" "eigenai"."verification_status" NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eigenai"."agent_badge_status" ADD CONSTRAINT "agent_badge_status_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eigenai"."agent_badge_status" ADD CONSTRAINT "agent_badge_status_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eigenai"."signature_submissions" ADD CONSTRAINT "signature_submissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eigenai"."signature_submissions" ADD CONSTRAINT "signature_submissions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_badge_status_agent_competition_uniq" ON "eigenai"."agent_badge_status" USING btree ("agent_id","competition_id");--> statement-breakpoint
CREATE INDEX "idx_badge_status_competition_active" ON "eigenai"."agent_badge_status" USING btree ("competition_id","is_badge_active" DESC);--> statement-breakpoint
CREATE INDEX "idx_badge_status_agent_id" ON "eigenai"."agent_badge_status" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_badge_status_competition_id" ON "eigenai"."agent_badge_status" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_badge_status_updated_at" ON "eigenai"."agent_badge_status" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_sig_submissions_agent_comp_status_submitted" ON "eigenai"."signature_submissions" USING btree ("agent_id","competition_id","verification_status","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_sig_submissions_agent_id" ON "eigenai"."signature_submissions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_sig_submissions_competition_id" ON "eigenai"."signature_submissions" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_sig_submissions_submitted_at" ON "eigenai"."signature_submissions" USING btree ("submitted_at");