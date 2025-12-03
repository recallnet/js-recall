import { beforeEach, describe, expect, test } from "vitest";

import {
  ApiClient,
  UserRegistrationResponse,
  createTestClient,
  generateRandomEthAddress,
  getAdminApiKey,
} from "@recallnet/test-utils";

describe("Admin Trading API - Agent Creation", () => {
  let adminApiKey: string;
  let adminClient: ApiClient;

  beforeEach(async () => {
    // await ensureDefaultArenas();
    adminApiKey = await getAdminApiKey();

    adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);
  });

  test("should authenticate as admin", async () => {
    // Attempt to login as admin with correct API key
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Attempt to login with incorrect API key and assert failure
    const failedLogin = await adminClient.loginAsAdmin("invalid_api_key");
    expect(failedLogin).toBe(false);
  });

  test("should register a user and agent via admin API", async () => {
    // Register a new user with agent
    const userName = `Test User ${Date.now()}`;
    const userEmail = `user${Date.now()}@test.com`;
    const agentName = `Test Agent ${Date.now()}`;
    const agentDescription = "A test trading agent";

    const result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(), // Generate random wallet address
      name: userName,
      email: userEmail,
      agentName,
      agentDescription,
    })) as UserRegistrationResponse;

    // Assert registration success
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user.name).toBe(userName);
    expect(result.user.email).toBe(userEmail);
    expect(result.agent).toBeDefined();
    expect(result.agent!.name).toBe(agentName);
    expect(result.agent!.description).toBe(agentDescription);
    expect(result.agent!.apiKey).toBeDefined();
  });
});
