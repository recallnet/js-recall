/**
 * Global Setup for Comps E2E Tests
 *
 * Initializes the test environment, including the database and API server.
 * Reuses infrastructure from @recallnet/test-utils package.
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";

import { arenas } from "@recallnet/db/schema/core/defs";
import {
  MockHyperliquidServer,
  MockSymphonyServer,
  createLogger,
  db,
  dbManager,
  startLoopsMockServer,
  startServer,
  stopLoopsMockServer,
  stopServer,
} from "@recallnet/test-utils";

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
  const envTestPath = path.resolve(__dirname, "../.env.test");
  const envTestExists = fs.existsSync(envTestPath);

  testLogger.info("========== E2E TEST ENVIRONMENT SETUP ==========");
  testLogger.info(`Looking for .env.test at: ${envTestPath}`);
  testLogger.info(`.env.test file exists: ${envTestExists}`);

  if (envTestExists) {
    const result = config({
      path: envTestPath,
      override: true,
    });

    testLogger.info(
      `Loaded .env.test file: ${result.parsed ? "successfully" : "failed"}`,
    );
    if (result.parsed) {
      testLogger.info(
        `Loaded ${Object.keys(result.parsed).length} variables from .env.test`,
      );
    }
  } else {
    testLogger.warn(
      "⚠️ WARNING: .env.test file not found! Tests will use .env or default values.",
    );
  }

  // Ensure TEST_MODE is set
  process.env.TEST_MODE = "true";

  // Ensure METRICS_PORT is set for test environment
  if (!process.env.METRICS_PORT) {
    process.env.METRICS_PORT = "3003";
  }

  // Ensure Loops variables are set (for API server)
  if (!process.env.LOOPS_BASE_URL) {
    process.env.LOOPS_BASE_URL = "http://127.0.0.1:4010";
  }
  if (!process.env.LOOPS_API_KEY) {
    process.env.LOOPS_API_KEY = "test-api-key";
  }
  if (!process.env.LOOPS_MAILING_LIST_ID) {
    process.env.LOOPS_MAILING_LIST_ID = "test-mailing-list";
  }

  // Set EMAIL_* variables for comps app RPC services (they use different env var names)
  if (!process.env.EMAIL_BASE_URL) {
    process.env.EMAIL_BASE_URL = "http://127.0.0.1:4010";
  }
  if (!process.env.EMAIL_API_KEY) {
    process.env.EMAIL_API_KEY = "test-api-key";
  }
  if (!process.env.EMAIL_MAILING_LIST_ID) {
    process.env.EMAIL_MAILING_LIST_ID = "test-mailing-list";
  }

  // Set SportsDataIO variables (NFL mock server runs on port 4569)
  // The mock server itself is started per-test in nfl-competition.test.ts
  if (!process.env.SPORTSDATAIO_BASE_URL) {
    process.env.SPORTSDATAIO_BASE_URL = "http://localhost:4569";
  }
  if (!process.env.SPORTSDATAIO_API_KEY) {
    process.env.SPORTSDATAIO_API_KEY = "mock-api-key";
  }

  log("🚀 Setting up E2E test environment...");

  try {
    // Start Loops mock server first
    log("🔄 Starting Loops mock server...");
    await startLoopsMockServer(process.env.LOOPS_BASE_URL);

    // Initialize database using DbManager from test-utils
    log("📦 Initializing database...");
    await dbManager.initialize();

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

    // Start API server (runs migrations)
    log("🌐 Starting API server...");
    await startServer();

    // Create default arenas for tests (after migrations have run)
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

    await db
      .insert(arenas)
      .values({
        id: "default-nfl-game-prediction-arena",
        name: "Default NFL Game Prediction Arena",
        createdBy: "system",
        category: "sports",
        skill: "sports_prediction",
        kind: "Competition",
      })
      .onConflictDoNothing();

    log("✅ Default arenas created");

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

  // Close database connection using DbManager from test-utils
  log("🔌 Closing database connection...");
  await dbManager.close();

  // Stop API server
  log("🛑 Stopping API server...");
  stopServer();

  // Stop Loops mock server
  await stopLoopsMockServer();

  log("✅ Test environment cleaned up");
}
