ALTER TABLE "airdrop_allocations" RENAME COLUMN "season" TO "airdrop";--> statement-breakpoint
ALTER TABLE "airdrop_allocations" DROP CONSTRAINT "airdrop_allocations_season_seasons_number_fk";
--> statement-breakpoint
ALTER TABLE "conviction_claims" DROP CONSTRAINT "conviction_claims_season_seasons_number_fk";
--> statement-breakpoint
DROP INDEX "idx_season";--> statement-breakpoint
ALTER TABLE "airdrop_allocations" DROP CONSTRAINT "airdrop_allocations_address_season_pk";--> statement-breakpoint
ALTER TABLE "airdrop_allocations" ADD CONSTRAINT "airdrop_allocations_address_airdrop_pk" PRIMARY KEY("address","airdrop");--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "starts_with_airdrop" integer;--> statement-breakpoint
CREATE INDEX "idx_airdrop" ON "airdrop_allocations" USING btree ("airdrop");--> statement-breakpoint
CREATE INDEX "idx_start_date" ON "seasons" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_end_date" ON "seasons" USING btree ("end_date");--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "id";--> statement-breakpoint
UPDATE "seasons" SET "starts_with_airdrop" = "number";
