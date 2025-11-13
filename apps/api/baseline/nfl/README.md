# NFL Baseline Data

This directory contains baseline NFL game and play data for Phase 0 simulation testing.

## Structure

- `games.json` - Array of game metadata
- `plays/<gameId>.json` - Array of plays for each game

## Game Format

```json
{
  "sportsdataioGameId": "string",
  "startTime": "2025-11-27T17:30:00Z",
  "homeTeam": "DAL",
  "awayTeam": "WAS",
  "venue": "AT&T Stadium"
}
```

## Play Format

```json
{
  "sequence": 1,
  "quarter": 1,
  "clock": "15:00",
  "down": 1,
  "distance": 10,
  "yardLine": 25,
  "offenseTeam": "DAL",
  "defenseTeam": "WAS",
  "lockMs": 5000,
  "actualOutcome": "run"
}
```

## Fields

- `sequence`: Monotonically increasing play number within the game
- `quarter`: Quarter number (1-4)
- `clock`: Time remaining in quarter (mm:ss)
- `down`: Down number (1-4)
- `distance`: Yards to go for first down
- `yardLine`: Field position (0-100)
- `offenseTeam`: Team abbreviation on offense
- `defenseTeam`: Team abbreviation on defense
- `lockMs`: Milliseconds from start before play outcome is revealed
- `actualOutcome`: "run" or "pass"

## Usage

The ingestor script reads these files and replays them into the database:

```bash
cd apps/api
pnpm tsx scripts/nfl-ingestor.ts --dir baseline/nfl --competitionId <uuid> --replaySpeed 1.0 --loop
```
