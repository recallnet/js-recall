#!/usr/bin/env tsx
/**
 * Load Test Runner
 * Simplifies running Artillery load tests with environment variables
 */
import { spawn } from "child_process";
import * as dotenv from "dotenv";
import * as fs from "fs";

interface TestProfile {
  config: string;
  name: string;
  defaultAgents: string;
}

interface Options {
  profile: string;
  saveReport: boolean;
  envFile: string;
  agents: string;
  duration?: string;
  requestRate?: string;
  tradeAmount?: string;
  tracesSampleRate?: string;
  requestSampleRate?: string;
}

// Load environment variables from .env file
function loadEnv(envFile = ".env"): void {
  const result = dotenv.config({ path: envFile });
  if (result.error) {
    console.error(`⚠ Warning: ${envFile} not found`);
  } else {
    console.log(`✓ Loaded environment from ${envFile}`);
  }
}

// Test profiles configuration
const profiles: Record<string, TestProfile> = {
  stress: {
    config: "src/agent-trading/configs/stress.yml",
    name: "Stress Test",
    defaultAgents: "5",
  },
  tge: {
    config: "src/agent-trading/configs/tge.yml",
    name: "TGE Burst Test",
    defaultAgents: "200",
  },
  resilience: {
    config: "src/agent-trading/configs/resilience.yml",
    name: "Resilience Test",
    defaultAgents: "50",
  },
  daily: {
    config: "src/agent-trading/configs/daily.yml",
    name: "Daily Monitoring Test",
    defaultAgents: "30",
  },
};

// Parse command line arguments
function parseArgs(): Options {
  const args = process.argv.slice(2);
  let profile = "stress";
  let agentsOverride: string | undefined;

  // First pass: determine profile
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    // Check for profile names
    if (arg in profiles) {
      profile = arg;
      break;
    }
  }

  const options: Options = {
    profile,
    saveReport: true,
    envFile: ".env",
    agents: process.env.AGENTS_COUNT || profiles[profile]?.defaultAgents || "5",
  };

  // Second pass: parse all arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    // Check for profile names
    if (arg in profiles) {
      const selectedProfile = profiles[arg];
      options.profile = arg;
      // Update agent count with profile default if not explicitly set via CLI
      if (!agentsOverride && selectedProfile) {
        options.agents =
          process.env.AGENTS_COUNT || selectedProfile.defaultAgents;
      }
      continue;
    }

    // Check for flags
    switch (arg) {
      case "-h":
      case "--help":
        showHelp();
        process.exit(0);
        break;
      case "-n":
      case "--no-report":
        options.saveReport = false;
        break;
      case "-e":
      case "--env":
        if (args[i + 1]) {
          options.envFile = args[++i]!;
        }
        break;
      case "-a":
      case "--agents":
        if (args[i + 1]) {
          options.agents = args[++i]!;
          agentsOverride = options.agents; // Mark as explicitly set
        }
        break;
      case "--report":
        options.saveReport = true;
        break;
      case "-d":
      case "--duration":
        if (args[i + 1]) {
          options.duration = args[++i]!;
        }
        break;
      case "-r":
      case "--rate":
        if (args[i + 1]) {
          options.requestRate = args[++i]!;
        }
        break;
      case "-t":
      case "--trade-amount":
        if (args[i + 1]) {
          options.tradeAmount = args[++i]!;
        }
        break;
      case "--traces-sample-rate":
        if (args[i + 1]) {
          options.tracesSampleRate = args[++i]!;
        }
        break;
      case "--request-sample-rate":
        if (args[i + 1]) {
          options.requestSampleRate = args[++i]!;
        }
        break;
      default:
        if (!arg.startsWith("-")) {
          options.profile = arg;
        }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Load Test Runner

Usage: tsx run.ts [profile] [options]
       npm run test [profile] [options]
       pnpm test [profile] [options]

Profiles:
  stress         Parameterized stress test (default: 8 req/s, 60s, $0.10)
  tge            TGE burst simulation (200 agents, multi-phase)
  resilience     Error injection and resilience test (50 agents, 30 min)
  daily          Daily monitoring test (30 agents, 30 min)

Options:
  -n, --no-report            Don't save report file
  -a, --agents N             Number of agents (default: profile-specific)
  -e, --env FILE             Environment file (default: .env)
  -d, --duration N           Test duration in seconds (stress only)
  -r, --rate N               Request rate per second (stress only)
  -t, --trade-amount N       Trade amount in dollars (stress only)
  --traces-sample-rate N     Sentry SDK traces sample rate 0.0-1.0 (default: 0.01)
  --request-sample-rate N    Sentry request span sample rate 0.0-1.0 (default: 0.01)
  -h, --help                 Show this help

Examples:
  tsx src/cli.ts                              # Run default stress test (8 req/s, 60s)
  tsx src/cli.ts stress                       # Same as above (baseline)
  tsx src/cli.ts stress -r 20 -d 180 -t 0.05  # Custom: 20 req/s for 3 min with $0.05 trades
  tsx src/cli.ts stress -d 1800 -r 16         # 30-minute test at 16 req/s
  tsx src/cli.ts stress -d 7200 -r 8          # 2-hour endurance test
  tsx src/cli.ts stress --request-sample-rate 1.0  # 100% span sampling for debugging
  tsx src/cli.ts tge                          # Run TGE burst test
  tsx src/cli.ts resilience                   # Run chaos engineering test
`);
}

// Generate timestamp for reports
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// Generate unique test run ID
function generateTestRunId(profile: string): string {
  const timestamp = getTimestamp();
  return `${profile}-${timestamp}`;
}

// Generate Sentry link for test run
function getSentryLink(testRunId: string): string | null {
  const sentryOrg = process.env.SENTRY_ORG || "recallnet";
  const sentryProjectId = process.env.SENTRY_PROJECT_ID;
  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn || !sentryProjectId) {
    return null;
  }

  const query = encodeURIComponent(`test_run_id:${testRunId}`);
  return `https://${sentryOrg}.sentry.io/explore/traces/?environment=perf-testing&project=${sentryProjectId}&statsPeriod=24h&query=${query}`;
}

// Run Artillery test
function runTest(options: Options): void {
  const profile = profiles[options.profile];
  if (!profile) {
    console.error(`Error: Unknown profile '${options.profile}'`);
    process.exit(1);
  }

  // Load environment variables
  loadEnv(options.envFile);

  // Generate unique test run ID
  const testRunId = generateTestRunId(options.profile);

  // Build environment for Artillery subprocess (isolated)
  const artilleryEnv: Record<string, string | undefined> = {
    ...process.env,
    AGENTS_COUNT: options.agents,
    TEST_PROFILE: options.profile,
    TEST_RUN_ID: testRunId,
  };

  // Set defaults for generic test parameters (can be overridden via options or env vars)
  const duration = options.duration || process.env.TEST_DURATION || "60"; // Default: 1 minute
  const requestRate = options.requestRate || process.env.REQUEST_RATE || "8"; // Default: 8 req/s
  const tradeAmount = options.tradeAmount || process.env.TRADE_AMOUNT || "0.1"; // Default: $0.10
  const tracesSampleRate =
    options.tracesSampleRate || process.env.SENTRY_TRACES_SAMPLE_RATE || "0.01"; // Default: 1%
  const requestSampleRate =
    options.requestSampleRate || process.env.SENTRY_SAMPLE_REQUEST || "0.01"; // Default: 1%

  artilleryEnv.TEST_DURATION = duration;
  artilleryEnv.REQUEST_RATE = requestRate;
  artilleryEnv.TRADE_AMOUNT = tradeAmount;
  artilleryEnv.SENTRY_TRACES_SAMPLE_RATE = tracesSampleRate;
  artilleryEnv.SENTRY_SAMPLE_REQUEST = requestSampleRate;

  // Determine if this profile uses parameterized config or fixed phases
  const isParameterized = options.profile === "stress";

  // Build header with appropriate parameters
  let header = `
════════════════════════════════════════════
  ${profile.name}
════════════════════════════════════════════
Target: ${process.env.API_HOST || "NOT SET"}
Test Run ID: ${testRunId}

Test Parameters:
  Agents: ${options.agents}
`;

  // Add parameterized test details or fixed config note
  if (isParameterized) {
    header += `  Duration: ${duration}s
  Request Rate: ${requestRate} req/s
  Trade Amount: $${tradeAmount}
`;
  } else {
    header += `  Configuration: Multi-phase (see ${profile.config})
  Trade Patterns: Defined by test profile
`;
  }

  // Add Sentry config if enabled
  if (process.env.SENTRY_DSN) {
    header += `
Sentry Monitoring:
  Traces Sample Rate: ${(parseFloat(tracesSampleRate) * 100).toFixed(1)}%
  Request Sample Rate: ${(parseFloat(requestSampleRate) * 100).toFixed(1)}%
`;
  }

  // Add report file path if saving
  let reportFile: string | undefined;
  if (options.saveReport) {
    const timestamp = getTimestamp();
    reportFile = `reports/${options.profile}-${timestamp}.json`;
    header += `
Report: ${reportFile}
`;
  }

  header += `
Config: ${profile.config}
════════════════════════════════════════════
`;

  console.log(header);

  // Build Artillery command
  const artilleryArgs = ["artillery", "run"];

  if (reportFile) {
    artilleryArgs.push("--output", reportFile);
  }

  // Only add phase overrides for parameterized profiles (baseline/stress)
  if (isParameterized) {
    artilleryArgs.push(
      "--overrides",
      `{ "config": { "phases": [{ "duration": ${duration}, "arrivalRate": ${requestRate}, "name": "stress_test" }] } }`,
    );
  }

  artilleryArgs.push(profile.config);

  console.log("Starting test...\n");

  // Create reports directory if it doesn't exist
  if (!fs.existsSync("reports")) {
    fs.mkdirSync("reports");
  }

  // Run Artillery with npx using isolated environment
  const artillery = spawn("npx", artilleryArgs, {
    stdio: "inherit",
    env: artilleryEnv,
  });

  artillery.on("close", (code) => {
    if (code === 0) {
      console.log("\n✓ Test completed successfully!");

      // Output Sentry link if available
      const sentryLink = getSentryLink(testRunId);
      if (sentryLink) {
        console.log(`\n📊 View results in Sentry:`);
        console.log(`   ${sentryLink}\n`);
      }
    } else {
      console.error(`\n✗ Test failed with code ${code}`);
      process.exit(code);
    }
  });

  artillery.on("error", (err) => {
    console.error("Failed to start Artillery:", err);
    process.exit(1);
  });
}

// Main execution
function main(): void {
  const options = parseArgs();
  runTest(options);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runTest, loadEnv };
