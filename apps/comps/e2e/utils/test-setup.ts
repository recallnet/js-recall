/**
 * Per-test setup file
 *
 * Runs before each test file to set up the test environment.
 * Matches pattern from apps/api/e2e/utils/test-setup.ts
 */
import { afterEach, beforeEach, vi } from "vitest";

import { MockPrivyClient } from "@recallnet/services/lib";
import { dbManager } from "@recallnet/test-utils";

// Mock Next.js cache functions since they're not available in test environment
vi.mock("@/lib/cache-tags", () => ({
  invalidateCacheTags: vi.fn(),
}));

// Before every test
beforeEach(async () => {
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
