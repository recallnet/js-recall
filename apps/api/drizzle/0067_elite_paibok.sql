INSERT INTO seasons (number, name, start_date, end_date)
	VALUES (1, 'Season 1', '2025-11-15 00:00:00+00', '2025-12-14 00:00:00+00')
	ON CONFLICT DO NOTHING;
--> statement-breakpoint
DO $$
BEGIN
    UPDATE "seasons"
        SET "end_date" = '2025-12-14 00:00:00+00'
        WHERE "id" = 2 AND "number" = 1;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Do nothing on error
END $$;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "start_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "end_date" SET NOT NULL;