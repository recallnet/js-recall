/**
 * Per-test setup file
 *
 * Runs before each test file to set up the test environment.
 * Matches pattern from apps/api/e2e/utils/test-setup.ts
 */
import fs from "fs";
import path from "path";
import { afterAll, afterEach, beforeEach, vi } from "vitest";

import { MockPrivyClient } from "@recallnet/services/lib";
import { dbManager } from "@recallnet/test-utils";

// Mock Next.js cache invalidation function since Next.js cache is not available in test environment
vi.mock("@/lib/cache-tags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cache-tags")>();
  return {
    ...actual,
    invalidateCacheTags: vi.fn(),
  };
});

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

// After all tests in this file complete
afterAll(async () => {
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
        console.log(
          "[File Teardown] ✅ Removed ROOT_ENCRYPTION_KEY from .env.test",
        );
      }
    }
  } catch (envCleanupError) {
    console.warn(
      "[File Teardown] Warning: Could not clean up .env.test encryption key: " +
        (envCleanupError instanceof Error
          ? envCleanupError.message
          : String(envCleanupError)),
    );
  }
});
