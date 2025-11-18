# NFL Baseline Data - Simulation Guide

## Overview

This directory contains real SportsDataIO API responses split chronologically to simulate a live game progression. The data is from game 19068 (MIN @ CHI, Week 1, 2025).

## File Structure

### Game Metadata

- `games.json` - Game metadata (teams, venue, start time)

### Play-by-Play Snapshots

- `19068-0.json` - Pre-game (no plays, game scheduled)
- `19068-1.json` - After kickoff (1 play)
- `19068-2.json` - After first rush (2 plays)
- `19068-3.json` - After pass completion (3 plays)
- `19068-4.json` - Same as 19068-3 (duplicate snapshot for testing)
- `19068-5.json` - After sack (4 plays)
- `19068-full.json` - Complete game (all plays, final score)

## Chronological Progression

### Snapshot 0: Pre-Game

```
Status: Scheduled
IsInProgress: false
Plays: 0
Score: 0-0
```

### Snapshot 1: After Kickoff

```
Status: InProgress
IsInProgress: true
Quarter: 1, Time: 15:00
Current State: MIN 1st & 10 at MIN 25
Plays: 1 (Kickoff)
Score: 0-0
```

**Next Play**: MIN will run their first offensive play

### Snapshot 2: After First Rush

```
Status: InProgress
Quarter: 1, Time: 14:53
Current State: MIN 2nd & 7 at MIN 28
Plays: 2 (Kickoff, Rush +3 yards)
Score: 0-0
```

**Next Play**: MIN 2nd down

### Snapshot 3: After Pass Completion

```
Status: InProgress
Quarter: 1, Time: 14:17
Current State: MIN 3rd & 2 at MIN 33
Plays: 3 (Kickoff, Rush, Pass +5 yards)
Score: 0-0
```

**Next Play**: MIN 3rd down

### Snapshot 4: Duplicate of Snapshot 3

```
Same as Snapshot 3 (for testing idempotency)
```

### Snapshot 5: After Sack

```
Status: InProgress
Quarter: 1, Time: 13:40
Current State: MIN 4th & 3 at MIN 32
Plays: 4 (Kickoff, Rush, Pass, Sack -1 yard)
Score: 0-0
```

**Next Play**: MIN 4th down (likely punt)

### Snapshot Full: Game Complete

```
Status: Final
IsInProgress: false
IsOver: true
Final Score: MIN 27, CHI 24
All plays included
```

## Key Metadata Fields

### Score Object

- **Status**: "Scheduled" → "InProgress" → "Final"
- **IsInProgress**: false → true → false
- **Quarter**: null → "1" → "2" → "3" → "4" → "F"
- **TimeRemaining**: Game clock (e.g., "14:53")
- **Possession**: Team with the ball (e.g., "MIN")
- **Down**: Current down (1-4)
- **Distance**: Yards to first down
- **YardLine**: Field position (0-100)
- **YardLineTerritory**: Which side of field
- **DownAndDistance**: Human-readable (e.g., "2nd & 7")
- **LastUpdated**: Timestamp of this snapshot

### Plays Array

- Contains all plays that have **already happened**
- Each play has `PlayID`, `Sequence`, `Type`, `Description`
- Grows with each snapshot

## Play Types in This Data

**Predictable** (agents can predict):

- `Rush` - Running play
- `PassCompleted` - Completed pass
- `Sack` - QB sacked (treated as pass)

**Non-Predictable** (filtered from predictions):

- `Kickoff` - Special teams
- `Punt` - Special teams
- `FieldGoal` - Special teams
- `Penalty` - Administrative

## Using for Testing

### Sequential Replay

```bash
cd apps/api

# Ingest snapshot 0 (pre-game)
pnpm tsx scripts/nfl-ingestor.ts --file baseline/nfl/plays/19068-0.json

# Ingest snapshot 1 (after kickoff, creates open play for sequence 2)
pnpm tsx scripts/nfl-ingestor.ts --file baseline/nfl/plays/19068-1.json

# Agents predict sequence 2 (first offensive play)
# ...

# Ingest snapshot 2 (resolves sequence 2, creates open play for sequence 3)
pnpm tsx scripts/nfl-ingestor.ts --file baseline/nfl/plays/19068-2.json
```

### Automated Replay

```bash
# Use the loop script to auto-advance through snapshots
pnpm tsx scripts/nfl-replay.ts \
  --dir baseline/nfl/plays \
  --game 19068 \
  --competitionId <uuid> \
  --interval 30000  # 30 seconds between snapshots
```

## Metadata Correctness

Each snapshot's `Score` object represents the **current game state** (what the next play will be):

- ✅ **19068-0.json**: Pre-game, no possession
- ✅ **19068-1.json**: After kickoff, MIN 1st & 10 at 25
- ✅ **19068-2.json**: After rush, MIN 2nd & 7 at 28
- ✅ **19068-3.json**: After pass, MIN 3rd & 2 at 33
- ✅ **19068-4.json**: Same as 19068-3
- ✅ **19068-5.json**: After sack, MIN 4th & 3 at 32

The `Plays` array contains all completed plays up to that point, and the `Score` object describes what's coming next.

## Testing Predictions

With this data, you can test:

1. **Open play creation** - System creates sequence N+1 from Score object
2. **Play resolution** - When next snapshot arrives, sequence N+1 gets resolved
3. **Sequential predictions** - Agents predict plays 2, 3, 4, 5 in order
4. **Scoring** - Calculate accuracy across multiple plays
5. **Non-predictable filtering** - Kickoff doesn't create predictions
