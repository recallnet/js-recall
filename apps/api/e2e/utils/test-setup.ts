/**
 * Test setupFile, this is run before each test file https://vitest.dev/config/#setupfiles
 *
 * NOTE: The actual server under test is started inside a sub-process, hence in
 *   memory things like caches, timeouts, and intervals cannot be interacted with.
 *
 * NOTE: that if you are running --isolate=false, this setup file will be run
 *   in the same global scope multiple times. Meaning, that you are accessing the
 *   same global object before each test, so make sure you are not doing the same
 *   thing more than you need.
 *
 */
import fs from "fs";
import path from "path";
import client from "prom-client";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { MockPrivyClient } from "@recallnet/services/lib";
import { dbManager, setupPrivyTestEnvironment } from "@recallnet/test-utils";

import { mockHyperliquidServer, mockSymphonyServer } from "../setup.js";

// TODO: is this log file needed if we use Pino?
// Path to log file
const logFile = path.resolve(__dirname, "../e2e-server.log");

// Function to log to both console and file
const log = (message: string) => {
  console.log(message);
  fs.appendFileSync(logFile, message + "\n");
};

// Extend the timeout for all tests
vi.setConfig({ testTimeout: 60_000 });

// Set test mode environment variable
process.env.TEST_MODE = "true";

// Ensure METRICS_PORT is set for test environment
if (!process.env.METRICS_PORT) {
  process.env.METRICS_PORT = "3003";
}

// Setup Privy test environment and mocks before all tests
beforeAll(async () => {
  setupPrivyTestEnvironment();
});

// After all tests finish for each file, i.e. this is run once for each file
afterAll(async () => {
  log("[File Teardown] Cleaning up test environment...");

  try {
    // Clean up logging infrastructure resources
    log("[File Teardown] Cleaning up logging infrastructure...");

    // Clear Prometheus metrics registry to prevent conflicts between test runs
    try {
      const metricsToRemove = [
        "http_request_duration_ms",
        "http_requests_total",
        "repository_query_duration_ms",
        "repository_queries_total",
        "db_queries_total",
      ];

      let removedCount = 0;
      for (const metricName of metricsToRemove) {
        try {
          // TODO: I think this is interacting via http so this is ok.
          const existingMetric = client.register.getSingleMetric(metricName);
          if (existingMetric) {
            client.register.removeSingleMetric(metricName);
            removedCount++;
          }
        } catch (error) {
          void error; // Metric might not exist, which is fine
        }
      }

      if (removedCount > 0) {
        log(
          `[File Teardown] Removed ${removedCount} Prometheus metrics from registry`,
        );
      }
    } catch (error) {
      log(
        `[File Teardown] Warning: Error cleaning up Prometheus metrics: ${error}`,
      );
    }

    // Force garbage collection if available (helps with AsyncLocalStorage cleanup)
    if (global.gc) {
      // TODO: is this needed? maybe a hallucination? If we need this, we
      //  should be using the `--expose-gc` flag for tests, which we are not afaict
      global.gc();
      log("[File Teardown] Forced garbage collection");
    }

    // Clean up any generated ROOT_ENCRYPTION_KEY from .env.test to prevent git commits
    try {
      const envTestPath = path.resolve(__dirname, "../../.env.test");
      if (fs.existsSync(envTestPath)) {
        const envContent = fs.readFileSync(envTestPath, "utf8");

        // Remove any ROOT_ENCRYPTION_KEY line that was added during tests
        const updatedContent = envContent.replace(
          /^ROOT_ENCRYPTION_KEY=.*$\n?/m,
          "",
        );

        if (updatedContent !== envContent) {
          fs.writeFileSync(envTestPath, updatedContent);
          log("[File Teardown] ✅ Removed ROOT_ENCRYPTION_KEY from .env.test");
        }
      }
    } catch (envCleanupError) {
      log(
        "[File Teardown] Warning: Could not clean up .env.test encryption key: " +
          (envCleanupError instanceof Error
            ? envCleanupError.message
            : String(envCleanupError)),
      );
    }

    // Add a longer delay to allow logging infrastructure and database connections to clean up
    // This is especially important in CI environments where rapid test cycles can cause resource conflicts
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    log(
      "[File Teardown] Error during cleanup: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});

// Before every test
beforeEach(async function () {
  // Ensure database is initialized
  await dbManager.initialize();

  // Reset mock Symphony server call counter between tests
  if (mockSymphonyServer) {
    mockSymphonyServer.reset();
  }

  // Reset mock Hyperliquid server call counter between tests
  if (mockHyperliquidServer) {
    mockHyperliquidServer.reset();
  }
});

// After every test
afterEach(async function () {
  // Clean up database state
  await dbManager.resetDatabase();
  // Clear linked Privy wallets
  MockPrivyClient.clearLinkedWallets();
});
