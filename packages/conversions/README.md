# @recallnet/conversions

> Unit conversion utilities for the Recall platform.

## Overview

This package provides conversion utilities, primarily for blockchain token amounts:

- **Atto conversions** - Convert between atto units (10^-18) and standard units

## Installation

```bash
pnpm add @recallnet/conversions
```

## Usage

```typescript
import { fromAtto, toAtto } from "@recallnet/conversions/atto-conversions";

// Convert from atto to standard units
const tokens = fromAtto("1000000000000000000"); // "1"

// Convert to atto units
const atto = toAtto("1.5"); // "1500000000000000000"
```

## API

### `fromAtto(value)`

Convert from atto units (10^-18) to standard decimal representation.

### `toAtto(value)`

Convert from standard decimal to atto units (10^-18).

## Development

```bash
pnpm build            # Build package
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
```

## License

MIT AND Apache-2.0
