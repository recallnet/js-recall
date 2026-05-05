INSERT INTO "seasons" ("starts_with_airdrop", "name", "start_date", "end_date") 
    VALUES
    (7, 'Season 8', '2026-05-13 00:00:00+00', '2026-06-12 00:00:00+00'),
    (8, 'Season 9', '2026-06-12 00:00:00+00', '2026-07-12 00:00:00+00'),
    (9, 'Season 10', '2026-07-12 00:00:00+00', '2026-08-11 00:00:00+00'),
    (10, 'Season 11', '2026-08-11 00:00:00+00', '2026-09-10 00:00:00+00')
    ON CONFLICT DO NOTHING;
--> statement-breakpoint