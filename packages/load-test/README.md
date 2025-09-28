# Load Testing Suite for RecallNet Platform

Comprehensive load testing suite for the RecallNet agent trading platform using Artillery.

## Overview

This package provides a professional load testing infrastructure with unified parameterized testing and specialized test profiles designed to evaluate:

- **Scalability**: How the system performs under increasing load
- **Stability**: System resilience and error recovery
- **Performance**: Response times and throughput under various conditions

## Quick Start

```bash
# Install dependencies (from monorepo root)
pnpm install

# Copy environment configuration
cp packages/load-test/.env.example packages/load-test/.env
# Edit .env with your API_HOST and ADMIN_API_KEY

# Navigate to load test directory
cd packages/load-test

# Run baseline test (8 req/s, 60 seconds, 5 agents)
npx tsx src/cli.ts baseline

# Generate analysis report for latest test
pnpm analyze:latest
```

## Test Profiles

### Baseline Test (60 seconds)

Quick validation test using stress.yml with default parameters.

```bash
npx tsx src/cli.ts baseline
```

**Parameters:** 8 req/s, 60 seconds, $0.10 trades, 5 agents

### Parameterized Stress Testing

Flexible load testing with custom parameters using the unified stress.yml config.

```bash
npx tsx src/cli.ts stress
# Or with custom parameters:
npx tsx src/cli.ts stress --rate 32 --duration 300 --trade-amount 0.1 --agents 10
```

**Examples:**

- 30-minute test: `tsx src/cli.ts stress -d 1800 -r 16`
- 2-hour endurance: `tsx src/cli.ts stress -d 7200 -r 8`
- High stress: `tsx src/cli.ts stress -d 300 -r 32 -a 10`

### Specialized Test Profiles

#### TGE Simulation

Simulates Token Generation Event with extreme burst patterns.

```bash
npx tsx src/cli.ts tge
```

**Behavior Patterns:**

- FOMO buyers (40%): Aggressive accumulation
- Whale traders (20%): Large volume trades
- Catchup traders (30%): Late joiners
- Panic sellers (10%): Rapid exits

#### Resilience Testing

Tests error handling and recovery with intentional failures.

```bash
npx tsx src/cli.ts resilience
```

**Chaos Engineering Scenarios:**

- Normal trading (50%)
- Overdraw attempts (20%)
- Malformed requests (15%)
- Rate limit testing (15%)

#### Daily Traffic Pattern

Simulates typical daily trading patterns for regression detection.

```bash
npx tsx src/cli.ts daily
```

**Realistic patterns:** Morning ramp → Peak hours → Lunch dip → Afternoon → Evening decline

## Architecture

### Directory Structure

```
src/
├── agent-trading/
│   ├── configs/           # Test configurations
│   │   ├── stress.yml     # Unified baseline + parameterized config
│   │   ├── tge.yml        # TGE burst simulation
│   │   ├── resilience.yml # Chaos engineering
│   │   └── daily.yml      # Daily traffic patterns
│   ├── processors/        # Artillery processor
│   │   └── agent-trading-processor.ts
│   └── utils/            # Utility modules
│       ├── user-generator.ts
│       ├── competition-utils.ts
│       ├── trade-patterns.ts
│       └── error-patterns.ts
├── cli.ts                # Command-line interface
```

### CLI Usage

```bash
tsx src/cli.ts [profile] [options]

Profiles:
  baseline       Baseline test (8 req/s, 1 min) - uses defaults from stress.yml
  stress         Parameterized stress test (use -r/-d/-t options)
  tge            TGE burst simulation
  resilience     Error injection and resilience test
  daily          Daily monitoring test

Options:
  -d, --duration N      Test duration in seconds (for stress profile)
  -r, --rate N          Request rate per second (for stress profile)
  -t, --trade-amount N  Trade amount in dollars (for stress profile)
  -a, --agents N        Number of agents (default: 5)
  --report              Save timestamped report
  -n, --no-report       Don't save report file
```

### Processor Functions

The consolidated processor (`agent-trading-processor.ts`) provides:

**Setup Functions:**

- `generateRandomUserAndAgent()`: Creates test users/agents
- `setCompetitionPayload()`: Configures competitions
- `extractUserAndAgentInfo()`: Captures API keys
- `selectRandomAgent()`: Round-robin agent selection

**Trading Patterns:**

- `normalTrade()`: Standard rebalancing ($0.10 minimum)
- `tgeFomoTrade()`: FOMO buying pattern ($0.10 minimum)
- `whaleTrade()`: Large volume trades ($0.10 minimum)
- `catchupTrade()`: Aggressive late entry ($0.10 minimum)
- `panicSell()`: Rapid exit pattern

**Error Testing:**

- `overdrawnTrade()`: Insufficient balance attempts
- `malformedTrade()`: Invalid request formats
- `disallowedCrossChainTrade()`: Cross-chain when disabled

**Monitoring:**

- `healthCheck()`: Balance checks without trading
- `trackLoadTestMetrics()`: Sentry performance tracking

## Configuration

### Environment Variables

Required variables in `.env`:

```bash
# API endpoint for load testing
API_HOST=https://api-load-test.your-domain.com

# Admin API key for competition/agent creation
ADMIN_API_KEY=your_admin_key_here

# Optional: Sentry error tracking
SENTRY_DSN=your_sentry_dsn_here
```

### Competition Setup

All tests automatically:

1. Check for existing active competitions
2. End any active competition
3. Create a new competition with appropriate settings
4. Create and register the specified number of agents
5. Start the competition
6. Begin test scenarios

## Reports

Tests generate JSON reports with timestamps:

```bash
# View available reports
ls reports/

# Generate analysis report from latest JSON
pnpm analyze:latest

# Analysis generates markdown output to console
# JSON reports are available for external tools
```

## Performance Baselines

Expected performance for healthy system:

| Metric             | Baseline | Acceptable | Warning  |
| ------------------ | -------- | ---------- | -------- |
| P50 Response Time  | < 200ms  | < 300ms    | > 500ms  |
| P95 Response Time  | < 500ms  | < 1000ms   | > 2000ms |
| P99 Response Time  | < 1000ms | < 2000ms   | > 5000ms |
| Error Rate         | 0%       | < 1%       | > 5%     |
| Throughput (req/s) | > 100    | > 50       | < 50     |

## GitHub Actions Integration

Simplified workflow with direct parameter inputs:

- **Daily scheduled run**: Baseline test at midnight
- **Manual dispatch**: Custom duration, rate, trade amount, agent count
- **Smart defaults**: 8 req/s, 60s duration, $0.10 trades, 5 agents
- **Report artifacts**: Automatic HTML/JSON report uploads

## Troubleshooting

### Common Issues

**Insufficient balance errors:**

- Trade amounts optimized to $0.10 minimum
- Tests run sustainably without balance exhaustion
- Agent balances reset between competition cycles

**403 Forbidden on trades:**

- Ensure competition `tradingType` is set to `"allow"`
- Verify agents are registered to the active competition
- Check that competition is in "active" status

**429 Rate Limiting:**

- Expected during burst phases
- Monitor frequency to ensure rate limits are appropriate
- Consider implementing backoff in production agents

### Debug Mode

Enable verbose logging:

```bash
DEBUG=http* npx tsx src/cli.ts baseline
```

## Development

### Adding New Test Patterns

1. Add new trading pattern to `utils/trade-patterns.ts`
2. Export function from `processors/agent-trading-processor.ts`
3. Create new config in `configs/` referencing the function
4. Add profile to `cli.ts` profiles object

### Creating Custom Tests

Use the parameterized stress profile for custom scenarios:

```bash
# Custom burst test
tsx src/cli.ts stress --rate 50 --duration 120 --agents 20

# Custom endurance test
tsx src/cli.ts stress --rate 5 --duration 14400 --agents 3
```

## Best Practices

1. **Start small**: Run baseline test first
2. **Monitor resources**: Watch CPU/memory during tests
3. **Incremental testing**: Use parameterized stress for gradual load increases
4. **Clean state**: Tests handle competition cleanup automatically
5. **Report analysis**: Always review HTML reports for patterns
6. **Sustainable testing**: $0.10 trade amounts prevent balance issues

## Support

For issues or questions:

- Check existing issues in the repository
- Review API documentation at `/apps/api/openapi/openapi.json`
- Ensure environment variables are correctly configured
