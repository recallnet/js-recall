/**
 * Test setup file that runs before each test suite
 *
 * This is used to set up global Jest configurations and hooks
 */

import { dbManager } from './db-manager';
import { BalanceManager, CompetitionManager, services } from '../../src/services';
import fs from 'fs';
import path from 'path';

// Path to log file
const logFile = path.resolve(__dirname, '../e2e-server.log');

// Function to log to both console and file
const log = (message: string) => {
  console.log(message);
  fs.appendFileSync(logFile, message + '\n');
};

// Extend the timeout for all tests
jest.setTimeout(30000);

// Global Jest setup for E2E tests

// Set test mode environment variable
process.env.TEST_MODE = 'true';

// Before all tests in every file
beforeAll(async () => {
  log('[Global Setup] Initializing test environment...');

  // Ensure database is initialized
  await dbManager.initialize();

  // Ensure scheduler is reset at the start of tests
  if (services.scheduler) {
    log('[Global Setup] Resetting scheduler service...');
    services.scheduler.reset();
  }
});

// Before each test
beforeEach(async () => {
  // Reset scheduler to ensure a clean state for each test
  if (services.scheduler) {
    log('[Global Setup] Resetting scheduler service for new test...');
    services.scheduler.reset();
  }

  // Reset caches to ensure a clean state for each test
  log('[Global Setup] Resetting service caches...');

  // Reset TeamManager caches
  if (services.teamManager) {
    // Reset apiKeyCache if it exists
    //@ts-expect-error known private class property
    if (services.teamManager.apiKeyCache instanceof Map) {
      //@ts-expect-error known private class property
      const count = services.teamManager.apiKeyCache.size;
      if (count > 0) {
        log(`[Global Setup] Clearing ${count} entries from TeamManager.apiKeyCache`);
        //@ts-expect-error known private class property
        services.teamManager.apiKeyCache.clear();
      }
    }

    // Reset inactiveTeamsCache if it exists
    //@ts-expect-error known private class property
    if (services.teamManager.inactiveTeamsCache instanceof Map) {
      //@ts-expect-error known private class property
      const count = services.teamManager.inactiveTeamsCache.size;
      if (count > 0) {
        log(`[Global Setup] Clearing ${count} entries from TeamManager.inactiveTeamsCache`);
        //@ts-expect-error known private class property
        services.teamManager.inactiveTeamsCache.clear();
      }
    }
  }

  // Reset CompetitionManager cache
  if (services.competitionManager) {
    //@ts-expect-error known private class property
    if (services.competitionManager.activeCompetitionCache !== null) {
      log('[Global Setup] Resetting CompetitionManager.activeCompetitionCache');
      //@ts-expect-error known private class property
      services.competitionManager.activeCompetitionCache = null;
    }
  }

  // Reset BalanceManager cache
  if (services.balanceManager) {
    //@ts-expect-error known private class property
    if (services.balanceManager.balanceCache instanceof Map) {
      //@ts-expect-error known private class property
      const count = services.balanceManager.balanceCache.size;
      if (count > 0) {
        log(`[Global Setup] Clearing ${count} entries from BalanceManager.balanceCache`);
        //@ts-expect-error known private class property
        services.balanceManager.balanceCache.clear();
      }
    }
  }

  // Reset TradeSimulator cache
  if (services.tradeSimulator) {
    //@ts-expect-error known private class property
    if (services.tradeSimulator.tradeCache instanceof Map) {
      //@ts-expect-error known private class property
      const count = services.tradeSimulator.tradeCache.size;
      if (count > 0) {
        log(`[Global Setup] Clearing ${count} entries from TradeSimulator.tradeCache`);
        //@ts-expect-error known private class property
        services.tradeSimulator.tradeCache.clear();
      }
    }
  }

  // Reset PriceTracker cache
  if (services.priceTracker) {
    //@ts-expect-error known private class property
    if (services.priceTracker.priceCache instanceof Map) {
      //@ts-expect-error known private class property
      const count = services.priceTracker.priceCache.size;
      if (count > 0) {
        log(`[Global Setup] Clearing ${count} entries from PriceTracker.priceCache`);
        //@ts-expect-error known private class property
        services.priceTracker.priceCache.clear();
      }
    }
  }

  // Clear provider caches if they exist
  // These are typically accessed through the priceTracker service
  if (services.priceTracker) {
    const providers = ['dexscreenerProvider', 'multiChainProvider'];

    providers.forEach((providerName) => {
      //@ts-expect-error known private class property
      const provider = services.priceTracker[providerName];
      if (provider) {
        if (provider.cache instanceof Map) {
          const count = provider.cache.size;
          if (count > 0) {
            log(`[Global Setup] Clearing ${count} entries from ${providerName}.cache`);
            provider.cache.clear();
          }
        }
      }
    });
  }
});

// After all tests in every file
afterAll(async () => {
  log('[Global Teardown] Cleaning up test environment...');

  try {
    // Stop the scheduler to prevent ongoing database connections
    if (services.scheduler) {
      log('[Global Teardown] Stopping scheduler service...');
      services.scheduler.stopSnapshotScheduler();
      log('[Global Teardown] Scheduler service stopped');
    }

    // Add a small delay to allow any pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up database state
    await dbManager.cleanupTestState();
  } catch (error) {
    log(
      '[Global Teardown] Error during cleanup: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});

// Log test lifecycle events for debugging
beforeEach(() => {
  log(`[Test] Starting test: ${expect.getState().currentTestName}`);
});

afterEach(() => {
  log(`[Test] Completed test: ${expect.getState().currentTestName}`);
  jest.resetAllMocks();
});
