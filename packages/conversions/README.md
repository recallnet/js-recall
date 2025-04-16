# @recallnet/conversions

Utility functions for converting between units and converting from units to display strings.

## Features

- Convert between gigabyte-months and credits
- Convert between RECALL tokens and atto-RECALL tokens
- Convert between time units and block numbers
- Format atto-RECALL values for display

## Installation

This package is part of the Recall monorepo and is installed via pnpm workspaces:

```bash
pnpm add @recallnet/conversions
```

## Usage

### Converting Storage Units

```typescript
import {
  attoCreditsToGbMonths,
  gbMonthsToCredits,
} from "@recallnet/conversions";

// Convert 1 GB-month to credits
const credits = gbMonthsToCredits(1);
// Returns: 2592000000000000n (2.592e15)

// Convert credits back to GB-months
const gbMonths = attoCreditsToGbMonths("2592000000000000");
// Returns: 1
```

### Working with RECALL Tokens

```typescript
import {
  attoRecallToRecallDisplay,
  recallToAttoRecall,
} from "@recallnet/conversions";

// Convert 1.5 RECALL to atto-RECALL
const attoRecall = recallToAttoRecall(1.5);
// Returns: 1500000000000000000n

// Format atto-RECALL for display
const display = attoRecallToRecallDisplay("1500000000000000000");
// Returns: "1.5000"
```

### Time and Block Conversions

```typescript
import { hoursToNumBlocks, numBlocksToSeconds } from "@recallnet/conversions";

// Convert 1 hour to blocks
const blocks = hoursToNumBlocks(1);
// Returns: 3600n

// Convert blocks to seconds
const seconds = numBlocksToSeconds(3600);
// Returns: 3600n
```

## API Documentation

For detailed API documentation, please refer to the generated TypeDoc documentation in the `docs` directory.

## Contributing

This package is part of the Recall monorepo. Please refer to the root README for contribution guidelines.

## License

This package is private and part of the Recall network codebase.
