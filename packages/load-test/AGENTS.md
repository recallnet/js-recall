# AGENTS.md - Load Test Package

This file provides AI agent guidance specific to the load testing package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

Load testing suite using Artillery for the trading platform.

## Test Profiles

| Profile      | Description                                         |
| ------------ | --------------------------------------------------- |
| `stress`     | Sustained load testing (configurable rate/duration) |
| `tge`        | Token Generation Event burst simulation             |
| `resilience` | Chaos engineering with error injection              |
| `daily`      | Daily monitoring pattern                            |

## Usage

```bash
# Run stress test
npx tsx src/cli.ts stress

# Custom parameters
npx tsx src/cli.ts stress --rate 16 --duration 1800 --agents 20

# TGE burst simulation
npx tsx src/cli.ts tge

# Analyze results
pnpm analyze:latest
```

## Structure

```
src/
├── cli.ts                    # CLI entry point
├── agent-trading/
│   ├── configs/              # Artillery configurations
│   ├── processors/           # Artillery processors
│   └── utils/                # Utilities
```

## Key Patterns

- **Parameterized tests**: CLI flags override config
- **Sentry integration**: Observability and tracing
- **Report analysis**: Post-test report generation

## Development Commands

```bash
npx tsx src/cli.ts stress     # Run stress test
pnpm analyze:latest           # Analyze latest report
pnpm analyze:consolidate      # Consolidate multiple reports
```

## Environment Variables

Required:

- `API_HOST` - API endpoint for testing
- `ADMIN_API_KEY` - Admin API key

Optional:

- `SENTRY_DSN` - Sentry observability
- `SENTRY_ORG`, `SENTRY_PROJECT_ID` - Trace links
