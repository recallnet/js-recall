/**
 * Global Setup
 *
 *
 * Initializes the test environment, including the database and server.
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";

import { createLogger } from "@/lib/logger.js";

import { dbManager } from "./utils/db-manager.js";
import { startServer, stopServer } from "./utils/server.js";

// Path to log file
const logFile = path.resolve(__dirname, "e2e-server.log");

// Create a test-specific logger
const testLogger = createLogger("E2E-Setup");

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

  if (envTestExists) {
    // Save original values for debugging
    const originalBaseUsdcBalance = process.env.INITIAL_BASE_USDC_BALANCE;
    const originalLeaderboardAccess =
      process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS;

    // Force override with .env.test values (but don't override leaderboard setting if in leaderboard test)
    const result = config({
      path: envTestPath,
      override: true,
      // Only use processEnv when running the leaderboard test
      ...(isLeaderboardTest && {
        // Preserve our manual setting instead of loading from .env.test
        ignoreProcessEnv: false, // This tells dotenv to use process.env as the starting point
      }),
      ...(isTradingTest && {
        //
        ignoreProcessEnv: false,
      }),
      ...(isBaseTradingTest && {
        //
        ignoreProcessEnv: false,
      }),
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

  // Ensure TEST_MODE is set
  process.env.TEST_MODE = "true";

  // Ensure METRICS_PORT is set for test environment
  if (!process.env.METRICS_PORT) {
    process.env.METRICS_PORT = "3003";
  }

  log("🚀 Setting up E2E test environment...");

  try {
    // Initialize database using our new DbManager
    log("📦 Initializing database...");
    await dbManager.initialize();

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

  // Close database connection using our DbManager
  log("🔌 Closing database connection...");
  await dbManager.close();

  // Stop server
  log("🛑 Stopping server...");
  stopServer();

  log("✅ Test environment cleaned up");
}
