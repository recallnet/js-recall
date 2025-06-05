ALTER TABLE "votes_available" DROP CONSTRAINT "votes_available_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "votes_available" DROP COLUMN "user_id";