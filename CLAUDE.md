# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

**Development:**

- `pnpm dev` - Start all apps in development mode (uses turbo with 20 concurrency)
- `pnpm build` - Build all packages and applications
- `pnpm lint` - Run ESLint across monorepo (must pass before commit)
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting (CI requirement)
- `pnpm clean` - Clean all build artifacts and node_modules

**Testing:**

- API: `pnpm --filter api test` - Unit tests
- API: `pnpm --filter api test:e2e` - E2E tests

**Database (API app only):**

- `pnpm --filter api db:migrate` - Run database migrations
- `pnpm --filter api db:studio` - Open Drizzle Studio
- `pnpm --filter api db:seed` - Seed development database
- `pnpm --filter api db:reset` - Clean and re-migrate database

**Documentation:**

- `pnpm docs:build` - Generate TypeDoc documentation
- `pnpm docs:check` - Validate TSDoc coverage (99% target required)

## Architecture Overview

**Monorepo Structure:**

- `apps/api/` - Multi-chain trading simulator API (Node.js/Express + PostgreSQL)
- `apps/comps/` - Competitions web app (Next.js)
- `apps/portal/` - Main web application (Next.js)
- `apps/faucet/` - Token faucet app (Next.js)
- `apps/registration/` - Registration site (Next.js)
- `packages/` - Shared libraries, utilities, and toolkits
  - `db-schema/` - Drizzle database schema definitions organized by domain

**Technology Stack:**

- **Language:** TypeScript (required)
- **Package Manager:** pnpm 9.12.3+
- **Build System:** Turborepo
- **Node.js:** >=20
- **Database:** PostgreSQL with Drizzle ORM (API)
- **Web Framework:** Next.js with App Router

## API Service Architecture

**Layered Architecture (MVC pattern):**

- `src/routes/` - Express route definitions
- `src/controllers/` - Request/response handling with Zod validation
- `src/middleware/` - Auth, logging, rate limiting, error handling
- `src/services/` - Business logic and external service integration
- `src/database/repositories/` - Data access layer with Drizzle ORM

**Key Services:**

- Multi-chain price tracking (DexScreener, Jupiter, Raydium providers)
- Competition management and scheduling
- Portfolio snapshots and performance tracking
- Agent authentication via API keys
- Rate limiting and request logging

**Authentication:** Bearer token system with agent API keys

## Key Development Patterns

**API Response Format:**
All API endpoints return consistent format with `success`, `data`, and `error` fields.

**Database Access:**
Use repository pattern - never write raw SQL in controllers or services. All database operations go through repositories in `src/database/repositories/`.

**Multi-Chain Support:**
The system supports EVM chains (Ethereum, Polygon, Base, Arbitrum, Optimism) and SVM (Solana). Chain-specific logic is handled in provider services.

**Error Handling:**
Use centralized error handling middleware. Services throw specific error types that get mapped to appropriate HTTP status codes.

## Testing Requirements

**API Testing:**

- Unit tests for all services and utilities
- E2E tests for complete user flows (located in `e2e/tests/`)
- All E2E tests run sequentially with database cleanup between tests
- Test database is automatically managed by test setup

**Quality Gates:**
Code must pass all of these before merge:

1. ESLint validation (`pnpm lint`)
2. Prettier formatting (`pnpm format:check`)
3. TypeScript compilation (`pnpm build`)
4. TSDoc coverage validation (`pnpm docs:check`)

## Package Development

**Shared Packages:**

- `@recallnet/api-sdk` - Auto-generated API client
- `@recallnet/agent-toolkit` - AI agent integration tools
- `@recallnet/ui` - Shared React components (shadcn/ui based)
- `@recallnet/chains` - Chain configuration and utilities

**Agent Development:**
Agent toolkits support multiple AI frameworks (OpenAI, LangChain, AI SDK, MCP). Use existing patterns in `packages/agent-toolkit/src/` when extending.

## Environment Setup

**Required Environment Variables (API):**

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for rate limiting
- `ROOT_ENCRYPTION_KEY` - For encrypting sensitive data
- Various chain-specific RPC URLs and API keys

**Optional but Recommended:**

- `NODE_ENV=development` for local development
- `TEST_MODE=true` for testing environments

## Common Issues

**Database Migrations:**
Always run `pnpm --filter api db:migrate` after pulling changes that include new migration files in `apps/api/drizzle/`.

**Cache Issues:**
If experiencing build issues, run `pnpm clean` to remove all build artifacts and node_modules.

**Test Database:**
E2E tests manage their own database state. If tests are failing due to database issues, check that `DATABASE_URL` points to a test database, not production.
