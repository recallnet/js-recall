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

# Run default stress test (8 req/s, 60 seconds, 5 agents)
npx tsx src/cli.ts stress
# Displays Sentry traces link after completion (if configured)

# Generate analysis report for latest test
pnpm analyze:latest
```

## Test Profiles

The load testing suite contains **4 distinct test profiles**, each designed to validate different aspects of system behavior under various traffic patterns.

### Common Structure (All Profiles)

All test profiles follow the same basic structure:

#### Setup Phase (before:)

1. **Competition Management**:
   - Check for existing active competition
   - End active competition if exists
   - Create new competition for test isolation

2. **Agent Creation**:
   - Create N agents (configurable via `AGENTS_COUNT`)
   - Each agent gets: user account, wallet, profile, and API key
   - Register all agents to the competition

3. **Competition Start**:
   - Start competition to enable trading
   - All agents now active and ready

#### Test Execution (scenarios:)

Each virtual user (VU) executes a scenario that typically includes:

- `GET /api/agent/balances` - Check current holdings
- `POST /api/trade/execute` - Execute a trade
- Sentry instrumentation for observability

#### Teardown (after:)

- Flush Sentry spans for complete observability
- Competition remains active for post-test analysis

---

### 1. Stress Test

**Goal**: Find system capacity limits through sustained load at configurable rates.

```bash
# Default (8 req/s for 60 seconds)
npx tsx src/cli.ts stress

# Custom parameters
npx tsx src/cli.ts stress --rate 16 --duration 1800 --agents 20
```

#### Structure

**Single parameterized phase**:

- Duration: Configurable via `--duration` (default: 60s)
- Rate: Configurable via `--rate` (default: 8 req/s)
- Trade Amount: Configurable via `--trade-amount` (default: $0.10)
- Agents: Configurable via `--agents` (default: 5)

**Scenarios**:

- `test-trading` (100%): Simple GET balances → POST trade flow

#### Use Cases

✅ **Capacity planning** - "Can we handle 32 req/s?"
✅ **Performance baseline** - "What's our P95 at normal load?"
✅ **Breaking point discovery** - "Where does the system fail?"
✅ **Regression testing** - "Did this change affect performance?"

#### Examples

```bash
# Quick smoke test
npx tsx src/cli.ts stress

# Production-like load (30 min)
npx tsx src/cli.ts stress --rate 16 --duration 1800 --agents 20

# Find breaking point
npx tsx src/cli.ts stress --rate 32 --duration 1800 --agents 20

# 2-hour endurance test
npx tsx src/cli.ts stress --rate 8 --duration 7200 --agents 10
```

#### Key Characteristics

- **Parameterized**: Fully controllable via CLI
- **Consistent**: Steady load throughout test
- **Simple**: Single scenario type for clear interpretation
- **Flexible**: Suitable for wide range of load levels

---

### 2. TGE Burst Test

**Goal**: Simulate Token Generation Event - extreme burst traffic like a new token launch.

```bash
npx tsx src/cli.ts tge
```

#### Structure

**5-phase progression** simulating launch day:

| Phase         | Duration | Rate          | Description       |
| ------------- | -------- | ------------- | ----------------- |
| Pre-launch    | 60s      | 5 req/s       | Calm before storm |
| TGE Launch    | 10s      | **100 req/s** | Massive spike!    |
| FOMO Phase    | 300s     | 50 req/s      | Sustained FOMO    |
| Stabilization | 120s     | 30 req/s      | Cooling down      |
| Cooldown      | 60s      | 10 req/s      | Return to normal  |

**Total duration**: 9 minutes, 10 seconds

**Scenarios** (weighted to simulate trader types):

- `fomo-buyers` (40%): Aggressive accumulation, 0.5s think time
- `whale-traders` (20%): Large volume trades, 1s think time
- `catchup-traders` (30%): Late joiners, 0.8s think time
- `panic-sellers` (10%): Emotional selling, 0.3s think time

**Default Config**:

- Agents: 200
- Peak load: 100 req/s (1000+ concurrent during burst)
- Trade patterns: Scenario-specific (FOMO vs whale vs panic)

#### Use Cases

✅ **Launch readiness** - "Can we survive a token launch?"
✅ **Burst capacity** - "What happens at 100 req/s for 10 seconds?"
✅ **Circuit breaker validation** - "Do rate limits protect us?"
✅ **Recovery testing** - "Does system stabilize after spike?"

#### Key Characteristics

- **Fixed phases**: Not parameterizable (designed for specific pattern)
- **Burst pattern**: 20x spike from baseline to peak
- **Multi-scenario**: Different trader behaviors weighted realistically
- **Short duration**: Quick validation (9 min) vs long endurance

#### What to Expect

- **Normal**: Some failures during 100 req/s burst (10s window)
- **Success criteria**: System recovers after burst, no cascading failures
- **Watch for**: Circuit breaker triggers, queue buildup, memory spikes

---

### 3. Resilience Test

**Goal**: Chaos engineering - validate system handles errors, edge cases, and malicious inputs gracefully.

```bash
npx tsx src/cli.ts resilience
```

#### Structure

**4-phase error injection**:

| Phase           | Duration      | Rate     | Description     |
| --------------- | ------------- | -------- | --------------- |
| Normal          | 300s (5 min)  | 5 req/s  | Baseline        |
| Mixed Load      | 600s (10 min) | 10 req/s | Scale up        |
| Error Injection | 600s (10 min) | 15 req/s | Inject chaos    |
| Recovery        | 300s (5 min)  | 5 req/s  | Verify recovery |

**Total duration**: 30 minutes

**Scenarios** (weighted to inject errors):

- `normal-trading` (50%): Valid trades (control group)
- `overdraw-attempts` (20%): Try to spend more than balance
- `malformed-requests` (15%): Invalid JSON, missing fields
- `rate-limit-test` (15%): 10 rapid trades in loop (intentional throttling)

**Default Config**:

- Agents: 50
- Peak load: 15 req/s
- Error injection: 50% of requests are intentionally invalid

#### Use Cases

✅ **Error handling** - "Do we return proper 400s?"
✅ **Validation logic** - "Can malformed requests crash us?"
✅ **Rate limiting** - "Does throttling work correctly?"
✅ **System stability** - "Do errors cause cascading failures?"
✅ **Recovery** - "Does system return to normal after chaos?"

#### Key Characteristics

- **Fixed phases**: 30-minute structured test
- **Error-focused**: 50% of traffic is intentionally problematic
- **Multi-scenario**: Each scenario tests different failure mode
- **Recovery validation**: Final phase verifies system stabilizes

#### What to Expect

- **Normal**: High 4xx error rate (intentional)
- **Success criteria**: No 5xx errors, proper 4xx responses, system doesn't crash
- **Watch for**: Memory leaks from error handling, cascading failures

---

### 4. Daily Monitoring Test

**Goal**: Production health check - simulate realistic daily traffic patterns for continuous monitoring.

```bash
npx tsx src/cli.ts daily
```

#### Structure

**5-phase daily cycle** (compressed to 30 min):

| Phase     | Duration | Rate             | Description      |
| --------- | -------- | ---------------- | ---------------- |
| Morning   | 5 min    | Ramp 1→6 req/s   | Users waking up  |
| Peak      | 10 min   | Ramp 6→10 req/s  | High activity    |
| Lunch     | 5 min    | 4 req/s (steady) | Reduced activity |
| Afternoon | 5 min    | 8 req/s (steady) | Busy again       |
| Evening   | 5 min    | Ramp 8→2 req/s   | Winding down     |

**Total duration**: 30 minutes (simulates 24-hour pattern)

**Scenarios**:

- `regular-trading` (70%): Normal GET balances → POST trade
- `monitoring` (30%): Health checks (GET balances only, no trades)

**Default Config**:

- Agents: 30
- Peak load: 10 req/s
- Trade patterns: 70% trades, 30% monitoring

#### Use Cases

✅ **Daily smoke test** - "Is production healthy today?"
✅ **Deployment validation** - "Did new deploy break anything?"
✅ **Performance trends** - "Are we degrading over time?"
✅ **Alerting validation** - "Do our monitors catch issues?"

#### Key Characteristics

- **Fixed phases**: Simulates realistic daily pattern
- **Gradual ramps**: Uses `rampTo` for smooth transitions
- **Monitoring focus**: 30% of traffic is non-trading (balance checks)
- **Moderate load**: Never exceeds 10 req/s (safe for prod)

#### What to Expect

- **Normal**: Zero failures, P95 < 300ms consistently
- **Success criteria**: All phases pass, no degradation over time
- **Watch for**: Memory growth, latency creep during peaks

---

### Comparison Matrix

| Profile        | Duration                   | Max Rate                 | Agents                   | Pattern         | Goal                 |
| -------------- | -------------------------- | ------------------------ | ------------------------ | --------------- | -------------------- |
| **Stress**     | Configurable (default 60s) | Configurable (default 8) | Configurable (default 5) | Sustained flat  | Find capacity limits |
| **TGE**        | 9 min 10s                  | 100 req/s (burst)        | 200                      | Burst spike     | Launch readiness     |
| **Resilience** | 30 min                     | 15 req/s                 | 50                       | Error injection | Chaos engineering    |
| **Daily**      | 30 min                     | 10 req/s                 | 30                       | Daily cycle     | Production health    |

---

### When to Use Each Profile

#### Before Deployment

1. **Stress test** at expected production load → Must pass
2. **Resilience test** to validate error handling → Must handle errors gracefully
3. **Daily test** to establish baseline → Capture metrics

#### After Deployment

1. **Daily test** (continuous monitoring) → Run hourly or daily
2. **Stress test** if performance concerns → Diagnose regressions

#### Before Major Launch

1. **TGE test** to prepare for spike → Must survive burst
2. **Stress test** at 2x expected load → Capacity headroom

#### During Investigation

1. **Stress test** to reproduce issues → Isolate problems
2. Vary `--rate` to find breaking point → Capacity planning

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
  stress         Parameterized stress test (default: 8 req/s, 60s, 5 agents)
  tge            TGE burst simulation (200 agents, multi-phase)
  resilience     Error injection and resilience test (50 agents, 30 min)
  daily          Daily monitoring test (30 agents, 30 min)

Options:
  -d, --duration N           Test duration in seconds (stress only, default: 60)
  -r, --rate N               Request rate per second (stress only, default: 8)
  -t, --trade-amount N       Trade amount in dollars (stress only, default: 0.1)
  -a, --agents N             Number of agents (default: profile-specific)
  --traces-sample-rate N     Sentry SDK traces sample rate 0.0-1.0 (default: 0.01)
  --request-sample-rate N    Sentry request span sample rate 0.0-1.0 (default: 0.01)
  -n, --no-report            Don't save report file
  -h, --help                 Show help
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

**Monitoring & Metrics:**

- `startTestMetrics()`: Initialize test-level metrics
- `startSetupPhase()`: Track setup phase start
- `finishSetupPhase()`: Record setup duration and metadata
- `trackScenarioExecution()`: Track scenario execution counts
- `startTradeFlow()`: Begin trade flow timing
- `finishTradeFlow()`: Complete trade flow with success/failure tracking
- `trackLoadTestMetrics()`: HTTP request performance tracking
- `cleanupSentry()`: Flush spans before process exit
- `healthCheck()`: Balance checks without trading

## Configuration

### Environment Variables

Required variables in `.env`:

```bash
# API endpoint for load testing
API_HOST=https://api-load-test.your-domain.com

# Admin API key for competition/agent creation
ADMIN_API_KEY=your_admin_key_here

# Optional: Sentry observability
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your_sentry_org_here       # For generating traces explorer links
SENTRY_PROJECT_ID=your_project_id     # For generating traces explorer links
SENTRY_TRACES_SAMPLE_RATE=0.01        # SDK auto-instrumentation sampling (default: 1%)
SENTRY_SAMPLE_REQUEST=0.01            # Custom span sampling (default: 1%)

# Optional: Test configuration overrides (CLI flags take precedence)
TEST_DURATION=60                       # Test duration in seconds
REQUEST_RATE=8                         # Requests per second
TRADE_AMOUNT=0.1                       # Trade amount in dollars
TEST_PROFILE=stress                    # Test profile name for tagging
```

### Sentry Observability

The load test suite integrates with Sentry for real-time observability and metrics tracking.

**Automatic Test Run Tracking:**

Each test run generates a unique test run ID (e.g., `stress-20250930-102812`) and displays a Sentry traces explorer link after completion:

```bash
$ npx tsx src/cli.ts stress

✓ Test completed successfully!

📊 View results in Sentry:
   https://recallnet.sentry.io/explore/traces/?environment=perf-testing&project=...&query=test_run_id%3Astress-20250930-102812
```

**Searchable Span Attributes:**

All HTTP request spans include searchable attributes:

- `test_run_id` - Unique identifier for this specific test run
- `load_test.agent_id` - Specific agent performing the request
- `load_test.duration_seconds` - Test duration configuration
- `load_test.request_rate` - Configured request rate
- `load_test.trade_amount` - Trade amount per transaction
- `load_test.setup.competition_id` - Competition ID for the test run
- `test_profile` - Test profile name (stress, tge, daily, etc.)
- `environment` - API host being tested
- `agents_count` - Number of agents in the test
- `http.method`, `http.url`, `http.status_code` - Request details

**Query Examples in Sentry:**

```
# Find spans from specific test run
test_run_id:stress-20250930-102812

# Find all load test spans
has:load_test.agent_id

# Find spans from specific test profile
test_profile:stress

# Find spans from specific competition
load_test.setup.competition_id:YOUR_COMPETITION_ID

# Find high-latency requests
http.response_time_ms:>1000

# Find errors by agent
load_test.agent_id:YOUR_AGENT_ID http.status_code:>=400
```

**Sampling Configuration:**

Control sampling rates via environment variables or CLI flags:

- `SENTRY_TRACES_SAMPLE_RATE` / `--traces-sample-rate`: SDK auto-instrumentation (default 1%)
- `SENTRY_SAMPLE_REQUEST` / `--request-sample-rate`: Custom span sampling (default 1%)
- Set to `1.0` for 100% sampling during debugging
- CLI flags override environment variables
- Errors are always captured regardless of sampling rate

```bash
# 100% sampling for debugging
tsx src/cli.ts stress --request-sample-rate 1.0

# 10% sampling for production monitoring
tsx src/cli.ts stress --rate 16 --duration 1800 --request-sample-rate 0.1
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

Tests generate JSON reports with timestamps in `reports/` directory.

### Single Report Analysis

```bash
# Analyze latest report
pnpm analyze:latest

# Analyze specific report
pnpm analyze reports/stress-20250930-102812.json

# Compare against baseline
pnpm analyze reports/new.json reports/stress-baseline.json
```

### Consolidated Trend Analysis

Consolidate multiple reports of the **same test type** for trend analysis:

```bash
# Consolidate all stress test reports
pnpm analyze:consolidate reports/stress-*.json

# Consolidate last 5 reports (shell command)
tsx src/agent-trading/report-analyzer.ts --consolidate $(ls -t reports/stress-*.json | head -5)
```

**Consolidated reports include:**

- Trend indicators (↑ Degrading / → Stable / ↓ Improving)
- Best/worst run identification
- Statistical analysis (min/max/avg/stddev)
- Side-by-side metrics comparison table
- Actionable recommendations based on trends and variance
- Individual run details with pass/fail status

**Type safety:** Consolidation will error if you try to mix different test types (e.g., baseline + stress).

Output: `reports/consolidated-{profile}-{date}.md`

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

- **Daily scheduled run**: Stress test at midnight (8 req/s, 60s)
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

Enable full Sentry span sampling for debugging:

```bash
npx tsx src/cli.ts stress --request-sample-rate 1.0 --traces-sample-rate 1.0
```

This captures 100% of HTTP requests and traces, useful for debugging specific issues.

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

# Debug test with 100% Sentry sampling
tsx src/cli.ts stress --request-sample-rate 1.0 --traces-sample-rate 1.0
```

## Best Practices

1. **Start small**: Run default stress test first (8 req/s for 60s)
2. **Monitor resources**: Watch CPU/memory during tests
3. **Incremental testing**: Use parameterized stress for gradual load increases
4. **Clean state**: Tests handle competition cleanup automatically
5. **Report analysis**: Always review reports for patterns
6. **Sustainable testing**: $0.10 trade amounts prevent balance issues
7. **Sentry monitoring**: Enable traces for debugging, use lower sampling for production
8. **Profile selection**: Use stress for capacity, TGE for burst, resilience for chaos, daily for monitoring

## Support

For issues or questions:

- Check existing issues in the repository
- Review API documentation at `/apps/api/openapi/openapi.json`
- Ensure environment variables are correctly configured
