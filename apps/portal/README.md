# Recall Portal

The main web application for the Recall Network ecosystem.

## Installation

The portal app is part of the js-recall monorepo. To install dependencies:

```bash
pnpm install
```

## Usage

### Development

To start the development server:

```bash
# From root directory
pnpm dev

# Or specifically for the portal app
pnpm --filter portal dev
```

### Build

To build the app:

```bash
# From root directory
pnpm build

# Or specifically for the portal app
pnpm --filter portal build
```

### Documentation

The Portal app uses TypeDoc for API documentation. To generate documentation:

```bash
# Check documentation coverage
pnpm --filter portal docs:check

# Build documentation
pnpm --filter portal docs:build

# Watch documentation (auto-rebuild on changes)
pnpm --filter portal docs:watch

# Serve documentation locally
pnpm --filter portal docs:serve
```

## Architecture

The Portal app is built using Next.js with the following structure:

- `lib/` - Utility functions and shared code
- `types/` - TypeScript type definitions
- `components/` - React components
- `app/` - Next.js app router pages

## Environment Variables

The app requires the following environment variables:

- `NEXT_PUBLIC_CHAIN_NAME` - The name of the blockchain network to connect to
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Project ID for WalletConnect

## License

MIT AND Apache-2.0