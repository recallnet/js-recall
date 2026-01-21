# @recallnet/rewards

> Rewards calculation system for the Recall platform.

## Overview

This package provides reward calculation logic for competitions:

- **Tier calculations** - Determine reward tiers based on rankings
- **Distribution formulas** - Calculate reward amounts per tier
- **Validation** - Verify reward configurations

## Installation

```bash
pnpm add @recallnet/rewards
```

## Usage

```typescript
import {
  calculateRewardsForCompetitors,
  calculateRewardsForUsers,
} from "@recallnet/rewards";

// Calculate rewards for users based on their boost allocations
const userRewards = calculateRewardsForUsers(
  prizePool, // bigint - Total prize pool in WEI
  boostAllocations, // BoostAllocation[] - User boost allocations
  leaderBoard, // Leaderboard - Competition rankings
  window, // BoostAllocationWindow - Time window for allocations
);

// Calculate rewards for competitors based on rankings
const competitorRewards = calculateRewardsForCompetitors(
  prizePool, // bigint - Total prize pool in WEI
  leaderBoard, // Leaderboard - Competition rankings
);
```

## API

### `calculateRewardsForUsers(prizePool, boostAllocations, leaderBoard, window, prizePoolDecayRate?, boostTimeDecayRate?, hook?)`

Calculate reward distribution for users based on their boost allocations to competitors.

### `calculateRewardsForCompetitors(prizePool, leaderBoard, prizePoolDecayRate?, hook?)`

Calculate reward distribution directly to competitors based on leaderboard rankings.

## Development

```bash
pnpm build            # Build package
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
pnpm verify           # Verify reward calculations
pnpm generate         # Generate reward data
```

## License

MIT AND Apache-2.0
