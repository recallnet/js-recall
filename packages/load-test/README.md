# Agent Trading Load Test Package

This package contains load tests for Recall Agent Trading using Artillery HTTP engine.

- Documentation: [Artillery HTTP engine](https://www.artillery.io/docs/reference/engines/http)

## Prerequisites

- Node.js ≥ 20, pnpm ≥ 9.12.3
- A `.env` file in this directory (`packages/load-test/.env`) with required variables

## Environment Variables

The following variables are read by the test scripts (from `.env` via `--env-file .env`):

- `API_HOST`: Base URL for API requests (e.g., `http://localhost:3000`).
- `AGENTS_COUNT`: Number of agents to create/drive and the max vusers for Agent Trading.
- `TRADES_COUNT`: Number of trades each agent will execute.
- `ADMIN_API_KEY`: Admin API key used for agent trading setup/trading flows.

Create `.env` in this folder with values appropriate for your environment. Example:

```bash
# API (used by agent trading tests)
API_HOST=http://localhost:3000

# Agent trading controls
AGENTS_COUNT=20
TRADES_COUNT=100

# Admin (required for agent-trading)
ADMIN_API_KEY=replace-with-admin-key
```

## How to Run Agent Trading Load Test

All commands should be run from the monorepo root. Use `--filter` to target this package.

### Agent Trading (admin setup + trade execution)

Run the test and generate a report:

```bash
pnpm --filter @recallnet/load-test test:agent-trading
pnpm --filter @recallnet/load-test report:agent-trading
```

Artifacts:

- JSON report: `packages/load-test/reports/agent-trading.json`
- HTML report: `packages/load-test/reports/agent-trading.html`

Notes:

- Requires `ADMIN_API_KEY` and a reachable `API_HOST`.
- Uses an Artillery processor to prepare agents and competitions.

## Project Structure

```
src/
└── agent-trading/           # Agent trading load tests
    ├── agent-trading.ts     # Main test configuration
    └── processors/          # Test processors
        └── agent-trading-processor.ts
```

Future load test types can be added as separate subdirectories under `src/` (e.g., `src/user-api/`, `src/leaderboard/`, etc.).

## What The Test Does

### Agent Trading (`src/agent-trading/agent-trading.ts`)

Uses admin endpoints to create or recycle a competition, generate `AGENTS_COUNT` users & agents,
register them into a competition, start it, and then simulate trading for each agent.

- Setup (`before` flow):
  - GET `/api/competitions/status` (admin auth) and end any active competition.
  - POST `/api/admin/competition/create` (admin auth) and capture `competitionId`.
  - Loop `AGENTS_COUNT` times:
    - POST `/api/admin/users` to create a user & agent (admin auth).
    - POST `/api/admin/competitions/{competitionId}/agents/{agentId}` to register.
  - POST `/api/admin/competition/start` (admin auth).
- Trading (`scenarios`):
  - Each of the `AGENTS_COUNT` agents executes `TRADES_COUNT` trades. A trade consists of fetching balances and then executing a buy/sell POST request to `/api/trade/execute`.
- Traffic model: `arrivalCount: ${AGENTS_COUNT}`, `maxVusers: ${AGENTS_COUNT}`.

## Trade Strategy

The load test includes sophisticated rebalancing logic between USDC and WETH with realistic trading patterns.

## Reports

The `test:agent-trading` script creates a JSON report under `reports/`. Use the `report:agent-trading` script
to convert it into an HTML report for easier analysis.

Example:

```bash
pnpm --filter @recallnet/load-test test:agent-trading
pnpm --filter @recallnet/load-test report:agent-trading
open packages/load-test/reports/agent-trading.html
```

## Tips

- Keep `AGENTS_COUNT` sized appropriately for your environment.
- For debugging HTTP requests, you may set `DEBUG=http*` when running Artillery.
- Refer to the OpenAPI spec under `apps/api/openapi/openapi.json` for exact endpoint
  shapes and query parameters used by these scenarios.

## CI/CD

A GitHub Actions workflow is configured to run the `test:agent-trading` test. The reports are uploaded as artifacts to each workflow run.
