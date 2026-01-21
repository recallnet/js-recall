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
import { calculateRewards, validateRewardConfig } from "@recallnet/rewards";

const rewards = calculateRewards({
  totalPool: 10000,
  participants: rankings,
  tierConfig: config,
});
```

## API

### `calculateRewards(config)`

Calculate reward distribution for a set of participants.

### `validateRewardConfig(config)`

Validate a reward configuration.

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
