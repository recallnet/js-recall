import axios from "axios";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/database/db.js";
import { admins } from "@/database/schema/core/defs.js";
import {
  AdminAgentResponse,
  AdminAgentsListResponse,
  AdminReactivateAgentInCompetitionResponse,
  AdminRemoveAgentFromCompetitionResponse,
  AdminUsersListResponse,
  AgentProfileResponse,
  ApiResponse,
  ErrorResponse,
  LeaderboardResponse,
  UserRegistrationResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  generateRandomEthAddress,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";

describe("Admin API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);
  });

  test("should authenticate as admin", async () => {
    console.log("TEST: Starting admin authentication test");

    // Create a test client
    const client = createTestClient();
    console.log("TEST: Created test client");

    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);
    expect(loginSuccess).toBe(true);

    // Attempt to login with incorrect API key and assert failure
    console.log("TEST: Attempting to login with invalid API key");
    const failedLogin = await client.loginAsAdmin("invalid_api_key");
    console.log(`TEST: Invalid login result: ${failedLogin}`);
    expect(failedLogin).toBe(false);

    console.log("TEST: Admin authentication test completed");
  });

  test("should register a user and agent via admin API", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

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

  test("should register a user and agent with metadata via admin API", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user with agent and metadata
    const userName = `Metadata User ${Date.now()}`;
    const userEmail = `metadata-user-${Date.now()}@test.com`;
    const agentName = `Metadata Agent ${Date.now()}`;
    const agentDescription = "A trading agent with metadata";

    // Define the metadata for the agent
    const agentMetadata = {
      skills: ["trading"],
    };
    const userMetadata = {
      website: "https://example.com",
    };

    // Register the user and agent with metadata
    const result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      userMetadata: userMetadata,
      agentName: agentName,
      agentDescription: agentDescription,
      agentMetadata: agentMetadata,
    })) as UserRegistrationResponse;

    // Assert registration success using type assertion
    expect(result.success).toBe(true);

    // Safely check user and agent properties with type assertion
    const registrationResponse = result as UserRegistrationResponse;
    expect(registrationResponse.user).toBeDefined();
    expect(registrationResponse.user.name).toBe(userName);
    expect(registrationResponse.user.email).toBe(userEmail);
    expect(registrationResponse.agent).toBeDefined();
    expect(registrationResponse.agent!.name).toBe(agentName);
    expect(registrationResponse.agent!.description).toBe(agentDescription);
    expect(registrationResponse.agent!.apiKey).toBeDefined();
    expect(registrationResponse.user.metadata).toEqual(userMetadata);

    // Now get the agent's profile to verify the metadata was saved
    const agentClient = adminClient.createAgentClient(
      registrationResponse.agent!.apiKey!,
    );
    const profileResponse = await agentClient.getAgentProfile();

    // Safely check profile properties with type assertion
    const agentProfile = profileResponse as AgentProfileResponse;
    expect(agentProfile.success).toBe(true);
    expect(agentProfile.agent.metadata).toEqual(agentMetadata);
  });

  test("should register an agent separately from a user", async () => {
    // Register a new user with no agent
    const userName = `Test User ${Date.now()}`;
    const agentName = `Test Agent ${Date.now()}`;

    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register the user
    const userWalletAddress = generateRandomEthAddress();
    const userResult = (await adminClient.registerUser({
      walletAddress: userWalletAddress,
      name: userName,
    })) as UserRegistrationResponse;
    expect(userResult.success).toBe(true);
    expect(userResult.user).toBeDefined();
    const userId = userResult.user.id;
    expect(userId).toBeDefined();

    // Register the agent with bare minimum fields
    const agentResult = (await adminClient.registerAgent({
      user: {
        walletAddress: userWalletAddress,
      },
      agent: {
        name: agentName,
      },
    })) as AdminAgentResponse;

    // Assert registration success
    expect(agentResult.success).toBe(true);
    expect(agentResult.agent).toBeDefined();
    expect(agentResult.agent.ownerId).toBe(userId);
    expect(agentResult.agent.name).toBe(agentName);

    const agentName2 = `Test Agent ${Date.now()}`;
    const agentDescription = "A test trading agent";
    const agentWalletAddress = generateRandomEthAddress();
    const agentEmail = `test-agent-${Date.now()}@test.com`;
    const agentImageUrl = "https://example.com/agent.png";
    const agentMetadata = {
      skills: ["trading"],
    };

    // Register the agent with all fields
    const agentResult2 = (await adminClient.registerAgent({
      user: {
        walletAddress: userWalletAddress,
      },
      agent: {
        name: agentName2,
        description: agentDescription,
        walletAddress: agentWalletAddress,
        email: agentEmail,
        imageUrl: agentImageUrl,
        metadata: agentMetadata,
      },
    })) as AdminAgentResponse;

    expect(agentResult2.success).toBe(true);
    expect(agentResult2.agent).toBeDefined();
    expect(agentResult2.agent.ownerId).toBe(userId);
    expect(agentResult2.agent.name).toBe(agentName2);
    expect(agentResult2.agent.description).toBe(agentDescription);
    expect(agentResult2.agent.apiKey).toBeDefined();
    expect(agentResult2.agent.walletAddress).toBe(
      agentWalletAddress.toLowerCase(),
    );
    expect(agentResult2.agent.email).toBe(agentEmail);
    expect(agentResult2.agent.imageUrl).toBe(agentImageUrl);
    expect(agentResult2.agent.metadata).toEqual(agentMetadata);
  });

  test("should fail to register an agent with an invalid user ID or user wallet address", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user with no agent
    const userName = `Test User ${Date.now()}`;
    const userWalletAddress = generateRandomEthAddress();
    const userResult = (await adminClient.registerUser({
      walletAddress: userWalletAddress,
      name: userName,
    })) as UserRegistrationResponse;
    expect(userResult.success).toBe(true);
    expect(userResult.user).toBeDefined();
    const userId = userResult.user.id;
    expect(userId).toBeDefined();

    // Register the agent with an invalid user ID
    const randomUuid = "ca00c26a-f610-477a-a472-bdaca866d789";
    const agentResult = (await adminClient.registerAgent({
      user: {
        id: randomUuid,
      },
      agent: {
        name: "Test Agent",
        description: "A test trading agent",
        walletAddress: generateRandomEthAddress(),
      },
    })) as ErrorResponse;
    expect(agentResult.success).toBe(false);
    expect(agentResult.error).toContain("does not exist");

    // Register the agent with an invalid user ID and wallet address
    const randomWalletAddress = generateRandomEthAddress();
    const agentResult2 = (await adminClient.registerAgent({
      user: {
        walletAddress: randomWalletAddress,
      },
      agent: {
        name: "Test Agent",
        description: "A test trading agent",
        walletAddress: generateRandomEthAddress(),
      },
    })) as ErrorResponse;
    expect(agentResult2.success).toBe(false);
    expect(agentResult2.error).toContain("does not exist");

    // Register the agent with both a user ID and a user wallet address
    const agentResult3 = (await adminClient.registerAgent({
      user: {
        id: randomUuid,
        walletAddress: userWalletAddress,
      },
      agent: {
        name: "Test Agent",
        description: "A test trading agent",
        walletAddress: generateRandomEthAddress(),
      },
    })) as ErrorResponse;
    expect(agentResult3.success).toBe(false);
    expect(agentResult3.error).toContain(
      "Must provide either user ID or user wallet address",
    );
  });

  test("should not allow user registration without admin auth", async () => {
    // Create a test client (not authenticated as admin)
    const client = createTestClient();

    // Attempt to register a user without admin auth
    const result = await client.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: "Unauthorized User",
      email: "unauthorized@test.com",
      agentName: "Unauthorized Agent",
    });

    // Assert failure
    expect(result.success).toBe(false);
  });

  test("should not allow registration of users with duplicate email", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register first user
    const userEmail = `same-email-${Date.now()}@test.com`;
    const firstResult = await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: `First User ${Date.now()}`,
      email: userEmail,
      agentName: `First Agent ${Date.now()}`,
    });

    // Assert first registration success
    expect(firstResult.success).toBe(true);

    // Try to register second user with the same email
    const secondResult = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: `Second User ${Date.now()}`,
      email: userEmail,
      agentName: `Second Agent ${Date.now()}`,
    })) as ErrorResponse;

    // Assert second registration failure due to duplicate email
    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toContain("email");
  });

  test("should list agents and users as admin", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user with agent first
    const userName = `User To List ${Date.now()}`;
    const userEmail = `list-${Date.now()}@test.com`;
    const agentName = `Agent To List ${Date.now()}`;

    const registerResult = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName: agentName,
    })) as UserRegistrationResponse;
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    // List agents and users
    const agentsResult =
      (await adminClient.listAgents()) as AdminAgentsListResponse;
    expect(agentsResult.success).toBe(true);
    expect(agentsResult.agents).toBeDefined();
    expect(agentsResult.agents!.length).greaterThanOrEqual(1);
    expect(agentsResult.agents![0]?.name).toBe(agentName);

    const usersResult =
      (await adminClient.listUsers()) as AdminUsersListResponse;
    expect(usersResult.success).toBe(true);
    expect(usersResult.users).toBeDefined();
    expect(usersResult.users!.length).greaterThanOrEqual(1);
    expect(usersResult.users![0]?.name).toBe(userName);
    expect(usersResult.users![0]?.email).toBe(userEmail);
  });

  test("should delete an agent as admin", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user with agent first
    const userName = `User To Delete ${Date.now()}`;
    const userEmail = `delete-${Date.now()}@test.com`;
    const agentName = `Agent To Delete ${Date.now()}`;

    const registerResult = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    })) as UserRegistrationResponse;
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    const agentId = registerResult.agent!.id;

    // Now delete the agent
    const deleteResult = (await adminClient.deleteAgent(
      agentId,
    )) as ApiResponse;

    // Assert deletion success
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.message).toContain("successfully deleted");

    // Verify the agent is gone by trying to get the list of agents
    const agentsResult =
      (await adminClient.listAgents()) as AdminAgentsListResponse;
    expect(agentsResult.success).toBe(true);

    // Check that the deleted agent is not in the list
    const deletedAgentExists = agentsResult.agents.some(
      (a: { id: string }) => a.id === agentId,
    );
    expect(deletedAgentExists).toBe(false);
  });

  test("should not allow agent deletion without admin auth", async () => {
    // Setup admin client with the API key to create an agent
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user with agent first
    const userName = `User No Delete ${Date.now()}`;
    const userEmail = `nodelete-${Date.now()}@test.com`;
    const agentName = `Agent No Delete ${Date.now()}`;

    const registerResult = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    })) as UserRegistrationResponse;
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    const agentId = registerResult.agent!.id;

    // Create a non-admin client
    const regularClient = createTestClient();

    // Try to delete the agent without admin auth
    const deleteResult = await regularClient.deleteAgent(agentId);

    // Assert deletion failure
    expect(deleteResult.success).toBe(false);

    // Verify the agent still exists
    const agentsResult =
      (await adminClient.listAgents()) as AdminAgentsListResponse;
    const agentExists = agentsResult.agents.some(
      (a: { id: string }) => a.id === agentId,
    );
    expect(agentExists).toBe(true);
  });

  test("should not allow deletion of non-existent agent", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Try to delete an agent with a non-existent ID (using a valid UUID format)
    const nonExistentId = "00000000-0000-4000-a000-000000000000"; // Valid UUID that doesn't exist
    const deleteResult = (await adminClient.deleteAgent(
      nonExistentId,
    )) as ErrorResponse;

    // Assert deletion failure
    expect(deleteResult.success).toBe(false);
    expect(deleteResult.error).toContain("not found");
  });

  test("should not allow deletion of admin accounts", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Note: Admins are now in a separate table, so we can't accidentally delete them
    // through the agent deletion endpoint. This test verifies that agent deletion works
    // correctly for regular agents.

    // Create a regular agent to delete
    const userName = `User For Admin Test ${Date.now()}`;
    const userEmail = `admin-test-${Date.now()}@test.com`;
    const agentName = `Agent For Admin Test ${Date.now()}`;

    const registerResult = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    })) as UserRegistrationResponse;
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    // Delete the agent to verify our delete functionality works correctly
    const deleteResult = await adminClient.deleteAgent(
      registerResult.agent!.id,
    );
    expect(deleteResult.success).toBe(true);
  });

  test("should search for users and agents based on various criteria", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create users with agents with distinct attributes to test the search functionality
    const timestamp = Date.now();

    // User 1: Standard active user with agent
    const user1Name = `Search User Alpha ${timestamp}`;
    const user1Email = `search-alpha-${timestamp}@test.com`;
    const agent1Name = `Search Agent Alpha ${timestamp}`;
    const user1Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: user1Name,
      email: user1Email,
      agentName: agent1Name,
    })) as UserRegistrationResponse;
    expect(user1Result.success).toBe(true);

    // User 2: Standard active user with different name pattern
    const user2Name = `Testing User Beta ${timestamp}`;
    const user2Email = `beta-${timestamp}@example.com`;
    const agent2Name = `Testing Agent Beta ${timestamp}`;
    const user2Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: user2Name,
      email: user2Email,
      agentName: agent2Name,
    })) as UserRegistrationResponse;
    expect(user2Result.success).toBe(true);

    // User 3: Standard active user to test searches
    const user3Name = `Search User Inactive ${timestamp}`;
    const user3Email = `inactive-${timestamp}@test.com`;
    const agent3Name = `Search Agent Inactive ${timestamp}`;
    const user3Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: user3Name,
      email: user3Email,
      agentName: agent3Name,
    })) as UserRegistrationResponse;
    expect(user3Result.success).toBe(true);

    // TEST CASE 1: Search by user name substring (should find user 1 and user 3)
    const nameSearchResult = await adminClient.searchUsersAndAgents({
      name: "Search User",
      searchType: "users",
    });

    expect(nameSearchResult.success).toBe(true);
    if (nameSearchResult.success) {
      expect(nameSearchResult.results.users.length).toBe(2);
      expect(
        nameSearchResult.results.users.some((u) => u.name === user1Name),
      ).toBe(true);
      expect(
        nameSearchResult.results.users.some((u) => u.name === user3Name),
      ).toBe(true);
      expect(
        nameSearchResult.results.users.some((u) => u.name === user2Name),
      ).toBe(false);
    }

    // TEST CASE 2: Search by agent name
    const agentNameSearchResult = await adminClient.searchUsersAndAgents({
      name: "Search Agent",
      searchType: "agents",
    });

    expect(agentNameSearchResult.success).toBe(true);
    if (agentNameSearchResult.success) {
      expect(agentNameSearchResult.results.agents.length).toBe(2);
      expect(
        agentNameSearchResult.results.agents.some((a) => a.name === agent1Name),
      ).toBe(true);
      expect(
        agentNameSearchResult.results.agents.some((a) => a.name === agent3Name),
      ).toBe(true);
      expect(
        agentNameSearchResult.results.agents.some((a) => a.name === agent2Name),
      ).toBe(false);
    }

    // TEST CASE 3: Search by email domain
    const emailSearchResult = await adminClient.searchUsersAndAgents({
      email: "example.com",
      searchType: "both",
    });

    expect(emailSearchResult.success).toBe(true);
    if (emailSearchResult.success) {
      expect(emailSearchResult.results.users.length).toBe(1);
      expect(emailSearchResult.results.users[0]?.email).toBe(user2Email);
    }

    // TEST CASE 4: Search by status - all users should be active by default
    const activeSearchResult = await adminClient.searchUsersAndAgents({
      status: "active",
      searchType: "both",
    });

    expect(activeSearchResult.success).toBe(true);
    if (activeSearchResult.success) {
      // All three users we created should be found as active
      expect(
        activeSearchResult.results.users.some(
          (u) => u.id === user1Result.user.id,
        ),
      ).toBe(true);
      expect(
        activeSearchResult.results.users.some(
          (u) => u.id === user2Result.user.id,
        ),
      ).toBe(true);
      expect(
        activeSearchResult.results.users.some(
          (u) => u.id === user3Result.user.id,
        ),
      ).toBe(true);

      // All three agents we created should be found as active
      expect(user1Result.agent).toBeDefined();
      expect(user2Result.agent).toBeDefined();
      expect(user3Result.agent).toBeDefined();
      expect(
        activeSearchResult.results.agents.some(
          (a) => a.id === user1Result.agent!.id,
        ),
      ).toBe(true);
      expect(
        activeSearchResult.results.agents.some(
          (a) => a.id === user2Result.agent!.id,
        ),
      ).toBe(true);
      expect(
        activeSearchResult.results.agents.some(
          (a) => a.id === user3Result.agent!.id,
        ),
      ).toBe(true);
    }

    // TEST CASE 5: Search by wallet address
    // Extract wallet address from the first user
    const walletAddress = user1Result.user.walletAddress;
    expect(walletAddress).toBeTruthy();

    // Search using a portion of the wallet address (e.g., first 10 characters after 0x)
    const partialWalletAddress = walletAddress.substring(0, 12); // 0x + first 10 chars
    console.log(
      `Searching for users with partial wallet address: ${partialWalletAddress}`,
    );

    const walletSearchResult = await adminClient.searchUsersAndAgents({
      walletAddress: partialWalletAddress,
      searchType: "users",
    });

    expect(walletSearchResult.success).toBe(true);
    if (walletSearchResult.success) {
      expect(walletSearchResult.results.users.length).toBe(1);
      expect(walletSearchResult.results.users[0]?.id).toBe(user1Result.user.id);
      expect(walletSearchResult.results.users[0]?.walletAddress).toBe(
        walletAddress,
      );
    }

    // Clean up - delete the agents we created
    expect(user1Result.agent).toBeDefined();
    expect(user2Result.agent).toBeDefined();
    expect(user3Result.agent).toBeDefined();
    await adminClient.deleteAgent(user1Result.agent!.id);
    await adminClient.deleteAgent(user2Result.agent!.id);
    await adminClient.deleteAgent(user3Result.agent!.id);
  });

  test("should generate and use new encryption key after admin setup", async () => {
    // get admin db entry
    const [result] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, ADMIN_EMAIL))
      .limit(1);
    expect(result).toBeDefined();
    expect(result?.apiKey).toBeDefined();

    // decrypting the apiKey using the default root key should not match the admin key
    const defaultEncryptionKey =
      "default_encryption_key_do_not_use_in_production";

    const decryptApiKey = (encryptedKey: string): string => {
      try {
        const algorithm = "aes-256-cbc";
        const parts = encryptedKey.split(":");

        if (parts.length !== 2) {
          throw new Error("Invalid encrypted key format");
        }

        const iv = Buffer.from(parts[0]!, "hex");
        const encrypted = parts[1]!;

        // Create a consistently-sized key from the root encryption key
        const cryptoKey = crypto
          .createHash("sha256")
          .update(defaultEncryptionKey)
          .digest();

        const decipher = crypto.createDecipheriv(algorithm, cryptoKey, iv);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
      } catch (error) {
        console.error("[AdminManager] Error decrypting API key:", error);
        throw error;
      }
    };
    // expect process.env.ENCRYPTION_KEY to be different from the default key
    expect(process.env.ROOT_ENCRYPTION_KEY).not.toBe(defaultEncryptionKey);

    // Try to decrypt the admin's API key with the default encryption key
    // This should FAIL if our fix is working (meaning a new key was generated)
    expect(() => {
      decryptApiKey(result!.apiKey!);
    }).toThrow(); // Should throw "bad decrypt" error

    console.log(
      "TEST: ✅ Cannot decrypt admin API key with default encryption key - new key was generated!",
    );
  });

  test("should update a competition as admin", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // First create a competition
    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Test Competition for Update",
        description: "Original description",
        type: "trading",
        externalUrl: "https://example.com",
        imageUrl: "https://example.com/image.jpg",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(createResponse.status).toBe(201);
    expect(createResponse.data.success).toBe(true);
    expect(createResponse.data.competition).toBeDefined();
    const competitionId = createResponse.data.competition.id;

    // Now update the competition
    const updateResponse = await axios.put(
      `${getBaseUrl()}/api/admin/competition/${competitionId}`,
      {
        name: "Updated Test Competition",
        description: "Updated description",
        externalUrl: "https://updated.com",
        imageUrl: "https://updated.com/image.jpg",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.success).toBe(true);
    expect(updateResponse.data.competition).toBeDefined();
    expect(updateResponse.data.competition.name).toBe(
      "Updated Test Competition",
    );
    expect(updateResponse.data.competition.description).toBe(
      "Updated description",
    );
    expect(updateResponse.data.competition.externalUrl).toBe(
      "https://updated.com",
    );
    expect(updateResponse.data.competition.imageUrl).toBe(
      "https://updated.com/image.jpg",
    );
    expect(updateResponse.data.competition.id).toBe(competitionId);
  }, 2400_000);

  test("should not allow competition update without admin auth", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // Create a competition first
    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Test Competition for Auth Test",
        description: "Test description",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(createResponse.status).toBe(201);
    const competitionId = createResponse.data.competition.id;

    // Try to update without auth - should fail
    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${competitionId}`,
        {
          name: "Should not work",
        },
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  test("should return error for non-existent competition update", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${nonExistentId}`,
        {
          name: "This should fail",
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Will be 500 because the service throws an error for not found
        expect(error.response.status).toBe(500);
      } else {
        throw error;
      }
    }
  });

  test("should validate competition type and reject restricted field updates", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // Create a competition first
    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Test Competition for Validation",
        description: "Test description",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(createResponse.status).toBe(201);
    const competitionId = createResponse.data.competition.id;

    // Try to update with invalid type
    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${competitionId}`,
        {
          type: "invalid_type",
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
      } else {
        throw error;
      }
    }

    // Try to update status (should be rejected as restricted field)
    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${competitionId}`,
        {
          status: "active",
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data.error).toContain(
          "Invalid competition update, attempting to update forbidden field",
        );
      } else {
        throw error;
      }
    }

    // Try to update startDate (should be rejected as restricted field)
    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${competitionId}`,
        {
          startDate: new Date().toISOString(),
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain(
          "Invalid competition update request body",
        );
      } else {
        throw error;
      }
    }

    // Try to update endDate (should be rejected as restricted field)
    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${competitionId}`,
        {
          endDate: new Date().toISOString(),
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain(
          "Invalid competition update request body",
        );
      } else {
        throw error;
      }
    }
  });

  // ===== Per-Competition Agent Management Tests =====

  test("admin can remove agent from specific competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for testing
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 - To Remove",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 - To Stay",
    });

    // Start competition with both agents
    const competitionName = `Per-Competition Remove Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id],
    );
    const competition = startResponse.competition;

    // Verify both agents are initially in the competition
    const initialLeaderboard =
      (await adminClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(initialLeaderboard.success).toBe(true);
    const initialAgentIds = initialLeaderboard.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(initialAgentIds).toContain(agent1.id);
    expect(initialAgentIds).toContain(agent2.id);

    // Remove agent1 from the competition
    const removeReason = "Violated competition-specific rules";
    const removeResponse = (await adminClient.removeAgentFromCompetition(
      competition.id,
      agent1.id,
      removeReason,
    )) as AdminRemoveAgentFromCompetitionResponse;

    // Verify removal response
    expect(removeResponse.success).toBe(true);
    expect(removeResponse.message).toContain("removed from competition");
    expect(removeResponse.competition.id).toBe(competition.id);
    expect(removeResponse.agent.id).toBe(agent1.id);

    // Verify agent1 is no longer in active leaderboard
    const updatedLeaderboard =
      (await adminClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(updatedLeaderboard.success).toBe(true);
    const activeAgentIds = updatedLeaderboard.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(activeAgentIds).not.toContain(agent1.id);
    expect(activeAgentIds).toContain(agent2.id); // agent2 should still be there

    // Verify agent1 appears in inactive agents list
    expect(updatedLeaderboard.inactiveAgents).toBeDefined();
    const inactiveAgent = updatedLeaderboard.inactiveAgents.find(
      (agent) => agent.agentId === agent1.id,
    );
    expect(inactiveAgent).toBeDefined();
    expect(inactiveAgent?.active).toBe(false);
    expect(inactiveAgent?.deactivationReason).toBe(
      `Admin removal: ${removeReason}`,
    );
  });

  test("admin can reactivate agent in specific competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for testing
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent - To Reactivate",
    });

    // Start competition with the agent
    const competitionName = `Per-Competition Reactivate Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
    const competition = startResponse.competition;

    // Remove agent from the competition first
    const removeReason = "Temporary removal for testing";
    const removeResponse = await adminClient.removeAgentFromCompetition(
      competition.id,
      agent.id,
      removeReason,
    );
    expect(removeResponse.success).toBe(true);

    // Verify agent is not in active leaderboard
    const leaderboardAfterRemoval =
      (await adminClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    const activeAgentIds = leaderboardAfterRemoval.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(activeAgentIds).not.toContain(agent.id);

    // Reactivate agent in the competition
    const reactivateResponse = (await adminClient.reactivateAgentInCompetition(
      competition.id,
      agent.id,
    )) as AdminReactivateAgentInCompetitionResponse;

    // Verify reactivation response
    expect(reactivateResponse.success).toBe(true);
    expect(reactivateResponse.message).toContain("reactivated in competition");
    expect(reactivateResponse.competition.id).toBe(competition.id);
    expect(reactivateResponse.agent.id).toBe(agent.id);

    // Verify agent is back in active leaderboard
    const leaderboardAfterReactivation =
      (await adminClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    const reactivatedAgentIds = leaderboardAfterReactivation.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(reactivatedAgentIds).toContain(agent.id);

    // Verify agent is no longer in inactive agents list
    const inactiveAgent = leaderboardAfterReactivation.inactiveAgents.find(
      (inactiveAgentEntry) => inactiveAgentEntry.agentId === agent.id,
    );
    expect(inactiveAgent).toBeUndefined();
  });

  test("cannot remove agent from non-existent competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for testing
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent - Non-existent Competition",
    });

    // Try to remove agent from non-existent competition
    const nonExistentCompetitionId = "00000000-0000-4000-a000-000000000000";
    const removeResponse = (await adminClient.removeAgentFromCompetition(
      nonExistentCompetitionId,
      agent.id,
      "Testing non-existent competition",
    )) as ErrorResponse;

    // Verify operation fails
    expect(removeResponse.success).toBe(false);
    expect(removeResponse.error).toContain("not found");
  });

  test("cannot remove non-existent agent from competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and start competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent - For Valid Competition",
    });

    const competitionName = `Valid Competition Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
    const competition = startResponse.competition;

    // Try to remove non-existent agent
    const nonExistentAgentId = "00000000-0000-4000-a000-000000000000";
    const removeResponse = (await adminClient.removeAgentFromCompetition(
      competition.id,
      nonExistentAgentId,
      "Testing non-existent agent",
    )) as ErrorResponse;

    // Verify operation fails
    expect(removeResponse.success).toBe(false);
    expect(removeResponse.error).toContain("not found");
  });

  test("cannot remove agent not participating in competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 - In Competition",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 - Not In Competition",
    });

    // Start competition with only agent1
    const competitionName = `Single Agent Competition Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id],
    );
    const competition = startResponse.competition;

    // Try to remove agent2 (who is not in the competition)
    const removeResponse = (await adminClient.removeAgentFromCompetition(
      competition.id,
      agent2.id,
      "Testing agent not in competition",
    )) as ErrorResponse;

    // Verify operation fails
    expect(removeResponse.success).toBe(false);
    expect(removeResponse.error).toContain(
      "not participating in this competition",
    );
  });

  test("cannot reactivate agent not in competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 - In Competition",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 - Not In Competition",
    });

    // Start competition with only agent1
    const competitionName = `Reactivate Not In Competition Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id],
    );
    const competition = startResponse.competition;

    // Try to reactivate agent2 (who is not in the competition)
    const reactivateResponse = (await adminClient.reactivateAgentInCompetition(
      competition.id,
      agent2.id,
    )) as ErrorResponse;

    // Verify operation fails
    expect(reactivateResponse.success).toBe(false);
    expect(reactivateResponse.error).toContain("not in this competition");
  });

  test("per-competition operations require admin authentication", async () => {
    // Setup admin client to create competition and agents
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and start competition
    const { client: userClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent - Auth Test",
      });

    const competitionName = `Auth Test Competition ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
    const competition = startResponse.competition;

    // Try per-competition operations with non-admin client
    const removeResponse = (await userClient.removeAgentFromCompetition(
      competition.id,
      agent.id,
      "Unauthorized removal attempt",
    )) as ErrorResponse;

    const reactivateResponse = (await userClient.reactivateAgentInCompetition(
      competition.id,
      agent.id,
    )) as ErrorResponse;

    // Verify both operations fail due to lack of admin rights
    expect(removeResponse.success).toBe(false);
    expect(removeResponse.error).toBeDefined();

    expect(reactivateResponse.success).toBe(false);
    expect(reactivateResponse.error).toBeDefined();
  });

  test("per-competition status is independent of global status", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for testing
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent - Status Independence Test",
      });

    // Start competition with the agent
    const competitionName = `Status Independence Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
    const competition = startResponse.competition;

    // Verify agent can access API initially
    const initialProfile = await agentClient.getAgentProfile();
    expect(initialProfile.success).toBe(true);

    // Remove agent from competition (per-competition deactivation)
    const removeResponse = await adminClient.removeAgentFromCompetition(
      competition.id,
      agent.id,
      "Testing per-competition status independence",
    );
    expect(removeResponse.success).toBe(true);

    // Agent should still be able to access API (global status unchanged)
    const profileAfterRemoval = await agentClient.getAgentProfile();
    expect(profileAfterRemoval.success).toBe(true);

    // Now globally deactivate the agent
    const globalDeactivateResponse = await adminClient.deactivateAgent(
      agent.id,
      "Testing global deactivation",
    );
    expect(globalDeactivateResponse.success).toBe(true);

    // Agent should now be blocked from API access
    try {
      await agentClient.getAgentProfile();
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Reactivate agent in competition (should not affect global status)
    const reactivateInCompetitionResponse =
      await adminClient.reactivateAgentInCompetition(competition.id, agent.id);
    expect(reactivateInCompetitionResponse.success).toBe(true);

    // Agent should still be blocked from API access (global status still inactive)
    try {
      await agentClient.getAgentProfile();
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Globally reactivate the agent
    const globalReactivateResponse = await adminClient.reactivateAgent(
      agent.id,
    );
    expect(globalReactivateResponse.success).toBe(true);

    // Wait for cache to update
    await wait(100);

    // Agent should now be able to access API again
    const finalProfile = await agentClient.getAgentProfile();
    expect(finalProfile.success).toBe(true);
  });
});
