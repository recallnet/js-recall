CREATE TYPE "public"."actor_status" AS ENUM('active', 'inactive', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('pending', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('trading');--> statement-breakpoint
ALTER TABLE "competitions" RENAME COLUMN "external_link" TO "external_url";--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."actor_status";--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "status" SET DATA TYPE "public"."actor_status" USING "status"::"public"."actor_status";--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."actor_status";--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "status" SET DATA TYPE "public"."actor_status" USING "status"::"public"."actor_status";--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "status" SET DATA TYPE "public"."competition_status" USING "status"::"public"."competition_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."actor_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DATA TYPE "public"."actor_status" USING "status"::"public"."actor_status";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "email" varchar(100);--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "type" "competition_type" DEFAULT 'trading' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_wallet_address_unique" UNIQUE("wallet_address");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");