# NFL Baseline Data

This directory contains real SportsDataIO API responses for simulation and testing.

## Structure

- `plays/19068-{0..5}.json` - Chronological snapshots of game 19068 (MIN @ CHI)
- `plays/19068-full.json` - Complete game with all plays, for reference
- `schedule/2025-0.json` - Schedule sample for the 2025 season

## Data Format

### Plays

Files use the actual SportsDataIO Play-by-Play API response format:

```json
{
  "Score": {
    "GlobalGameID": 19068,
    "GameKey": "202510106",
    "Status": "InProgress",
    "IsInProgress": true,
    "Quarter": "1",
    "TimeRemaining": "14:53",
    "Possession": "MIN",
    "Down": 2,
    "Distance": "7",
    "YardLine": 28,
    "YardLineTerritory": "MIN",
    "DownAndDistance": "2nd & 7",
    ...
  },
  "Quarters": [...],
  "Plays": [...]
}
```

### Schedule

The `schedule/2025-0.json` file uses the actual SportsDataIO Schedule API response format and includes game schedules, including the matching game ID `19068` for the play-by-play data.

```json
{
  "Games": [
    {
      "GlobalGameID": 19068,
      "Season": 2025,
      "Week": 1,
      "Date": "2025-09-08T20:15:00",
      "AwayTeam": "MIN",
      "HomeTeam": "CHI",
      "PointSpread": 1.5,
      "OverUnder": 43.5,
      "City": "Chicago",
      "GameStatus": "Scheduled",
      ...
    }
  ]
}
```

### Chronological Snapshots

- **19068-0.json** - Pre-game (0 plays)
- **19068-1.json** - After kickoff (1 play)
- **19068-2.json** - After first rush (2 plays)
- **19068-3.json** - After pass completion (3 plays)
- **19068-4.json** - Duplicate of snapshot 3 (for testing)
- **19068-5.json** - After sack (4 plays)
- **19068-full.json** - Complete game (all plays)

Each snapshot's `Score` object represents the **current game state** (what the next play will be), and the `Plays` array contains all plays that have already happened.

## Usage

### Automated Play-by-Play Replay

```bash
# Use the loop script to auto-advance through snapshots
pnpm tsx scripts/nfl-mock-server.ts --port 4569
```

Then, call the `/mock/auto-advance/:providerGameId` endpoint to auto-advance through snapshots.

The only game ID we have in the `baseline/nfl/plays` directory is `19068`.

### Manual Play-by-Play Replay

```bash
# Use the loop script to auto-advance through snapshots
pnpm tsx scripts/nfl-mock-server.ts --port 4569
```

Then, call the `/mock/advance/:providerGameId` endpoint to advance to the next snapshot.

## Ingestion Scripts

### Mock Server

You'll need to override the `SPORTSDATAIO_BASE_URL` environment variable to point to the localhost mock server when running the ingestion scripts.

```bash
# Override the SPORTSDATAIO_BASE_URL environment variable
SPORTSDATAIO_BASE_URL=http://localhost:4569
```

#### Play-by-Play Ingestion

```bash
# Use the play-by-play ingestion script to ingest the play-by-play
pnpm tsx scripts/nfl-plays-ingestor.ts --gameId 19068
```

Then, call the `/pbp/json/playbyplay/:providerGameId` endpoint to get the play-by-play.

#### Schedule Ingestion

```bash
# Use the schedule ingestion script to ingest the schedule
pnpm tsx scripts/nfl-schedule-ingestor.ts --season 2025
```

Then, call the `/stats/json/schedules/:season` endpoint to get the schedule.

### Live Replay API

Alternatively, the SportsDataIO API provides a live replay API that can be used to replay the game. This is useful for testing the game replay logic with point-in-time, full progressions instead of the mock server's subset of data.

Visit the [SportsDataIO API developer portal](https://sportsdata.io/developers/replay/nfl-2025-regular-season-week-1-sunday-tuesday) for more information. For example:

- Set up the replay for game `19068` in the 2025 season (at time Sept 8th around 8:15pm ET)
- Configure the `SPORTSDATAIO_API_KEY` environment variable to your SportsDataIO API key
- Also set the `SPORTSDATAIO_BASE_URL` environment variable to include the `replay` subdomain: `https://replay.sportsdata.io/v3/nfl`
- Then, when you run the ingestion scripts, they will pull from the live replay API instead of the mock server. Note the schedule ingestor requires you pass the `--season` argument with `2025reg`.
