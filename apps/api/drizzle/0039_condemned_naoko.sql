ALTER TABLE "email_verification_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "email_verification_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "embedded_wallet_address" varchar(42);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privy_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_subscribed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_users_privy_id" ON "users" USING btree ("privy_id");--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "is_email_verified";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_email_verified";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_embedded_wallet_address_unique" UNIQUE("embedded_wallet_address");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_privy_id_unique" UNIQUE("privy_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_privy_id_key" UNIQUE("privy_id");