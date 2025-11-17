import { beforeEach, describe, expect, test } from "vitest";

import { specificChainTokens } from "@recallnet/services/lib";
import { ApiClient } from "@recallnet/test-utils";
import {
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  AgentProfileResponse,
  CROSS_CHAIN_TRADING_TYPE,
  CreateCompetitionResponse,
  StartCompetitionResponse,
  UserCompetitionsResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  createTestCompetition,
  generateRandomEthAddress,
  generateTestCompetitions,
  getAdminApiKey,
  noTradingConstraints,
  startExistingTestCompetition,
  wait,
} from "@recallnet/test-utils";
import { generateRandomPrivyId } from "@recallnet/test-utils";

// IDE shows error because e2e is excluded from main tsconfig, but path resolves correctly at runtime via Vitest
import { portfolioSnapshotterService } from "@/lib/services";

import {
  createPrivyAuthenticatedRpcClient,
  registerUserAndAgentAndGetRpcClient,
} from "../utils/test-helpers.js";

describe("User API", () => {
  // Clean up test state before each test
  let adminApiKey: string;
  let adminClient: ApiClient;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();

    // Create and authenticate admin client for all tests
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
  });

  test("admin can register a user and user can authenticate", async () => {
    // Register a user
    const userName = `User ${Date.now()}`;
    const agentName = `Agent ${Date.now()}`;
    const userEmail = `user${Date.now()}@example.com`;

    const { user, apiKey, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        userName,
        userEmail,
        agentName,
      });

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

    // Verify user can authenticate and get profile via RPC
    const profile = await rpcClient.user.getProfile();
    expect(profile).toBeDefined();
    expect(profile.id).toBe(user.id);
    expect(profile.name).toBe(userName);
  });

  // TODO: once we have a user-centric API, switch to a user-centric test
  test("users can update their profile information", async () => {
    // Register a user
    const { rpcClient } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
    });

    // Update user profile
    const newName = "Updated Contact Person";
    const updatedUser = await rpcClient.user.updateProfile({
      name: newName,
    });

    expect(updatedUser).toBeDefined();
    expect(updatedUser.name).toBe(newName);

    // Verify changes persisted
    const profile = await rpcClient.user.getProfile();
    expect(profile).toBeDefined();
    expect(profile.name).toBe(newName);
  });

  test("admin can list all registered users", async () => {
    // Register multiple users
    const userData = [
      { name: `User A ${Date.now()}`, email: `user${Date.now()}@example.com` },
      { name: `User B ${Date.now()}`, email: `userb${Date.now()}@example.com` },
      { name: `User C ${Date.now()}`, email: `userc${Date.now()}@example.com` },
    ];

    for (const data of userData) {
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        userName: data.name,
        userEmail: data.email,
      });
    }

    // Admin lists all users
    const usersResponse = await adminClient.listUsers();

    expect(usersResponse.success).toBe(true);
    expect((usersResponse as AdminUsersListResponse).users).toBeDefined();
    expect(
      (usersResponse as AdminUsersListResponse).users.length,
    ).toBeGreaterThanOrEqual(userData.length);

    // Verify all our users are in the list
    for (const data of userData) {
      const foundUser = (usersResponse as AdminUsersListResponse).users.find(
        (u) => u.name === data.name && u.email === data.email,
      );
      expect(foundUser).toBeDefined();
    }
  });

  // TODO: once we have a user-centric API, switch to a user-centric test
  test("user can update both optional parameters in a single request", async () => {
    // Register a user without initial metadata or imageUrl
    const userName = `Combined Update User ${Date.now()}`;
    const userEmail = `combined-update-${Date.now()}@example.com`;
    const agentName = "Combined Update Agent";

    const { rpcClient, user } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      userName,
      userEmail,
      agentName,
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.imageUrl).toBeNull(); // No initial imageUrl (database returns null, not undefined)
    expect(user.metadata).toBeNull(); // No initial metadata (database returns null, not undefined)

    // Define new values for both fields, including metadata
    const newName = "Combined Update User";
    const newImageUrl = "https://example.com/combined-update-image.jpg";
    const newMetadata = {
      foo: "bar",
    };

    // Update both fields in a single request
    const updatedUser = await rpcClient.user.updateProfile({
      name: newName,
      imageUrl: newImageUrl,
      metadata: newMetadata,
    });

    expect(updatedUser).toBeDefined();
    expect(updatedUser.imageUrl).toBe(newImageUrl);

    // Verify changes persisted
    const profile = await rpcClient.user.getProfile();
    expect(profile).toBeDefined();

    expect(profile.name).toBe(newName);
    expect(profile.imageUrl).toBe(newImageUrl);
    expect(profile.metadata).toEqual(newMetadata);

    // Verify admin can see both updated fields
    const searchResponse = await adminClient.searchUsersAndAgents({
      user: {
        email: userEmail,
      },
    });

    expect(searchResponse.success).toBe(true);
    const foundUser = (
      searchResponse as unknown as AdminSearchUsersAndAgentsResponse
    ).results.users.find((t) => t.email === userEmail);

    expect(foundUser).toBeDefined();
    expect(foundUser?.imageUrl).toBe(newImageUrl);
  });

  test("creating a new user with duplicate email updates on conflict", async () => {
    const originalWalletAddress = generateRandomEthAddress();
    const originalUserEmail = `email@example.com`;
    const { user: originalUser } = await createPrivyAuthenticatedRpcClient({
      userName: "Privy Test User",
      userEmail: originalUserEmail,
      embeddedWalletAddress: originalWalletAddress,
      walletAddress: originalWalletAddress,
    });
    const originalUserId = originalUser.id;
    // Name is derived from Privy profile; with email provider it defaults to username from email
    expect(typeof originalUser.name).toBe("string");
    expect(originalUser.email).toBe(originalUserEmail);
    // New users use embedded wallet as primary wallet
    expect(originalUser.embeddedWalletAddress).toBeDefined();
    expect(originalUser.walletAddress).toBe(originalUser.embeddedWalletAddress);
    expect(originalUser.walletLastVerifiedAt).toBeDefined();
    expect(originalUser.lastLoginAt).toBeDefined();
    const originalLastLoginAt = originalUser.lastLoginAt;
    const originalWalletLastVerifiedAt = originalUser.walletLastVerifiedAt;

    // Try to create a user with the same email - should succeed and update the user name
    const newName = "Another Privy Test User";
    // Note: registering a new wallet address on conflict won't update the user's wallet
    const newWalletAddress = generateRandomEthAddress();
    // We key off of unique email upon user creation, so this should update the user
    const existingPrivyId = originalUser.privyId;
    const { user: updatedUser } = await createPrivyAuthenticatedRpcClient({
      userName: newName,
      privyId: existingPrivyId || undefined,
      userEmail: originalUserEmail,
      walletAddress: newWalletAddress,
    });
    expect(updatedUser.id).toBe(originalUserId);
    expect(updatedUser.email).toBe(originalUserEmail);
    // On duplicate email, wallet info is preserved (still the embedded wallet)
    expect(updatedUser.walletAddress).toBe(originalUser.embeddedWalletAddress);
    expect(updatedUser.walletLastVerifiedAt).toBe(originalWalletLastVerifiedAt);
    expect(updatedUser.embeddedWalletAddress).toBe(
      originalUser.embeddedWalletAddress,
    );
    // Should be updated to the "fresh" values
    expect(updatedUser.name).toBe(newName);
    expect(updatedUser.lastLoginAt).not.toBe(originalLastLoginAt);
  });

  test("creating a new user with duplicate wallet address creates a new account", async () => {
    const originalWalletAddress = generateRandomEthAddress();
    const user1Email = `user1@example.com`;
    const { user: originalUser } = await createPrivyAuthenticatedRpcClient({
      walletAddress: originalWalletAddress,
      userEmail: user1Email,
    });
    expect(originalUser).toBeDefined();

    // Try to login with the same wallet address - /login is idempotent and should merge
    const user2Email = `user2@example.com`;
    const { user: mergedUser } = await createPrivyAuthenticatedRpcClient({
      userEmail: user2Email,
      walletAddress: originalWalletAddress,
    });
    // The second login uses a different privyId with its own embedded wallet; it should not merge
    expect(mergedUser.id).not.toBe(originalUser.id);
  });

  test("creating a new user with duplicate privyId is idempotent on login", async () => {
    const originalPrivyId = generateRandomPrivyId();
    const { user: originalUser } = await createPrivyAuthenticatedRpcClient({
      privyId: originalPrivyId,
    });
    expect(originalUser).toBeDefined();

    // Try to login again with the same privyId - should update lastLoginAt
    const { user: again } = await createPrivyAuthenticatedRpcClient({
      privyId: originalPrivyId,
    });
    expect(again.id).toBe(originalUser.id);
  });

  test("user can access their profile and manage agents", async () => {
    const { rpcClient, user } = await createPrivyAuthenticatedRpcClient({
      userName: "Privy Test User",
      userEmail: "siwe-test@example.com",
    });

    // Test: User can get their profile via Privy session
    const profile = await rpcClient.user.getProfile();
    expect(profile).toBeDefined();
    expect(profile.id).toBe(user.id);
    expect(profile.name).toBe(user.name);
    expect(profile.metadata).toBeNull();

    // Test: User can update their profile via Privy session, including metadata
    const newName = "Updated Privy User";
    const newMetadata = {
      foo: "bar",
    };
    const updatedProfile = await rpcClient.user.updateProfile({
      name: newName,
      metadata: newMetadata,
    });
    expect(updatedProfile.name).toBe(newName);
    expect(updatedProfile.metadata).toEqual(newMetadata);

    // Test: User can create an agent via Privy session
    const { agent: createdAgent } = await rpcClient.user.createAgent({
      name: "Privy Created Agent",
      handle: "privycreated",
      description: "Agent created via Privy session",
    });
    expect(createdAgent).toBeDefined();
    expect(createdAgent.name).toBe("Privy Created Agent");

    // Test: User can list their agents via Privy session
    const { agents } = await rpcClient.user.getUserAgents({});
    expect(agents).toBeDefined();
    expect(agents.length).toBe(1);
    expect(agents[0]?.name).toBe("Privy Created Agent");
    expect(agents[0]?.isVerified).toBe(false);

    // Test: User can get a specific agent via Privy session
    const agentId = createdAgent.id;
    const specificAgent = await rpcClient.user.getUserAgent({ agentId });
    expect(specificAgent.id).toBe(agentId);
  });

  test("user can update their agent profiles", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Agent Profile Test User",
      userEmail: "agent-profile-test@example.com",
    });

    // Create an agent via Privy session
    const { agent } = await rpcClient.user.createAgent({
      name: "Original Agent Name",
      handle: "originalagent",
      description: "Original agent description",
      imageUrl: "https://example.com/original-image.jpg",
    });
    expect(agent.name).toBe("Original Agent Name");
    expect(agent.description).toBe("Original agent description");
    expect(agent.imageUrl).toBe("https://example.com/original-image.jpg");

    // Test: User can update agent name only
    const { agent: updatedAgent1 } = await rpcClient.user.updateAgentProfile({
      agentId: agent.id,
      name: "Updated Agent Name",
    });
    expect(updatedAgent1.name).toBe("Updated Agent Name");
    expect(updatedAgent1.description).toBe("Original agent description"); // Should remain unchanged
    expect(updatedAgent1.imageUrl).toBe(
      "https://example.com/original-image.jpg",
    ); // Should remain unchanged

    // Test: User can update description only
    const { agent: updatedAgent2 } = await rpcClient.user.updateAgentProfile({
      agentId: agent.id,
      description: "Updated agent description",
    });
    expect(updatedAgent2.name).toBe("Updated Agent Name"); // Should remain from previous update
    expect(updatedAgent2.description).toBe("Updated agent description");
    expect(updatedAgent2.imageUrl).toBe(
      "https://example.com/original-image.jpg",
    ); // Should remain unchanged

    // Test: User can update imageUrl only
    const { agent: updatedAgent3 } = await rpcClient.user.updateAgentProfile({
      agentId: agent.id,
      imageUrl: "https://example.com/updated-image.jpg",
    });
    expect(updatedAgent3.name).toBe("Updated Agent Name"); // Should remain from previous update
    expect(updatedAgent3.description).toBe("Updated agent description"); // Should remain from previous update
    expect(updatedAgent3.imageUrl).toBe(
      "https://example.com/updated-image.jpg",
    );

    // Test: User can update email field
    const { agent: updatedAgent4 } = await rpcClient.user.updateAgentProfile({
      agentId: agent.id,
      email: "updated-email@example.com",
    });
    expect(updatedAgent4.email).toBe("updated-email@example.com");

    // Test: User can update metadata field
    const { agent: updatedAgent5 } = await rpcClient.user.updateAgentProfile({
      agentId: agent.id,
      metadata: {
        skills: ["trading", "ai"],
      },
    });
    expect(updatedAgent5.metadata).toBeDefined();
    expect(updatedAgent5.metadata?.skills).toEqual(["trading", "ai"]);

    // Test: User can update all fields at once
    const { agent: finalAgent } = await rpcClient.user.updateAgentProfile({
      agentId: agent.id,
      name: "Final Agent Name",
      description: "Final agent description",
      imageUrl: "https://example.com/final-image.jpg",
      email: "final-email@example.com",
      metadata: {
        skills: ["trading", "ai"],
      },
    });
    expect(finalAgent.name).toBe("Final Agent Name");
    expect(finalAgent.description).toBe("Final agent description");
    expect(finalAgent.imageUrl).toBe("https://example.com/final-image.jpg");
    expect(finalAgent.metadata?.skills).toEqual(["trading", "ai"]);

    // Test: Verify changes persisted by getting the agent again
    const persistedAgent = await rpcClient.user.getUserAgent({
      agentId: agent.id,
    });
    expect(persistedAgent.name).toBe("Final Agent Name");
    expect(persistedAgent.description).toBe("Final agent description");
    expect(persistedAgent.imageUrl).toBe("https://example.com/final-image.jpg");
  });

  test("user cannot update an agent they don't own", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Agent Profile Test User",
      userEmail: "agent-profile-test@example.com",
    });

    // Create an agent via Privy session
    const { agent } = await rpcClient.user.createAgent({
      name: "Original Agent Name",
      handle: "originalagent2",
      description: "Original agent description",
      imageUrl: "https://example.com/original-image.jpg",
    });

    // Test: User cannot update agent they don't own
    // Create another user and try to update the first user's agent
    const { rpcClient: otherUserRpcClient } =
      await createPrivyAuthenticatedRpcClient({
        userName: "Other User",
        userEmail: "other-user@example.com",
      });

    await expect(
      otherUserRpcClient.user.updateAgentProfile({
        agentId: agent.id,
        name: "Unauthorized Update",
      }),
    ).rejects.toThrow(/Access denied/);
  });

  test("user cannot update an agent with invalid fields", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Agent Profile Test User",
      userEmail: "agent-profile-test@example.com",
    });

    // Create an agent via Privy session
    const { agent } = await rpcClient.user.createAgent({
      name: "Original Agent Name",
      handle: "originalagent3",
      description: "Original agent description",
      imageUrl: "https://example.com/original-image.jpg",
    });

    // Test: Invalid fields are rejected by server-side validation
    // Use type assertion to bypass TypeScript's compile-time validation
    await expect(
      rpcClient.user.updateAgentProfile({
        agentId: agent.id,
        name: "Valid Name",
        // @ts-expect-error We want to force the error
        invalidField: "Should be rejected",
      }),
    ).rejects.toThrow(/Input validation failed/);
  });

  test("get user agents pagination works with default parameters", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Pagination Test User",
      userEmail: "pagination-test@example.com",
    });

    // Create 5 agents
    const agentNames = [
      "Agent Alpha",
      "Agent Beta",
      "Agent Charlie",
      "Agent Delta",
      "Agent Echo",
    ];

    for (const name of agentNames) {
      await rpcClient.user.createAgent({
        name,
        handle: name.toLowerCase().replace(/\s+/g, ""),
        description: `Description for ${name}`,
      });
      // Small delay to ensure different timestamps
      await wait(10);
    }

    // Test default pagination (should return all agents)
    const { agents: defaultAgents } = await rpcClient.user.getUserAgents({});
    expect(defaultAgents).toHaveLength(5);
    expect(Array.isArray(defaultAgents)).toBe(true);

    // Check that stats and other metric-related fields are included
    expect(defaultAgents[0]?.trophies).toBeDefined();
    expect(defaultAgents[0]?.skills).toBeDefined();
    expect(defaultAgents[0]?.stats).toBeDefined();
    expect(defaultAgents[0]?.stats?.completedCompetitions).toBe(0);
    expect(defaultAgents[0]?.stats?.totalTrades).toBe(0);
    expect(defaultAgents[0]?.stats?.bestPlacement).toBeUndefined();
    expect(defaultAgents[0]?.stats?.ranks).toBeUndefined();
  });

  test("user agents pagination respects limit parameter", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Limit Test User",
      userEmail: "limit-test@example.com",
    });

    // Create 6 agents
    for (let i = 1; i <= 6; i++) {
      await rpcClient.user.createAgent({
        name: `Agent ${i.toString().padStart(2, "0")}`,
        handle: `agent${i.toString().padStart(2, "0")}`,
        description: `Description for Agent ${i}`,
      });
      await wait(10);
    }

    // Test limit of 3
    const { agents: limitedAgents } = await rpcClient.user.getUserAgents({
      limit: 3,
    });
    expect(limitedAgents).toHaveLength(3);

    // Test limit of 2
    const { agents: limit2Agents } = await rpcClient.user.getUserAgents({
      limit: 2,
    });
    expect(limit2Agents).toHaveLength(2);

    // Test limit larger than total
    const { agents: largeLimitAgents } = await rpcClient.user.getUserAgents({
      limit: 20,
    });
    expect(largeLimitAgents).toHaveLength(6);
  });

  test("user agents pagination respects offset parameter", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Offset Test User",
      userEmail: "offset-test@example.com",
    });

    // Create 6 agents
    for (let i = 1; i <= 6; i++) {
      await rpcClient.user.createAgent({
        name: `Agent ${i.toString().padStart(2, "0")}`,
        handle: `agent${i.toString().padStart(2, "0")}b`,
        description: `Description for Agent ${i}`,
      });
      await wait(10);
    }

    // Get all agents first to establish baseline
    const { agents: allAgents } = await rpcClient.user.getUserAgents({});
    expect(allAgents).toHaveLength(6);

    // Test offset of 2
    const { agents: offset2Agents } = await rpcClient.user.getUserAgents({
      offset: 2,
    });
    expect(offset2Agents).toHaveLength(4);

    // Test offset of 4
    const { agents: offset4Agents } = await rpcClient.user.getUserAgents({
      offset: 4,
    });
    expect(offset4Agents).toHaveLength(2);

    // Test offset larger than total
    const { agents: largeOffsetAgents } = await rpcClient.user.getUserAgents({
      offset: 10,
    });
    expect(largeOffsetAgents).toHaveLength(0);
  });

  test("user agents pagination combines limit and offset correctly", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Limit Offset Test User",
      userEmail: "limit-offset-test@example.com",
    });

    // Create 8 agents
    for (let i = 1; i <= 8; i++) {
      await rpcClient.user.createAgent({
        name: `Agent ${i.toString().padStart(2, "0")}`,
        handle: `agent${i.toString().padStart(2, "0")}c`,
        description: `Description for Agent ${i}`,
      });
      await wait(10);
    }

    // Test pagination: page 1 (offset 0, limit 3)
    const { agents: page1Agents } = await rpcClient.user.getUserAgents({
      limit: 3,
      offset: 0,
    });
    expect(page1Agents).toHaveLength(3);

    // Test pagination: page 2 (offset 3, limit 3)
    const { agents: page2Agents } = await rpcClient.user.getUserAgents({
      limit: 3,
      offset: 3,
    });
    expect(page2Agents).toHaveLength(3);

    // Test pagination: page 3 (offset 6, limit 3) - should only return 2 agents
    const { agents: page3Agents } = await rpcClient.user.getUserAgents({
      limit: 3,
      offset: 6,
    });
    expect(page3Agents).toHaveLength(2);

    // Verify no overlap between pages by checking agent IDs
    const page1Ids = page1Agents.map((a) => a.id);
    const page2Ids = page2Agents.map((a) => a.id);
    const page3Ids = page3Agents.map((a) => a.id);

    const allPageIds = [...page1Ids, ...page2Ids, ...page3Ids];
    const uniqueIds = new Set(allPageIds);
    expect(uniqueIds.size).toBe(allPageIds.length); // No duplicates
  });

  test("user agents sorting works correctly", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Sort Test User",
      userEmail: "sort-test@example.com",
    });

    // Create agents with names that will sort differently
    const agentData = [
      { name: "Zebra Agent", description: "Last alphabetically" },
      { name: "Alpha Agent", description: "First alphabetically" },
      { name: "Beta Agent", description: "Second alphabetically" },
      { name: "Gamma Agent", description: "Third alphabetically" },
    ];

    for (const agent of agentData) {
      await rpcClient.user.createAgent({
        name: agent.name,
        handle: agent.name.toLowerCase().replace(/\s+/g, ""),
        description: agent.description,
      });
      await wait(50); // Larger delay for timestamp differentiation
    }

    // Test name ascending sort
    const { agents: nameAscAgents } = await rpcClient.user.getUserAgents({
      sort: "name",
    });
    expect(nameAscAgents).toHaveLength(4);
    expect(nameAscAgents[0]?.name).toBe("Alpha Agent");
    expect(nameAscAgents[1]?.name).toBe("Beta Agent");
    expect(nameAscAgents[2]?.name).toBe("Gamma Agent");
    expect(nameAscAgents[3]?.name).toBe("Zebra Agent");

    // Test name descending sort
    const { agents: nameDescAgents } = await rpcClient.user.getUserAgents({
      sort: "-name",
    });
    expect(nameDescAgents).toHaveLength(4);
    expect(nameDescAgents[0]?.name).toBe("Zebra Agent");
    expect(nameDescAgents[1]?.name).toBe("Gamma Agent");
    expect(nameDescAgents[2]?.name).toBe("Beta Agent");
    expect(nameDescAgents[3]?.name).toBe("Alpha Agent");

    // Test created date ascending sort (oldest first)
    const { agents: createdAscAgents } = await rpcClient.user.getUserAgents({
      sort: "createdAt",
    });
    expect(createdAscAgents).toHaveLength(4);
    // First created should be "Zebra Agent" (created first in our loop)
    expect(createdAscAgents[0]?.name).toBe("Zebra Agent");
    expect(createdAscAgents[3]?.name).toBe("Gamma Agent");

    // Test created date descending sort (newest first)
    const { agents: createdDescAgents } = await rpcClient.user.getUserAgents({
      sort: "-createdAt",
    });
    expect(createdDescAgents).toHaveLength(4);
    // Last created should be "Gamma Agent" (created last in our loop)
    expect(createdDescAgents[0]?.name).toBe("Gamma Agent");
    expect(createdDescAgents[3]?.name).toBe("Zebra Agent");
  });

  test("user agents sorting combined with pagination", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Sort Pagination Test User",
      userEmail: "sort-pagination-test@example.com",
    });

    // Create 6 agents with names that will sort predictably
    const names = ["Hotel", "Alpha", "India", "Bravo", "Juliet", "Charlie"];

    for (const name of names) {
      await rpcClient.user.createAgent({
        name: `${name} Agent`,
        handle: `${name.toLowerCase()}agent`,
        description: `Description for ${name}`,
      });
      await wait(10);
    }

    // Get first page of 2, sorted by name ascending
    const { agents: page1Agents } = await rpcClient.user.getUserAgents({
      sort: "name",
      limit: 2,
      offset: 0,
    });
    expect(page1Agents).toHaveLength(2);
    expect(page1Agents[0]?.name).toBe("Alpha Agent");
    expect(page1Agents[1]?.name).toBe("Bravo Agent");

    // Get second page of 2, sorted by name ascending
    const { agents: page2Agents } = await rpcClient.user.getUserAgents({
      sort: "name",
      limit: 2,
      offset: 2,
    });
    expect(page2Agents).toHaveLength(2);
    expect(page2Agents[0]?.name).toBe("Charlie Agent");
    expect(page2Agents[1]?.name).toBe("Hotel Agent");
  });

  test("user agents pagination only returns agents owned by authenticated user", async () => {
    // Create two different users
    const { rpcClient: user1RpcClient } =
      await createPrivyAuthenticatedRpcClient({
        userName: "User 1",
        userEmail: "user1@example.com",
      });

    const { rpcClient: user2RpcClient } =
      await createPrivyAuthenticatedRpcClient({
        userName: "User 2",
        userEmail: "user2@example.com",
      });

    // User 1 creates 3 agents
    for (let i = 1; i <= 3; i++) {
      await user1RpcClient.user.createAgent({
        name: `User1 Agent ${i}`,
        handle: `user1agent${i}`,
        description: `Description ${i}`,
      });
    }

    // User 2 creates 2 agents
    for (let i = 1; i <= 2; i++) {
      await user2RpcClient.user.createAgent({
        name: `User2 Agent ${i}`,
        handle: `user2agent${i}`,
        description: `Description ${i}`,
      });
    }

    // User 1 should only see their own agents
    const { agents: user1Agents } = await user1RpcClient.user.getUserAgents({});
    expect(user1Agents).toHaveLength(3);
    user1Agents.forEach((agent) => {
      expect(agent.name).toMatch(/^User1 Agent/);
    });

    // User 2 should only see their own agents
    const { agents: user2Agents } = await user2RpcClient.user.getUserAgents({});
    expect(user2Agents).toHaveLength(2);
    user2Agents.forEach((agent) => {
      expect(agent.name).toMatch(/^User2 Agent/);
    });

    // Test pagination isolation - User 1 with pagination
    const { agents: user1PaginatedAgents } =
      await user1RpcClient.user.getUserAgents({
        limit: 2,
      });
    expect(user1PaginatedAgents).toHaveLength(2);
    user1PaginatedAgents.forEach((agent) => {
      expect(agent.name).toMatch(/^User1 Agent/);
    });
  });

  test("user agents API returns consistent structure with pagination", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Structure Test User",
      userEmail: "structure-test@example.com",
    });

    // Create a couple of agents
    await rpcClient.user.createAgent({
      name: "Test Agent 1",
      handle: "testagent1",
      description: "Description 1",
    });
    await rpcClient.user.createAgent({
      name: "Test Agent 2",
      handle: "testagent2",
      description: "Description 2",
    });

    // Test response structure with no pagination
    const noPaginationResponse = await rpcClient.user.getUserAgents({});
    expect(noPaginationResponse.userId).toBeDefined();
    expect(noPaginationResponse.agents).toBeDefined();
    expect(Array.isArray(noPaginationResponse.agents)).toBe(true);

    // Test response structure with pagination
    const paginatedResponse = await rpcClient.user.getUserAgents({
      limit: 1,
      offset: 0,
    });
    expect(paginatedResponse.userId).toBeDefined();
    expect(paginatedResponse.agents).toBeDefined();
    expect(Array.isArray(paginatedResponse.agents)).toBe(true);

    // Verify agent structure (should not include API key for security)
    const agents = paginatedResponse.agents;
    expect(agents.length).toBeGreaterThan(0);
    const agent = agents[0];
    expect(agent?.id).toBeDefined();
    expect(agent?.ownerId).toBeDefined();
    expect(agent?.name).toBeDefined();
    expect(agent?.status).toBeDefined();
    expect(agent?.createdAt).toBeDefined();
    expect(agent?.updatedAt).toBeDefined();
    // API key should NOT be present in the response for security
    // @ts-expect-error We are testing the API key is not present
    expect(agent?.apiKey).toBeUndefined();
  });

  test("user agents pagination handles edge cases gracefully", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Edge Case Test User",
      userEmail: "edge-case-test@example.com",
    });

    // Create a few agents
    for (let i = 1; i <= 3; i++) {
      await rpcClient.user.createAgent({
        name: `Agent ${i}`,
        handle: `edgecaseagent${i}`,
        description: `Description ${i}`,
      });
    }

    // Test zero offset
    const { agents: zeroOffsetAgents } = await rpcClient.user.getUserAgents({
      offset: 0,
    });
    expect(zeroOffsetAgents).toHaveLength(3);

    // Test minimum limit
    const { agents: minLimitAgents } = await rpcClient.user.getUserAgents({
      limit: 1,
    });
    expect(minLimitAgents).toHaveLength(1);

    // Test that pagination still works with empty sort string
    const { agents: emptySortAgents } = await rpcClient.user.getUserAgents({
      sort: "",
    });
    expect(emptySortAgents).toHaveLength(3);
  });

  test("user cannot create agents with duplicate names", async () => {
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Duplicate Agent Name Test User",
      userEmail: "duplicate-agent-name-test@example.com",
    });

    const agentName = "Duplicate Agent Name";
    const agentDescription = "Test agent for duplicate name testing";

    // Create the first agent successfully
    await rpcClient.user.createAgent({
      name: agentName,
      handle: "duplicateagent",
      description: agentDescription,
    });

    // Try to create a second agent with the same name - should fail with conflict error
    await expect(
      rpcClient.user.createAgent({
        name: agentName,
        handle: "duplicateagent2",
        description: agentDescription,
      }),
    ).rejects.toThrow(/You already have an agent with name/);
  });

  describe("User Agent API Key Access", () => {
    test("user can retrieve their own agent's API key", async () => {
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "API Key Test User",
        userEmail: "api-key-test@example.com",
      });

      // Create an agent for this user
      const { agent } = await rpcClient.user.createAgent({
        name: "Test Agent for API Key",
        handle: "testapikey",
        description: "Agent description for API key testing",
      });

      // Get the agent's API key
      const keyData = await rpcClient.user.getAgentApiKey({
        agentId: agent.id,
      });
      expect(keyData.agentId).toBe(agent.id);
      expect(keyData.agentName).toBe(agent.name);
      expect(keyData.apiKey).toBeDefined();
      expect(typeof keyData.apiKey).toBe("string");
      expect(keyData.apiKey.length).toBeGreaterThan(0);
    });

    test("user cannot retrieve API key for agent they don't own", async () => {
      // Create two different users
      const { rpcClient: user1RpcClient } =
        await createPrivyAuthenticatedRpcClient({
          userName: "User 1",
          userEmail: "user1-apikey@example.com",
        });

      const { rpcClient: user2RpcClient } =
        await createPrivyAuthenticatedRpcClient({
          userName: "User 2",
          userEmail: "user2-apikey@example.com",
        });

      // User 1 creates an agent
      const { agent } = await user1RpcClient.user.createAgent({
        name: "User 1 Agent",
        handle: "user1keytest",
        description: "Agent owned by User 1",
      });

      // User 2 tries to get User 1's agent API key
      await expect(
        user2RpcClient.user.getAgentApiKey({ agentId: agent.id }),
      ).rejects.toThrow(/Access denied/);
    });

    test("unauthenticated user cannot retrieve any agent API key", async () => {
      // Create an agent first
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Agent Owner",
        userEmail: "agent-owner@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Test Agent",
        handle: "unauthtest",
        description: "Agent for unauthorized access test",
      });

      // Create unauthenticated RPC client (no Privy token)
      const { createTestRpcClient } = await import(
        "../utils/rpc-client-helpers.js"
      );
      const unauthenticatedRpcClient = await createTestRpcClient();

      // Try to get the agent's API key without authentication
      await expect(
        unauthenticatedRpcClient.user.getAgentApiKey({ agentId: agent.id }),
      ).rejects.toThrow(/Unauthorized|Authentication required/);
    });

    test("user gets 404 for non-existent agent API key", async () => {
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "404 Test User",
        userEmail: "404-test@example.com",
      });

      // Try to get API key for non-existent agent
      const fakeAgentId = "00000000-0000-0000-0000-000000000000";
      await expect(
        rpcClient.user.getAgentApiKey({ agentId: fakeAgentId }),
      ).rejects.toThrow(/Agent not found/);
    });

    test("user gets 400 for invalid agent ID format", async () => {
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Invalid ID Test User",
        userEmail: "invalid-id-test@example.com",
      });

      // Try to get API key with invalid UUID format
      const invalidAgentId = "not-a-valid-uuid";
      await expect(
        rpcClient.user.getAgentApiKey({ agentId: invalidAgentId }),
      ).rejects.toThrow(/Input validation failed|Invalid/);
    });

    test("API key endpoint returns consistent format", async () => {
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Format Test User",
        userEmail: "format-test@example.com",
      });

      // Create an agent
      const { agent } = await rpcClient.user.createAgent({
        name: "Format Test Agent",
        handle: "formattestagent",
        description: "Agent for format consistency testing",
      });

      // Get the agent's API key
      const keyData = await rpcClient.user.getAgentApiKey({
        agentId: agent.id,
      });

      // Verify response structure
      expect(keyData).toHaveProperty("agentId");
      expect(keyData).toHaveProperty("agentName");
      expect(keyData).toHaveProperty("agentHandle");
      expect(keyData).toHaveProperty("apiKey");

      // Verify types
      expect(typeof keyData.agentId).toBe("string");
      expect(typeof keyData.agentName).toBe("string");
      expect(typeof keyData.agentHandle).toBe("string");
      expect(typeof keyData.apiKey).toBe("string");

      // Verify values match agent data
      expect(keyData.agentId).toBe(agent.id);
      expect(keyData.agentName).toBe(agent.name);
    });

    test("retrieved API key works for agent authentication", async () => {
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Auth Test User",
        userEmail: "auth-test@example.com",
      });

      // Create an agent
      const { agent } = await rpcClient.user.createAgent({
        name: "Auth Test Agent",
        handle: "authtestagent",
        description: "Agent for authentication testing",
      });

      // Get the agent's API key
      const keyData = await rpcClient.user.getAgentApiKey({
        agentId: agent.id,
      });

      // Create an agent client using the retrieved API key
      const agentClient = adminClient.createAgentClient(keyData.apiKey);

      // Verify the agent client can authenticate and get its profile
      const profileResponse = await agentClient.getAgentProfile();
      expect(profileResponse.success).toBe(true);

      const profileData = profileResponse as AgentProfileResponse;
      expect(profileData.agent.id).toBe(agent.id);
      expect(profileData.agent.name).toBe(agent.name);
    });
  });

  test("user can get competitions for their agents", async () => {
    const { client1, user1 } = await generateTestCompetitions(adminApiKey);
    // Test: User can get competitions for their agents
    const competitionsResponse =
      (await client1.getUserCompetitions()) as UserCompetitionsResponse;

    expect(competitionsResponse.success).toBe(true);
    expect(competitionsResponse.competitions).toBeDefined();
    expect(Array.isArray(competitionsResponse.competitions)).toBe(true);
    expect(competitionsResponse.competitions.length).toBe(10);
    expect(competitionsResponse.pagination).toBeDefined();
    expect(
      (competitionsResponse as UserCompetitionsResponse).pagination.limit,
    ).toBe(10);
    expect(
      (competitionsResponse as UserCompetitionsResponse).pagination.offset,
    ).toBe(0);
    expect(
      (competitionsResponse as UserCompetitionsResponse).pagination.total,
    ).toBe(15);
    expect(
      (competitionsResponse as UserCompetitionsResponse).pagination.hasMore,
    ).toBe(true);

    for (const comp of competitionsResponse.competitions) {
      expect(comp.agents).toBeDefined();
      expect(Array.isArray(comp.agents)).toBe(true);
      expect(comp.agents.every((agent) => agent.ownerId === user1.id)).toBe(
        true,
      );
      expect(
        comp.agents.every(
          (agent) => agent.rank === undefined || agent.rank >= 1,
        ),
      );
    }

    // Test with query parameters
    const competitionsWithParamsResponse = (await client1.getUserCompetitions({
      limit: 5,
      offset: 0,
    })) as UserCompetitionsResponse;

    expect(competitionsWithParamsResponse.success).toBe(true);
    expect(
      (competitionsWithParamsResponse as UserCompetitionsResponse).pagination
        .limit,
    ).toBe(5);
  });

  test("user can get competitions for their agents with correct rank", async () => {
    // Register three agents
    const {
      rpcClient: rpcClient1,
      agent: agent1,
      client: agentClient1,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Agent One",
    });

    const {
      rpcClient: rpcClient2,
      agent: agent2,
      client: agentClient2,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Agent Two",
    });

    const {
      rpcClient: rpcClient3,
      agent: agent3,
      client: agentClient3,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Agent Three",
    });

    // Create and start a competition with three agents
    const competitionName = `Ranking Test Competition ${Date.now()}`;
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition with three agents for testing ranking",
      agentIds: [agent1.id, agent2.id, agent3.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse.success).toBe(true);

    const competition = startResponse.competition;
    expect(competition).toBeDefined();

    // Make trades with different outcomes to create distinct rankings
    // Agent 1: Bad trade (loses most money) - should be ranked 3rd (worst)
    await agentClient1.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Zero address trade
      amount: "1000",
      competitionId: competition.id,
      reason: "Bad trade for Agent 1",
    });

    // Agent 2: Good trade (loses least money) - should be ranked 1st (best)
    await agentClient2.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000",
      amount: "10",
      competitionId: competition.id,
      reason: "Good trade for Agent 2",
    });

    // Agent 3: Medium trade (loses some money) - should be ranked 2nd (middle)
    await agentClient3.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000",
      amount: "100",
      competitionId: competition.id,
      reason: "Medium trade for Agent 3",
    });

    // Trigger portfolio snapshots
    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

    // Get agent competitions for each user
    const { competitions: comps1 } = await rpcClient1.user.getCompetitions({});

    const { competitions: comps2 } = await rpcClient2.user.getCompetitions({});

    const { competitions: comps3 } = await rpcClient3.user.getCompetitions({});

    expect(comps2[0]?.id).toBe(competition.id);
    expect(comps2[0]?.agents.length).toBe(1);
    expect(comps2[0]?.agents[0]?.id).toBe(agent2.id);
    expect(comps2[0]?.agents[0]?.rank).toBe(1);

    expect(comps3[0]?.id).toBe(competition.id);
    expect(comps3[0]?.agents.length).toBe(1);
    expect(comps3[0]?.agents[0]?.id).toBe(agent3.id);
    expect(comps3[0]?.agents[0]?.rank).toBe(2);

    expect(comps1[0]?.id).toBe(competition.id);
    expect(comps1[0]?.agents.length).toBe(1);
    expect(comps1[0]?.agents[0]?.id).toBe(agent1.id);
    expect(comps1[0]?.agents[0]?.rank).toBe(3);
  });

  describe("User Competitions Sorting and Pagination", () => {
    test("user competitions throw 400 error for invalid sort fields", async () => {
      // Create a user with agent
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Invalid Sort Test User",
        userEmail: "invalid-sort-test@example.com",
      });

      // Test valid sort fields that should work now
      const validSortResult = await rpcClient.user.getCompetitions({
        sort: "agentName",
      });
      expect(validSortResult).toBeDefined();

      const validRankSortResult = await rpcClient.user.getCompetitions({
        sort: "-rank",
      });
      expect(validRankSortResult).toBeDefined();

      // Test actually invalid sort field that should still fail
      await expect(
        rpcClient.user.getCompetitions({
          sort: "invalidFieldName",
        }),
      ).rejects.toThrow(/cannot sort by field/);
    });

    test("user competitions hasMore calculation is accurate", async () => {
      // Create a user with agent
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "HasMore Test User",
        userEmail: "hasmore-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "HasMore Test Agent",
        handle: "hasmoretest",
        description: "Agent for hasMore testing",
      });

      // Create exactly 5 competitions
      for (let i = 0; i < 5; i++) {
        const createResponse = await adminClient.createCompetition({
          name: `HasMore Competition ${i}`,
          description: `Competition ${i} for hasMore testing`,
        });
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await rpcClient.competitions.join({
          competitionId: createCompResponse.competition.id,
          agentId: agent.id,
        });
      }

      // Test scenario where hasMore should be true
      const page1Result = await rpcClient.user.getCompetitions({
        limit: 3,
        offset: 0,
      });
      expect(page1Result.pagination.hasMore).toBe(true);
      // 0 + 3 < 5 = true

      // Test scenario where hasMore should be false
      const page2Result = await rpcClient.user.getCompetitions({
        limit: 3,
        offset: 3,
      });
      expect(page2Result.pagination.hasMore).toBe(false);
      // 3 + 3 >= 5 = false (even though we only get 2 items back)

      // Verify the returned count matches what we expect
      expect(page2Result.competitions.length).toBe(2); // Only 2 competitions left (5 - 3 = 2)
    });

    test("user competitions pagination handles offset beyond total", async () => {
      // Create a user with agent and limited competitions
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Offset Edge Test User",
        userEmail: "offset-edge-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Offset Edge Test Agent",
        handle: "offsetedgetest",
        description: "Agent for offset edge tests",
      });

      // Create only 2 competitions
      for (let i = 0; i < 2; i++) {
        const createResponse = await adminClient.createCompetition({
          name: `Edge Test Competition ${i}`,
          description: `Competition ${i} for edge testing`,
        });
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await rpcClient.competitions.join({
          competitionId: createCompResponse.competition.id,
          agentId: agent.id,
        });
      }

      // Test offset beyond total (should return empty array)
      const beyondTotalResult = await rpcClient.user.getCompetitions({
        offset: 10,
        limit: 5,
      });
      expect(beyondTotalResult.competitions.length).toBe(0);
      expect(beyondTotalResult.pagination.hasMore).toBe(false);
    });

    test("user competitions valid sort fields work correctly", async () => {
      // Test that the currently supported sort fields work as expected
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Valid Sort Test User",
        userEmail: "valid-sort-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Valid Sort Test Agent",
        handle: "validsorttest",
        description: "Agent for valid sort testing",
      });

      // Create competitions with predictable names for sorting
      const firstComp = "Alpha Competition";
      const secondComp = "Beta Competition";
      const thirdComp = "Charlie Competition";

      const create1Response = await adminClient.createCompetition({
        name: firstComp,
        description: `Description for ${firstComp}`,
      });
      expect(create1Response.success).toBe(true);
      const competitionIdForFirstComp = (
        create1Response as CreateCompetitionResponse
      ).competition.id;
      await rpcClient.competitions.join({
        competitionId: competitionIdForFirstComp,
        agentId: agent.id,
      });
      await wait(50);

      const create2Response = await adminClient.createCompetition({
        name: secondComp,
        description: `Description for ${secondComp}`,
      });
      expect(create2Response.success).toBe(true);
      const createCompResponse2 = create2Response as CreateCompetitionResponse;
      const competitionIdForSecondComp = createCompResponse2.competition.id;
      await rpcClient.competitions.join({
        competitionId: competitionIdForSecondComp,
        agentId: agent.id,
      });
      await wait(50);

      const create3Response = await adminClient.createCompetition({
        name: thirdComp,
        description: `Description for ${thirdComp}`,
      });
      expect(create3Response.success).toBe(true);
      const competitionIdForThirdComp = (
        create3Response as CreateCompetitionResponse
      ).competition.id;
      await rpcClient.competitions.join({
        competitionId: competitionIdForThirdComp,
        agentId: agent.id,
      });
      await wait(50);

      // Start/end the first competition, start/end the second competition, and keep the third pending
      const startCompResponse = await adminClient.startExistingCompetition({
        competitionId: competitionIdForFirstComp,
        agentIds: [agent.id],
      });
      expect(startCompResponse.success).toBe(true);
      const endCompResponse = await adminClient.endCompetition(
        competitionIdForFirstComp,
      );
      expect(endCompResponse.success).toBe(true);
      const startCompResponse2 = await adminClient.startExistingCompetition({
        competitionId: competitionIdForSecondComp,
        agentIds: [agent.id],
      });
      expect(startCompResponse2.success).toBe(true);

      // Test name ascending sort (should work)
      const { competitions: nameAscComps } =
        await rpcClient.user.getCompetitions({
          sort: "name",
        });
      expect(nameAscComps.length).toBe(3);
      expect(nameAscComps[0]?.name).toBe("Alpha Competition");
      expect(nameAscComps[1]?.name).toBe("Beta Competition");
      expect(nameAscComps[2]?.name).toBe("Charlie Competition");

      // Test createdAt descending sort (should work)
      const { competitions: createdDescComps } =
        await rpcClient.user.getCompetitions({
          sort: "-createdAt",
        });
      expect(createdDescComps.length).toBe(3);
      // Newest first should be "Charlie Competition" (created last)
      expect(createdDescComps[0]?.name).toBe("Charlie Competition");

      // Sort by status ascending
      const { competitions: statusAgents } =
        await rpcClient.user.getCompetitions({
          sort: "status",
        });
      expect(statusAgents).toHaveLength(3);
      // The `competition` status should be in order
      expect(statusAgents[0]?.status).toBe("pending");
      expect(statusAgents[1]?.status).toBe("active");
      expect(statusAgents[2]?.status).toBe("ended");

      // Sort by status descending
      const { competitions: statusDescAgents } =
        await rpcClient.user.getCompetitions({
          sort: "-status",
        });
      expect(statusDescAgents).toHaveLength(3);
      // The `competition` status should be in order
      expect(statusDescAgents[0]?.status).toBe("ended");
      expect(statusDescAgents[1]?.status).toBe("active");
      expect(statusDescAgents[2]?.status).toBe("pending");
    });

    test("user competitions correct sort format works", async () => {
      // Test the CORRECT format that the API expects: "fieldName" and "-fieldName"
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Correct Format Test User",
        userEmail: "correct-format-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Correct Format Test Agent",
        handle: "correctfmttest",
        description: "Agent for correct format testing",
      });

      // Create competitions with predictable names
      const competitionNames = [
        "Zebra Competition",
        "Alpha Competition",
        "Beta Competition",
      ];

      for (const name of competitionNames) {
        const createResponse = await adminClient.createCompetition({
          name,
          description: `Description for ${name}`,
        });
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await rpcClient.competitions.join({
          competitionId: createCompResponse.competition.id,
          agentId: agent.id,
        });

        // Small delay to ensure different timestamps
        await wait(50);
      }

      // Test correct format: name ascending (no prefix)
      const { competitions: nameAscComps } =
        await rpcClient.user.getCompetitions({
          sort: "name",
        });
      expect(nameAscComps.length).toBe(3);
      expect(nameAscComps[0]?.name).toBe("Alpha Competition");
      expect(nameAscComps[1]?.name).toBe("Beta Competition");
      expect(nameAscComps[2]?.name).toBe("Zebra Competition");

      // Test correct format: name descending (minus prefix)
      const { competitions: nameDescComps } =
        await rpcClient.user.getCompetitions({
          sort: "-name",
        });
      expect(nameDescComps.length).toBe(3);
      expect(nameDescComps[0]?.name).toBe("Zebra Competition");
      expect(nameDescComps[1]?.name).toBe("Beta Competition");
      expect(nameDescComps[2]?.name).toBe("Alpha Competition");

      // Test correct format: createdAt ascending
      const { competitions: createdAscComps } =
        await rpcClient.user.getCompetitions({
          sort: "createdAt",
        });
      expect(createdAscComps.length).toBe(3);
      // Oldest first should be "Zebra Competition" (created first)
      expect(createdAscComps[0]?.name).toBe("Zebra Competition");

      // Test correct format: createdAt descending
      const { competitions: createdDescComps } =
        await rpcClient.user.getCompetitions({
          sort: "-createdAt",
        });
      expect(createdDescComps.length).toBe(3);
      // Newest first should be "Beta Competition" (created last)
      expect(createdDescComps[0]?.name).toBe("Beta Competition");
    });

    test("user competitions multiple sort fields work correctly", async () => {
      // Test multiple sort fields using the correct format: "field1,field2,-field3"
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Multiple Sort Test User",
        userEmail: "multiple-sort-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Multiple Sort Test Agent",
        handle: "multisorttest",
        description: "Agent for multiple sort testing",
      });

      // Create competitions with same names but different timestamps to test multi-field sorting
      const competitionData = [
        { name: "Alpha Competition", delay: 100 },
        { name: "Alpha Competition", delay: 200 }, // Same name, different time
        { name: "Beta Competition", delay: 150 },
      ];

      for (const comp of competitionData) {
        const createResponse = await adminClient.createCompetition({
          name: comp.name,
          description: `Description for ${comp.name}`,
        });
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await rpcClient.competitions.join({
          competitionId: createCompResponse.competition.id,
          agentId: agent.id,
        });

        // Controlled delay to ensure different timestamps
        await wait(comp.delay);
      }

      // Test multiple sort fields: name ascending, then createdAt descending
      const { competitions: multipleSortComps } =
        await rpcClient.user.getCompetitions({
          sort: "name,-createdAt",
        });
      expect(multipleSortComps.length).toBe(3);

      // Should be sorted by name first (Alpha, Alpha, Beta),
      // then by createdAt desc within same names (newer Alpha first)
      expect(multipleSortComps[0]?.name).toBe("Alpha Competition");
      expect(multipleSortComps[1]?.name).toBe("Alpha Competition");
      expect(multipleSortComps[2]?.name).toBe("Beta Competition");

      // Verify the two Alpha competitions are in correct createdAt order (newest first)
      const alpha1CreatedAt = new Date(multipleSortComps[0]?.createdAt || "");
      const alpha2CreatedAt = new Date(multipleSortComps[1]?.createdAt || "");
      expect(alpha1CreatedAt.getTime()).toBeGreaterThan(
        alpha2CreatedAt.getTime(),
      );
    });

    // ========================================
    // NEW COMPUTED SORT FIELD TESTS
    // ========================================

    test("user competitions agentName sorting works correctly", async () => {
      // Test the new agentName computed sort field
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "AgentName Sort Test User",
        userEmail: "agentname-sort-test@example.com",
      });

      // Create multiple agents with different names for sorting
      const agentNames = ["Zebra Agent", "Alpha Agent", "Beta Agent"];
      const agents = [];

      for (const name of agentNames) {
        const { agent } = await rpcClient.user.createAgent({
          name,
          handle: name.toLowerCase().replace(/\s+/g, ""),
          description: `Description for ${name}`,
        });
        agents.push(agent);
      }

      // Create competitions and have different agents join different competitions
      const competitions = [];
      for (let i = 0; i < 3; i++) {
        const createResponse = await adminClient.createCompetition({
          name: `AgentName Sort Competition ${i}`,
          description: `Competition ${i} for agentName sorting`,
        });
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        competitions.push(competition);

        // Each competition gets a different agent (to test primary agent name sorting)
        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agents[i]!.id,
        });

        // Small delay to ensure different timestamps
        await wait(50);
      }

      // Test agentName ascending sort (should work now!)
      const { competitions: agentNameAscComps } =
        await rpcClient.user.getCompetitions({
          sort: "agentName",
        });
      expect(agentNameAscComps.length).toBe(3);

      // Verify sorting by primary agent name (alphabetically first)
      // Should be: Alpha Agent, Beta Agent, Zebra Agent
      expect(agentNameAscComps[0]?.agents?.[0]?.name).toBe("Alpha Agent");
      expect(agentNameAscComps[1]?.agents?.[0]?.name).toBe("Beta Agent");
      expect(agentNameAscComps[2]?.agents?.[0]?.name).toBe("Zebra Agent");

      // Test agentName descending sort
      const { competitions: agentNameDescComps } =
        await rpcClient.user.getCompetitions({
          sort: "-agentName",
        });
      expect(agentNameDescComps.length).toBe(3);

      // Should be: Zebra Agent, Beta Agent, Alpha Agent
      expect(agentNameDescComps[0]?.agents?.[0]?.name).toBe("Zebra Agent");
      expect(agentNameDescComps[1]?.agents?.[0]?.name).toBe("Beta Agent");
      expect(agentNameDescComps[2]?.agents?.[0]?.name).toBe("Alpha Agent");
    });

    test("user competitions rank sorting works correctly", async () => {
      // Test rank sorting with 3 users each having 1 agent in same competition with different ranks
      // Create 3 users, each with 1 agent
      const userAgents = [];
      for (let i = 1; i <= 3; i++) {
        const {
          rpcClient,
          agent,
          client: agentClient,
        } = await registerUserAndAgentAndGetRpcClient({
          adminApiKey,
          userName: `Rank Test User ${i}`,
          userEmail: `rank-test-user${i}@example.com`,
          agentName: `Rank Agent ${i}`,
        });
        userAgents.push({ rpcClient, agent, agentClient });
      }

      // Create two competitions
      const comp1Response = await createTestCompetition({
        adminClient,
        name: "Multi-Agent Competition",
        description: "Competition with multiple agents for ranking",
      });
      const comp1 = comp1Response.competition;

      const comp2Response = await createTestCompetition({
        adminClient,
        name: "Single Agent Competition",
        description: "Competition with single agent",
      });
      const comp2 = comp2Response.competition;

      // All agents join first competition
      await userAgents[0]!.rpcClient.competitions.join({
        competitionId: comp1.id,
        agentId: userAgents[0]!.agent.id,
      });
      await userAgents[1]!.rpcClient.competitions.join({
        competitionId: comp1.id,
        agentId: userAgents[1]!.agent.id,
      });
      await userAgents[2]!.rpcClient.competitions.join({
        competitionId: comp1.id,
        agentId: userAgents[2]!.agent.id,
      });

      // First agent also joins second competition
      await userAgents[0]!.rpcClient.competitions.join({
        competitionId: comp2.id,
        agentId: userAgents[0]!.agent.id,
      });

      // Start first competition and create ranking differences
      await startExistingTestCompetition({
        adminClient,
        competitionId: comp1.id,
        agentIds: [
          userAgents[0]!.agent.id,
          userAgents[1]!.agent.id,
          userAgents[2]!.agent.id,
        ],
      });

      const agent1Client = userAgents[0]!.agentClient;
      const agent2Client = userAgents[1]!.agentClient;
      const agent3Client = userAgents[2]!.agentClient;
      // Create ranking differences using burn address pattern
      // Agent 1: Small loss (best rank)
      await agent1Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: specificChainTokens.eth.eth, // ETH - should maintain/increase value
        amount: "50",
        competitionId: comp1.id,
        reason: "Agent 1 small trade - USDC to ETH",
      });

      // Agent 2: Medium loss (middle rank)
      await agent2Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn - bad trade
        amount: "25",
        competitionId: comp1.id,
        reason: "Agent 2 bad trade - burning tokens",
      });

      // Agent 3: Large loss (worst rank)
      await agent3Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "50",
        competitionId: comp1.id,
        reason: "Agent 3 terrible trade - burning large amount",
      });

      // End first competition and start second
      await adminClient.endCompetition(comp1.id);
      await startExistingTestCompetition({
        adminClient,
        competitionId: comp2.id,
        agentIds: [userAgents[0]!.agent.id],
      });

      // Wait for portfolio snapshots to be created
      await wait(2000);

      // Test rank ascending sort from first user's perspective (best ranks first)
      const { competitions: rankAscComps } =
        await userAgents[0]!.rpcClient.user.getCompetitions({
          sort: "rank",
        });
      expect(rankAscComps.length).toBe(2);

      // Find competitions by name
      const multiAgentComp = rankAscComps.find(
        (c) => c.name === "Multi-Agent Competition",
      );
      const singleAgentComp = rankAscComps.find(
        (c) => c.name === "Single Agent Competition",
      );

      expect(multiAgentComp).toBeDefined();
      expect(singleAgentComp).toBeDefined();

      // User 1's agent should have rank 1 in multi-agent comp (best) and rank 1 in single-agent comp
      expect(multiAgentComp!.agents?.[0]?.rank).toBe(1);
      expect(singleAgentComp!.agents?.[0]?.rank).toBe(1);

      // Test rank descending sort
      const { competitions: rankDescComps } =
        await userAgents[0]!.rpcClient.user.getCompetitions({
          sort: "-rank",
        });
      expect(rankDescComps.length).toBe(2);

      // Order should be reversed, but ranks should be the same
      const multiAgentCompDesc = rankDescComps.find(
        (c) => c.name === "Multi-Agent Competition",
      );
      const singleAgentCompDesc = rankDescComps.find(
        (c) => c.name === "Single Agent Competition",
      );
      expect(multiAgentCompDesc!.agents?.[0]?.rank).toBe(1);
      expect(singleAgentCompDesc!.agents?.[0]?.rank).toBe(1);

      // Verify second user has rank 2 in the competition
      const { competitions: user2Comps } =
        await userAgents[1]!.rpcClient.user.getCompetitions({});
      const user2Comp1 = user2Comps.find(
        (c) => c.name === "Multi-Agent Competition",
      );
      expect(user2Comp1!.agents?.[0]?.rank).toBe(2);

      // Verify third user has rank 3
      const { competitions: user3Comps } =
        await userAgents[2]!.rpcClient.user.getCompetitions({});
      const user3Comp1 = user3Comps.find(
        (c) => c.name === "Multi-Agent Competition",
      );
      expect(user3Comp1!.agents?.[0]?.rank).toBe(3);
    });

    test("user competitions rank sorting with undefined ranks", async () => {
      // Test rank sorting when some competitions have no ranking data
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Undefined Rank Test User",
        userEmail: "undefined-rank-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Undefined Rank Test Agent",
        handle: "undefranktest",
        description: "Agent for testing undefined rank handling",
      });

      // Create one started competition (will have rank) and one unstarted (no rank)
      const startedCompResponse = await createTestCompetition({
        adminClient,
        name: "Started Competition",
        description: "Competition that will be started",
      });
      const startedComp = startedCompResponse.competition;

      const unstartedCompResponse = await createTestCompetition({
        adminClient,
        name: "Unstarted Competition",
        description: "Competition that will not be started",
      });
      const unstartedComp = unstartedCompResponse.competition;

      // Join both competitions
      await rpcClient.competitions.join({
        competitionId: startedComp.id,
        agentId: agent.id,
      });
      await rpcClient.competitions.join({
        competitionId: unstartedComp.id,
        agentId: agent.id,
      });

      // Start only one competition
      await startExistingTestCompetition({
        adminClient,
        competitionId: startedComp.id,
        agentIds: [agent.id],
      });
      await wait(1000);

      // Test rank ascending sort - competitions with undefined ranks should go to end
      const { competitions: rankSortComps } =
        await rpcClient.user.getCompetitions({
          sort: "rank",
        });
      expect(rankSortComps.length).toBe(2);

      // First competition should be the one with valid rank
      expect(rankSortComps[0]?.name).toBe("Started Competition");
      expect(rankSortComps[0]?.agents?.[0]?.rank).toBe(1);

      // Second competition should be the one with undefined rank
      expect(rankSortComps[1]?.name).toBe("Unstarted Competition");
      expect(rankSortComps[1]?.agents?.[0]?.rank).toBeUndefined();
    });

    test("user competitions new sort fields validation", async () => {
      // Test that the new sort fields are properly validated
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "New Sort Validation User",
        userEmail: "new-sort-validation@example.com",
      });

      // Test that agentName is now a valid sort field (should not throw 400)
      const agentNameResult = await rpcClient.user.getCompetitions({
        sort: "agentName",
      });
      expect(agentNameResult).toBeDefined();

      // Test that rank is now a valid sort field (should not throw 400)
      const rankResult = await rpcClient.user.getCompetitions({
        sort: "rank",
      });
      expect(rankResult).toBeDefined();

      // Test that descending variants work
      const agentNameDescResult = await rpcClient.user.getCompetitions({
        sort: "-agentName",
      });
      expect(agentNameDescResult).toBeDefined();

      const rankDescResult = await rpcClient.user.getCompetitions({
        sort: "-rank",
      });
      expect(rankDescResult).toBeDefined();

      // Test that invalid sort fields still throw 400
      await expect(
        rpcClient.user.getCompetitions({
          sort: "invalidField",
        }),
      ).rejects.toThrow(/cannot sort by field/);
    });

    test("user competitions combined sort with new fields", async () => {
      // Test combining new computed sort fields with existing database fields
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Combined Sort Test User",
        userEmail: "combined-sort-test@example.com",
      });

      const { agent } = await rpcClient.user.createAgent({
        name: "Combined Sort Test Agent",
        handle: "combsorttest",
        description: "Agent for combined sort testing",
      });

      // Create competitions with same agent names but different creation times
      for (let i = 0; i < 3; i++) {
        const createResponse = await adminClient.createCompetition({
          name: `Combined Sort Competition ${i}`,
          description: `Competition ${i} for combined sort testing`,
        });
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agent.id,
        });

        // Controlled delay for predictable timestamps
        await wait(100);
      }

      // Test combined sort: agentName ascending, then createdAt descending
      // Since all have same agent, should sort by createdAt desc as secondary
      const { competitions: combinedComps } =
        await rpcClient.user.getCompetitions({
          sort: "agentName,-createdAt",
        });
      expect(combinedComps.length).toBe(3);

      // Verify newest competition comes first (since agentName is same for all)
      expect(combinedComps[0]?.name).toBe("Combined Sort Competition 2");
      expect(combinedComps[1]?.name).toBe("Combined Sort Competition 1");
      expect(combinedComps[2]?.name).toBe("Combined Sort Competition 0");
    });

    test("user competitions agentName sorting with pagination", async () => {
      // Test pagination with agentName computed sorting
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "AgentName Pagination Test User",
        userEmail: "agentname-pagination-test@example.com",
      });

      // Create multiple agents with predictable names for sorting
      const agentNames = [
        "Alpha Agent",
        "Beta Agent",
        "Charlie Agent",
        "Delta Agent",
        "Echo Agent",
      ];
      const agents = [];

      for (const name of agentNames) {
        const { agent } = await rpcClient.user.createAgent({
          name,
          handle: name.toLowerCase().replace(/\s+/g, ""),
          description: `Description for ${name}`,
        });
        agents.push(agent);
      }

      // Create 5 competitions, each with a different agent
      for (let i = 0; i < 5; i++) {
        const createResponse = await adminClient.createCompetition({
          name: `AgentName Pagination Competition ${i}`,
          description: `Competition ${i} for agentName pagination testing`,
        });
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agents[i]!.id,
        });

        await wait(50);
      }

      // Test first page (limit 2, offset 0) with agentName sorting
      const page1Result = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 2,
        offset: 0,
      });
      expect(page1Result.competitions.length).toBe(2);
      expect(page1Result.pagination.total).toBe(5);
      expect(page1Result.pagination.hasMore).toBe(true);

      // Should be Alpha and Beta (first 2 alphabetically)
      expect(page1Result.competitions[0]?.agents?.[0]?.name).toBe(
        "Alpha Agent",
      );
      expect(page1Result.competitions[1]?.agents?.[0]?.name).toBe("Beta Agent");

      // Test second page (limit 2, offset 2)
      const page2Result = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 2,
        offset: 2,
      });
      expect(page2Result.competitions.length).toBe(2);
      expect(page2Result.pagination.total).toBe(5);
      expect(page2Result.pagination.hasMore).toBe(true);

      // Should be Charlie and Delta
      expect(page2Result.competitions[0]?.agents?.[0]?.name).toBe(
        "Charlie Agent",
      );
      expect(page2Result.competitions[1]?.agents?.[0]?.name).toBe(
        "Delta Agent",
      );

      // Test final page (limit 2, offset 4)
      const page3Result = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 2,
        offset: 4,
      });
      expect(page3Result.competitions.length).toBe(1); // Only Echo left
      expect(page3Result.pagination.total).toBe(5);
      expect(page3Result.pagination.hasMore).toBe(false);

      // Should be Echo
      expect(page3Result.competitions[0]?.agents?.[0]?.name).toBe("Echo Agent");

      // Verify no overlapping results between pages
      const allPageIds = [
        ...page1Result.competitions.map((c) => c.id),
        ...page2Result.competitions.map((c) => c.id),
        ...page3Result.competitions.map((c) => c.id),
      ];
      const uniqueIds = new Set(allPageIds);
      expect(uniqueIds.size).toBe(allPageIds.length); // No duplicates
    });

    test("user competitions rank sorting with pagination", async () => {
      // Test pagination with rank computed sorting
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Rank Pagination Test User",
        userEmail: "rank-pagination-test@example.com",
      });

      // Create multiple agents
      const agents = [];
      for (let i = 0; i < 4; i++) {
        const { agent } = await rpcClient.user.createAgent({
          name: `Rank Test Agent ${i}`,
          handle: `ranktest${i}`,
          description: `Agent ${i} for rank pagination testing`,
        });
        agents.push(agent);
      }

      // Create 2 started competitions (will have ranks) and 2 unstarted (no ranks)
      const competitions = [];

      // Create started competitions with different performance levels
      for (let i = 0; i < 2; i++) {
        const createResponse = await createTestCompetition({
          adminClient,
          name: `Started Rank Competition ${i}`,
          description: `Started competition ${i} for rank testing`,
        });
        const competition = createResponse.competition;
        competitions.push(competition);

        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agents[i]!.id,
        });
        await startExistingTestCompetition({
          adminClient,
          competitionId: competition.id,
          agentIds: [agents[i]!.id],
        });

        // Create different performance levels using established burn address pattern
        const keyData = await rpcClient.user.getAgentApiKey({
          agentId: agents[i]!.id,
        });
        const agentClient = adminClient.createAgentClient(keyData.apiKey);
        if (i === 0) {
          // Best performer: keep valuable assets
          await agentClient.executeTrade({
            fromToken: specificChainTokens.eth.usdc,
            toToken: specificChainTokens.eth.eth,
            amount: "100",
            competitionId: competition.id,
            reason: "Smart trade - buying ETH",
          });
        } else {
          // Poor performer: burn tokens to create lower rank
          await agentClient.executeTrade({
            fromToken: specificChainTokens.eth.usdc,
            toToken: "0x000000000000000000000000000000000000dead", // Burn address
            amount: "150",
            competitionId: competition.id,
            reason: "Bad trade - burning tokens",
          });
        }

        // End this competition before starting the next one (only one can be active)
        await adminClient.endCompetition(competition.id);
      }

      // Unstarted competitions
      for (let i = 2; i < 4; i++) {
        const createResponse = await createTestCompetition({
          adminClient,
          name: `Unstarted Rank Competition ${i}`,
          description: `Unstarted competition ${i} for rank testing`,
        });
        const competition = createResponse.competition;
        competitions.push(competition);

        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agents[i]!.id,
        });
      }

      // Wait for portfolio snapshots
      await wait(1500);

      // Test first page with rank sorting (started competitions should come first)
      const page1Result = await rpcClient.user.getCompetitions({
        sort: "rank",
        limit: 2,
        offset: 0,
      });
      expect(page1Result.competitions.length).toBe(2);
      expect(page1Result.pagination.total).toBe(4);
      expect(page1Result.pagination.hasMore).toBe(true);

      // First 2 should be the started competitions (with ranks)
      expect(page1Result.competitions[0]?.agents?.[0]?.rank).toBe(1);
      expect(page1Result.competitions[1]?.agents?.[0]?.rank).toBe(1);

      // Test second page (should be unstarted competitions)
      const page2Result = await rpcClient.user.getCompetitions({
        sort: "rank",
        limit: 2,
        offset: 2,
      });
      expect(page2Result.competitions.length).toBe(2);
      expect(page2Result.pagination.total).toBe(4);
      expect(page2Result.pagination.hasMore).toBe(false);

      // Last 2 should be the unstarted competitions (undefined ranks)
      expect(page2Result.competitions[0]?.agents?.[0]?.rank).toBeUndefined();
      expect(page2Result.competitions[1]?.agents?.[0]?.rank).toBeUndefined();
    });

    test("user competitions pagination accuracy with computed sorting", async () => {
      // Test that pagination counts are accurate when using computed sorting
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Computed Pagination Test User",
        userEmail: "computed-pagination-test@example.com",
      });

      // Create multiple agents with different names
      const agentNames = ["Zebra", "Alpha", "Beta", "Gamma", "Delta", "Echo"];
      const agents = [];

      for (const name of agentNames) {
        const { agent } = await rpcClient.user.createAgent({
          name: `${name} Agent`,
          handle: `${name.toLowerCase()}agent`,
          description: `Agent named ${name}`,
        });
        agents.push(agent);
      }

      // Create 6 competitions, each with a different agent
      for (let i = 0; i < 6; i++) {
        const createResponse = await adminClient.createCompetition({
          name: `Computed Pagination Competition ${i}`,
          description: `Competition ${i} for computed pagination testing`,
        });
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agents[i]!.id,
        });
      }

      // Test various pagination scenarios with computed sorting

      // Scenario 1: First 3 items
      const scenario1 = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 3,
        offset: 0,
      });
      expect(scenario1.competitions.length).toBe(3);
      expect(scenario1.pagination.total).toBe(6);
      expect(scenario1.pagination.hasMore).toBe(true);
      expect(scenario1.pagination.offset).toBe(0);
      expect(scenario1.pagination.limit).toBe(3);

      // Scenario 2: Next 3 items
      const scenario2 = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 3,
        offset: 3,
      });
      expect(scenario2.competitions.length).toBe(3);
      expect(scenario2.pagination.total).toBe(6);
      expect(scenario2.pagination.hasMore).toBe(false);
      expect(scenario2.pagination.offset).toBe(3);
      expect(scenario2.pagination.limit).toBe(3);

      // Scenario 3: Offset beyond total
      const scenario3 = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 3,
        offset: 10,
      });
      expect(scenario3.competitions.length).toBe(0);
      expect(scenario3.pagination.total).toBe(6);
      expect(scenario3.pagination.hasMore).toBe(false);

      // Scenario 4: Large limit
      const scenario4 = await rpcClient.user.getCompetitions({
        sort: "agentName",
        limit: 20,
        offset: 0,
      });
      expect(scenario4.competitions.length).toBe(6);
      expect(scenario4.pagination.total).toBe(6);
      expect(scenario4.pagination.hasMore).toBe(false);

      // Verify sorting is correct across all scenarios
      const allSorted = scenario4.competitions;
      const expectedOrder = [
        "Alpha Agent",
        "Beta Agent",
        "Delta Agent",
        "Echo Agent",
        "Gamma Agent",
        "Zebra Agent",
      ];

      for (let i = 0; i < expectedOrder.length; i++) {
        expect(allSorted[i]?.agents?.[0]?.name).toBe(expectedOrder[i]);
      }
    });

    test("user competitions mixed computed and database sorting with pagination", async () => {
      // Test pagination with mixed computed (agentName) and database (createdAt) sorting
      const { rpcClient } = await createPrivyAuthenticatedRpcClient({
        userName: "Mixed Sort Pagination User",
        userEmail: "mixed-sort-pagination@example.com",
      });

      // Create agents with unique names but predictable sorting for testing
      const agentData = [
        { name: "Alpha Agent A", comp: "Competition A" },
        { name: "Alpha Agent B", comp: "Competition B" },
        { name: "Beta Agent A", comp: "Competition C" },
        { name: "Beta Agent B", comp: "Competition D" },
        { name: "Gamma Agent", comp: "Competition E" },
      ];

      const agents = [];
      for (const data of agentData) {
        const { agent } = await rpcClient.user.createAgent({
          name: data.name,
          handle: data.name.toLowerCase().replace(/\s+/g, ""),
          description: `Agent for ${data.comp}`,
        });
        agents.push(agent);
      }

      // Create competitions with controlled timing for secondary sort
      for (let i = 0; i < agentData.length; i++) {
        const createResponse = await adminClient.createCompetition({
          name: agentData[i]!.comp,
          description: `Competition ${i} for mixed sorting`,
        });
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await rpcClient.competitions.join({
          competitionId: competition.id,
          agentId: agents[i]!.id,
        });

        // Controlled delay for predictable timestamps
        await wait(100);
      }

      // Test pagination with mixed sort: agentName (computed) + createdAt descending (database)
      const page1Result = await rpcClient.user.getCompetitions({
        sort: "agentName,-createdAt",
        limit: 3,
        offset: 0,
      });
      expect(page1Result.competitions.length).toBe(3);
      expect(page1Result.pagination.total).toBe(5);
      expect(page1Result.pagination.hasMore).toBe(true);

      // Should be: Alpha Agent A, Alpha Agent B, Beta Agent A
      expect(page1Result.competitions[0]?.name).toBe("Competition A"); // Alpha Agent A
      expect(page1Result.competitions[1]?.name).toBe("Competition B"); // Alpha Agent B
      expect(page1Result.competitions[2]?.name).toBe("Competition C"); // Beta Agent A

      // Test second page
      const page2Result = await rpcClient.user.getCompetitions({
        sort: "agentName,-createdAt",
        limit: 3,
        offset: 3,
      });
      expect(page2Result.competitions.length).toBe(2);
      expect(page2Result.pagination.hasMore).toBe(false);

      // Should be: Beta Agent B, Gamma Agent
      expect(page2Result.competitions[0]?.name).toBe("Competition D"); // Beta Agent B
      expect(page2Result.competitions[1]?.name).toBe("Competition E"); // Gamma Agent
    });
  });

  test("user agents have correct stats after one competition", async () => {
    // Create 5 users, each with 1 agent
    const agentNames = [
      "Alpha Agent",
      "Bravo Agent",
      "Charlie Agent",
      "Delta Agent",
      "Echo Agent",
    ];

    const userAgents = [];
    for (let i = 0; i < agentNames.length; i++) {
      const {
        rpcClient,
        agent,
        client: agentClient,
      } = await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        userName: `Stats Test User ${i + 1}`,
        userEmail: `stats-user${i + 1}@example.com`,
        agentName: agentNames[i]!,
      });
      userAgents.push({ rpcClient, agent, agentClient });
      // Small delay to ensure different timestamps
      await wait(10);
    }

    // Create and start a competition
    const competitionName = `Best Placement Test Competition ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition({
      name: competitionName,
      description: "Test competition for bestPlacement verification",
      tradingConstraints: noTradingConstraints,
    });
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Enter all 5 agents in the competition
    const agentIds = userAgents.map((ua) => ua.agent.id);
    const startResult = await adminClient.startExistingCompetition({
      competitionId,
      agentIds,
    });
    expect(startResult.success).toBe(true);

    // Create different performance levels by executing different trades

    const agentClients = userAgents.map((ua) => ua.agentClient);

    // Alpha Agent: (3 small bad trades)
    for (let i = 0; i < 3; i++) {
      await agentClients[0]?.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        competitionId,
        reason: `Alpha Agent smart trade ${i + 1} - buying ETH`,
      });
      await wait(50);
    }

    // Bravo Agent: (2 small bad trades)
    for (let i = 0; i < 2; i++) {
      await agentClients[1]?.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "100",
        competitionId,
        reason: `Bravo Agent good trade ${i + 1}`,
      });
      await wait(50);
    }

    // Charlie Agent: (1 medium bad trade)
    await agentClients[2]?.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1000",
      competitionId,
      reason: "Charlie Agent trade",
    });
    await wait(50);

    // Delta Agent: (1 large bad trade)
    await agentClients[3]?.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead", // Burn address
      amount: "2000",
      competitionId,
      reason: "Delta Agent bad trade - burning tokens",
    });
    await wait(50);

    // Echo Agent: Worst performer (2 bad trades)
    for (let i = 0; i < 2; i++) {
      await agentClients[4]?.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "2000",
        competitionId,
        reason: `Echo Agent terrible trade ${i + 1} - burning tokens`,
      });
      await wait(50);
    }

    // Wait for 10 seconds to give values a chance to deviate
    await wait(10000);

    // End the competition to calculate final rankings
    const endResult = await adminClient.endCompetition(competitionId);
    expect(endResult.success).toBe(true);

    // Wait a bit for rankings to be calculated
    await wait(1000);

    // Get all agents and verify bestPlacement stats
    const allAgents = [];
    for (const ua of userAgents) {
      const { agents } = await ua.rpcClient.user.getUserAgents({});
      expect(agents).toHaveLength(1); // Each user has 1 agent
      allAgents.push(agents[0]!);
    }

    // Verify each agent has bestPlacement data
    for (const agent of allAgents) {
      expect(agent.stats).toBeDefined();
      expect(agent.stats?.bestPlacement).toBeDefined();
      expect(agent.stats?.bestPlacement?.competitionId).toBe(competitionId);
      expect(agent.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
      expect(agent.stats?.bestPlacement?.rank).toBeLessThanOrEqual(5);
      expect(agent.stats?.bestPlacement?.totalAgents).toBe(5);
      expect(agent.stats?.completedCompetitions).toBe(1);
      expect(agent.stats?.totalTrades).toBeGreaterThanOrEqual(1);
      expect(agent.stats?.bestPnl).toBeDefined();
      expect(agent.stats?.bestPnl).not.toBe(0);
    }

    // Find specific agents and verify their expected rankings
    const alphaAgent = allAgents.find((a) => a.name === "Alpha Agent");
    const bravoAgent = allAgents.find((a) => a.name === "Bravo Agent");
    const charlieAgent = allAgents.find((a) => a.name === "Charlie Agent");
    const deltaAgent = allAgents.find((a) => a.name === "Delta Agent");
    const echoAgent = allAgents.find((a) => a.name === "Echo Agent");

    expect(alphaAgent).toBeDefined();
    expect(bravoAgent).toBeDefined();
    expect(charlieAgent).toBeDefined();
    expect(deltaAgent).toBeDefined();
    expect(echoAgent).toBeDefined();

    // Verify trade counts match what we executed
    expect(alphaAgent?.stats?.totalTrades).toBe(3);
    expect(bravoAgent?.stats?.totalTrades).toBe(2);
    expect(charlieAgent?.stats?.totalTrades).toBe(1);
    expect(deltaAgent?.stats?.totalTrades).toBe(1);
    expect(echoAgent?.stats?.totalTrades).toBe(2);

    // Verify all agents have valid rankings
    expect(alphaAgent?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(alphaAgent?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(5);
    expect(bravoAgent?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(bravoAgent?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(3);
    expect(charlieAgent?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(charlieAgent?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(5);
    expect(deltaAgent?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(3);
    expect(deltaAgent?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(5);
    expect(echoAgent?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(3);
    expect(echoAgent?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(5);

    // Verify that all ranks are unique (no ties)
    const ranks = [
      alphaAgent?.stats?.bestPlacement?.rank,
      bravoAgent?.stats?.bestPlacement?.rank,
      charlieAgent?.stats?.bestPlacement?.rank,
      deltaAgent?.stats?.bestPlacement?.rank,
      echoAgent?.stats?.bestPlacement?.rank,
    ].filter((rank) => rank !== undefined);

    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(5); // All ranks should be unique

    // All agents should have the same competition data in bestPlacement
    for (const agent of allAgents) {
      expect(agent.stats?.bestPlacement?.competitionId).toBe(competitionId);
      expect(agent.stats?.bestPlacement?.totalAgents).toBe(5);
    }
  });

  test("two agents in multiple competitions have correct stats", async () => {
    // Test 2 agents (from different users) across multiple competitions with reversed performance
    // Create 2 users, each with 1 agent
    const {
      rpcClient: user1RpcClient,
      agent: agent1,
      client: agent1Client,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      userName: "Multi Comp User 1",
      userEmail: "multicomp-user1@example.com",
      agentName: "Agent Foxtrot",
    });

    const {
      rpcClient: user2RpcClient,
      agent: agent2,
      client: agent2Client,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      userName: "Multi Comp User 2",
      userEmail: "multicomp-user2@example.com",
      agentName: "Agent Hotel",
    });

    // FIRST COMPETITION
    const competition1Name = `Multi Competition Test 1 ${Date.now()}`;
    const createComp1Result = await adminClient.createCompetition({
      name: competition1Name,
      description: "First test competition for multi-comp verification",
    });
    expect(createComp1Result.success).toBe(true);
    const createComp1Response = createComp1Result as CreateCompetitionResponse;
    const competition1Id = createComp1Response.competition.id;

    // Start first competition with both agents
    const startComp1Result = await adminClient.startExistingCompetition({
      competitionId: competition1Id,
      agentIds: [agent1.id, agent2.id],
    });
    expect(startComp1Result.success).toBe(true);

    // Agent 1: Make stable trade (USDC to ETH) - will win comp1
    await agent1Client.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: specificChainTokens.eth.eth,
      amount: "1000",
      competitionId: competition1Id,
      reason: `Agent Foxtrot trade - stable USDC to ETH`,
    });

    // Agent 2: Make bad trade - will lose comp1
    await agent2Client.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1000",
      competitionId: competition1Id,
      reason: "Agent Hotel trade - volatile USDC to burn",
    });

    // End first competition
    const endComp1Result = await adminClient.endCompetition(competition1Id);
    expect(endComp1Result.success).toBe(true);

    // Wait for rankings to be calculated
    await wait(500);

    // SECOND COMPETITION
    const competition2Name = `Multi Competition Test 2 ${Date.now()}`;
    const createComp2Result = await adminClient.createCompetition({
      name: competition2Name,
      description: "Second test competition for multi-comp verification",
    });
    expect(createComp2Result.success).toBe(true);
    const createComp2Response = createComp2Result as CreateCompetitionResponse;
    const competition2Id = createComp2Response.competition.id;

    // Start second competition with both agents
    const startComp2Result = await adminClient.startExistingCompetition({
      competitionId: competition2Id,
      agentIds: [agent1.id, agent2.id],
    });
    expect(startComp2Result.success).toBe(true);

    // REVERSE THE TRADING PATTERNS
    // Agent 1: make bad trade - will lose comp2
    await agent1Client.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1200",
      competitionId: competition2Id,
      reason: "Agent Foxtrot volatile trade - USDC to burn",
    });

    // Agent 2: Now make stable trade (USDC to ETH) - will win comp2
    await agent2Client.executeTrade({
      fromToken: specificChainTokens.eth.usdc,
      toToken: specificChainTokens.eth.eth,
      competitionId: competition2Id,
      amount: "1200",
      reason: `Agent Hotel stable trade - stable USDC to ETH`,
    });

    // End second competition
    const endComp2Result = await adminClient.endCompetition(competition2Id);
    expect(endComp2Result.success).toBe(true);

    // Wait for rankings to be calculated
    await wait(500);

    // Get all agents and verify stats
    const { agents: user1Agents } = await user1RpcClient.user.getUserAgents({});
    expect(user1Agents).toHaveLength(1);
    const agentFoxtrot = user1Agents[0]!;

    const { agents: user2Agents } = await user2RpcClient.user.getUserAgents({});
    expect(user2Agents).toHaveLength(1);
    const agentHotel = user2Agents[0]!;

    expect(agentFoxtrot).toBeDefined();
    expect(agentHotel).toBeDefined();

    // Verify both agents have completed 2 competitions
    expect(agentFoxtrot.stats?.completedCompetitions).toBe(2);
    expect(agentHotel.stats?.completedCompetitions).toBe(2);

    // Verify trade counts
    expect(agentFoxtrot.stats?.totalTrades).toBe(2); // 1 from comp1 + 1 from comp2
    expect(agentHotel.stats?.totalTrades).toBe(2); // 1 from comp1 + 1 from comp2

    // Verify both agents have bestPlacement stats
    expect(agentFoxtrot.stats?.bestPlacement).toBeDefined();
    expect(agentHotel.stats?.bestPlacement).toBeDefined();

    // Verify bestPlacement structure
    expect(agentFoxtrot.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(agentFoxtrot.stats?.bestPlacement?.rank).toBeLessThanOrEqual(2);
    expect(agentFoxtrot.stats?.bestPlacement?.totalAgents).toBe(2);
    expect([competition1Id, competition2Id]).toContain(
      agentFoxtrot.stats?.bestPlacement?.competitionId,
    );

    expect(agentHotel.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(agentHotel.stats?.bestPlacement?.rank).toBeLessThanOrEqual(2);
    expect(agentHotel.stats?.bestPlacement?.totalAgents).toBe(2);
    expect([competition1Id, competition2Id]).toContain(
      agentHotel.stats?.bestPlacement?.competitionId,
    );

    // Verify both agents have valid bestPnl values
    expect(agentFoxtrot.stats?.bestPnl).toBeDefined();
    expect(agentHotel.stats?.bestPnl).toBeDefined();
    expect(typeof agentFoxtrot.stats?.bestPnl).toBe("number");
    expect(typeof agentHotel.stats?.bestPnl).toBe("number");

    // Verify that bestPlacement reflects the better performance from either competition
    // Both agents won one competition each, so both should have rank 1
    const agentFoxtrotRank = agentFoxtrot.stats?.bestPlacement?.rank;
    const agentHotelRank = agentHotel.stats?.bestPlacement?.rank;

    // Ensure ranks are the same since each agent has won one comp
    expect(agentFoxtrotRank).toBe(agentHotelRank);
    expect(agentFoxtrotRank).toBe(1);
  });
});
