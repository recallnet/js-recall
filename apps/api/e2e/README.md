# End-to-End (E2E) Tests for Solana Trading Simulator

This directory contains the end-to-end testing suite for the Solana Trading Simulator. The tests cover the entire application stack from server startup to database interactions and API endpoints.

## Architecture

The E2E testing framework is structured as follows:

```
e2e/
├── jest.config.js         # Jest configuration for E2E tests
├── setup.ts               # Global setup for all tests (runs once)
├── tsconfig.json          # TypeScript configuration for tests
├── tests/                 # Test files
│   ├── admin.test.ts      # Admin functionality tests
│   ├── competition.test.ts # Competition management tests
│   ├── team.test.ts       # Team registration and management tests
│   └── trading.test.ts    # Trading functionality tests
└── utils/                 # Utility functions for tests
    ├── api-client.ts      # API client for making requests
    ├── database.ts        # Database utilities
    ├── server.ts          # Server startup/shutdown utilities
    ├── test-helpers.ts    # Common test helper functions
    └── test-setup.ts      # Setup that runs before each test
```

## Environment Setup

The tests are configured to use a separate `.env.test` file in the project root when running with `NODE_ENV=test`. This allows you to maintain different configuration settings for testing without affecting your development or production environments.

To ensure your tests run with the correct environment:

- Make sure you have a `.env.test` file in the project root
- Run tests with `NODE_ENV=test` prefix, e.g., `NODE_ENV=test npm run test:e2e`
- The test setup will automatically load and use this file

## Required Balance Configuration

For the E2E tests to run successfully, the `.env.test` file must include appropriate initial token balances. The trading tests rely on specific token balances being available to execute trades.

### Minimum Required Balances

The following balance settings should be in your `.env.test` file:

```
# Solana (SVM) balances
INITIAL_SVM_SOL_BALANCE=10
INITIAL_SVM_USDC_BALANCE=5000
INITIAL_SVM_USDT_BALANCE=1000

# Ethereum (EVM) balances
INITIAL_EVM_ETH_BALANCE=1
INITIAL_EVM_USDC_BALANCE=5000
INITIAL_EVM_USDT_BALANCE=1000

# Base-specific balances
INITIAL_BASE_USDC_BALANCE=5000  # Required for base-trades.test.ts
```

Many tests, particularly in `trading.test.ts` and `base-trades.test.ts`, expect these minimum balances to execute trades properly. If the balances are set too low or to zero, the tests may fail with "Insufficient balance" errors.

If you modify these values in the `.env.test` file, you may need to also update the expected values in the test assertions.

> **Note**: The test suite is designed to adapt to the actual balances available. This flexible approach allows tests to pass with different balance configurations, but the values above are recommended for consistent testing behavior.

### Cross-Chain Trading Tests

The cross-chain trading tests depend on the `ALLOW_CROSS_CHAIN_TRADING` environment variable:

```
# Set to true to enable cross-chain trading tests
# Set to false to skip cross-chain trading tests
ALLOW_CROSS_CHAIN_TRADING=false
```

Tests will automatically adapt based on this setting, either executing cross-chain trades or skipping those tests.

## Running Tests

To run the E2E tests:

```bash
npm run test:e2e
```

To run tests in watch mode during development:

```bash
npm run test:e2e:watch
```

## Test Flow

Each test follows a similar pattern:

1. Setup test environment (database, server)
2. Create necessary test data (admin account, teams, competition)
3. Execute the functionality being tested
4. Verify the expected outcomes
5. Clean up test state

## Adding New Tests

When adding new tests:

1. Create a new file in the `tests/` directory
2. Import necessary utilities from the `utils/` directory
3. Structure your tests using Jest's `describe` and `test` functions
4. Clean up any resources created during your tests

## Debugging

For debugging tests, you can:

- Increase the log level in `.env.test`
- Add `console.log` statements
- Use the `await wait(ms)` helper function to pause execution during debugging
