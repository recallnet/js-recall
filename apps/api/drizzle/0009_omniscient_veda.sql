ALTER TABLE "stakes" DROP CONSTRAINT "stakes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "stakes" DROP COLUMN "user_id";