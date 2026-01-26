# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Distributed Documentation

This repository uses a three-tier documentation structure:

- **README.md** - Human-focused project overview and usage documentation
- **AGENTS.md** - AI agent guidance (tool-agnostic patterns and commands)
- **CLAUDE.md** - Claude-specific context that points to AGENTS.md

Each app and package has its own documentation files for detailed context:

| Location                      | Purpose                                |
| ----------------------------- | -------------------------------------- |
| `apps/api/`                   | Multi-chain trading simulator API      |
| `apps/comps/`                 | Competitions web application (Next.js) |
| `packages/db/`                | Database schema and repositories       |
| `packages/services/`          | Business logic services                |
| `packages/rewards/`           | Rewards calculation system             |
| `packages/conversions/`       | Unit conversion utilities              |
| `packages/test-utils/`        | E2E test utilities                     |
| `packages/ui2/`               | UI component library (shadcn/ui)       |
| `packages/staking-contracts/` | Staking contract interfaces            |
| `packages/eslint-config/`     | Shared ESLint configuration            |
| `packages/typescript-config/` | Shared TypeScript configuration        |
| `packages/fonts/`             | Shared font resources                  |
| `packages/load-test/`         | Load testing suite                     |

When working in a specific area, check for local AGENTS.md files for detailed context.

## Agent Workflow Requirements

When working as an AI agent in this repo, follow these practices:

### 1. Plan Before Implementation

- Create explicit plans or task breakdowns before editing code
- Read existing code and TSDoc before making changes
- Use the TodoWrite tool to track multi-step tasks

### 2. Commit Frequently

- Make small, focused commits after each logical change
- Never bypass pre-commit hooks with `--no-verify`
- Fix issues reported by hooks before committing

### 3. Verify Before Claiming Completion

Before marking work as complete, ensure:

```bash
pnpm lint           # ESLint passes
pnpm build          # TypeScript compiles
pnpm --filter api test  # Tests pass (when applicable)
```

### 4. TDD for Bug Fixes

When fixing bugs, always use Test-Driven Development:

1. Write a failing test that reproduces the bug
2. Verify the test fails before any code changes
3. Fix the bug with minimal code changes
4. Verify the test passes after the fix

### 5. Prefer Detection Over Direct Fixes

When a bug is found:

1. First identify why it escaped detection (missing tests, weak validation)
2. Add or strengthen the detection system (tests, lint rules, runtime checks)
3. Only fix the bug after the detection system is in place

## Code Philosophy

### Database-First Architecture

We believe in leveraging PostgreSQL's power rather than reimplementing logic in application code. This means:

- Complex calculations happen in SQL, not JavaScript
- Aggregations use database functions (`SUM()`, `AVG()`, `COUNT()`), not array methods
- Sorting happens in SQL (`ORDER BY`), not JavaScript `.sort()`
- Use `DISTINCT ON` with proper indexes for latest-record queries
- Data consistency is enforced by database constraints, not application validation alone
- Performance optimization starts with proper indexes and query design
- Never fetch all records to filter/aggregate in memory - use SQL WHERE/GROUP BY/HAVING clauses

### Type Safety Without Compromise

- **Zero tolerance for `any` types** in production code
- All functions must have explicit return types (never rely on inference)
- Prefer named types/interfaces over inline type definitions
- All external data must be validated at runtime using type guards or Zod schemas
- Database types must be properly typed in TypeScript
- Prefer compile-time safety over runtime assertions when possible

### Performance Through Design

- Every list endpoint must support pagination (no unlimited queries)
- Caching decisions require human review (consider platform caching like Vercel first)
- Every query must have appropriate indexes
- Avoid situations where the number of database queries scales linearly (e.g. fetching a list then making separate queries per item). Use joins or batch fetching instead

### Testing as Documentation

- Tests demonstrate intended behavior better than comments
- Tests cover edge cases explicitly, not just happy paths
- Tests use realistic data scenarios, not contrived examples
- Test names clearly describe what is being tested and why
- **Test Coverage**: See `coverage.config.json` for current thresholds
  - Coverage requirements vary by package
  - New packages start with higher coverage requirements
  - All new critical path code needs tests regardless of package thresholds

### Clean Architecture Principles

- **Controllers**: Handle HTTP concerns only (serialization, deserialization, status codes)
- **Services**: Contain all business logic and orchestration
- **Repositories**: Manage database interactions exclusively
- **No cross-layer violations**: Controllers never call repositories directly

### Code Reuse Over Duplication

- Search for existing functionality before implementing new features
- Document why existing solutions don't work when creating alternatives
- **When implementing a replacement**: Remove the old implementation in the same PR
- Remove dead code immediately upon discovery
- Deprecate properly with migration paths

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
- `packages/` - Shared libraries, utilities, and toolkits
  - `db/` - Drizzle database schema definitions and data access repositories organized by domain

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

**Serialization and business logic separation:**
Use controller pattern: Controllers should handle serialization and deserialization of arguments and responses, but should not include business logic, and should generally be kept thin and simple, and should never call into the repository layer directly. The controller layer should call into the service layer which contains all business logic, and which in turn should call into the repository layer for database interactions.

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

- `@recallnet/ui2` - Modern UI components (shadcn/ui based)
- `@recallnet/address-utils` - Address manipulation utilities
- `@recallnet/db` - Database schema definitions and data access repositories
- `@recallnet/fonts` - Shared font resources
- `@recallnet/staking-contracts` - Staking contract interfaces

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

## Additional Rules and Standards

This repository includes comprehensive coding standards and practices defined in `.cursor/rules/`:

- **General Practices:** Core coding philosophy, documentation standards, and agent workflow patterns ([`.cursor/rules/org-general-practices.mdc`](./.cursor/rules/org-general-practices.mdc))
- **TypeScript Standards:** Type safety, TSDoc requirements, testing patterns, and performance guidelines ([`.cursor/rules/org-typescript-standards.mdc`](./.cursor/rules/org-typescript-standards.mdc))
- **Repository Configuration:** Monorepo structure, quality gates, and project-specific tooling ([`.cursor/rules/repo-specific-config.mdc`](./.cursor/rules/repo-specific-config.mdc))
- **API Standards:** Database patterns, authentication, testing, and service architecture for `apps/api` ([`.cursor/rules/api-specific-config.mdc`](./.cursor/rules/api-specific-config.mdc))

These rules provide detailed guidance on code quality, security practices, testing requirements, and architectural patterns that complement the essential commands and overview above.

## Critical Documentation Rule

**NEVER use temporal or comparative language in code comments or TSDoc**. This is crucial because:

- Comments like "new optimized method" or "replaces old implementation" become misleading over time
- Future AI reviewers lack the historical context to understand what "new" or "old" means
- Implementation details like "avoids N+1" or "atomic operation" belong in commit messages, not code

**Instead of:** "Optimized method that efficiently fetches users avoiding N+1 queries"  
**Write:** "Fetches users with their associated posts in a single query"

Always describe WHAT the code does, never HOW it compares to other code or WHY it's better.

## Working with AI Coding Agents

### Key Principles

1. **Be Explicit About Context**: AI agents work best when given clear context about the current task, existing patterns, and constraints.

2. **Leverage Existing Patterns**: Always point AI agents to existing implementations of similar features in the codebase.

3. **Validate Generated Code**:

   - Check for `any` types
   - Verify database queries are optimized
   - Ensure proper error handling
   - Confirm test coverage

4. **Iterative Refinement**: Use AI agents for initial implementation, then refine based on:
   - Linting results
   - Type checking
   - Test failures
   - Performance profiling

### Best Practices for Prompting

1. **Reference Specific Files**: Point to exact file paths and line numbers when discussing code.

2. **Include Error Messages**: Provide complete error messages and stack traces.

3. **Specify Requirements Clearly**:

   - Performance requirements (response times, throughput)
   - Type safety requirements
   - Testing requirements
   - Documentation needs

4. **Request Explanations**: Ask AI agents to explain trade-offs and design decisions.

## Critical Rules Summary

### Never Do These

- ❌ Use `any` type (use proper type guards or generics)
- ❌ Fetch all records then filter in memory (use SQL WHERE clauses)
- ❌ Create unbounded queries (always use LIMIT)
- ❌ Mix authentication patterns (stick to one per endpoint)
- ❌ Log sensitive data (passwords, API keys, PII)
- ❌ Skip tests for critical paths (auth, payments, trading)
- ❌ Implement caching without human review (always discuss caching strategy first)
- ❌ Leave both old and new implementations when refactoring (remove replaced code immediately)
- ❌ Use temporal/comparative words in comments ("new", "optimized", "replaces", "efficient")

### Always Do These

- ✅ Use TypeScript strict mode
- ✅ Specify explicit return types for all functions
- ✅ Create named types/interfaces instead of inline type definitions
- ✅ Add indexes for foreign keys and WHERE clause columns
- ✅ Validate environment variables on startup
- ✅ Use structured JSON logging with request IDs
- ✅ Document breaking changes in PR descriptions
- ✅ Run linter and tests before marking tasks complete
- ✅ Push computation to the database (aggregations, sorting, filtering)
- ✅ Use atomic operations to prevent race conditions
- ✅ Sample high-volume logging and monitoring events (e.g., 1-10%)
- ✅ Mask sensitive data in logs (wallet addresses, API keys)
- ✅ Write comments that describe WHAT code does, not HOW it's better than before

## Quick Reference

### File Locations

- API Routes: `apps/api/src/routes/`
- Controllers: `apps/api/src/controllers/`
- Services: `apps/api/src/services/`
- Repositories: `apps/api/src/database/repositories/`
- DB Schemas: `packages/db/src/`
- Frontend Components: `apps/comps/components/`

## Project-Specific Notes for AI Agents

When working with AI agents on this project:

1. The project uses pnpm workspaces - be aware of package boundaries
2. Database changes require migration generation (`pnpm --filter api db:gen-migrations`)
3. TSDoc coverage requirements vary by package (see `coverage.config.json`)
4. E2E tests run against a real database - ensure proper cleanup
5. Metrics are exposed via Prometheus on port 3003 - alerting is handled externally
6. Sentry is configured for error tracking with 10% sampling in production
