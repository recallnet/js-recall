# @recallnet/test-utils

> Test utilities and helpers for E2E testing.

## Overview

This package provides testing infrastructure for the Recall platform:

- **API client** - Typed client for API testing
- **Database utilities** - Test database setup and cleanup
- **Mock servers** - Mock external services
- **Test helpers** - Common test patterns and fixtures

## Installation

```bash
pnpm add @recallnet/test-utils --save-dev
```

## Usage

```typescript
import {
  DatabaseManager,
  TestApiClient,
  TestHelpers,
} from "@recallnet/test-utils";

// Create test API client
const client = new TestApiClient(baseUrl, apiKey);

// Setup test database
const dbManager = new DatabaseManager();
await dbManager.setup();

// Use test helpers
const agent = await TestHelpers.createTestAgent(db);
```

## Features

### API Client

Full-featured API client with authentication:

```typescript
const client = new TestApiClient(url, apiKey);
await client.getBalances();
await client.executeTrade(trade);
```

### Database Management

Test database lifecycle:

```typescript
const db = new DatabaseManager();
await db.setup();
await db.cleanup();
```

### Mock Servers

Mock external services:

```typescript
import { MockPrivyServer } from "@recallnet/test-utils";
```

## Development

```bash
pnpm build            # Build package
```

## License

MIT AND Apache-2.0
