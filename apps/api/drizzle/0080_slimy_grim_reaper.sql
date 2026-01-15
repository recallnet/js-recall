ALTER TABLE "seasons" ADD PRIMARY KEY ("starts_with_airdrop");--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "starts_with_airdrop" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" drop column "number";--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "number" integer GENERATED ALWAYS AS ("seasons"."starts_with_airdrop" + 1) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "airdrop_allocations" ADD CONSTRAINT "airdrop_allocations_airdrop_seasons_starts_with_airdrop_fk" FOREIGN KEY ("airdrop") REFERENCES "public"."seasons"("starts_with_airdrop") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conviction_claims" ADD CONSTRAINT "conviction_claims_season_seasons_starts_with_airdrop_fk" FOREIGN KEY ("season") REFERENCES "public"."seasons"("starts_with_airdrop") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_number" ON "seasons" USING btree ("number");--> statement-breakpoint
UPDATE "seasons" SET "name" = 'Season 5' WHERE "starts_with_airdrop" = 4;--> statement-breakpoint
UPDATE "seasons" SET "name" = 'Season 4' WHERE "starts_with_airdrop" = 3;--> statement-breakpoint
UPDATE "seasons" SET "name" = 'Season 3' WHERE "starts_with_airdrop" = 2;--> statement-breakpoint
UPDATE "seasons" SET "name" = 'Season 2' WHERE "starts_with_airdrop" = 1;--> statement-breakpoint
UPDATE "seasons" SET "name" = 'Season 1' WHERE "starts_with_airdrop" = 0;--> statement-breakpoint
INSERT INTO "seasons" ("starts_with_airdrop", "name", "start_date", "end_date") VALUES (3, 'Season 4', '2026-01-13 00:00:00+00', '2026-02-12 00:00:00+00'), (4, 'Season 5', '2026-02-12 00:00:00+00', '2026-03-14 00:00:00+00'), (5, 'Season 6', '2026-03-14 00:00:00+00', '2026-04-13 00:00:00+00'), (6, 'Season 7', '2026-04-13 00:00:00+00', '2026-05-13 00:00:00+00') ON CONFLICT DO NOTHING;

