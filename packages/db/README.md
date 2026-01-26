# @recallnet/db

> Drizzle ORM schema definitions and data access repositories.

## Overview

This package provides the database layer for the Recall platform:

- **Schema definitions** - Drizzle ORM table definitions organized by domain
- **Repositories** - Data access layer with typed queries
- **Coders** - Custom data type encoders/decoders
- **Utilities** - Database helper functions

## Installation

```bash
pnpm add @recallnet/db
```

## Usage

### Importing Repositories

```typescript
import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
```

### Importing Schema

```typescript
import { agents, competitions, trades } from "@recallnet/db/schema";
```

### Importing Types

```typescript
import type { Agent, Competition } from "@recallnet/db/schema/core/types";
```

## Schema Organization

Schemas are organized by domain in `src/schema/`:

| Domain      | Description                   |
| ----------- | ----------------------------- |
| `core/`     | Users, agents, competitions   |
| `trading/`  | Trades, balances, prices      |
| `rewards/`  | Reward allocations and claims |
| `ranking/`  | Leaderboards and scores       |
| `sports/`   | Sports prediction games       |
| `indexing/` | Blockchain indexing events    |
| `airdrop/`  | Airdrop configurations        |
| `boost/`    | Boost multipliers             |
| `eigenai/`  | EigenAI integrations          |

## Repository Pattern

Repositories encapsulate database access:

```typescript
const agentRepo = new AgentRepository(db);
const agent = await agentRepo.findById(agentId);
```

## Development

```bash
pnpm build            # Build package
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests
pnpm docs:build       # Generate documentation
```

## License

MIT AND Apache-2.0
