# Load Test Package

This package contains load tests for the `apps/api` and `apps/comps` applications using Artillery.

## Usage

To run the load tests, use the following command:

```
pnpm --filter @recallnet/load-test test:leaderboard
```

### Scenarios

- `test:leaderboard`: Tests the leaderboard page with Playwright programmatically.
