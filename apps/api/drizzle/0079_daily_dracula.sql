ALTER TABLE "airdrop_allocations" RENAME COLUMN "season" TO "airdrop";--> statement-breakpoint
ALTER TABLE "airdrop_allocations" DROP CONSTRAINT "airdrop_allocations_season_seasons_number_fk";
--> statement-breakpoint
DROP INDEX "idx_season";--> statement-breakpoint
ALTER TABLE "airdrop_allocations" DROP CONSTRAINT "airdrop_allocations_address_season_pk";--> statement-breakpoint
ALTER TABLE "seasons" drop column "number";--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "number" integer GENERATED ALWAYS AS ("seasons"."starts_with_airdrop" + 1) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "airdrop_allocations" ADD CONSTRAINT "airdrop_allocations_address_airdrop_pk" PRIMARY KEY("address","airdrop");--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_starts_with_airdrop_pk" PRIMARY KEY("starts_with_airdrop");--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "starts_with_airdrop" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "airdrop_allocations" ADD CONSTRAINT "airdrop_allocations_airdrop_seasons_starts_with_airdrop_fk" FOREIGN KEY ("airdrop") REFERENCES "public"."seasons"("starts_with_airdrop") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_airdrop" ON "airdrop_allocations" USING btree ("airdrop");--> statement-breakpoint
CREATE INDEX "idx_number" ON "seasons" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_start_date" ON "seasons" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_end_date" ON "seasons" USING btree ("end_date");--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_starts_with_airdrop_unique" UNIQUE("starts_with_airdrop");--> statement-breakpoint
INSERT INTO "seasons" ("starts_with_airdrop", "start_date", "end_date") VALUES (3, '2026-01-13 00:00:00+00', '2026-02-12 00:00:00+00'), (4, '2026-02-12 00:00:00+00', '2026-03-14 00:00:00+00'), (5, '2026-03-14 00:00:00+00', '2026-04-13 00:00:00+00'), (6, '2026-04-13 00:00:00+00', '2026-05-13 00:00:00+00') ON CONFLICT DO NOTHING;--> statement-breakpoint
