# AGENTS.md - DB Package

This file provides AI agent guidance specific to the database package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Drizzle ORM schema definitions and data access repositories for the Recall platform.

## Structure

```
src/
├── schema/           # Drizzle table definitions by domain
│   ├── core/         # Users, agents, competitions
│   ├── trading/      # Trades, balances, prices
│   ├── rewards/      # Reward allocations
│   ├── ranking/      # Leaderboards, scores
│   └── ...           # Other domains
├── repositories/     # Data access layer
├── coders/           # Custom type encoders/decoders
├── utils/            # Database utilities
└── types.ts          # Shared type definitions
```

## Key Patterns

- **Schema by domain**: Tables are grouped logically (core, trading, rewards, etc.)
- **Repository pattern**: All database access through repository classes
- **Type exports**: Each schema domain exports types via `**/types.ts`
- **Relations**: Defined in `**/relations.ts` files

## Adding a New Table

1. Create schema in appropriate domain: `src/schema/{domain}/defs.ts`
2. Add types: `src/schema/{domain}/types.ts`
3. Add relations if needed: `src/schema/{domain}/relations.ts`
4. Export from `src/schema/index.ts`
5. Create repository: `src/repositories/{name}.ts`
6. Add export to `package.json` exports

## Adding a New Repository

1. Create file: `src/repositories/{name}.ts`
2. Follow existing patterns (constructor takes db instance)
3. Add export path to `package.json`

## Development Commands

```bash
pnpm build            # Build package
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests
pnpm docs:check       # Validate TSDoc coverage
```

## Key File Locations

- Schema definitions: `src/schema/*/defs.ts`
- Type definitions: `src/schema/*/types.ts`
- Repositories: `src/repositories/*.ts`
- Custom coders: `src/coders/`
