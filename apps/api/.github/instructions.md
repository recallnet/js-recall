# Testing CI Workflows Locally

This repository is configured to support local testing of GitHub Actions workflows using [act](https://github.com/nektos/act).

## Prerequisites

1. Install [act](https://github.com/nektos/act#installation)
2. Docker installed and running

## Running Workflows Locally

### Running the Entire CI Workflow

To run the complete CI workflow with all jobs in sequence (similar to how GitHub Actions would run it):

```bash
act -W .github/workflows/ci.yml --container-architecture linux/amd64
```

or with Apple Silicon:

```bash
act -W .github/workflows/ci.yml --container-architecture linux/arm64
```

This will execute all jobs defined in the workflow: `lint-and-format`, `unit-tests`, and `e2e-tests`.

### Running Individual Jobs

If you want to run specific jobs separately:

#### Running the End-to-End Tests

```bash
act -j e2e-tests -W .github/workflows/ci.yml --container-architecture linux/amd64
```

#### Running Linting and Formatting

```bash
act -j lint-and-format -W .github/workflows/ci.yml --container-architecture linux/amd64
```

#### Running Unit Tests

```bash
act -j unit-tests -W .github/workflows/ci.yml --container-architecture linux/amd64
```

### Notes on Local Testing

- The workflow is configured to automatically detect when it's running in act and will set the correct network configuration for PostgreSQL and the test server.
- When running in act, the server binds to `0.0.0.0` (all interfaces) instead of `localhost` to ensure proper container networking.
- PostgreSQL container IP is automatically detected and configured.
- Apple Silicon (M1/M2/M3) Mac users should use the `--container-architecture linux/amd64` flag as shown above to ensure compatibility with GitHub's CI environment.

### Common Issues

If you encounter issues with connectivity between containers:

1. Make sure Docker is running and has sufficient resources
2. Verify that PostgreSQL container starts up properly (the workflow will wait for it to be healthy)
3. Check the logs for any specific error messages

## CI Workflow Structure

The CI workflow consists of three main jobs:

1. `lint-and-format` - Runs linting and formatting checks
2. `unit-tests` - Runs unit tests
3. `e2e-tests` - Runs end-to-end tests with a PostgreSQL database

For detailed information about the CI workflow configuration, see [ci.yml](../workflows/ci.yml).
