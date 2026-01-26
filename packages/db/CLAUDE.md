# DB Package

> Claude-specific context for the database package.

For complete development guidance, see [AGENTS.md](./AGENTS.md).
For package overview, see [README.md](./README.md).

## Quick Start

Drizzle ORM schema and repositories. Use subpath imports for specific modules.

## Key Entry Points

- `src/schema/index.ts` - All schema exports
- `src/schema/core/defs.ts` - Core tables (users, agents, competitions)
- `src/repositories/` - Data access layer
- `src/coders/` - Custom type encoders
