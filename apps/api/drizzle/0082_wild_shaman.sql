INSERT INTO "seasons" ("starts_with_airdrop", "name", "start_date", "end_date")
    VALUES
    (11, 'Season 12', '2026-09-10 00:00:00+00', '2026-10-10 00:00:00+00'),
    (12, 'Season 13', '2026-10-10 00:00:00+00', '2026-11-09 00:00:00+00'),
    (13, 'Season 14', '2026-11-09 00:00:00+00', '2026-12-09 00:00:00+00'),
    (14, 'Season 15', '2026-12-09 00:00:00+00', '2027-01-08 00:00:00+00')
    ON CONFLICT DO NOTHING;
--> statement-breakpoint
