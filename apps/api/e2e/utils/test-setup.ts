/**
 * Test setup file that runs before each test suite
 *
 * This is used to set up global Jest configurations and hooks
 */
import fs from "fs";
import path from "path";
import client from "prom-client";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { ServiceRegistry } from "@/services/index.js";

import { dbManager } from "./db-manager.js";

const services = new ServiceRegistry();

// Path to log file
const logFile = path.resolve(__dirname, "../e2e-server.log");

// Function to log to both console and file
const log = (message: string) => {
  console.log(message);
  fs.appendFileSync(logFile, message + "\n");
};

// Extend the timeout for all tests
vi.setConfig({ testTimeout: 60_000 });

// Global Jest setup for E2E tests

// Set test mode environment variable
process.env.TEST_MODE = "true";

// Ensure METRICS_PORT is set for test environment
if (!process.env.METRICS_PORT) {
  process.env.METRICS_PORT = "3003";
}

// Before all tests in every file
beforeAll(async () => {
  log("[Global Setup] Initializing test environment...");

  // Ensure database is initialized
  await dbManager.initialize();
});

// Before each test
beforeEach(async () => {
  // Reset caches to ensure a clean state for each test
  log("[Global Setup] Resetting service caches...");

  // Reset UserManager caches
  if (services.userManager) {
    // Reset userWalletCache if it exists
    // @ts-expect-error known private class property
    if (services.userManager.userWalletCache instanceof Map) {
      //  @ts-expect-error known private class property
      const count = services.userManager.userWalletCache.size;
      if (count > 0) {
        log(
          `[Global Setup] Clearing ${count} entries from UserManager.userWalletCache`,
        );
        // @ts-expect-error known private class property
        services.userManager.userWalletCache.clear();
      }
    }

    // Reset userProfileCache if it exists
    // @ts-expect-error known private class property
    if (services.userManager.userProfileCache instanceof Map) {
      //  @ts-expect-error known private class property
      const count = services.userManager.userProfileCache.size;
      if (count > 0) {
        log(
          `[Global Setup] Clearing ${count} entries from UserManager.userProfileCache`,
        );
        // @ts-expect-error known private class property
        services.userManager.userProfileCache.clear();
      }
    }
  }

  // Reset AgentManager caches
  if (services.agentManager) {
    // Reset apiKeyCache cache if it exists
    // @ts-expect-error known private class property
    if (services.agentManager.apiKeyCache instanceof Map) {
      //  @ts-expect-error known private class property
      const count = services.agentManager.apiKeyCache.size;
      if (count > 0) {
        log(
          `[Global Setup] Clearing ${count} entries from AgentManager.apiKeyCache`,
        );
        // @ts-expect-error known private class property
        services.agentManager.apiKeyCache.clear();
      }
    }

    // Reset inactiveAgentsCache if it exists
    // @ts-expect-error known private class property
    if (services.agentManager.inactiveAgentsCache instanceof Map) {
      // @ts-expect-error known private class property
      const count = services.agentManager.inactiveAgentsCache.size;
      if (count > 0) {
        log(
          `[Global Setup] Clearing ${count} entries from AgentManager.inactiveAgentsCache`,
        );
        // @ts-expect-error known private class property
        services.agentManager.inactiveAgentsCache.clear();
      }
    }
  }

  // Reset BalanceManager cache
  if (services.balanceManager) {
    // @ts-expect-error known private class property
    if (services.balanceManager.balanceCache instanceof Map) {
      // @ts-expect-error known private class property
      const count = services.balanceManager.balanceCache.size;
      if (count > 0) {
        log(
          `[Global Setup] Clearing ${count} entries from BalanceManager.balanceCache`,
        );
        // @ts-expect-error known private class property
        services.balanceManager.balanceCache.clear();
      }
    }
  }

  // Reset TradeSimulator cache
  if (services.tradeSimulator) {
    // @ts-expect-error known private class property
    if (services.tradeSimulator.tradeCache instanceof Map) {
      // @ts-expect-error known private class property
      const count = services.tradeSimulator.tradeCache.size;
      if (count > 0) {
        log(
          `[Global Setup] Clearing ${count} entries from TradeSimulator.tradeCache`,
        );
        // @ts-expect-error known private class property
        services.tradeSimulator.tradeCache.clear();
      }
    }
  }

  // Clear provider caches if they exist
  // These are typically accessed through the priceTracker service
  if (services.priceTracker) {
    const providers = ["dexscreenerProvider", "multiChainProvider"];

    providers.forEach((providerName) => {
      // @ts-expect-error known private class property
      const provider = services.priceTracker[providerName];
      if (provider) {
        if (provider.cache instanceof Map) {
          const count = provider.cache.size;
          if (count > 0) {
            log(
              `[Global Setup] Clearing ${count} entries from ${providerName}.cache`,
            );
            provider.cache.clear();
          }
        }
      }
    });
  }
});

// After all tests in every file
afterAll(async () => {
  log("[Global Teardown] Cleaning up test environment...");

  try {
    // Clean up logging infrastructure resources
    log("[Global Teardown] Cleaning up logging infrastructure...");

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
          `[Global Teardown] Removed ${removedCount} Prometheus metrics from registry`,
        );
      }
    } catch (error) {
      log(
        `[Global Teardown] Warning: Error cleaning up Prometheus metrics: ${error}`,
      );
    }

    // Force garbage collection if available (helps with AsyncLocalStorage cleanup)
    if (global.gc) {
      global.gc();
      log("[Global Teardown] Forced garbage collection");
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
          log(
            "[Global Teardown] ✅ Removed ROOT_ENCRYPTION_KEY from .env.test",
          );
        }
      }
    } catch (envCleanupError) {
      log(
        "[Global Teardown] Warning: Could not clean up .env.test encryption key: " +
          (envCleanupError instanceof Error
            ? envCleanupError.message
            : String(envCleanupError)),
      );
    }

    // Add a longer delay to allow logging infrastructure and database connections to clean up
    // This is especially important in CI environments where rapid test cycles can cause resource conflicts
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clean up database state
    await dbManager.cleanupTestState();
  } catch (error) {
    log(
      "[Global Teardown] Error during cleanup: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});

// Log test lifecycle events are now handled by LogReporter

afterEach(() => {
  vi.resetAllMocks();
});
