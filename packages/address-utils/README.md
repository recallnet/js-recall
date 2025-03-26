# @recallnet/address-utils

A utility package for formatting and displaying Ethereum addresses in a user-friendly way.

## Installation

This package is private and can only be installed within the Recall monorepo:

```bash
pnpm add @recallnet/address-utils@workspace:*
```

## Usage

The package provides utilities for formatting Ethereum addresses:

```typescript
import { displayAddress } from '@recallnet/address-utils/display';

// Basic usage (shows first 4 and last 4 characters)
displayAddress("0x1234567890abcdef1234567890abcdef12345678");
// Returns: "0x12…5678"

// Custom number of characters
displayAddress("0x1234567890abcdef1234567890abcdef12345678", { numChars: 6 });
// Returns: "0x1234…345678"

// Custom separator
displayAddress("0x1234567890abcdef1234567890abcdef12345678", { separator: "..." });
// Returns: "0x12...5678"
```

## API Documentation

For detailed API documentation, you can:

1. Build the documentation locally:
   ```bash
   pnpm docs:build
   ```

2. View the documentation in your browser:
   ```bash
   pnpm docs:serve
   ```

The documentation will be available in the `docs` directory after building.

## Development

To contribute to this package:

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start development mode:
   ```bash
   pnpm dev
   ```

3. Build the package:
   ```bash
   pnpm build
   ```

4. Run linting:
   ```bash
   pnpm lint
   ```

## License

MIT AND Apache-2.0