# Load Test Package

This package contains load tests for Recall using Artillery (HTTP & Playwright engines).

- Documentation: [Artillery HTTP engine](https://www.artillery.io/docs/reference/engines/http)

## Prerequisites

- Node.js ≥ 20, pnpm ≥ 9.12.3
- A `.env` file in this directory (`packages/load-test/.env`) with required variables

## Environment Variables

The following variables are read by the test scripts (from `.env` via `--env-file .env`):

- `API_HOST`: Base URL for API requests used by HTTP scenarios (e.g., `http://localhost:3001`).
- `HOST`: Base URL used by the Playwright scenario target (e.g., `http://localhost:3000`).
- `USERS_COUNT`: Max concurrent virtual users for the Users API load test.
- `AGENTS_COUNT`: Number of agents to create/drive and the max vusers for Agent Trading.
- `TRADES_COUNT`: Number of trades each agent will execute.
- `ADMIN_API_KEY`: Admin API key used only by the Agent Trading setup/trading flows.

Create `.env` in this folder with values appropriate for your environment. Example:

```bash
# API (used by HTTP tests and agent trading)
API_HOST=http://localhost:3000

# Web (used by Playwright test)
HOST=http://localhost:3001

# Concurrency controls
USERS_COUNT=100
AGENTS_COUNT=20
TRADES_COUNT=100

# Admin (required for agent-trading only)
ADMIN_API_KEY=replace-with-admin-key
```

## How to Run Each Load Test

All commands should be run from the monorepo root. Use `--filter` to target this package.

### 1) Users API (public, non-admin HTTP endpoints)

Run the test and generate a report:

```bash
pnpm --filter @recallnet/load-test test:users-api
pnpm --filter @recallnet/load-test report:users-api
```

Artifacts:

- JSON report: `packages/load-test/reports/users-api.json`
- HTML report: `packages/load-test/reports/users-api.html`

### 2) Agent Trading (admin setup + trade execution)

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

### 3) Leaderboard (Playwright UI scenario)

Run the test and generate a report:

```bash
pnpm --filter @recallnet/load-test test:leaderboard
pnpm --filter @recallnet/load-test report:leaderboard
```

Artifacts:

- JSON report: `packages/load-test/reports/leaderboard.json`
- HTML report: `packages/load-test/reports/leaderboard.html`

Notes:

- Ensure `HOST` points to the web app (e.g., `apps/comps`/`apps/portal`).

## What Each Test Does

### Users API (`src/users-api.ts`)

Uses the Artillery HTTP engine against public, non-admin endpoints under `/api/*`.

- Scenarios:
  - `Leaderboard`:
    - GET `/api/leaderboard?limit=10&offset=0&type=trading`
    - GET `/api/leaderboard?limit=10&offset=10&type=trading`
    - GET `/api/leaderboard?limit=10&offset=20&type=trading`
  - `Competitions Hub`:
    - In parallel: GET `/api/leaderboard?limit=25&type=trading`,
      GET `/api/competitions?status=active` (capture first `competitionId`),
      GET `/api/competitions?status=pending` (capture first `competitionId`),
      GET `/api/competitions?status=ended` (capture first `competitionId`).
    - Then, for any captured IDs: GET `/api/competitions/{competitionId}/agents`.
  - `Active Competition`:
    - GET `/api/competitions?status=active` (capture first `competitionId`).
    - GET `/api/competitions/{competitionId}` using the captured ID.

Traffic model (excerpt):

- Warmup: `arrivalCount: 100`
- Load: `arrivalRate: 50`, `maxVusers: ${USERS_COUNT}`

### Agent Trading (`src/agent-trading.ts`)

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

### Leaderboard (Playwright) (`src/leaderboard.ts`)

End-to-end UI flow against the web app:

- Navigate to `/leaderboards`, wait for table to render.
- Click next-page chevron (if present) and wait for responses that include `/leaderboard`.
- Click the first row to navigate to the agent profile page.
- Target is `HOST` from environment.

## Reports

Each `test:*` script creates a JSON report under `reports/`. Use the matching `report:*` script
to convert it into an HTML report for easier analysis.

Example:

```bash
pnpm --filter @recallnet/load-test test:users-api
pnpm --filter @recallnet/load-test report:users-api
open packages/load-test/reports/users-api.html
```

## Tips

- Keep `USERS_COUNT`/`AGENTS_COUNT` sized appropriately for your environment.
- For debugging HTTP requests, you may set `DEBUG=http*` when running Artillery.
- Refer to the OpenAPI spec under `apps/api/openapi/openapi.json` for exact endpoint
  shapes and query parameters used by these scenarios.

## CI/CD

A GitHub Actions workflow is configured to run the `test:agent-trading` and `test:users-api` tests daily at midnight. See [`.github/workflows/load-testing.yml`](../../.github/workflows/load-testing.yml) for details.

The reports are uploaded as artifacts to each workflow run.
