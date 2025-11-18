# NFL Baseline Data

This directory contains real SportsDataIO API responses for simulation and testing.

## Structure

- `games.json` - Game metadata
- `plays/19068-{0..5}.json` - Chronological snapshots of game 19068 (MIN @ CHI)
- `plays/19068-full.json` - Complete game with all plays
- `SIMULATION_GUIDE.md` - Detailed guide on using the data

## Data Format

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

## Chronological Snapshots

- **19068-0.json** - Pre-game (0 plays)
- **19068-1.json** - After kickoff (1 play)
- **19068-2.json** - After first rush (2 plays)
- **19068-3.json** - After pass completion (3 plays)
- **19068-4.json** - Duplicate of snapshot 3 (for testing)
- **19068-5.json** - After sack (4 plays)
- **19068-full.json** - Complete game (all plays)

Each snapshot's `Score` object represents the **current game state** (what the next play will be), and the `Plays` array contains all plays that have already happened.

## Usage

### Live Ingestor (Production)

```bash
cd apps/api
export SPORTSDATAIO_API_KEY=your_key

# Ingest live game with 3-second polling
pnpm tsx scripts/nfl-plays-ingestor.ts \
  --globalGameId 19068 \
  --competitionId <uuid> \
  --pollInterval 3000
```

### Baseline Ingestor (Testing)

```bash
cd apps/api

# Replay baseline data with loop mode
pnpm tsx scripts/nfl-ingestor.ts \
  --dir baseline/nfl \
  --competitionId <uuid> \
  --replaySpeed 10.0 \
  --loop
```

See `SIMULATION_GUIDE.md` for detailed testing scenarios.
