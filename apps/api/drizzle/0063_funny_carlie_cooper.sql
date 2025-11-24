CREATE TABLE "boost_bonus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_admin_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boost_bonus" ADD CONSTRAINT "boost_bonus_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boost_bonus" ADD CONSTRAINT "boost_bonus_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boost_bonus_user_active_idx" ON "boost_bonus" USING btree ("user_id","is_active","expires_at") WHERE "boost_bonus"."is_active" = true;--> statement-breakpoint
CREATE INDEX "boost_bonus_user_id_idx" ON "boost_bonus" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "boost_bonus_expires_at_idx" ON "boost_bonus" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "boost_bonus_is_active_idx" ON "boost_bonus" USING btree ("is_active");