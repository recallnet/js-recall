/**
 * Test setupFile, this is run before each test file https://vitest.dev/config/#setupfiles
 */
import fs from "fs";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { MockPrivyClient } from "@recallnet/services/lib";
import { dbManager } from "@recallnet/test-utils";

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

// Setup before all tests
beforeAll(async () => {
  log("[File Setup] Setting up test environment...");
});

// After all tests finish for each file
afterAll(async () => {
  log("[File Teardown] Cleaning up test environment...");

  try {
    // Add a delay to allow cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    log(
      "[File Teardown] Error during cleanup: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});

// Before every test
beforeEach(async () => {
  log("[BeforeEach] ...");
  // Ensure database is initialized
  await dbManager.initialize();
});

// After every test
afterEach(async () => {
  // Clean up database state
  await dbManager.resetDatabase();
  // Clear linked Privy wallets
  MockPrivyClient.clearLinkedWallets();
});
