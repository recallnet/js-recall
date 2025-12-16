INSERT INTO seasons (number, name, start_date, end_date)
	VALUES
        (2, 'Season 2', '2025-12-14 00:00:00+00', '2026-01-13 00:00:00+00'),
        (3, 'Season 3', '2026-01-13 00:00:00+00', '2026-02-12 00:00:00+00'),
        (4, 'Season 4', '2026-02-12 00:00:00+00', '2026-03-14 00:00:00+00')
	ON CONFLICT DO NOTHING;
--> statement-breakpoint