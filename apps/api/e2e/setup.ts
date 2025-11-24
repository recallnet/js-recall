/**
 * Global Setup
 *
 *
 * Initializes the test environment, including the database and server.
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";

import { arenas } from "@recallnet/db/schema/core/defs";
import { dbManager } from "@recallnet/test-utils";
import {
  startLoopsMockServer,
  stopLoopsMockServer,
} from "@recallnet/test-utils";
import { MockHyperliquidServer } from "@recallnet/test-utils";
import { MockSymphonyServer } from "@recallnet/test-utils";
import { startServer, stopServer } from "@recallnet/test-utils";

import { db } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

// Path to log file
const logFile = path.resolve(__dirname, "e2e-server.log");

// Create a test-specific logger
const testLogger = createLogger("E2E-Setup");

// Mock Symphony server instance
export let mockSymphonyServer: MockSymphonyServer | null = null;
// Mock Hyperliquid server instance
export let mockHyperliquidServer: MockHyperliquidServer | null = null;

// Function to log to both Pino logger and file
const log = (message: string) => {
  testLogger.info(message);
  fs.appendFileSync(logFile, message + "\n");
};

// Setup function to run before all tests
export async function setup() {
  // Load test environment variables
  const envTestPath = path.resolve(__dirname, "../.env.test");
  const envTestExists = fs.existsSync(envTestPath);

  // Log important environment loading information
  testLogger.info("========== E2E TEST ENVIRONMENT SETUP ==========");
  testLogger.info(`Looking for .env.test at: ${envTestPath}`);
  testLogger.info(`.env.test file exists: ${envTestExists}`);

  // Check if leaderboard-access test is being run by examining command line arguments
  const args = process.argv.slice(2);
  testLogger.info({ args }, "42 setup");
  const isLeaderboardTest = args.some(
    (arg) =>
      arg.includes("leaderboard-access.test") ||
      arg.includes("leaderboard-access"),
  );

  const isTradingTest = args.some(
    (arg) => arg.includes("trading.test") || arg.includes("trading"),
  );
  testLogger.info(`Is trading test: ${isTradingTest}`);
  const isBaseTradingTest = args.some(
    (arg) => arg.includes("base-trades.test") || arg.includes("base-trades"),
  );

  const isRateLimiterDisabledTest = args.some(
    (arg) =>
      arg.includes("rate-limiter-disabled.test") ||
      arg.includes("rate-limiter-disabled"),
  );

  if (envTestExists) {
    // Save original values for debugging
    const originalBaseUsdcBalance = process.env.INITIAL_BASE_USDC_BALANCE;
    const originalLeaderboardAccess =
      process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS;

    // Determine if test needs to preserve process.env
    const shouldUseProcessEnv =
      isLeaderboardTest ||
      isTradingTest ||
      isBaseTradingTest ||
      isRateLimiterDisabledTest;

    // Force override with .env.test values
    const result = config({
      path: envTestPath,
      override: true,
      // Use process.env as starting point for specific tests that need custom env vars
      ...(shouldUseProcessEnv && { ignoreProcessEnv: false }),
    });

    testLogger.info(
      `Loaded .env.test file: ${result.parsed ? "successfully" : "failed"}`,
    );
    if (result.parsed) {
      testLogger.info(
        `Loaded ${Object.keys(result.parsed).length} variables from .env.test`,
      );

      // Check specific test-critical variables
      testLogger.info("Critical variables after loading .env.test:");
      testLogger.info(
        `- INITIAL_BASE_USDC_BALANCE: ${process.env.INITIAL_BASE_USDC_BALANCE} (was: ${originalBaseUsdcBalance})`,
      );
      testLogger.info(
        `- DISABLE_PARTICIPANT_LEADERBOARD_ACCESS: ${process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS} (was: ${originalLeaderboardAccess})`,
      );
    }
  } else {
    testLogger.warn(
      "⚠️ WARNING: .env.test file not found! Tests will use .env or default values.",
    );

    // Try loading from .env as fallback and log the result
    const envMainPath = path.resolve(__dirname, "../.env");
    const envMainExists = fs.existsSync(envMainPath);
    testLogger.info(`Using .env as fallback. File exists: ${envMainExists}`);

    if (envMainExists) {
      const result = config({ path: envMainPath, override: true });
      testLogger.info(
        `Loaded .env file: ${result.parsed ? "successfully" : "failed"}`,
      );
    }
  }
  if (isLeaderboardTest) {
    process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS = "true";
    testLogger.info(
      `DISABLE_PARTICIPANT_LEADERBOARD_ACCESS set to: ${process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS}`,
    );
  }
  if (isTradingTest) {
    process.env.MAX_TRADE_PERCENTAGE = "10";
    testLogger.info(
      `MAX_TRADE_PERCENTAGE set to: ${process.env.MAX_TRADE_PERCENTAGE}`,
    );
  }
  if (isBaseTradingTest) {
    process.env.MAX_TRADE_PERCENTAGE = "15";
    testLogger.info(
      `MAX_TRADE_PERCENTAGE set to: ${process.env.MAX_TRADE_PERCENTAGE}`,
    );
  }

  if (isRateLimiterDisabledTest) {
    process.env.DISABLE_RATE_LIMITER = "true";
    testLogger.info(
      `DISABLE_RATE_LIMITER set to: ${process.env.DISABLE_RATE_LIMITER}`,
    );
  }

  // Extend cache freshness to 10 minutes for all e2e tests to prevent cache expiration issues
  process.env.PRICE_CACHE_TTL_MS = "600000"; // 10 minutes
  testLogger.info(
    `PRICE_CACHE_TTL_MS set to: ${process.env.PRICE_CACHE_TTL_MS}`,
  );

  // Ensure TEST_MODE is set
  process.env.TEST_MODE = "true";

  // Ensure METRICS_PORT is set for test environment
  if (!process.env.METRICS_PORT) {
    process.env.METRICS_PORT = "3003";
  }

  // Ensure Loos variables are set (to trigger the `EmailService` logic properly)
  if (!process.env.LOOPS_BASE_URL) {
    process.env.LOOPS_BASE_URL = "http://127.0.0.1:4010";
  }
  if (!process.env.LOOPS_API_KEY) {
    process.env.LOOPS_API_KEY = "test-api-key";
  }
  if (!process.env.LOOPS_MAILING_LIST_ID) {
    process.env.LOOPS_MAILING_LIST_ID = "test-mailing-list";
  }

  log("🚀 Setting up E2E test environment...");

  try {
    // Start Loops mock server first
    log("🔄 Starting Loops mock server...");
    await startLoopsMockServer(process.env.LOOPS_BASE_URL);

    // Initialize database using our new DbManager
    log("📦 Initializing database...");
    await dbManager.initialize();

    // Create default arenas for tests
    log("🏟️  Creating default arenas...");
    await db
      .insert(arenas)
      .values({
        id: "default-paper-arena",
        name: "Default Paper Trading Arena",
        createdBy: "system",
        category: "crypto_trading",
        skill: "spot_paper_trading",
        kind: "Competition",
      })
      .onConflictDoNothing();

    await db
      .insert(arenas)
      .values({
        id: "default-perps-arena",
        name: "Default Perpetual Futures Arena",
        createdBy: "system",
        category: "crypto_trading",
        skill: "perpetual_futures",
        kind: "Competition",
      })
      .onConflictDoNothing();

    await db
      .insert(arenas)
      .values({
        id: "default-spot-live-arena",
        name: "Default Spot Live Trading Arena",
        createdBy: "system",
        category: "crypto_trading",
        skill: "spot_live_trading",
        kind: "Competition",
      })
      .onConflictDoNothing();
    log("✅ Default arenas created");

    // Start mock Symphony server for perps testing
    log("🎭 Starting mock Symphony server...");
    mockSymphonyServer = new MockSymphonyServer(4567);
    await mockSymphonyServer.start();

    // Start mock Hyperliquid server for perps testing
    log("🎨 Starting mock Hyperliquid server...");
    mockHyperliquidServer = new MockHyperliquidServer(4568);
    await mockHyperliquidServer.start();

    // Set Symphony API URL to point to our mock server
    const SYMPHONY_API_URL = "http://localhost:4567";
    testLogger.info(`SYMPHONY_API_URL set to: ${SYMPHONY_API_URL}`);

    // Set Hyperliquid API URL to point to our mock server
    const HYPERLIQUID_API_URL = "http://localhost:4568";
    testLogger.info(`HYPERLIQUID_API_URL set to: ${HYPERLIQUID_API_URL}`);

    // Start server
    log("🌐 Starting server...");
    await startServer();

    log("✅ Test environment ready");
  } catch (error) {
    log(
      "❌ Failed to set up test environment: " +
        (error instanceof Error ? error.message : String(error)),
    );
    throw error;
  }
}

// Teardown function to run after all tests
export async function teardown() {
  log("🧹 Cleaning up test environment...");

  // Stop mock Symphony server
  if (mockSymphonyServer) {
    log("🛑 Stopping mock Symphony server...");
    await mockSymphonyServer.stop();
    mockSymphonyServer = null;
  }

  // Stop mock Hyperliquid server
  if (mockHyperliquidServer) {
    log("🛑 Stopping mock Hyperliquid server...");
    await mockHyperliquidServer.stop();
    mockHyperliquidServer = null;
  }

  // Close database connection using our DbManager
  log("🔌 Closing database connection...");
  await dbManager.close();

  // Stop server
  log("🛑 Stopping server...");
  stopServer();

  // Stop Loops mock server
  await stopLoopsMockServer();

  log("✅ Test environment cleaned up");
}
