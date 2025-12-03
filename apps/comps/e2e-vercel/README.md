# E2E Tests for Vercel Deployment

This directory contains end-to-end tests designed to run against the deployed Comps application (either Vercel or other environments).

## Overview

These tests validate the Trading API endpoints exposed by the Comps application, specifically focusing on admin operations for agent management.

## Structure

```
e2e-vercel/
├── setup.ts              # Global test setup and teardown
├── utils/
│   └── test-setup.ts     # Per-test setup and teardown
└── tests/
    └── admin.test.ts     # Admin API tests for agent creation
```

## Running Tests

### Locally

To run the tests against your local development server:

```bash
# Start the dev server first
pnpm dev

# In another terminal, run the tests
pnpm test:e2e-vercel
```

### Against Deployed Environment

To run tests against a deployed environment (e.g., Vercel):

```bash
# Set the API base URL
export NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app

# Run the tests
pnpm test:e2e-vercel
```

## Configuration

The tests require the following environment variables:

- `NEXT_PUBLIC_API_BASE_URL`: The base URL of the API to test (defaults to `http://localhost:3001`)
- Admin API key must be configured in the database

## Test Coverage

### Admin Agent Creation (`admin.test.ts`)

Tests the `/api/trading/admin/agents` endpoint:

- ✅ Create agent with all fields
- ✅ Create agent with minimal fields
- ✅ Reject creation without authentication
- ✅ Reject creation with invalid wallet address
- ✅ Reject creation without required fields
- ✅ Reject creation for non-existent user

## Adding New Tests

1. Create a new test file in `tests/`
2. Import test utilities from `@recallnet/test-utils`
3. Use the `baseUrl` from environment or default to localhost
4. Follow the existing patterns for authentication and assertions

Example:

```typescript
import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { getAdminApiKey } from "@recallnet/test-utils";

describe("My New Test", () => {
  let adminApiKey: string;
  let baseUrl: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
  });

  test("should do something", async () => {
    const response = await axios.get(`${baseUrl}/api/trading/some-endpoint`, {
      headers: {
        Authorization: `Bearer ${adminApiKey}`,
      },
    });

    expect(response.status).toBe(200);
  });
});
```

## Notes

- These tests are configured to run sequentially (not in parallel) to avoid race conditions
- Test timeout is set to 120 seconds to accommodate network latency
- The tests use the same test utilities as the API e2e tests for consistency
