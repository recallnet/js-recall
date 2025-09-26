import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import {
  admins,
  competitionRewards,
  competitions,
} from "@recallnet/db/schema/core/defs";
import { tradingConstraints } from "@recallnet/db/schema/trading/defs";

import { db } from "@/database/db.js";
import {
  AdminAgentResponse,
  AdminAgentsListResponse,
  AdminReactivateAgentInCompetitionResponse,
  AdminRemoveAgentFromCompetitionResponse,
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  AgentProfileResponse,
  ApiResponse,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CreateCompetitionResponse,
  ErrorResponse,
  LeaderboardResponse,
  UpdateCompetitionResponse,
  UserRegistrationResponse,
} from "@/e2e/utils/api-types.js";
import { generateRandomPrivyId } from "@/e2e/utils/privy.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  createPerpsTestCompetition,
  createTestClient,
  createTestCompetition,
  generateRandomEthAddress,
  generateTestHandle,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startPerpsTestCompetition,
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";

describe("Admin API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should authenticate as admin", async () => {
    // Create a test client
    const client = createTestClient();

    // Attempt to login as admin with correct API key
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Attempt to login with incorrect API key and assert failure
    const failedLogin = await client.loginAsAdmin("invalid_api_key");
    expect(failedLogin).toBe(false);
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
    const agentHandle = generateTestHandle();

    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register the user
    const userWalletAddress = generateRandomEthAddress();
    const userResult = (await adminClient.registerUser({
      walletAddress: userWalletAddress,
      name: userName,
      email: `${userName.toLowerCase().replace(/\s+/g, "-")}@test.com`,
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
        handle: agentHandle,
      },
    })) as AdminAgentResponse;

    // Assert registration success
    expect(agentResult.success).toBe(true);
    expect(agentResult.agent).toBeDefined();
    expect(agentResult.agent.ownerId).toBe(userId);
    expect(agentResult.agent.name).toBe(agentName);
    expect(agentResult.agent.handle).toBe(agentHandle);

    const agentName2 = `Test Agent ${Date.now()}`;
    const agentHandle2 = generateTestHandle();
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
        handle: agentHandle2,
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
    expect(agentResult2.agent.handle).toBe(agentHandle2);
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
      email: `${userName.toLowerCase().replace(/\s+/g, "-")}@test.com`,
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

  test("should update existing user on duplicate email", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register first user
    const email = `same-email-${Date.now()}@test.com`;
    const originalUserName = `First User ${Date.now()}`;
    const originalWalletAddress = generateRandomEthAddress();
    const firstResult = (await adminClient.registerUser({
      walletAddress: originalWalletAddress,
      name: originalUserName,
      email,
      agentName: `First Agent ${Date.now()}`,
    })) as UserRegistrationResponse;

    // Assert first registration success
    expect(firstResult.success).toBe(true);
    const originalUser = firstResult.user!;

    // Try to register second user with the same email
    const newName = `Second User ${Date.now()}`;
    const secondResult = (await adminClient.registerUser({
      walletAddress: originalWalletAddress,
      name: newName,
      email,
      agentName: `Second Agent ${Date.now()}`,
    })) as UserRegistrationResponse;

    // Assert second registration success (note: certain fields might prefer "original" user on conflict)
    expect(secondResult.success).toBe(true);
    expect(secondResult.user).toBeDefined();
    expect(secondResult.user.email).toBe(email);
    expect(secondResult.user.name).not.toBe(newName); // Original name should be preserved
    expect(secondResult.user.walletAddress).toBe(originalUser.walletAddress);
    expect(secondResult.user.walletLastVerifiedAt).toBe(
      originalUser.walletLastVerifiedAt,
    );
    expect(secondResult.user.embeddedWalletAddress).toBe(
      originalUser.embeddedWalletAddress,
    );
    expect(secondResult.user.privyId).toBe(originalUser.privyId);
    expect(secondResult.user.status).toBe(originalUser.status);
    expect(secondResult.user.metadata).toBe(originalUser.metadata);
    expect(secondResult.user.createdAt).toBe(originalUser.createdAt);
    expect(secondResult.user.updatedAt).not.toBe(originalUser.updatedAt);
    expect(secondResult.user.lastLoginAt).not.toBe(originalUser.lastLoginAt);
  });

  test("should not allow user registration with duplicate wallet address", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated client
    const originalWalletAddress = generateRandomEthAddress();
    const user1Email = `user1@example.com`;
    const { user: originalUser } = (await adminClient.registerUser({
      walletAddress: originalWalletAddress,
      name: "First User",
      email: user1Email,
    })) as UserRegistrationResponse;
    expect(originalUser).toBeDefined();

    // Try to create a user with the same wallet address - should fail
    const user2Email = `user2@example.com`;
    const user2Result = (await adminClient.registerUser({
      walletAddress: originalWalletAddress,
      name: "Second User",
      email: user2Email,
    })) as ErrorResponse;
    expect(user2Result.success).toBe(false);
    expect(user2Result.error).toContain(
      "A user with this walletAddress already exists",
    );
  });

  test("should not allow user registration with duplicate privyId", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated client
    const originalPrivyId = generateRandomPrivyId();
    const originalWalletAddress = generateRandomEthAddress();
    const originalUserEmail = `user1@example.com`;
    const { user: originalUser } = (await adminClient.registerUser({
      walletAddress: originalWalletAddress,
      privyId: originalPrivyId,
      name: "First User",
      email: originalUserEmail,
    })) as UserRegistrationResponse;
    expect(originalUser).toBeDefined();

    // Try to create a user with the same privyId - should fail
    const user2Email = `user2@example.com`;
    const user2Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      privyId: originalPrivyId,
      name: "Second User",
      email: user2Email, // Use a different email else it'll update on conflict
    })) as ErrorResponse;
    expect(user2Result.success).toBe(false);
    expect(user2Result.error).toContain(
      "A user with this privyId already exists",
    );
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

  test("should update an agent as admin", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user with agent first
    const userName = `User To Update ${Date.now()}`;
    const userEmail = `update-${Date.now()}@test.com`;
    const agentName = `Agent To Update ${Date.now()}`;

    const registerResult = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    })) as UserRegistrationResponse;
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    // Now update the agent
    const updateResult = (await adminClient.updateAgentAsAdmin(
      registerResult.agent!.id,
      {
        name: "Updated Name",
        description: "Updated Description",
        imageUrl: "https://example.com/updated-image.jpg",
      },
    )) as AgentProfileResponse;
    expect(updateResult.success).toBe(true);
    expect(updateResult.agent).toBeDefined();
    expect(updateResult.agent.name).toBe("Updated Name");
    expect(updateResult.agent.description).toBe("Updated Description");
    expect(updateResult.agent.imageUrl).toBe(
      "https://example.com/updated-image.jpg",
    );
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
    const agent1Handle = generateTestHandle();
    const user1Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: user1Name,
      email: user1Email,
      agentName: agent1Name,
      agentHandle: agent1Handle,
    })) as UserRegistrationResponse;
    expect(user1Result.success).toBe(true);

    // User 2: Standard active user with different name pattern
    const user2Name = `Testing User Beta ${timestamp}`;
    const user2Email = `beta-${timestamp}@example.com`;
    const agent2Name = `Testing Agent Beta ${timestamp}`;
    const agent2Handle = generateTestHandle();
    const user2Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: user2Name,
      email: user2Email,
      agentName: agent2Name,
      agentHandle: agent2Handle,
    })) as UserRegistrationResponse;
    expect(user2Result.success).toBe(true);

    // User 3: Standard active user to test searches
    const user3Name = `Search User Inactive ${timestamp}`;
    const user3Email = `inactive-${timestamp}@test.com`;
    const agent3Name = `Search Agent Inactive ${timestamp}`;
    const agent3Handle = generateTestHandle();
    const user3Result = (await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: user3Name,
      email: user3Email,
      agentName: agent3Name,
      agentHandle: agent3Handle,
    })) as UserRegistrationResponse;
    expect(user3Result.success).toBe(true);

    // TEST CASE 1: Search by user name substring (should find user 1 and user 3)
    const nameSearchResult = (await adminClient.searchUsersAndAgents({
      user: {
        name: "Search User",
      },
    })) as AdminSearchUsersAndAgentsResponse;

    expect(nameSearchResult.success).toBe(true);
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
    expect(nameSearchResult.results.agents.length).toBe(0);

    // TEST CASE 2: Search by agent name
    const agentNameSearchResult = (await adminClient.searchUsersAndAgents({
      agent: {
        name: "Search Agent",
      },
    })) as AdminSearchUsersAndAgentsResponse;

    expect(agentNameSearchResult.success).toBe(true);
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
    expect(nameSearchResult.results.agents.length).toBe(0);

    // Verify that apiKey is not present in agent responses (sanitizeAgent function working)
    agentNameSearchResult.results.agents.forEach((agent) => {
      expect(agent).not.toHaveProperty("apiKey");
      expect(agent).not.toHaveProperty("email");
    });

    // TEST CASE 3: Search by email domain
    const emailSearchResult = (await adminClient.searchUsersAndAgents({
      user: {
        email: "example.com",
      },
    })) as AdminSearchUsersAndAgentsResponse;

    expect(emailSearchResult.success).toBe(true);
    expect(emailSearchResult.results.users.length).toBe(1);
    expect(emailSearchResult.results.users[0]?.email).toBe(user2Email);

    // TEST CASE 4: Search by status - all users should be active by default
    const activeSearchResult = (await adminClient.searchUsersAndAgents({
      user: {
        status: "active",
      },
      agent: {
        status: "active",
      },
      join: false, // default is false (no join)
    })) as AdminSearchUsersAndAgentsResponse;

    expect(activeSearchResult.success).toBe(true);
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

    // Verify that apiKey is not present in agent responses (sanitizeAgent function working)
    activeSearchResult.results.agents.forEach((agent) => {
      expect(agent).not.toHaveProperty("apiKey");
      expect(agent).not.toHaveProperty("email");
    });

    // TEST CASE 5: Search by wallet address
    // Extract wallet address from the first user
    const walletAddress = user1Result.user.walletAddress;
    expect(walletAddress).toBeTruthy();

    // Search using a portion of the wallet address (e.g., first 10 characters after 0x)
    const partialWalletAddress = walletAddress!.substring(0, 12); // 0x + first 10 chars

    const walletSearchResult = (await adminClient.searchUsersAndAgents({
      user: {
        walletAddress: partialWalletAddress,
      },
    })) as AdminSearchUsersAndAgentsResponse;

    expect(walletSearchResult.success).toBe(true);
    expect(walletSearchResult.results.users.length).toBe(1);
    expect(walletSearchResult.results.users[0]?.id).toBe(user1Result.user.id);
    expect(walletSearchResult.results.users[0]?.walletAddress).toBe(
      walletAddress,
    );
    expect(walletSearchResult.results.agents.length).toBe(0);

    // TEST CASE 6: Join query - find agents by name that are owned by a user with specific wallet address
    // Add one more agent to user 1 called "search alpha 2"
    const agent1_2Name = `Search Agent Alpha 2 ${timestamp}`;
    const agent1_2Result = (await adminClient.registerAgent({
      user: {
        walletAddress: user1Result.user.walletAddress,
      },
      agent: {
        name: agent1_2Name,
        description: "Second agent for user 1",
      },
    })) as AdminAgentResponse;
    expect(agent1_2Result.success).toBe(true);
    expect(agent1_2Result.agent.ownerId).toBe(user1Result.user.id);

    // Use the wallet address from user1
    const user1WalletAddress = user1Result.user.walletAddress;

    // Perform the join query - search for agents with "Search Agent" in name owned by user1
    const joinQueryResult = (await adminClient.searchUsersAndAgents({
      user: {
        walletAddress: user1WalletAddress!.substring(0, 12), // Use partial wallet address
      },
      agent: {
        name: "Search Agent",
      },
      join: true,
    })) as AdminSearchUsersAndAgentsResponse;

    // Verify search results
    expect(joinQueryResult.success).toBe(true);

    // Should find only the agent from user1
    expect(joinQueryResult.results.agents.length).toBe(2);

    // Verify the correct agents was found (user1's agent)
    expect(joinQueryResult.results.agents[0]?.name).toBe(agent1Name);
    expect(joinQueryResult.results.agents[1]?.name).toBe(agent1_2Name);

    // Verify the agents belongs to user1
    expect(joinQueryResult.results.agents[0]?.ownerId).toBe(
      user1Result.user.id,
    );
    expect(joinQueryResult.results.agents[1]?.ownerId).toBe(
      user1Result.user.id,
    );

    // Verify user3's agent (which also has "Search Agent" in name) was not found
    // because we filtered by user1's wallet address
    const foundAgentIds = joinQueryResult.results.agents.map((a) => a.id);
    expect(foundAgentIds).not.toContain(user3Result.agent!.id);

    // Verify that apiKey is not present in agent responses (sanitizeAgent function working)
    joinQueryResult.results.agents.forEach((agent) => {
      expect(agent).not.toHaveProperty("apiKey");
      expect(agent).not.toHaveProperty("email");
    });

    // TEST CASE 7: search for user and agents with all possible filters
    const allFiltersResult = (await adminClient.searchUsersAndAgents({
      user: {
        name: "Search User",
        email: "search-alpha-${timestamp}@test.com",
        status: "active",
        walletAddress: user1Result.user.walletAddress || undefined,
      },
      agent: {
        name: "Search Agent",
        ownerId: user1Result.user.id,
        status: "active",
        walletAddress: user1Result.user.walletAddress || undefined,
      },
      join: false,
    })) as AdminSearchUsersAndAgentsResponse;
    // Expect no errors (we don't care about the response here; just the zod parsing)
    expect(allFiltersResult.success).toBe(true);

    // Clean up - delete the agents we created
    expect(user1Result.agent).toBeDefined();
    expect(user2Result.agent).toBeDefined();
    expect(user3Result.agent).toBeDefined();
    await adminClient.deleteAgent(user1Result.agent!.id);
    await adminClient.deleteAgent(user2Result.agent!.id);
    await adminClient.deleteAgent(user3Result.agent!.id);
  });

  test("should use 'join' with different query param formats", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Standard user with agent
    const agentName = `Search Agent Join`;
    const walletAddress = generateRandomEthAddress();
    const userResult = (await adminClient.registerUser({
      walletAddress: walletAddress,
      agentName: agentName,
      email: `user-${Date.now()}@test.com`,
    })) as UserRegistrationResponse;
    expect(userResult.success).toBe(true);

    // Random agent (used for testing `join` param)
    const randomUserWalletAddress = generateRandomEthAddress();
    const randomAgentName = `Random Name ${Date.now()}`;
    const randomUserResult = (await adminClient.registerUser({
      walletAddress: randomUserWalletAddress,
      agentName: randomAgentName,
      email: `random-user-${Date.now()}@test.com`,
    })) as UserRegistrationResponse;
    expect(randomUserResult.success).toBe(true);

    // Set up axios client with the admin API key
    const headers = {
      Authorization: `Bearer ${adminApiKey}`,
    };
    // We'll check with: first user's wallet, but also the random agent name not owned by the user
    const searchParams = new URLSearchParams();
    searchParams.set("user.walletAddress", walletAddress);
    searchParams.set("agent.name", randomAgentName);
    const baseUrl = `${getBaseUrl()}/api/admin/search?${searchParams.toString()}`;

    // Case 1: no `join` param => returns all users and agents w/o `join`
    let url = `${baseUrl}`;
    let response = await axios.get(url, { headers });
    expect(response.data.success).toBe(true);
    expect(response.data.join).toBe(false);
    expect(response.data.results.users.length).toBe(1);
    expect(response.data.results.agents.length).toBe(1);

    // Case 2: Explicit join=false => returns all users and agents w/o `join`
    url = `${baseUrl}&join=false`;
    response = await axios.get(url, { headers });
    expect(response.data.success).toBe(true);
    expect(response.data.join).toBe(false);
    expect(response.data.results.users.length).toBe(1);
    expect(response.data.results.agents.length).toBe(1);

    // Case 3: Explicit join=true => returns all users and agents w/ `join` (no agents found)
    url = `${baseUrl}&join=true`;
    searchParams.set("agent.name", "foo");
    response = await axios.get(url, { headers });
    expect(response.data.success).toBe(true);
    expect(response.data.join).toBe(true);
    expect(response.data.results.users.length).toBe(1);
    expect(response.data.results.agents.length).toBe(0);

    // Case 4: `join` as standalone param (aka `join=true`) => returns all users and agents w/ `join` (no agents found)
    url = `${baseUrl}&join`;
    searchParams.set("agent.name", "foo");
    response = await axios.get(url, { headers });
    expect(response.data.success).toBe(true);
    expect(response.data.join).toBe(true);
    expect(response.data.results.users.length).toBe(1);
    expect(response.data.results.agents.length).toBe(0);
  });

  test("should fail to search for users and agents with invalid query params", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const headers = {
      Authorization: `Bearer ${adminApiKey}`,
    };
    const baseUrl = `${getBaseUrl()}/api/admin/search`;

    // Case 1: invalid `user` filter value
    let query = "user.status=invalid_status";
    let url = `${baseUrl}?${query}`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 2: invalid `user` filter param
    url = `${baseUrl}?user.foo=invalid_foo`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 3: invalid `agent` filter value
    query = "agent.status=invalid_status";
    url = `${baseUrl}?${query}`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 4: invalid `agent` filter param
    url = `${baseUrl}?agent.foo=invalid_foo`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 5: both `agent` and `user` filter params with invalid values
    query = "agent.name=invalid_name&user.status=invalid_status";
    url = `${baseUrl}?${query}`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 6: both `agent` and `user` filter params with invalid params
    url = `${baseUrl}?agent.foo=invalid_foo&user.foo=active`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 7: invalid field name
    query = "foo=bar";
    url = `${baseUrl}?${query}`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 8: invalid join param
    query = "join=invalid_join";
    url = `${baseUrl}?${query}`;
    await expect(axios.get(url, { headers })).rejects.toThrow();

    // Case 9: empty search params
    url = `${baseUrl}`;
    await expect(axios.get(url, { headers })).rejects.toThrow();
    url = `${baseUrl}?`;
    await expect(axios.get(url, { headers })).rejects.toThrow();
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
    };
    // expect process.env.ENCRYPTION_KEY to be different from the default key
    expect(process.env.ROOT_ENCRYPTION_KEY).not.toBe(defaultEncryptionKey);

    // Try to decrypt the admin's API key with the default encryption key
    // This should FAIL if our fix is working (meaning a new key was generated)
    expect(() => {
      decryptApiKey(result!.apiKey!);
    }).toThrow(); // Should throw "bad decrypt" error
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
        expect(error.response.status).toBe(400);
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id],
    });
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id],
    });
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
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
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
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

  test("should update a competition with rewards and tradingConstraints", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // First create a competition
    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Test Competition with Rewards",
        description: "Competition to test rewards update",
        type: "trading",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(createResponse.status).toBe(201);
    expect(createResponse.data.success).toBe(true);
    const competitionId = createResponse.data.competition.id;

    // Now update the competition with rewards
    const updateResponse = await axios.put(
      `${getBaseUrl()}/api/admin/competition/${competitionId}`,
      {
        name: "Updated Competition with Rewards",
        description: "Updated with rewards",
        rewards: {
          1: 1000,
          2: 500,
          3: 250,
        },
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
      "Updated Competition with Rewards",
    );
    expect(updateResponse.data.competition.description).toBe(
      "Updated with rewards",
    );
    // Check that rewards were properly applied
    expect(updateResponse.data.competition.rewards).toBeDefined();
    expect(updateResponse.data.competition.rewards).toHaveLength(3);
    expect(updateResponse.data.competition.rewards).toContainEqual({
      rank: 1,
      reward: 1000,
    });
    expect(updateResponse.data.competition.rewards).toContainEqual({
      rank: 2,
      reward: 500,
    });
    expect(updateResponse.data.competition.rewards).toContainEqual({
      rank: 3,
      reward: 250,
    });
  });

  test("should create a perps competition as admin", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // Create a perps competition with required provider configuration using helper
    const response = await createPerpsTestCompetition({
      adminClient: client,
      name: "Test Perps Competition",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567", // Mock server URL
      },
    });

    expect(response.success).toBe(true);
    expect(response.competition).toBeDefined();
    expect(response.competition.name).toBe("Test Perps Competition");
    expect(response.competition.type).toBe("perpetual_futures");
    expect(response.competition.status).toBe("pending");
  });

  test("should update competition with only perpsProvider field", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // First create a regular trading competition using the helper
    const createResponse = await createTestCompetition({
      adminClient: client,
      name: "Test Competition for Type Change",
      description: "Competition to test perpsProvider-only update",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    expect(createResponse.competition).toBeDefined();
    const competitionId = createResponse.competition.id;

    // Update ONLY the perpsProvider field to convert to perps competition
    const updateResponse = (await client.updateCompetition(competitionId, {
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    })) as UpdateCompetitionResponse;

    // This should succeed now with the fix
    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition).toBeDefined();
    // Verify the competition type was changed to perpetual_futures
    expect(updateResponse.competition.type).toBe("perpetual_futures");
    // Name and description should remain unchanged
    expect(updateResponse.competition.name).toBe(
      "Test Competition for Type Change",
    );
    expect(updateResponse.competition.description).toBe(
      "Competition to test perpsProvider-only update",
    );
  });

  test("should update perpsProvider settings for existing perps competition", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // First create a perps competition directly
    const createResponse = (await client.createCompetition({
      name: "Existing Perps Competition",
      description: "Competition to test perpsProvider updates",
      type: "perpetual_futures",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 100,
        apiUrl: "http://localhost:4567",
      },
    })) as CreateCompetitionResponse;

    expect(createResponse.success).toBe(true);
    expect(createResponse.competition).toBeDefined();
    const competitionId = createResponse.competition.id;

    // Verify initial settings
    expect(createResponse.competition.type).toBe("perpetual_futures");

    // Update the perpsProvider settings
    const updateResponse = (await client.updateCompetition(competitionId, {
      perpsProvider: {
        provider: "symphony",
        initialCapital: 2000,
        selfFundingThreshold: 500, // Changed from 100 to 500
        apiUrl: "http://localhost:4567",
      },
    })) as UpdateCompetitionResponse;

    // This should now succeed with our fix
    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition).toBeDefined();
    // Verify the competition type remains perpetual_futures
    expect(updateResponse.competition.type).toBe("perpetual_futures");
    // Name and description should remain unchanged
    expect(updateResponse.competition.name).toBe("Existing Perps Competition");
    expect(updateResponse.competition.description).toBe(
      "Competition to test perpsProvider updates",
    );

    // For now, the test verifies the update doesn't throw an error
  });

  test("should start a perps competition with agents", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Agent 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Agent 2",
    });

    // Start a perps competition with the agents
    const competitionName = `Perps Competition ${Date.now()}`;
    const startResponse = await startPerpsTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

    // Verify the competition was started successfully
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition).toBeDefined();
    expect(startResponse.competition.name).toBe(competitionName);
    expect(startResponse.competition.type).toBe("perpetual_futures");
    expect(startResponse.competition.status).toBe("active");

    // For perps competitions, the agents are participating in the competition
    // The initializedAgents field may not be present for perps competitions since
    // we don't initialize traditional balances
    expect(startResponse.competition.agentIds).toBeDefined();
    expect(Array.isArray(startResponse.competition.agentIds)).toBe(true);
    expect(startResponse.competition.agentIds).toContain(agent1.id);
    expect(startResponse.competition.agentIds).toContain(agent2.id);
  });

  test("should atomically rollback competition update when rewards fail", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // First create a competition with initial rewards
    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Atomic Test Competition",
        description: "Testing atomic updates",
        type: "trading",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(createResponse.status).toBe(201);
    const competitionId = createResponse.data.competition.id;

    // Add initial rewards
    await axios.put(
      `${getBaseUrl()}/api/admin/competition/${competitionId}`,
      {
        rewards: {
          1: 100,
          2: 50,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    // Get initial state
    const [initialCompetition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId));
    expect(initialCompetition).toBeDefined();
    const initialName = initialCompetition!.name;

    // Try to update with invalid rewards structure that will fail validation
    try {
      await axios.put(
        `${getBaseUrl()}/api/admin/competition/${competitionId}`,
        {
          name: "This Should Not Be Saved",
          description: "This update should be rolled back",
          rewards: {
            "-1": 1000, // Invalid rank (negative)
            "0": 500, // Invalid rank (zero)
          },
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect.fail("Expected request to fail");
    } catch (error) {
      const axiosError = error as AxiosError;
      expect(axiosError.response?.status).toBe(400);
    }

    // Verify the competition was not updated (transaction rolled back)
    const [finalCompetition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId));

    expect(finalCompetition).toBeDefined();
    expect(finalCompetition!.name).toBe(initialName);
    expect(finalCompetition!.description).toBe("Testing atomic updates");
  });

  test("should atomically update competition with trading constraints", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // Create a competition
    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Trading Constraints Test",
        description: "Testing constraints update",
        type: "trading",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    const competitionId = createResponse.data.competition.id;

    // Update with all components atomically
    const updateResponse = await axios.put(
      `${getBaseUrl()}/api/admin/competition/${competitionId}`,
      {
        name: "Updated with Constraints",
        rewards: {
          1: 5000,
          2: 2500,
          3: 1000,
        },
        tradingConstraints: {
          minimumPairAgeHours: 72,
          minimum24hVolumeUsd: 50000,
          minimumLiquidityUsd: 100000,
          minimumFdvUsd: 500000,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.competition.name).toBe(
      "Updated with Constraints",
    );
    expect(updateResponse.data.competition.rewards).toHaveLength(3);

    // Verify all data was saved in the database
    const [competition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId));
    expect(competition).toBeDefined();
    expect(competition!.name).toBe("Updated with Constraints");

    const constraints = await db
      .select()
      .from(tradingConstraints)
      .where(eq(tradingConstraints.competitionId, competitionId));
    expect(constraints).toHaveLength(1);
    expect(constraints[0]).toBeDefined();
    expect(constraints[0]!.minimumPairAgeHours).toBe(72);
    expect(constraints[0]!.minimum24hVolumeUsd).toBe(50000);

    const rewards = await db
      .select()
      .from(competitionRewards)
      .where(eq(competitionRewards.competitionId, competitionId))
      .orderBy(competitionRewards.rank);
    expect(rewards).toHaveLength(3);
    expect(rewards[0]).toBeDefined();
    expect(rewards[0]!.reward).toBe(5000);
    expect(rewards[1]!.reward).toBe(2500);
    expect(rewards[2]!.reward).toBe(1000);
  });

  test("should atomically rollback competition creation when rewards fail", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    // Try to create a competition with invalid rewards that will fail validation
    try {
      await axios.post(
        `${getBaseUrl()}/api/admin/competition/create`,
        {
          name: "Should Not Be Created",
          description: "This competition should be rolled back",
          tradingType: "disallowAll",
          sandboxMode: false,
          type: "trading",
          rewards: {
            "-1": 1000, // Invalid rank (negative)
            "0": 500, // Invalid rank (zero)
          },
        },
        {
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
          },
        },
      );
      expect.fail("Expected request to fail");
    } catch (error) {
      const axiosError = error as AxiosError;
      expect(axiosError.response?.status).toBe(400);
    }

    // Verify no competition was created
    const allCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.name, "Should Not Be Created"));
    expect(allCompetitions).toHaveLength(0);

    // Verify no constraints were created
    const allConstraints = await db.select().from(tradingConstraints);
    const initialConstraintCount = allConstraints.length;

    // Try another creation that should succeed to verify the count
    const validResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Valid Competition After Rollback",
        description: "This should succeed",
        tradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(validResponse.data.success).toBe(true);

    const newConstraints = await db.select().from(tradingConstraints);
    expect(newConstraints.length).toBe(initialConstraintCount + 1);
  });

  test("should atomically create competition with constraints and rewards", async () => {
    const client = createTestClient(getBaseUrl());
    await client.loginAsAdmin(adminApiKey);

    const createResponse = await axios.post(
      `${getBaseUrl()}/api/admin/competition/create`,
      {
        name: "Atomic Create Test",
        description: "Testing atomic creation",
        tradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
        tradingConstraints: {
          minimumPairAgeHours: 96,
          minimum24hVolumeUsd: 75000,
          minimumLiquidityUsd: 150000,
          minimumFdvUsd: 500000,
        },
        rewards: {
          1: 10000,
          2: 5000,
          3: 2000,
          4: 1000,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${adminApiKey}`,
        },
      },
    );

    expect(createResponse.data.success).toBe(true);
    const competitionId = createResponse.data.competition.id;

    // Verify all data was created atomically in the database
    const [competition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId));
    expect(competition).toBeDefined();
    expect(competition!.name).toBe("Atomic Create Test");

    const constraints = await db
      .select()
      .from(tradingConstraints)
      .where(eq(tradingConstraints.competitionId, competitionId));
    expect(constraints).toHaveLength(1);
    expect(constraints[0]?.minimumPairAgeHours).toBe(96);
    expect(constraints[0]?.minimum24hVolumeUsd).toBe(75000);

    const rewards = await db
      .select()
      .from(competitionRewards)
      .where(eq(competitionRewards.competitionId, competitionId))
      .orderBy(competitionRewards.rank);
    expect(rewards).toHaveLength(4);
    expect(rewards[0]?.reward).toBe(10000);
    expect(rewards[3]?.reward).toBe(1000);
  });

  test("should convert pending competition from spot trading to perps", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a spot trading competition
    const createResponse = await adminClient.createCompetition({
      name: "Competition To Convert to Perps",
      description: "Test converting spot to perps",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = (createResponse as CreateCompetitionResponse)
      .competition.id;

    // Verify it's a trading competition
    const detailsBeforeUpdate = await adminClient.getCompetition(competitionId);
    expect(detailsBeforeUpdate.success).toBe(true);
    expect(
      (detailsBeforeUpdate as CompetitionDetailResponse).competition.type,
    ).toBe("trading");

    // Convert to perps type
    const updateResponse = await adminClient.updateCompetition(competitionId, {
      type: "perpetual_futures",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UpdateCompetitionResponse).competition.type).toBe(
      "perpetual_futures",
    );

    // Verify the type has changed
    const detailsAfterUpdate = await adminClient.getCompetition(competitionId);
    expect(detailsAfterUpdate.success).toBe(true);
    expect(
      (detailsAfterUpdate as CompetitionDetailResponse).competition.type,
    ).toBe("perpetual_futures");
  });

  test("should convert pending competition from perps to spot trading", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a perps competition
    const createResponse = await createPerpsTestCompetition({
      adminClient,
      name: "Perps Competition To Convert to Spot",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Verify it's a perps competition
    const detailsBeforeUpdate = await adminClient.getCompetition(competitionId);
    expect(detailsBeforeUpdate.success).toBe(true);
    expect(
      (detailsBeforeUpdate as CompetitionDetailResponse).competition.type,
    ).toBe("perpetual_futures");

    // Convert to spot trading type
    const updateResponse = await adminClient.updateCompetition(competitionId, {
      type: "trading",
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UpdateCompetitionResponse).competition.type).toBe(
      "trading",
    );

    // Verify the type has changed
    const detailsAfterUpdate = await adminClient.getCompetition(competitionId);
    expect(detailsAfterUpdate.success).toBe(true);
    expect(
      (detailsAfterUpdate as CompetitionDetailResponse).competition.type,
    ).toBe("trading");
  });

  test("should not allow converting active competition type", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create and start a spot trading competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent for Active Competition",
    });

    const startResponse = await startTestCompetition({
      adminClient,
      name: "Active Competition - No Type Change",
      agentIds: [agent.id],
    });

    expect(startResponse.success).toBe(true);
    const competitionId = startResponse.competition.id;

    // Verify it's active
    expect(startResponse.competition.status).toBe("active");

    // Try to convert to perps (should fail)
    const updateResponse = await adminClient.updateCompetition(competitionId, {
      type: "perpetual_futures",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

    // Should fail with appropriate error
    expect(updateResponse.success).toBe(false);
    expect((updateResponse as ErrorResponse).error).toContain(
      "Cannot change competition type once it has started",
    );
  });

  test("should require perpsProvider when converting to perpetual_futures", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a spot trading competition
    const createResponse = await adminClient.createCompetition({
      name: "Competition Missing PerpsProvider",
      description: "Test missing perpsProvider validation",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = (createResponse as CreateCompetitionResponse)
      .competition.id;

    // Try to convert to perps without providing perpsProvider (should fail)
    const updateResponse = await adminClient.updateCompetition(competitionId, {
      type: "perpetual_futures",
      // Intentionally not providing perpsProvider
    });

    // Should fail with validation error
    expect(updateResponse.success).toBe(false);
    expect((updateResponse as ErrorResponse).error).toContain(
      "Perps provider configuration is required when changing to perpetual futures type",
    );
  });

  test("should allow type conversion for pending competition with registered agents", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 for Type Conversion",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 for Type Conversion",
    });

    // Create a pending competition
    const createResponse = await adminClient.createCompetition({
      name: "Pending Competition With Agents",
      description: "Test type conversion with registered agents",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = (createResponse as CreateCompetitionResponse)
      .competition.id;

    // Add agents to the competition
    await adminClient.addAgentToCompetition(competitionId, agent1.id);
    await adminClient.addAgentToCompetition(competitionId, agent2.id);

    // Verify agents are registered
    const agentsResponse =
      await adminClient.getCompetitionAgents(competitionId);
    expect(agentsResponse.success).toBe(true);
    expect((agentsResponse as CompetitionAgentsResponse).agents).toHaveLength(
      2,
    );

    // Convert to perps type (should succeed even with registered agents)
    const updateResponse = await adminClient.updateCompetition(competitionId, {
      type: "perpetual_futures",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UpdateCompetitionResponse).competition.type).toBe(
      "perpetual_futures",
    );

    // Verify agents are still registered
    const agentsAfterConversion =
      await adminClient.getCompetitionAgents(competitionId);
    expect(agentsAfterConversion.success).toBe(true);
    expect(
      (agentsAfterConversion as CompetitionAgentsResponse).agents,
    ).toHaveLength(2);
  });
});
