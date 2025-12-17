import { type RouterClient } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import {
  admins,
  competitionPrizePools,
  competitionRewards,
  competitions,
} from "@recallnet/db/schema/core/defs";
import {
  perpsCompetitionConfig,
  tradingConstraints,
} from "@recallnet/db/schema/trading/defs";
import {
  DeleteArenaResponse,
  DeletePartnerResponse,
  RemovePartnerFromCompetitionResponse,
  UserRegistrationResponse,
} from "@recallnet/test-utils";
import { generateRandomPrivyId } from "@recallnet/test-utils";
import {
  ADMIN_EMAIL,
  createTestClient,
  ensureDefaultArenas,
  generateRandomEthAddress,
  generateTestHandle,
  wait,
} from "@recallnet/test-utils";

import { db } from "@/lib/db";
import { router as adminRouter } from "@/rpc/router/admin/index.js";
import { router } from "@/rpc/router/index.js";

import {
  assertRpcError,
  createPerpsTestCompetition,
  createTestAdminRpcClient,
  createTestCompetition,
  createTestRpcClient,
  defaultPaperTradingInitialBalances,
  registerUserAndAgentAndGetClient,
  startPerpsTestCompetition,
  startTestCompetition,
} from "../utils/rpc-client-helpers.js";

describe("Admin API", () => {
  let unauthorizedAdminClient: RouterClient<typeof adminRouter>;
  let authorizedAdminClient: RouterClient<typeof adminRouter>;
  let unauthorizedClient: RouterClient<typeof router>;

  // Clean up test state before each test
  beforeEach(async () => {
    unauthorizedClient = await createTestRpcClient();
    // Store the admin API key for authentication
    unauthorizedAdminClient = await createTestAdminRpcClient();
    const result = await unauthorizedAdminClient.setup({
      username: "admin",
      password: "admin-password",
      email: ADMIN_EMAIL,
    });
    authorizedAdminClient = await createTestAdminRpcClient({
      apiKey: result.admin.apiKey,
    });

    await ensureDefaultArenas();
  });

  test("should authenticate as admin", async () => {
    const result = await authorizedAdminClient.agents.list({});
    expect(result.success).toBe(true);

    // Should throw unauthorized error when no API key is provided
    const unauthorizedCall = expect(
      unauthorizedAdminClient.agents.list({}),
    ).rejects;
    await unauthorizedCall.toThrow(ORPCError);
    await unauthorizedCall.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("should register a user and agent via admin API", async () => {
    // Register a new user with agent
    const userName = `Test User ${Date.now()}`;
    const userEmail = `user${Date.now()}@test.com`;
    const agentName = `Test Agent ${Date.now()}`;
    const agentDescription = "A test trading agent";

    const result = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(), // Generate random wallet address
      name: userName,
      email: userEmail,
      agentName,
      agentDescription,
    });

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
    const result = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      userMetadata: userMetadata,
      agentName: agentName,
      agentDescription: agentDescription,
      agentMetadata: agentMetadata,
    });

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
    const profileResponse = await unauthorizedClient.agent.getAgent({
      agentId: registrationResponse.agent!.id,
    });

    // Safely check profile properties with type assertion
    const agentProfile = profileResponse;
    expect(agentProfile.agent.metadata).toEqual(agentMetadata);
  });

  test("should register an agent separately from a user", async () => {
    // Register a new user with no agent
    const userName = `Test User ${Date.now()}`;
    const agentName = `Test Agent ${Date.now()}`;
    const agentHandle = generateTestHandle();

    // Register the user
    const userWalletAddress = generateRandomEthAddress();
    const userResult = await authorizedAdminClient.users.register({
      walletAddress: userWalletAddress,
      name: userName,
      email: `${userName.toLowerCase().replace(/\s+/g, "-")}@test.com`,
    });
    expect(userResult.success).toBe(true);
    expect(userResult.user).toBeDefined();
    const userId = userResult.user.id;
    expect(userId).toBeDefined();

    // Register the agent with bare minimum fields
    const agentResult = await authorizedAdminClient.agents.create({
      user: {
        walletAddress: userWalletAddress,
      },
      agent: {
        name: agentName,
        handle: agentHandle,
      },
    });

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
    const agentResult2 = await authorizedAdminClient.agents.create({
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
    });

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
    // Register a new user with no agent
    const userName = `Test User ${Date.now()}`;
    const userWalletAddress = generateRandomEthAddress();
    const userResult = await authorizedAdminClient.users.register({
      walletAddress: userWalletAddress,
      name: userName,
      email: `${userName.toLowerCase().replace(/\s+/g, "-")}@test.com`,
    });
    expect(userResult.success).toBe(true);
    expect(userResult.user).toBeDefined();
    const userId = userResult.user.id;
    expect(userId).toBeDefined();

    // Register the agent with an invalid user ID
    const randomUuid = "ca00c26a-f610-477a-a472-bdaca866d789";
    await assertRpcError(
      authorizedAdminClient.agents.create({
        user: {
          id: randomUuid,
        },
        agent: {
          name: "Test Agent",
          description: "A test trading agent",
          walletAddress: generateRandomEthAddress(),
        },
      }),
      "NOT_FOUND",
    );

    // Register the agent with an invalid user ID and wallet address
    const randomWalletAddress = generateRandomEthAddress();
    await assertRpcError(
      authorizedAdminClient.agents.create({
        user: {
          walletAddress: randomWalletAddress,
        },
        agent: {
          name: "Test Agent",
          description: "A test trading agent",
          walletAddress: generateRandomEthAddress(),
        },
      }),
      "NOT_FOUND",
    );

    // Register the agent with both a user ID and a user wallet address
    await assertRpcError(
      authorizedAdminClient.agents.create({
        user: {
          id: randomUuid,
          walletAddress: userWalletAddress,
        },
        agent: {
          name: "Test Agent",
          description: "A test trading agent",
          walletAddress: generateRandomEthAddress(),
        },
      }),
      "BAD_REQUEST",
    );
  });

  test("should not allow user registration without admin auth", async () => {
    // Attempt to register a user without admin auth
    await assertRpcError(
      unauthorizedAdminClient.users.register({
        walletAddress: generateRandomEthAddress(),
        name: "Unauthorized User",
        email: "unauthorized@test.com",
        agentName: "Unauthorized Agent",
      }),
      "UNAUTHORIZED",
    );
  });

  test("should update existing user on duplicate email", async () => {
    // Register first user
    const email = `same-email-${Date.now()}@test.com`;
    const originalUserName = `First User ${Date.now()}`;
    const originalWalletAddress = generateRandomEthAddress();
    const firstResult = await authorizedAdminClient.users.register({
      walletAddress: originalWalletAddress,
      name: originalUserName,
      email,
      agentName: `First Agent ${Date.now()}`,
    });

    // Assert first registration success
    expect(firstResult.success).toBe(true);
    const originalUser = firstResult.user!;

    // Try to register second user with the same email
    const newName = `Second User ${Date.now()}`;
    const secondResult = await authorizedAdminClient.users.register({
      walletAddress: originalWalletAddress,
      name: newName,
      email,
      agentName: `Second Agent ${Date.now()}`,
    });

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
    expect(secondResult.user.createdAt).toStrictEqual(originalUser.createdAt);
    expect(secondResult.user.updatedAt).not.toBe(originalUser.updatedAt);
    expect(secondResult.user.lastLoginAt).not.toBe(originalUser.lastLoginAt);
  });

  test("should not allow user registration with duplicate wallet address", async () => {
    // Create a Privy-authenticated client
    const originalWalletAddress = generateRandomEthAddress();
    const user1Email = `user1@example.com`;
    const { user: originalUser } = await authorizedAdminClient.users.register({
      walletAddress: originalWalletAddress,
      name: "First User",
      email: user1Email,
    });
    expect(originalUser).toBeDefined();

    // Try to create a user with the same wallet address - should fail
    const user2Email = `user2@example.com`;
    assertRpcError(
      authorizedAdminClient.users.register({
        walletAddress: originalWalletAddress,
        name: "Second User",
        email: user2Email,
      }),
      "CONFLICT",
      { messageContains: "A user with this walletAddress already exists" },
    );
  });

  test("should not allow user registration with duplicate privyId", async () => {
    // Create a Privy-authenticated client
    const originalPrivyId = generateRandomPrivyId();
    const originalWalletAddress = generateRandomEthAddress();
    const originalUserEmail = `user1@example.com`;
    const { user: originalUser } = await authorizedAdminClient.users.register({
      walletAddress: originalWalletAddress,
      privyId: originalPrivyId,
      name: "First User",
      email: originalUserEmail,
    });
    expect(originalUser).toBeDefined();

    // Try to create a user with the same privyId - should fail
    const user2Email = `user2@example.com`;
    assertRpcError(
      authorizedAdminClient.users.register({
        walletAddress: generateRandomEthAddress(),
        privyId: originalPrivyId,
        name: "Second User",
        email: user2Email, // Use a different email else it'll update on conflict
      }),
      "CONFLICT",
      { messageContains: "A user with this privyId already exists" },
    );
  });

  test("should list agents and users as admin", async () => {
    // Register a new user with agent first
    const userName = `User To List ${Date.now()}`;
    const userEmail = `list-${Date.now()}@test.com`;
    const agentName = `Agent To List ${Date.now()}`;

    const registerResult = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName: agentName,
    });
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    // List agents and users
    const agentsResult = await authorizedAdminClient.agents.list({});
    expect(agentsResult.success).toBe(true);
    expect(agentsResult.agents).toBeDefined();
    expect(agentsResult.agents!.length).greaterThanOrEqual(1);
    expect(agentsResult.agents![0]?.name).toBe(agentName);

    const usersResult = await authorizedAdminClient.users.list({});
    expect(usersResult.success).toBe(true);
    expect(usersResult.users).toBeDefined();
    expect(usersResult.users!.length).greaterThanOrEqual(1);
    expect(usersResult.users![0]?.name).toBe(userName);
    expect(usersResult.users![0]?.email).toBe(userEmail);
  });

  test("should update an agent as admin", async () => {
    // Register a new user with agent first
    const userName = `User To Update ${Date.now()}`;
    const userEmail = `update-${Date.now()}@test.com`;
    const agentName = `Agent To Update ${Date.now()}`;

    const registerResult = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    });
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    // Now update the agent
    const updateResult = await authorizedAdminClient.agents.update({
      agentId: registerResult.agent!.id,
      name: "Updated Name",
      description: "Updated Description",
      imageUrl: "https://example.com/updated-image.jpg",
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.agent).toBeDefined();
    expect(updateResult.agent!.name).toBe("Updated Name");
    expect(updateResult.agent!.description).toBe("Updated Description");
    expect(updateResult.agent!.imageUrl).toBe(
      "https://example.com/updated-image.jpg",
    );
  });

  test("should delete an agent as admin", async () => {
    // Register a new user with agent first
    const userName = `User To Delete ${Date.now()}`;
    const userEmail = `delete-${Date.now()}@test.com`;
    const agentName = `Agent To Delete ${Date.now()}`;

    const registerResult = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    });
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    const agentId = registerResult.agent!.id;

    // Now delete the agent
    const deleteResult = await authorizedAdminClient.agents.delete({
      agentId,
    });

    // Assert deletion success
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.message).toContain("successfully deleted");

    // Verify the agent is gone by trying to get the list of agents
    const agentsResult = await authorizedAdminClient.agents.list({});
    expect(agentsResult.success).toBe(true);

    // Check that the deleted agent is not in the list
    const deletedAgentExists = agentsResult.agents.some(
      (a: { id: string }) => a.id === agentId,
    );
    expect(deletedAgentExists).toBe(false);
  });

  test("should not allow agent deletion without admin auth", async () => {
    // Register a user with agent first
    const userName = `User No Delete ${Date.now()}`;
    const userEmail = `nodelete-${Date.now()}@test.com`;
    const agentName = `Agent No Delete ${Date.now()}`;

    const registerResult = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    });
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
    const agentsResult = await authorizedAdminClient.agents.list({});
    const agentExists = agentsResult.agents.some(
      (a: { id: string }) => a.id === agentId,
    );
    expect(agentExists).toBe(true);
  });

  test("should not allow deletion of non-existent agent", async () => {
    // Try to delete an agent with a non-existent ID (using a valid UUID format)
    const nonExistentId = "00000000-0000-4000-a000-000000000000"; // Valid UUID that doesn't exist
    await assertRpcError(
      authorizedAdminClient.agents.delete({ agentId: nonExistentId }),
      "NOT_FOUND",
    );
  });

  test("should not allow deletion of admin accounts", async () => {
    // Note: Admins are now in a separate table, so we can't accidentally delete them
    // through the agent deletion endpoint. This test verifies that agent deletion works
    // correctly for regular agents.

    // Create a regular agent to delete
    const userName = `User For Admin Test ${Date.now()}`;
    const userEmail = `admin-test-${Date.now()}@test.com`;
    const agentName = `Agent For Admin Test ${Date.now()}`;

    const registerResult = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName,
    });
    expect(registerResult.success).toBe(true);
    expect(registerResult.agent).toBeDefined();

    // Delete the agent to verify our delete functionality works correctly
    const deleteResult = await authorizedAdminClient.agents.delete({
      agentId: registerResult.agent!.id,
    });
    expect(deleteResult.success).toBe(true);
  });

  test("should search for users and agents based on various criteria", async () => {
    // Create users with agents with distinct attributes to test the search functionality
    const timestamp = Date.now();

    // User 1: Standard active user with agent
    const user1Name = `Search User Alpha ${timestamp}`;
    const user1Email = `search-alpha-${timestamp}@test.com`;
    const agent1Name = `Search Agent Alpha ${timestamp}`;
    const agent1Handle = generateTestHandle();
    const user1Result = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: user1Name,
      email: user1Email,
      agentName: agent1Name,
      agentHandle: agent1Handle,
    });
    expect(user1Result.success).toBe(true);

    // User 2: Standard active user with different name pattern
    const user2Name = `Testing User Beta ${timestamp}`;
    const user2Email = `beta-${timestamp}@example.com`;
    const agent2Name = `Testing Agent Beta ${timestamp}`;
    const agent2Handle = generateTestHandle();
    const user2Result = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: user2Name,
      email: user2Email,
      agentName: agent2Name,
      agentHandle: agent2Handle,
    });
    expect(user2Result.success).toBe(true);

    // User 3: Standard active user to test searches
    const user3Name = `Search User Inactive ${timestamp}`;
    const user3Email = `inactive-${timestamp}@test.com`;
    const agent3Name = `Search Agent Inactive ${timestamp}`;
    const agent3Handle = generateTestHandle();
    const user3Result = await authorizedAdminClient.users.register({
      walletAddress: generateRandomEthAddress(),
      name: user3Name,
      email: user3Email,
      agentName: agent3Name,
      agentHandle: agent3Handle,
    });
    expect(user3Result.success).toBe(true);

    // TEST CASE 1: Search by user name substring (should find user 1 and user 3)
    const nameSearchResult = await authorizedAdminClient.search({
      user: {
        name: "Search User",
      },
    });

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
    const agentNameSearchResult = await authorizedAdminClient.search({
      agent: {
        name: "Search Agent",
      },
    });

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
    const emailSearchResult = await authorizedAdminClient.search({
      user: {
        email: "example.com",
      },
    });

    expect(emailSearchResult.success).toBe(true);
    expect(emailSearchResult.results.users.length).toBe(1);
    expect(emailSearchResult.results.users[0]?.email).toBe(user2Email);

    // TEST CASE 4: Search by status - all users should be active by default
    const activeSearchResult = await authorizedAdminClient.search({
      user: {
        status: "active",
      },
      agent: {
        status: "active",
      },
      join: false, // default is false (no join)
    });

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

    const walletSearchResult = await authorizedAdminClient.search({
      user: {
        walletAddress: partialWalletAddress,
      },
    });

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
    const agent1_2Result = await authorizedAdminClient.agents.create({
      user: {
        walletAddress: user1Result.user.walletAddress,
      },
      agent: {
        name: agent1_2Name,
        description: "Second agent for user 1",
      },
    });
    expect(agent1_2Result.success).toBe(true);
    expect(agent1_2Result.agent.ownerId).toBe(user1Result.user.id);

    // Use the wallet address from user1
    const user1WalletAddress = user1Result.user.walletAddress;

    // Perform the join query - search for agents with "Search Agent" in name owned by user1
    const joinQueryResult = await authorizedAdminClient.search({
      user: {
        walletAddress: user1WalletAddress!.substring(0, 12), // Use partial wallet address
      },
      agent: {
        name: "Search Agent",
      },
      join: true,
    });

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
    const allFiltersResult = await authorizedAdminClient.search({
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
    });
    // Expect no errors (we don't care about the response here; just the zod parsing)
    expect(allFiltersResult.success).toBe(true);

    // Clean up - delete the agents we created
    expect(user1Result.agent).toBeDefined();
    expect(user2Result.agent).toBeDefined();
    expect(user3Result.agent).toBeDefined();
    await authorizedAdminClient.agents.delete({
      agentId: user1Result.agent!.id,
    });
    await authorizedAdminClient.agents.delete({
      agentId: user2Result.agent!.id,
    });
    await authorizedAdminClient.agents.delete({
      agentId: user3Result.agent!.id,
    });
  });

  test("should use 'join' with different query param formats", async () => {
    // Standard user with agent
    const agentName = `Search Agent Join`;
    const walletAddress = generateRandomEthAddress();
    const userResult = await authorizedAdminClient.users.register({
      walletAddress: walletAddress,
      agentName: agentName,
      email: `user-${Date.now()}@test.com`,
    });
    expect(userResult.success).toBe(true);

    // Random agent (used for testing `join` param)
    const randomUserWalletAddress = generateRandomEthAddress();
    const randomAgentName = `Random Name ${Date.now()}`;
    const randomUserResult = await authorizedAdminClient.users.register({
      walletAddress: randomUserWalletAddress,
      agentName: randomAgentName,
      email: `random-user-${Date.now()}@test.com`,
    });
    expect(randomUserResult.success).toBe(true);

    // We'll check with: first user's wallet, but also the random agent name not owned by the user
    // Case 1: no `join` param => returns all users and agents w/o `join`
    const query = {
      "user.walletAddress": walletAddress,
      "agent.name": randomAgentName,
    };
    let response = await authorizedAdminClient.search(query);
    expect(response.success).toBe(true);
    expect(response.join).toBe(false);
    expect(response.results.users.length).toBe(1);
    expect(response.results.agents.length).toBe(1);

    // Case 2: Explicit join=false => returns all users and agents w/o `join`
    response = await authorizedAdminClient.search(
      Object.assign({}, query, { join: false }),
    );
    expect(response.success).toBe(true);
    expect(response.join).toBe(false);
    expect(response.results.users.length).toBe(1);
    expect(response.results.agents.length).toBe(1);

    // Case 3: Explicit join=true => returns all users and agents w/ `join` (no agents found)
    response = await authorizedAdminClient.search(
      Object.assign({}, query, {
        "agent.name": "foo",
        join: true,
      }),
    );
    expect(response.success).toBe(true);
    expect(response.join).toBe(true);
    expect(response.results.users.length).toBe(1);
    expect(response.results.agents.length).toBe(0);

    // Case 4: `join` as standalone param (aka `join=true`) => returns all users and agents w/ `join` (no agents found)
    response = await authorizedAdminClient.search(
      Object.assign({}, query, {
        "agent.name": "foo",
        join: "",
      }),
    );
    expect(response.success).toBe(true);
    expect(response.join).toBe(true);
    expect(response.results.users.length).toBe(1);
    expect(response.results.agents.length).toBe(0);
  });

  test("should fail to search for users and agents with invalid query params", async () => {
    async function assertInvalidSearch(query: {}) {
      await assertRpcError(authorizedAdminClient.search(query), "BAD_REQUEST");
    }

    // Case 1: invalid `user` filter value
    await assertInvalidSearch({
      "agent.status": "invalid_status",
    });

    // Case 2: invalid `user` filter param
    await assertInvalidSearch({
      "user.foo": "invalid_foo",
    });

    // Case 3: invalid `agent` filter value
    await assertInvalidSearch({
      "agent.status": "invalid_status",
    });

    // Case 4: invalid `agent` filter param
    await assertInvalidSearch({
      "agent.foo": "invalid_foo",
    });

    // Case 5: both `agent` and `user` filter params with invalid values
    await assertInvalidSearch({
      "agent.name": "invalid_name",
      "user.status": "invalid_status",
    });

    // Case 6: both `agent` and `user` filter params with invalid params
    await assertInvalidSearch({
      "agent.foo": "invalid_foo",
      "user.foo": "active",
    });

    // Case 7: invalid field name
    await assertInvalidSearch({
      foo: "bar",
    });

    // Case 8: invalid join param
    await assertInvalidSearch({
      join: "invalid_join",
    });

    // Case 9: empty search params
    await assertInvalidSearch({});
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
    // First create a competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Test Competition for Update",
      description: "Original description",
      type: "trading",
      externalUrl: "https://example.com",
      imageUrl: "https://example.com/image.jpg",
    });

    expect(createResponse.success).toBe(true);
    expect(createResponse.competition).toBeDefined();
    const competitionId = createResponse.competition.id;

    // Now update the competition
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      name: "Updated Test Competition",
      description: "Updated description",
      externalUrl: "https://updated.com",
      imageUrl: "https://updated.com/image.jpg",
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition).toBeDefined();
    expect(updateResponse.competition.name).toBe("Updated Test Competition");
    expect(updateResponse.competition.description).toBe("Updated description");
    expect(updateResponse.competition.externalUrl).toBe("https://updated.com");
    expect(updateResponse.competition.imageUrl).toBe(
      "https://updated.com/image.jpg",
    );
    expect(updateResponse.competition.id).toBe(competitionId);
  }, 2400_000);

  test("should not allow competition update without admin auth", async () => {
    // Create a competition first
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Test Competition for Auth Test",
      description: "Test description",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Try to update without auth - should fail
    await assertRpcError(
      unauthorizedAdminClient.competitions.update({
        competitionId,
        name: "Should not work",
      }),
      "UNAUTHORIZED",
    );
  });

  test("should return error for non-existent competition update", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId: nonExistentId,
        name: "Should should fail",
      }),
      "INTERNAL", // TODO: It should be probably NOT_FOUND
    );
  });

  test("should validate competition type and reject restricted field updates", async () => {
    // Create a competition first
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Test Competition for Validation",
      description: "Test description",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Try to update with invalid type
    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId,
        // @ts-expect-error Testing that status field is rejected
        type: "invalid_type",
      }),
      "BAD_REQUEST",
    );

    // Try to update status (should be rejected as restricted field)
    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId,
        // @ts-expect-error Testing that status field is rejected
        status: "active",
      }),
      "BAD_REQUEST",
    );
  });

  // ===== Per-Competition Agent Management Tests =====

  test("admin can remove agent from specific competition", async () => {
    // Register agents for testing
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 1 - To Remove",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 2 - To Stay",
    });

    // Start competition with both agents
    const competitionName = `Per-Competition Remove Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });
    const competition = startResponse.competition;

    // Verify both agents are initially in the competition
    const initialLeaderboard = await unauthorizedClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(initialLeaderboard.success).toBe(true);

    const initialAgentIds = initialLeaderboard.agents.map((entry) => entry.id);
    expect(initialAgentIds).toContain(agent1.id);
    expect(initialAgentIds).toContain(agent2.id);

    // Remove agent1 from the competition
    const removeReason = "Violated competition-specific rules";
    const removeResponse = await authorizedAdminClient.competitions.removeAgent(
      {
        competitionId: competition.id,
        agentId: agent1.id,
        reason: removeReason,
      },
    );

    // Verify removal response
    expect(removeResponse.success).toBe(true);
    expect(removeResponse.message).toContain("removed from competition");
    expect(removeResponse.competition.id).toBe(competition.id);
    expect(removeResponse.agent.id).toBe(agent1.id);

    // Verify agent1 is no longer in active leaderboard
    const updatedLeaderboard = await unauthorizedClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
      includeInactive: true,
    });
    expect(updatedLeaderboard.success).toBe(true);

    const activeAgents = updatedLeaderboard.agents.filter((a) => a.active);
    const activeAgentIds = activeAgents.map((entry) => entry.id);
    expect(activeAgentIds).not.toContain(agent1.id);
    expect(activeAgentIds).toContain(agent2.id); // agent2 should still be there

    // Verify agent1 appears in inactive agents list
    const inactiveAgents = updatedLeaderboard.agents.filter((a) => !a.active);
    expect(inactiveAgents.length).toBeGreaterThan(0);
    const inactiveAgent = inactiveAgents.find(
      (agent) => agent.id === agent1.id,
    );
    expect(inactiveAgent).toBeDefined();
    expect(inactiveAgent?.active).toBe(false);
    expect(inactiveAgent?.deactivationReason).toBe(
      `Admin removal: ${removeReason}`,
    );
  });

  test("admin can reactivate agent in specific competition", async () => {
    // Register agent for testing
    const { agent } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent - To Reactivate",
    });

    // Start competition with the agent
    const competitionName = `Per-Competition Reactivate Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // Remove agent from the competition first
    const removeReason = "Temporary removal for testing";
    const removeResponse = await authorizedAdminClient.competitions.removeAgent(
      {
        competitionId: competition.id,
        agentId: agent.id,
        reason: removeReason,
      },
    );
    expect(removeResponse.success).toBe(true);

    // Verify agent is not in active leaderboard
    const leaderboardAfterRemoval =
      await unauthorizedClient.competitions.getAgents({
        competitionId: competition.id,
        sort: "rank",
      });
    expect(leaderboardAfterRemoval.success).toBe(true);

    const activeAgentsAfterRemoval = leaderboardAfterRemoval.agents.filter(
      (a) => a.active,
    );
    const activeAgentIds = activeAgentsAfterRemoval.map((entry) => entry.id);
    expect(activeAgentIds).not.toContain(agent.id);

    // Reactivate agent in the competition
    const reactivateResponse =
      await authorizedAdminClient.competitions.reactivateAgent({
        competitionId: competition.id,
        agentId: agent.id,
      });

    // Verify reactivation response
    expect(reactivateResponse.success).toBe(true);
    expect(reactivateResponse.message).toContain("reactivated in competition");
    expect(reactivateResponse.competition.id).toBe(competition.id);
    expect(reactivateResponse.agent.id).toBe(agent.id);

    // Verify agent is back in active leaderboard
    const leaderboardAfterReactivation =
      await unauthorizedClient.competitions.getAgents({
        competitionId: competition.id,
        sort: "rank",
      });
    expect(leaderboardAfterReactivation.success).toBe(true);

    const activeAgentsAfterReactivation =
      leaderboardAfterReactivation.agents.filter((a) => a.active);
    const reactivatedAgentIds = activeAgentsAfterReactivation.map(
      (entry) => entry.id,
    );
    expect(reactivatedAgentIds).toContain(agent.id);

    // Verify agent is no longer in inactive agents list
    const inactiveAgentsAfterReactivation =
      leaderboardAfterReactivation.agents.filter((a) => !a.active);
    const inactiveAgent = inactiveAgentsAfterReactivation.find(
      (inactiveAgentEntry) => inactiveAgentEntry.id === agent.id,
    );
    expect(inactiveAgent).toBeUndefined();
  });

  test("cannot remove agent from non-existent competition", async () => {
    // Register agent for testing
    const { agent } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent - Non-existent Competition",
    });

    // Try to remove agent from non-existent competition
    const nonExistentCompetitionId = "00000000-0000-4000-a000-000000000000";
    await assertRpcError(
      authorizedAdminClient.competitions.removeAgent({
        competitionId: nonExistentCompetitionId,
        agentId: agent.id,
        reason: "Testing non-existent competition",
      }),
      "NOT_FOUND",
    );
  });

  test("cannot remove non-existent agent from competition", async () => {
    // Register agent and start competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent - For Valid Competition",
    });

    const competitionName = `Valid Competition Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // Try to remove non-existent agent
    const nonExistentAgentId = "00000000-0000-4000-a000-000000000000";
    await assertRpcError(
      authorizedAdminClient.competitions.removeAgent({
        competitionId: competition.id,
        agentId: nonExistentAgentId,
        reason: "Testing non-existent agent",
      }),
      "NOT_FOUND",
    );
  });

  test("cannot remove agent not participating in competition", async () => {
    // Register two agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 1 - In Competition",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 2 - Not In Competition",
    });

    // Start competition with only agent1
    const competitionName = `Single Agent Competition Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent1.id],
    });
    const competition = startResponse.competition;

    // Try to remove agent2 (who is not in the competition)
    await assertRpcError(
      authorizedAdminClient.competitions.removeAgent({
        competitionId: competition.id,
        agentId: agent2.id,
        reason: "Testing agent not in competition",
      }),
      "BAD_REQUEST",
      { messageContains: "not participating in this competition" },
    );
  });

  test("cannot reactivate agent not in competition", async () => {
    // Register two agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 1 - In Competition",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 2 - Not In Competition",
    });

    // Start competition with only agent1
    const competitionName = `Reactivate Not In Competition Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent1.id],
    });
    const competition = startResponse.competition;

    // Try to reactivate agent2 (who is not in the competition)
    await assertRpcError(
      authorizedAdminClient.competitions.reactivateAgent({
        competitionId: competition.id,
        agentId: agent2.id,
      }),
      "BAD_REQUEST",
      { messageContains: "not in this competition" },
    );
  });

  test("per-competition operations require admin authentication", async () => {
    // Setup admin client to create competition and agents

    // Register agent and start competition
    const { adminRpcClient: userClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminRpcClient: authorizedAdminClient,
        agentName: "Agent - Auth Test",
      });

    const competitionName = `Auth Test Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // Try per-competition operations with non-admin client
    await assertRpcError(
      unauthorizedAdminClient.competitions.removeAgent({
        competitionId: competition.id,
        agentId: agent.id,
        reason: "Unauthorized removal attempt",
      }),
      "UNAUTHORIZED",
    );

    // Verify both operations fail due to lack of admin rights
    await assertRpcError(
      userClient.competitions.reactivateAgent({
        competitionId: competition.id,
        agentId: agent.id,
      }),
      "UNAUTHORIZED",
    );
  });

  test("per-competition status is independent of global status", async () => {
    // Register agent for testing
    const { adminRpcClient: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminRpcClient: authorizedAdminClient,
        agentName: "Agent - Status Independence Test",
      });

    // Start competition with the agent
    const competitionName = `Status Independence Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // Verify agent can access API initially
    await unauthorizedClient.agent.getAgent({ agentId: agent.id });

    // Remove agent from competition (per-competition deactivation)
    const removeResponse = await authorizedAdminClient.competitions.removeAgent(
      {
        competitionId: competition.id,
        agentId: agent.id,
        reason: "Testing per-competition status independence",
      },
    );
    expect(removeResponse.success).toBe(true);

    // Agent should still be able to access API (global status unchanged)
    await unauthorizedClient.agent.getAgent({ agentId: agent.id });

    // Now globally deactivate the agent
    const globalDeactivateResponse =
      await authorizedAdminClient.agents.deactivate({
        agentId: agent.id,
        reason: "Testing global deactivation",
      });
    expect(globalDeactivateResponse.success).toBe(true);

    // Agent should now be blocked from API access
    try {
      await unauthorizedClient.agent.getAgent({ agentId: agent.id });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Reactivate agent in competition (should not affect global status)
    const reactivateInCompetitionResponse =
      await authorizedAdminClient.competitions.reactivateAgent({
        competitionId: competition.id,
        agentId: agent.id,
      });
    expect(reactivateInCompetitionResponse.success).toBe(true);

    // Agent should still be blocked from API access (global status still inactive)
    try {
      await unauthorizedClient.agent.getAgent({ agentId: agent.id });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Globally reactivate the agent
    const globalReactivateResponse =
      await authorizedAdminClient.agents.reactivate({
        agentId: agent.id,
      });
    expect(globalReactivateResponse.success).toBe(true);

    // Wait for cache to update
    await wait(100);

    // Agent should now be able to access API again
    await unauthorizedClient.agent.getAgent({ agentId: agent.id });
  });

  test("should update a competition with rewards and tradingConstraints", async () => {
    // First create a competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Test Competition with Rewards",
      description: "Competition to test rewards update",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Now update the competition with rewards
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      name: "Updated Competition with Rewards",
      description: "Updated with rewards",
      rewards: {
        1: 1000,
        2: 500,
        3: 250,
      },
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition).toBeDefined();
    expect(updateResponse.competition.name).toBe(
      "Updated Competition with Rewards",
    );
    expect(updateResponse.competition.description).toBe("Updated with rewards");
    // Check that rewards were properly applied
    expect(updateResponse.competition.rewards).toBeDefined();
    expect(updateResponse.competition.rewards).toHaveLength(3);
    expect(updateResponse.competition.rewards).toContainEqual({
      rank: 1,
      reward: 1000,
    });
    expect(updateResponse.competition.rewards).toContainEqual({
      rank: 2,
      reward: 500,
    });
    expect(updateResponse.competition.rewards).toContainEqual({
      rank: 3,
      reward: 250,
    });
  });

  test("should create a perps competition as admin", async () => {
    // Create a perps competition with required provider configuration using helper
    const response = await createPerpsTestCompetition({
      adminRpcClient: authorizedAdminClient,
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
    // First create a regular trading competition using the helper
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Test Competition for Type Change",
      description: "Competition to test perpsProvider-only update",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    expect(createResponse.competition).toBeDefined();
    const competitionId = createResponse.competition.id;

    // Update perpsProvider and arena to convert to perps competition
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      arenaId: "default-perps-arena",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

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
    // First create a perps competition directly
    const createResponse = await authorizedAdminClient.competitions.create({
      name: "Existing Perps Competition",
      description: "Competition to test perpsProvider updates",
      type: "perpetual_futures",
      arenaId: "default-perps-arena",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 100,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(createResponse.success).toBe(true);
    expect(createResponse.competition).toBeDefined();
    const competitionId = createResponse.competition.id;

    // Verify initial settings
    expect(createResponse.competition.type).toBe("perpetual_futures");

    // Update the perpsProvider settings
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      perpsProvider: {
        provider: "symphony",
        initialCapital: 2000,
        selfFundingThreshold: 500, // Changed from 100 to 500
        apiUrl: "http://localhost:4567",
      },
    });

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
    // Register agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Perps Agent 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Perps Agent 2",
    });

    // Start a perps competition with the agents
    const competitionName = `Perps Competition ${Date.now()}`;
    const startResponse = await startPerpsTestCompetition({
      adminRpcClient: authorizedAdminClient,
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

  test("should create a perps competition with minFundingThreshold", async () => {
    // Create a perps competition with minFundingThreshold
    const response = await createPerpsTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Perps Competition with Min Funding Threshold",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        minFundingThreshold: 250, // Set minimum portfolio balance to $250
        apiUrl: "http://localhost:4567",
      },
    });

    expect(response.success).toBe(true);
    expect(response.competition).toBeDefined();
    expect(response.competition.name).toBe(
      "Perps Competition with Min Funding Threshold",
    );
    expect(response.competition.type).toBe("perpetual_futures");

    // Verify the minFundingThreshold was saved by checking the competition details
    const competitionId = response.competition.id;
    const detailsResponse = await unauthorizedClient.competitions.getById({
      id: competitionId,
    });

    // Note: The perpsConfig details are NOT returned in the public API,
    // so we'll verify the competition was created successfully
    expect(detailsResponse.id).toBe(competitionId);
    expect(detailsResponse.type).toBe("perpetual_futures");

    // Verify the minFundingThreshold was saved in the database
    const perpsConfig = await db
      .select()
      .from(perpsCompetitionConfig)
      .where(eq(perpsCompetitionConfig.competitionId, competitionId));

    expect(perpsConfig).toHaveLength(1);
    expect(perpsConfig[0]).toBeDefined();
    expect(perpsConfig[0]?.minFundingThreshold).toBe("250"); // Stored as string in DB
  });

  test("should update perps competition to add minFundingThreshold", async () => {
    // First create a perps competition without minFundingThreshold
    const createResponse = await createPerpsTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Perps Competition to Update Min Funding",
      perpsProvider: {
        provider: "hyperliquid",
        initialCapital: 500,
        selfFundingThreshold: 100,
        // No minFundingThreshold initially
        apiUrl: "http://localhost:4567",
      },
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Update the competition to add minFundingThreshold
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      perpsProvider: {
        provider: "hyperliquid",
        initialCapital: 500,
        selfFundingThreshold: 100,
        minFundingThreshold: 150,
        apiUrl: "http://localhost:4567",
      },
    });
    expect(updateResponse.competition.type).toBe("perpetual_futures");

    // Verify the minFundingThreshold was updated in the database
    const perpsConfig = await db
      .select()
      .from(perpsCompetitionConfig)
      .where(eq(perpsCompetitionConfig.competitionId, competitionId));

    expect(perpsConfig).toHaveLength(1);
    expect(perpsConfig[0]).toBeDefined();
    expect(perpsConfig[0]?.minFundingThreshold).toBe("150"); // Stored as string in DB
  });

  test("should start a perps competition with minFundingThreshold", async () => {
    // Register agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Perps Agent with Min Funding 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Perps Agent with Min Funding 2",
    });

    // Start a perps competition with minFundingThreshold
    const competitionName = `Perps Min Funding Competition ${Date.now()}`;
    const startResponse = await startPerpsTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 50,
        minFundingThreshold: 100, // $100 minimum portfolio balance
        apiUrl: "http://localhost:4567",
      },
    });

    // Verify the competition was started successfully
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition).toBeDefined();
    expect(startResponse.competition.name).toBe(competitionName);
    expect(startResponse.competition.type).toBe("perpetual_futures");
    expect(startResponse.competition.status).toBe("active");

    // Verify agents are participating
    expect(startResponse.competition.agentIds).toBeDefined();
    expect(Array.isArray(startResponse.competition.agentIds)).toBe(true);
    expect(startResponse.competition.agentIds).toContain(agent1.id);
    expect(startResponse.competition.agentIds).toContain(agent2.id);

    // Verify the minFundingThreshold was saved in the database
    const perpsConfig = await db
      .select()
      .from(perpsCompetitionConfig)
      .where(
        eq(perpsCompetitionConfig.competitionId, startResponse.competition.id),
      );

    expect(perpsConfig).toHaveLength(1);
    expect(perpsConfig[0]).toBeDefined();
    expect(perpsConfig[0]?.minFundingThreshold).toBe("100"); // Stored as string in DB
  });

  test("should atomically rollback competition update when rewards fail", async () => {
    // First create a competition with initial rewards
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Atomic Test Competition",
      description: "Testing atomic updates",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Add initial rewards
    await authorizedAdminClient.competitions.update({
      competitionId,
      rewards: {
        1: 100,
        2: 50,
      },
    });

    // Get initial state
    const [initialCompetition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId));
    expect(initialCompetition).toBeDefined();
    const initialName = initialCompetition!.name;

    // Try to update with invalid rewards structure that will fail validation
    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId,
        name: "This Should Not Be Saved",
        description: "This update should be rolled back",
        rewards: {
          "-1": 1000, // Invalid rank (negative)
          "0": 500, // Invalid rank (zero)
        },
      }),
      "BAD_REQUEST",
    );

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
    // Create a competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Trading Constraints Test",
      description: "Testing constraints update",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Update with all components atomically
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
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
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition.name).toBe("Updated with Constraints");
    expect(updateResponse.competition.rewards).toHaveLength(3);

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
    // Try to create a competition with invalid rewards that will fail validation
    await assertRpcError(
      authorizedAdminClient.competitions.create({
        name: "Should Not Be Created",
        description: "This competition should be rolled back",
        tradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
        arenaId: "default-paper-arena",
        rewards: {
          "-1": 1000, // Invalid rank (negative)
          "0": 500, // Invalid rank (zero)
        },
      }),
      "BAD_REQUEST",
    );

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
    const validResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Valid Competition After Rollback",
      description: "This should succeed",
      tradingType: "disallowAll",
      sandboxMode: false,
      type: "trading",
    });

    expect(validResponse.success).toBe(true);

    const newConstraints = await db.select().from(tradingConstraints);
    expect(newConstraints.length).toBe(initialConstraintCount + 1);
  });

  test("should atomically create competition with constraints and rewards", async () => {
    const createResponse = await authorizedAdminClient.competitions.create({
      name: "Atomic Create Test",
      description: "Testing atomic creation",
      tradingType: "disallowAll",
      sandboxMode: false,
      type: "trading",
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
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
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

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
    // Create a spot trading competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Competition To Convert to Perps",
      description: "Test converting spot to perps",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Verify it's a trading competition
    const detailsBeforeUpdate = await unauthorizedClient.competitions.getById({
      id: competitionId,
    });
    expect(detailsBeforeUpdate.type).toBe("trading");

    // Convert to perps type
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      type: "perpetual_futures",
      arenaId: "default-perps-arena", // Change to perps arena for compatibility
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition.type).toBe("perpetual_futures");

    // Verify the type has changed
    const detailsAfterUpdate = await unauthorizedClient.competitions.getById({
      id: competitionId,
    });
    expect(detailsAfterUpdate.type).toBe("perpetual_futures");
  });

  test("should convert pending competition from perps to spot trading", async () => {
    // Create a perps competition
    const createResponse = await createPerpsTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Perps Competition To Convert to Spot",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Verify it's a perps competition
    const detailsBeforeUpdate = await unauthorizedClient.competitions.getById({
      id: competitionId,
    });
    expect(detailsBeforeUpdate.type).toBe("perpetual_futures");

    // Convert to spot trading type and move to paper arena
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      type: "trading",
      arenaId: "default-paper-arena", // Change to paper arena for compatibility
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition.type).toBe("trading");

    // Verify the type has changed
    const detailsAfterUpdate = await unauthorizedClient.competitions.getById({
      id: competitionId,
    });
    expect(detailsAfterUpdate.type).toBe("trading");
  });

  test("should not allow converting active competition type", async () => {
    // Create and start a spot trading competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent for Active Competition",
    });

    const startResponse = await startTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Active Competition - No Type Change",
      agentIds: [agent.id],
    });

    expect(startResponse.success).toBe(true);
    const competitionId = startResponse.competition.id;

    // Verify it's active
    expect(startResponse.competition.status).toBe("active");

    // Try to convert to perps (should fail)
    // Should fail with appropriate error
    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId,
        type: "perpetual_futures",
        perpsProvider: {
          provider: "symphony",
          initialCapital: 1000,
          selfFundingThreshold: 0,
          apiUrl: "http://localhost:4567",
        },
      }),
      "BAD_REQUEST",
      { messageContains: "Cannot change competition type once it has started" },
    );
  });

  test("should require perpsProvider when converting to perpetual_futures", async () => {
    // Create a spot trading competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Competition Missing PerpsProvider",
      description: "Test missing perpsProvider validation",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Try to convert to perps without providing perpsProvider (should fail)
    // Should fail with validation error
    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId,
        type: "perpetual_futures",
        // Intentionally not providing perpsProvider
      }),
      "BAD_REQUEST",
      {
        messageContains:
          "Perps provider configuration is required when changing to perpetual futures type",
      },
    );
  });

  test("should allow type conversion for pending competition with registered agents", async () => {
    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 1 for Type Conversion",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 2 for Type Conversion",
    });

    // Create a pending competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Pending Competition With Agents",
      description: "Test type conversion with registered agents",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Add agents to the competition
    await authorizedAdminClient.competitions.addAgent({
      competitionId,
      agentId: agent1.id,
    });
    await authorizedAdminClient.competitions.addAgent({
      competitionId,
      agentId: agent2.id,
    });

    // Verify agents are registered
    const agentsResponse = await unauthorizedClient.competitions.getAgents({
      competitionId,
    });
    expect(agentsResponse.success).toBe(true);
    expect(agentsResponse.agents).toHaveLength(2);

    // Convert to perps type and move to perps arena (should succeed even with registered agents)
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      type: "perpetual_futures",
      arenaId: "default-perps-arena",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition.type).toBe("perpetual_futures");

    // Verify agents are still registered
    const agentsAfterConversion =
      await unauthorizedClient.competitions.getAgents({ competitionId });
    expect(agentsAfterConversion.success).toBe(true);
    expect(agentsAfterConversion.agents).toHaveLength(2);
  });

  // ===== Prize Pool Tests =====

  test("should create competition with prizePools.agent and prizePools.users", async () => {
    // Create a competition with prize pools
    const createResponse = await authorizedAdminClient.competitions.create({
      name: "Competition with Prize Pools",
      description: "Testing prize pool creation",
      type: "trading",
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
      prizePools: {
        agent: 1000,
        users: 500,
      },
    });

    expect(createResponse.success).toBe(true);
    expect(createResponse.competition).toBeDefined();
    const competitionId = createResponse.competition.id;

    // Verify the competition was created successfully
    expect(createResponse.competition.name).toBe(
      "Competition with Prize Pools",
    );
    expect(createResponse.competition.description).toBe(
      "Testing prize pool creation",
    );

    // Verify prize pools were created in the database
    const prizePools = await db
      .select()
      .from(competitionPrizePools)
      .where(eq(competitionPrizePools.competitionId, competitionId));

    expect(prizePools).toHaveLength(1);
    expect(prizePools[0]).toBeDefined();
    expect(prizePools[0]!.agentPool.toString()).toBe("1000000000000000000000");
    expect(prizePools[0]!.userPool.toString()).toBe("500000000000000000000");
  });

  test("should update competition with prizePools.agent and prizePools.users", async () => {
    // First create a competition without prize pools
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Competition to Update with Prize Pools",
      description: "Testing prize pool updates",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Verify no prize pools exist initially
    let prizePools = await db
      .select()
      .from(competitionPrizePools)
      .where(eq(competitionPrizePools.competitionId, competitionId));
    expect(prizePools).toHaveLength(0);

    // Now update the competition with prize pools
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      name: "Updated Competition with Prize Pools",
      description: "Updated with prize pools",
      prizePools: {
        agent: 3000,
        users: 1500,
      },
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition.name).toBe(
      "Updated Competition with Prize Pools",
    );

    // Verify prize pools were created
    prizePools = await db
      .select()
      .from(competitionPrizePools)
      .where(eq(competitionPrizePools.competitionId, competitionId));

    expect(prizePools).toHaveLength(1);
    expect(prizePools[0]!.agentPool.toString()).toBe("3000000000000000000000");
    expect(prizePools[0]!.userPool.toString()).toBe("1500000000000000000000");
  });

  test("should start competition with prizePools", async () => {
    // Register agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 1 for Prize Pool Start",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Agent 2 for Prize Pool Start",
    });

    // Start a competition with prize pools
    const competitionName = `Prize Pool Start Competition ${Date.now()}`;
    const startResponse = await authorizedAdminClient.competitions.start({
      name: competitionName,
      description: "Testing start competition with prize pools",
      type: "trading",
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
      agentIds: [agent1.id, agent2.id],
      prizePools: {
        agent: 2000,
        users: 1000,
      },
    });

    expect(startResponse.success).toBe(true);
    expect(startResponse.competition).toBeDefined();
    expect(startResponse.competition.name).toBe(competitionName);
    expect(startResponse.competition.status).toBe("active");

    const competitionId = startResponse.competition.id;

    // Verify prize pools were created in the database
    const prizePools = await db
      .select()
      .from(competitionPrizePools)
      .where(eq(competitionPrizePools.competitionId, competitionId));

    expect(prizePools).toHaveLength(1);
    expect(prizePools[0]).toBeDefined();
    expect(prizePools[0]!.agentPool.toString()).toBe("2000000000000000000000");
    expect(prizePools[0]!.userPool.toString()).toBe("1000000000000000000000");
  });

  test("should create a competition with minimum stake", async () => {
    // Create a competition with minimum stake
    const createResponse = await authorizedAdminClient.competitions.create({
      name: "Competition with Minimum Stake",
      description: "Test competition with minimum stake requirement",
      type: "trading",
      minimumStake: 1000, // 1000 tokens minimum stake
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
    });

    expect(createResponse.success).toBe(true);
    const createResult = createResponse;
    expect(createResult.competition).toBeDefined();
    expect(createResult.competition.name).toBe(
      "Competition with Minimum Stake",
    );
    expect(createResult.competition.description).toBe(
      "Test competition with minimum stake requirement",
    );
    expect(createResult.competition.type).toBe("trading");

    // Verify minimum stake was set correctly using API call
    const competitionId = createResult.competition.id;

    // Get the competition details to verify minimum stake
    const detailsResponse = await unauthorizedClient.competitions.getById({
      id: competitionId,
    });

    const competitionDetails = detailsResponse;
    expect(competitionDetails).toBeDefined();
    expect(competitionDetails.minimumStake).toBeDefined();
    expect(competitionDetails.minimumStake).toBe(1000);
  });

  test("should update a competition with minimum stake", async () => {
    // First create a competition without minimum stake
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Competition to Update with Minimum Stake",
      description: "Test updating competition with minimum stake",
      type: "trading",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Verify initial state has no minimum stake using API call
    const initialDetailsResponse =
      await unauthorizedClient.competitions.getById({
        id: competitionId,
      });

    const initialCompetitionDetails = initialDetailsResponse;
    expect(initialCompetitionDetails).toBeDefined();
    expect(initialCompetitionDetails.minimumStake).toBeNull();

    // Now update the competition with minimum stake
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      name: "Updated Competition with Minimum Stake",
      description: "Updated with minimum stake requirement",
      minimumStake: 2500, // 2500 tokens minimum stake
    });

    expect(updateResponse.success).toBe(true);
    const updateResult = updateResponse;
    expect(updateResult.competition).toBeDefined();
    expect(updateResult.competition.name).toBe(
      "Updated Competition with Minimum Stake",
    );
    expect(updateResult.competition.description).toBe(
      "Updated with minimum stake requirement",
    );

    // Verify minimum stake was updated correctly using API call
    const updatedDetailsResponse =
      await unauthorizedClient.competitions.getById({
        id: competitionId,
      });

    const updatedCompetitionDetails = updatedDetailsResponse;
    expect(updatedCompetitionDetails).toBeDefined();
    expect(updatedCompetitionDetails.minimumStake).toBeDefined();
    expect(updatedCompetitionDetails.minimumStake).toBe(2500);
  });

  test("should require arenaId when creating competition", async () => {
    await assertRpcError(
      authorizedAdminClient.competitions.create({
        name: "Competition Missing Arena",
        description: "Test competition without arenaId",
        type: "trading",
        // @ts-expect-error - arenaId intentionally omitted to test validation
        arenaId: undefined,
      }),
      "BAD_REQUEST",
    );
  });

  test("should require arenaId when creating new competition via start", async () => {
    // This tests the create-and-start flow (no competitionId provided)
    const { agent } = await registerUserAndAgentAndGetClient({
      adminRpcClient: authorizedAdminClient,
      agentName: "Test Agent for Arena Validation",
    });

    await assertRpcError(
      authorizedAdminClient.competitions.start({
        name: "Competition Start Missing Arena",
        description: "Test start competition without arenaId",
        type: "trading",
        agentIds: [agent.id],
        arenaId: undefined,
      }),
      "BAD_REQUEST",
    );
  });

  test("should throw ApiError for invalid fields in request body", async () => {
    await assertRpcError(
      authorizedAdminClient.competitions.create({
        name: "Competition with Invalid Fields",
        description: "Test competition with invalid fields",
        // @ts-expect-error - we're intentionally passing an invalid type
        type: "foobar",
        arenaId: "default-paper-arena",
      }),
      "BAD_REQUEST",
      {
        messageContains:
          'type (invalid option: expected one of "trading"|"perpetual_futures"|"spot_live_trading"|"sports_prediction")',
      },
    );

    await assertRpcError(
      authorizedAdminClient.competitions.create({
        name: "Competition with Invalid Fields 2",
        description: "Test competition with invalid fields 2",
        type: "trading",
        arenaId: "default-paper-arena",
        // @ts-expect-error - we're intentionally passing an invalid type
        minimumStake: "invalid",
        startDate: "invalid",
      }),
      "BAD_REQUEST",
      {
        messageContains: [
          "startDate (invalid ISO datetime)",
          "minimumStake (expected number, received string)",
        ],
      },
    );

    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Competition to Update with Invalid Fields",
      description: "Test updating competition with invalid fields",
      type: "trading",
    });
    const competitionId = createResponse.competition.id;

    await assertRpcError(
      authorizedAdminClient.competitions.update({
        competitionId,
        name: "Competition to Update with Invalid Fields",
        description: "Test updating competition with invalid fields",
        prizePools: {
          // @ts-expect-error - we're intentionally passing an invalid type
          agent: "invalid",
          users: -10000,
        },
      }),
      "BAD_REQUEST",
      {
        messageContains: [
          "prizePools.agent (expected number, received string)",
          "prizePools.users (too small: expected number to be >=0)",
        ],
      },
    );
  });

  // ===== Arena CRUD Tests =====

  test("should create an arena as admin", async () => {
    const arenaData = {
      id: `test-arena-${Date.now()}`,
      name: "Test Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
      venues: ["aerodrome", "uniswap"],
      chains: ["base", "arbitrum"],
    };

    const response = await authorizedAdminClient.arenas.create(arenaData);

    expect(response.success).toBe(true);
    expect(response.arena).toBeDefined();
    expect(response.arena.id).toBe(arenaData.id);
    expect(response.arena.name).toBe(arenaData.name);
    expect(response.arena.category).toBe(arenaData.category);
    expect(response.arena.skill).toBe(arenaData.skill);
    expect(response.arena.venues).toEqual(arenaData.venues);
    expect(response.arena.chains).toEqual(arenaData.chains);
  });

  test("should reject arena with invalid ID format", async () => {
    const arenaData = {
      id: "Invalid_ID_With_Caps",
      name: "Test Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    };

    await assertRpcError(
      authorizedAdminClient.arenas.create(arenaData),
      "BAD_REQUEST",
      { messageContains: "lowercase kebab-case" },
    );
  });

  test("should reject duplicate arena ID", async () => {
    const arenaData = {
      id: `duplicate-arena-${Date.now()}`,
      name: "First Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    };

    // Create first arena
    const firstResponse = await authorizedAdminClient.arenas.create(arenaData);
    expect(firstResponse.success).toBe(true);

    // Try to create second arena with same ID
    await assertRpcError(
      authorizedAdminClient.arenas.create({
        ...arenaData,
        name: "Second Arena",
      }),
      "CONFLICT",
      { messageContains: "already exists" },
    );
  });

  test("should list arenas with pagination", async () => {
    // Create a few arenas first
    const arena1 = await authorizedAdminClient.arenas.create({
      id: `list-arena-1-${Date.now()}`,
      name: "List Test Arena 1",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });
    expect(arena1.success).toBe(true);

    const arena2 = await authorizedAdminClient.arenas.create({
      id: `list-arena-2-${Date.now()}`,
      name: "List Test Arena 2",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "perpetual_futures",
    });
    expect(arena2.success).toBe(true);

    // List arenas
    const listResponse = await authorizedAdminClient.arenas.list({
      limit: 10,
      offset: 0,
    });

    expect(listResponse.success).toBe(true);
    expect(listResponse.arenas).toBeDefined();
    expect(Array.isArray(listResponse.arenas)).toBe(true);
    expect(listResponse.arenas.length).toBeGreaterThan(1);
    expect(listResponse.pagination).toBeDefined();
    expect(listResponse.pagination.total).toBeGreaterThan(1);
  });

  test("should filter arenas by name", async () => {
    const uniqueName = `FilterTest-${Date.now()}`;

    // Create arena with unique name
    await authorizedAdminClient.arenas.create({
      id: `filter-arena-${Date.now()}`,
      name: uniqueName,
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });

    // Filter by name
    const listResponse = await authorizedAdminClient.arenas.list({
      limit: 10,
      offset: 0,
      nameFilter: uniqueName,
    });

    expect(listResponse.success).toBe(true);
    const arenas = listResponse.arenas;
    expect(arenas.length).toBeGreaterThanOrEqual(1);
    expect(arenas.some((a) => a.name === uniqueName)).toBe(true);
  });

  test("should get arena by ID", async () => {
    const arenaId = `get-arena-${Date.now()}`;

    // Create arena
    const createResponse = await authorizedAdminClient.arenas.create({
      id: arenaId,
      name: "Get Test Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });
    expect(createResponse.success).toBe(true);

    // Get arena by ID
    const getResponse = await authorizedAdminClient.arenas.getById({
      id: arenaId,
    });

    expect(getResponse.success).toBe(true);
    expect(getResponse.arena).toBeDefined();
    expect(getResponse.arena.id).toBe(arenaId);
    expect(getResponse.arena.name).toBe("Get Test Arena");
  });

  test("should return 404 for non-existent arena", async () => {
    await assertRpcError(
      authorizedAdminClient.arenas.getById({
        id: "nonexistent-arena-id",
      }),
      "NOT_FOUND",
    );
  });

  test("should update an arena", async () => {
    const arenaId = `update-arena-${Date.now()}`;

    // Create arena
    const createResponse = await authorizedAdminClient.arenas.create({
      id: arenaId,
      name: "Original Name",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
      venues: ["aerodrome"],
    });
    expect(createResponse.success).toBe(true);

    // Update arena
    const updateResponse = await authorizedAdminClient.arenas.update({
      id: arenaId,
      name: "Updated Name",
      venues: ["aerodrome", "uniswap"],
      chains: ["base"],
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.arena.name).toBe("Updated Name");
    expect(updateResponse.arena.venues).toEqual(["aerodrome", "uniswap"]);
    expect(updateResponse.arena.chains).toEqual(["base"]);
  });

  test("should delete an arena with no competitions", async () => {
    const arenaId = `delete-arena-${Date.now()}`;

    // Create arena
    const createResponse = await authorizedAdminClient.arenas.create({
      id: arenaId,
      name: "Arena To Delete",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });
    expect(createResponse.success).toBe(true);

    // Delete arena
    const deleteResponse = await authorizedAdminClient.arenas.delete({
      id: arenaId,
    });

    expect(deleteResponse.success).toBe(true);
    expect((deleteResponse as DeleteArenaResponse).message).toContain(
      "deleted",
    );

    // Verify arena is gone
    await assertRpcError(
      authorizedAdminClient.arenas.getById({ id: arenaId }),
      "NOT_FOUND",
    );
  });

  test("should create competition linked to arena", async () => {
    const arenaId = `comp-arena-${Date.now()}`;

    // Create arena first
    const arenaResponse = await authorizedAdminClient.arenas.create({
      id: arenaId,
      name: "Arena for Competition",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });
    expect(arenaResponse.success).toBe(true);

    // Create competition linked to arena
    const compResponse = await authorizedAdminClient.competitions.create({
      name: "Competition in Arena",
      type: "trading",
      arenaId: arenaId,
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
      engineId: "spot_paper_trading",
      engineVersion: "1.0.0",
      vips: ["vip-agent-1"],
      allowlist: ["allowed-agent-1", "allowed-agent-2"],
      minRecallRank: 100,
      agentAllocation: 5000,
      agentAllocationUnit: "RECALL",
      displayState: "active",
    });

    expect(compResponse.success).toBe(true);
    expect(compResponse.competition).toBeDefined();
    expect(compResponse.competition.name).toBe("Competition in Arena");

    // Now try to delete arena - should fail because it has a competition
    await assertRpcError(
      authorizedAdminClient.arenas.delete({ id: arenaId }),
      "CONFLICT",
      { messageContains: "associated competitions" },
    );
  });

  test("should update competition with arena and participation fields", async () => {
    // Create arena
    const arenaId = `update-arena-${Date.now()}`;
    await authorizedAdminClient.arenas.create({
      id: arenaId,
      name: "Update Test Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });

    // Create basic competition
    const createResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Basic Competition",
      type: "trading",
    });
    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Update with arena and participation fields
    const updateResponse = await authorizedAdminClient.competitions.update({
      competitionId,
      description: "Updated with arena link",
      arenaId: arenaId,
      engineId: "spot_paper_trading",
      engineVersion: "1.0.0",
      vips: ["vip-1", "vip-2"],
      allowlist: ["allowed-1"],
      blocklist: ["blocked-1"],
      minRecallRank: 50,
      allowlistOnly: true,
      agentAllocation: 10000,
      agentAllocationUnit: "USDC",
      boosterAllocation: 5000,
      boosterAllocationUnit: "RECALL",
      rewardRules: "Weekly distribution",
      rewardDetails: "Paid in USDC",
      displayState: "waitlist",
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.competition.description).toBe(
      "Updated with arena link",
    );
    // Note: We can't directly verify the new fields in the response
    // without updating the response serialization, but we verified they're accepted
  });
  // TODO: Add test for deleting arena with associated competitions
  // This requires updating createCompetition to accept arenaId parameter
  // Will be implemented when we update competition creation in next phase

  test("should not allow arena operations without admin auth", async () => {
    const regularClient = createTestClient();

    // Try to create arena without admin auth
    const createResponse = await regularClient.createArena({
      id: "unauthorized-arena",
      name: "Should Fail",
      createdBy: "hacker",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });

    expect(createResponse.success).toBe(false);
    // Should be unauthorized

    // Try to list arenas without admin auth
    await assertRpcError(
      unauthorizedAdminClient.arenas.list({}),
      "UNAUTHORIZED",
    );
  });

  // ===== Partner CRUD Tests =====

  test("should create a partner as admin", async () => {
    const partnerData = {
      name: "Aerodrome Finance",
      url: "https://aerodrome.finance",
      logoUrl: "https://aerodrome.finance/logo.png",
      details: "Leading DEX on Base",
    };

    const response = await authorizedAdminClient.partners.create(partnerData);

    expect(response.success).toBe(true);
    expect(response.partner).toBeDefined();
    expect(response.partner.name).toBe(partnerData.name);
    expect(response.partner.url).toBe(partnerData.url);
    expect(response.partner.logoUrl).toBe(partnerData.logoUrl);
  });

  test("should reject duplicate partner name", async () => {
    const partnerData = {
      name: `Duplicate Partner ${Date.now()}`,
      url: "https://example.com",
    };

    // Create first partner
    const firstResponse =
      await authorizedAdminClient.partners.create(partnerData);
    expect(firstResponse.success).toBe(true);

    // Try to create second partner with same name
    await assertRpcError(
      authorizedAdminClient.partners.create(partnerData),
      "CONFLICT",
      { messageContains: "already exists" },
    );
  });

  test("should list partners with pagination", async () => {
    // Create a few partners first
    const partner1 = await authorizedAdminClient.partners.create({
      name: `List Partner 1 ${Date.now()}`,
      url: "https://partner1.com",
    });
    expect(partner1.success).toBe(true);

    const partner2 = await authorizedAdminClient.partners.create({
      name: `List Partner 2 ${Date.now()}`,
      url: "https://partner2.com",
    });
    expect(partner2.success).toBe(true);

    // List partners
    const listResponse = await authorizedAdminClient.partners.list({
      limit: 10,
      offset: 0,
    });

    expect(listResponse.success).toBe(true);
    expect(listResponse.partners).toBeDefined();
    expect(Array.isArray(listResponse.partners)).toBe(true);
    expect(listResponse.partners.length).toBeGreaterThan(1);
    expect(listResponse.pagination).toBeDefined();
  });

  test("should filter partners by name", async () => {
    const uniqueName = `PartnerFilterTest-${Date.now()}`;

    // Create partner with unique name
    await authorizedAdminClient.partners.create({
      name: uniqueName,
      url: "https://example.com",
    });

    // Filter by name
    const listResponse = await authorizedAdminClient.partners.list({
      limit: 10,
      offset: 0,
      nameFilter: uniqueName,
    });

    expect(listResponse.success).toBe(true);
    const partners = listResponse.partners;
    expect(partners.length).toBeGreaterThanOrEqual(1);
    expect(partners.some((p) => p.name === uniqueName)).toBe(true);
  });

  test("should get partner by ID", async () => {
    // Create partner
    const createResponse = await authorizedAdminClient.partners.create({
      name: `Get Partner Test ${Date.now()}`,
      url: "https://example.com",
    });
    expect(createResponse.success).toBe(true);
    const partnerId = createResponse.partner.id;

    // Get partner by ID
    const getResponse = await authorizedAdminClient.partners.getById({
      id: partnerId,
    });

    expect(getResponse.success).toBe(true);
    expect(getResponse.partner).toBeDefined();
    expect(getResponse.partner.id).toBe(partnerId);
  });

  test("should return 404 for non-existent partner", async () => {
    await assertRpcError(
      authorizedAdminClient.partners.getById({
        id: "00000000-0000-0000-0000-000000000000",
      }),
      "NOT_FOUND",
    );
  });

  test("should update a partner", async () => {
    // Create partner
    const createResponse = await authorizedAdminClient.partners.create({
      name: `Original Partner ${Date.now()}`,
      url: "https://original.com",
      details: "Original details",
    });
    expect(createResponse.success).toBe(true);
    const partnerId = createResponse.partner.id;

    // Update partner
    const updateResponse = await authorizedAdminClient.partners.update({
      id: partnerId,
      name: "Updated Partner Name",
      url: "https://updated.com",
      details: "Updated details",
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.partner.name).toBe("Updated Partner Name");
    expect(updateResponse.partner.url).toBe("https://updated.com");
    expect(updateResponse.partner.details).toBe("Updated details");
  });

  test("should delete a partner", async () => {
    // Create partner
    const createResponse = await authorizedAdminClient.partners.create({
      name: `Partner To Delete ${Date.now()}`,
      url: "https://example.com",
    });
    expect(createResponse.success).toBe(true);
    const partnerId = createResponse.partner.id;

    // Delete partner
    const deleteResponse = await authorizedAdminClient.partners.delete({
      id: partnerId,
    });

    expect(deleteResponse.success).toBe(true);
    expect((deleteResponse as DeletePartnerResponse).message).toContain(
      "deleted",
    );

    // Verify partner is gone
    await assertRpcError(
      authorizedAdminClient.partners.getById({ id: partnerId }),
      "NOT_FOUND",
    );
  });

  test("should not allow partner operations without admin auth", async () => {
    // Try to create partner without admin auth
    await assertRpcError(
      unauthorizedAdminClient.partners.create({
        name: "Unauthorized Partner",
        url: "https://example.com",
      }),
      "UNAUTHORIZED",
    );

    // Try to list partners without admin auth
    await assertRpcError(
      unauthorizedAdminClient.partners.list({}),
      "UNAUTHORIZED",
    );
  });

  // ===== Partner-Competition Association Tests =====

  test("should add partner to competition", async () => {
    // Create partner
    const partnerResponse = await authorizedAdminClient.partners.create({
      name: `Assoc Partner ${Date.now()}`,
      url: "https://example.com",
    });
    expect(partnerResponse.success).toBe(true);
    const partnerId = partnerResponse.partner.id;

    // Create competition
    const compResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Assoc Competition",
      type: "trading",
    });
    expect(compResponse.success).toBe(true);
    const competitionId = compResponse.competition.id;

    // Add partner to competition
    const addResponse = await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId,
      position: 1,
    });

    expect(addResponse.success).toBe(true);
    expect(addResponse.association).toBeDefined();
    expect(addResponse.association.competitionId).toBe(competitionId);
    expect(addResponse.association.partnerId).toBe(partnerId);
    expect(addResponse.association.position).toBe(1);
  });

  test("should get partners for a competition", async () => {
    // Create partners
    const partner1 = await authorizedAdminClient.partners.create({
      name: `List Partner 1 ${Date.now()}`,
    });
    const partner2 = await authorizedAdminClient.partners.create({
      name: `List Partner 2 ${Date.now()}`,
    });
    expect(partner1.success && partner2.success).toBe(true);

    // Create competition
    const compResponse = await authorizedAdminClient.competitions.create({
      name: "Partners List Competition",
      type: "trading",
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
    });
    const competitionId = compResponse.competition.id;

    // Add partners
    await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId: partner1.partner.id,
      position: 1,
    });
    await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId: partner2.partner.id,
      position: 2,
    });

    // Get partners
    const getResponse =
      await authorizedAdminClient.partners.getCompetitionPartners({
        competitionId,
      });

    expect(getResponse.success).toBe(true);
    const partners = getResponse.partners;
    expect(partners.length).toBe(2);
    expect(partners[0]?.position).toBe(1);
    expect(partners[1]?.position).toBe(2);
  });

  test("should update partner position", async () => {
    // Create partner and competition
    const partnerResponse = await authorizedAdminClient.partners.create({
      name: `Position Partner ${Date.now()}`,
    });
    const partnerId = partnerResponse.partner.id;

    const compResponse = await createTestCompetition({
      adminRpcClient: authorizedAdminClient,
      name: "Position Competition",
      type: "trading",
    });
    const competitionId = compResponse.competition.id;

    // Add at position 1
    await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId,
      position: 1,
    });

    // Update to position 2
    const updateResponse =
      await authorizedAdminClient.partners.updateCompetitionPartnerPosition({
        competitionId,
        partnerId,
        position: 2,
      });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.association.position).toBe(2);
  });

  test("should remove partner from competition", async () => {
    // Create partner and competition
    const partnerResponse = await authorizedAdminClient.partners.create({
      name: `Remove Partner ${Date.now()}`,
    });
    const partnerId = partnerResponse.partner.id;

    const compResponse = await authorizedAdminClient.competitions.create({
      name: "Remove Competition",
      type: "trading",
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
    });
    const competitionId = compResponse.competition.id;

    // Add partner
    await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId,
      position: 1,
    });

    // Remove partner
    const removeResponse =
      await authorizedAdminClient.partners.removeFromCompetition({
        competitionId,
        partnerId,
      });

    expect(removeResponse.success).toBe(true);
    expect(
      (removeResponse as RemovePartnerFromCompetitionResponse).message,
    ).toContain("removed");

    // Verify it's gone
    const getResponse =
      await authorizedAdminClient.partners.getCompetitionPartners({
        competitionId,
      });
    expect(getResponse.partners.length).toBe(0);
  });

  test("should replace all partners atomically", async () => {
    // Create 3 partners
    const p1 = await authorizedAdminClient.partners.create({
      name: `Replace 1 ${Date.now()}`,
    });
    const p2 = await authorizedAdminClient.partners.create({
      name: `Replace 2 ${Date.now()}`,
    });
    const p3 = await authorizedAdminClient.partners.create({
      name: `Replace 3 ${Date.now()}`,
    });

    // Create competition
    const compResponse = await authorizedAdminClient.competitions.create({
      name: "Replace Competition",
      type: "trading",
      arenaId: "default-paper-arena",
      paperTradingInitialBalances: defaultPaperTradingInitialBalances(),
    });
    const competitionId = compResponse.competition.id;

    // Add first 2 partners
    await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId: p1.partner.id,
      position: 1,
    });
    await authorizedAdminClient.partners.addToCompetition({
      competitionId,
      partnerId: p2.partner.id,
      position: 2,
    });

    // Replace with different set
    const replaceResponse =
      await authorizedAdminClient.partners.replaceCompetitionPartners({
        competitionId,
        partners: [
          { partnerId: p2.partner.id, position: 1 },
          { partnerId: p3.partner.id, position: 2 },
        ],
      });

    expect(replaceResponse.success).toBe(true);
    const replacedPartners = replaceResponse.partners;
    expect(replacedPartners.length).toBe(2);

    // Verify replace response contains enriched partner data
    const partner1InResponse = replacedPartners.find(
      (p) => p.id === p2.partner.id,
    );
    const partner2InResponse = replacedPartners.find(
      (p) => p.id === p3.partner.id,
    );

    expect(partner1InResponse).toBeDefined();
    expect(partner1InResponse?.name).toContain("Replace 2");
    expect(partner1InResponse?.position).toBe(1);
    expect(partner1InResponse?.competitionPartnerId).toBeDefined();

    expect(partner2InResponse).toBeDefined();
    expect(partner2InResponse?.name).toContain("Replace 3");
    expect(partner2InResponse?.position).toBe(2);
    expect(partner2InResponse?.competitionPartnerId).toBeDefined();

    // Verify p1 was removed from response
    expect(
      replacedPartners.find((p) => p.id === p1.partner.id),
    ).toBeUndefined();

    // Verify ordering by position
    expect(replacedPartners[0]?.position).toBe(1);
    expect(replacedPartners[1]?.position).toBe(2);
    expect(replacedPartners[0]?.id).toBe(p2.partner.id);
    expect(replacedPartners[1]?.id).toBe(p3.partner.id);
  });
});
