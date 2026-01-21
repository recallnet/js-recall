# AGENTS.md - Test Utils Package

This file provides AI agent guidance specific to the test utilities package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

E2E testing utilities including API client, database management, and mocks.

## Structure

```
src/
├── api-client.ts     # Full API client for testing
├── database.ts       # Database connection
├── db-manager.ts     # Database lifecycle management
├── test-helpers.ts   # Common test patterns
├── server.ts         # Server utilities
├── privy.ts          # Privy auth mocking
├── mock-servers/     # Mock external services
├── types.ts          # Type definitions
└── index.ts          # Main exports
```

## Key Patterns

- **API client**: Typed methods matching API endpoints
- **Database cleanup**: Automatic cleanup between tests
- **Mock services**: Mock external dependencies for isolated tests
- **Factory functions**: Create test fixtures consistently

## Development Commands

```bash
pnpm build            # Build package
```

## Key File Locations

- API client: `src/api-client.ts`
- DB management: `src/db-manager.ts`
- Test helpers: `src/test-helpers.ts`
- Mocks: `src/mock-servers/`

## Usage in Tests

```typescript
import { DatabaseManager, TestApiClient } from "@recallnet/test-utils";

beforeAll(async () => {
  db = await DatabaseManager.setup();
});

afterAll(async () => {
  await DatabaseManager.cleanup();
});
```
