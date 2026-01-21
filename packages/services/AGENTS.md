# AGENTS.md - Services Package

This file provides AI agent guidance specific to the services package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Business logic services for competitions, trading, pricing, and rewards.

## Structure

```
src/
├── *.service.ts      # Service classes
├── providers/        # Price data providers
├── lib/              # Shared utilities
├── types/            # Type definitions
├── indexing/         # Blockchain indexing
└── __tests__/        # Unit tests
```

## Key Services

- `competition.service.ts` - Competition lifecycle (largest service)
- `agent.service.ts` - Agent management
- `trade-simulator.service.ts` - Trade execution
- `price-tracker.service.ts` - Price fetching
- `rewards.service.ts` - Reward calculations

## Key Patterns

- **Service classes**: Stateless, depend on repositories
- **Dependency injection**: Services receive dependencies via constructor
- **Error handling**: Use `neverthrow` Result types
- **Providers**: Price data abstraction layer in `providers/`

## Adding a New Service

1. Create `src/{name}.service.ts`
2. Follow existing patterns (constructor DI, typed methods)
3. Add tests in `src/__tests__/`
4. Export from `src/index.ts`

## Development Commands

```bash
pnpm build            # Build package
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests
pnpm docs:check       # Validate TSDoc coverage
```

## Key File Locations

- Services: `src/*.service.ts`
- Price providers: `src/providers/`
- Types: `src/types/`
- Tests: `src/__tests__/`

## Dependencies

- `@recallnet/db` - Database repositories
- `@recallnet/rewards` - Reward calculations
- `@recallnet/conversions` - Unit conversions
