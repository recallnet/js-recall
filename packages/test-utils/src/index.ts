// API Client for admin HTTP operations
export { ApiClient } from "./api-client.js";

// Database utilities
export { db, resetDb, dropAll, migrateDb, closeDb } from "./database.js";
export { DbManager, dbManager, connectToDb } from "./db-manager.js";

// Mock servers
export { MockSymphonyServer } from "./mock-servers/symphony.js";
export { MockHyperliquidServer } from "./mock-servers/hyperliquid.js";
export {
  startLoopsMockServer,
  stopLoopsMockServer,
} from "./mock-servers/loops.js";

// Privy utilities
export {
  TEST_PRIVY_PRIVATE_KEY,
  TEST_PRIVY_PUBLIC_KEY_BASE64,
  TEST_PRIVY_APP_ID,
  TEST_PRIVY_APP_SECRET,
  TEST_PRIVY_CONFIG,
  setupPrivyTestEnvironment,
  defaultTestUser,
  formatLinkedAccounts,
  createMockPrivyToken,
  generateRandomPrivyId,
  createTestPrivyUser,
  createTestPrivyUsers,
  createGoogleTestUser,
  createGitHubTestUser,
  createEmailOnlyTestUser,
  type TestPrivyUser,
} from "./privy.js";

// Server utilities
export { startServer, stopServer, getBaseUrl } from "./server.js";

// Test helpers
export {
  TEST_TOKEN_ADDRESS,
  VOLATILE_TOKEN,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
  looseTradingConstraints,
  noTradingConstraints,
  strictTradingConstraints,
  generateTestHandle,
  createTestAgent,
  createTestClient,
  registerUserAndAgentAndGetClient,
  createPrivyAuthenticatedClient,
  createAgentVerificationSignature,
  getAdminApiKey,
  generateRandomString,
  generateRandomEthAddress,
  wait,
  createTestCompetition,
  startTestCompetition,
  startExistingTestCompetition,
  createPerpsTestCompetition,
  startPerpsTestCompetition,
  generateTestCompetitions,
  getStartingValue,
} from "./test-helpers.js";

// Types
export * from "./types.js";

// Logger
export { createLogger } from "./logger.js";
