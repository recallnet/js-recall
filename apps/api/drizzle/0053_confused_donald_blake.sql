DROP TABLE "votes" CASCADE;--> statement-breakpoint
ALTER TABLE "competitions" RENAME COLUMN "voting_start_date" TO "boost_start_date";--> statement-breakpoint
ALTER TABLE "competitions" RENAME COLUMN "voting_end_date" TO "boost_end_date";