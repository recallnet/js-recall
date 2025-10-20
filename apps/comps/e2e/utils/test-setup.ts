/**
 * Per-test setup file
 *
 * Runs before each test file to set up the test environment.
 */
import { beforeEach } from "vitest";

import { dbManager } from "@recallnet/test-utils";

// Clean up test state before each test
beforeEach(async () => {
  // Reset database state between tests
  await dbManager.cleanup();
});
