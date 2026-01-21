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
import {
  attoValueToNumberValue,
  attoValueToStringValue,
  valueToAttoBigInt,
  valueToAttoString,
} from "@recallnet/conversions/atto-conversions";

// Convert from atto to standard units (string)
const tokenStr = attoValueToStringValue("1000000000000000000"); // "1"

// Convert from atto to standard units (number)
const tokenNum = attoValueToNumberValue("1500000000000000000"); // 1.5

// Convert to atto units (string)
const attoStr = valueToAttoString("1.5"); // "1500000000000000000"

// Convert to atto units (bigint)
const attoBigInt = valueToAttoBigInt("1.5"); // 1500000000000000000n
```

## API

### `attoValueToStringValue(attoValue, rounding?, decimals?)`

Convert from atto units (10^-18) to standard decimal string representation.

### `attoValueToNumberValue(attoValue, rounding?, decimals?)`

Convert from atto units (10^-18) to standard decimal number.

### `valueToAttoString(value)`

Convert from standard decimal to atto units as a string.

### `valueToAttoBigInt(value)`

Convert from standard decimal to atto units as a bigint.

## Development

```bash
pnpm build            # Build package
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
```

## License

MIT AND Apache-2.0
