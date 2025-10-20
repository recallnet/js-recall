import { beforeEach, describe, expect, test } from "vitest";

import {
  type UserProfileResponse,
  createMockPrivyToken,
  createTestClient,
  createTestPrivyUser,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

describe("User RPC", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("admin can register a user and user can authenticate via RPC", async () => {
    // Create a test client for admin operations
    const client = createTestClient();
    // Login as admin with correct API key
    await client.loginAsAdmin(adminApiKey);

    // Register a user via admin HTTP API
    const userName = `User ${Date.now()}`;
    const agentName = `Agent ${Date.now()}`;
    const userEmail = `user${Date.now()}@example.com`;

    const { user, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName,
      userEmail,
      agentName,
    });

    // Verify user was created
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.walletAddress).toBeDefined();
    expect(user.embeddedWalletAddress).toBeDefined();
    expect(user.name).toBe(userName);
    expect(user.email).toBe(userEmail);
    expect(user.privyId).toBeDefined();
    expect(user.walletLastVerifiedAt).toBeDefined();
    expect(user.lastLoginAt).toBeDefined();
    expect(apiKey).toBeDefined();

    // Create Privy token for the user (same pattern as API tests)
    const privyUser = createTestPrivyUser({
      privyId: user.privyId,
      name: user.name || undefined,
      email: user.email || undefined,
      walletAddress: user.walletAddress,
      provider: "email",
    });
    const privyToken = await createMockPrivyToken(privyUser);

    // Create RPC client with user's Privy token
    const rpcClient = await createTestRpcClient(privyToken);

    // Verify user can authenticate and get profile via RPC
    const profileResponse = await rpcClient.user.getProfile();
    expect(profileResponse).toBeDefined();
    expect(profileResponse.id).toBe(user.id);
    expect(profileResponse.name).toBe(userName);
    expect(profileResponse.email).toBe(userEmail);
  });
});
