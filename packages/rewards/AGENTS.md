# AGENTS.md - Rewards Package

This file provides AI agent guidance specific to the rewards package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Reward calculation logic for competition prize distribution.

## Structure

```
src/
├── index.ts          # Main exports and calculations
├── helpers.ts        # Calculation helpers
├── types.ts          # Type definitions
├── index.test.ts     # Tests
└── helpers.test.ts   # Helper tests
```

## Key Patterns

- **Pure functions**: All calculations are pure functions
- **Decimal precision**: Uses `decimal.js-light` for accurate math
- **Validation**: Input validation with Zod schemas
- **Testable**: High test coverage for all calculations

## Development Commands

```bash
pnpm build            # Build package
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
pnpm verify           # Verify reward calculations
```

## Key File Locations

- Calculations: `src/index.ts`
- Helpers: `src/helpers.ts`
- Types: `src/types.ts`
