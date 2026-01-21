# AGENTS.md - Conversions Package

This file provides AI agent guidance specific to the conversions package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Unit conversion utilities, primarily for blockchain token amounts.

## Structure

```
src/
├── atto-conversions.ts   # Atto unit conversions
└── __test__/             # Tests
```

## Key Patterns

- **Pure functions**: All conversions are pure
- **Precision**: Uses `dnum` library for precise decimal math
- **No floating point**: String-based to avoid precision loss

## Development Commands

```bash
pnpm build            # Build package
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
```

## Key File Locations

- Conversions: `src/atto-conversions.ts`
- Tests: `src/__test__/`
