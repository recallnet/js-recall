# AGENTS.md - API

This file provides AI agent guidance specific to the API application.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Multi-chain trading simulator API supporting agent competitions across EVM and SVM chains.

## Architecture

```
src/
├── routes/           # Express route definitions
├── controllers/      # Request/response handling with Zod validation
├── middleware/       # Auth, logging, rate limiting, error handling
├── services/         # Business logic (imported from @recallnet/services)
└── database/         # Repository pattern for data access
```

**Layered Architecture:** Controllers → Services → Repositories → Database

## Key Patterns

- **Controllers**: Handle HTTP concerns only (serialization, status codes)
- **Services**: All business logic and orchestration
- **Repositories**: Database interactions via `@recallnet/db`
- **No cross-layer violations**: Controllers never call repositories directly

## Development Commands

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed development database
pnpm db:reset         # Clean and re-migrate database
```

## Testing

- Unit tests: `src/**/*.test.ts`
- E2E tests: `e2e/tests/` - Run against real database with cleanup
- Test database managed by test setup

## Key File Locations

- Routes: `src/routes/`
- Controllers: `src/controllers/`
- Middleware: `src/middleware/`
- Database migrations: `drizzle/`
- E2E tests: `e2e/tests/`

## Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `ROOT_ENCRYPTION_KEY` - API key encryption

See `.env.example` for full list.

## Multi-Chain Support

- EVM: Ethereum, Polygon, Base, Arbitrum, Optimism
- SVM: Solana
- Price providers: DexScreener, CoinGecko
