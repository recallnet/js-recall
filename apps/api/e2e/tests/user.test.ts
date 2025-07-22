import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  Agent,
  AgentProfileResponse,
  CROSS_CHAIN_TRADING_TYPE,
  CreateCompetitionResponse,
  ErrorResponse,
  GetUserAgentsResponse,
  StartCompetitionResponse,
  TradeResponse,
  UserAgentApiKeyResponse,
  UserCompetitionsResponse,
  UserProfileResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createSiweAuthenticatedClient,
  createTestClient,
  createTestCompetition,
  generateTestCompetitions,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";

describe("User API", () => {
  // Clean up test state before each test
  let adminApiKey: string;

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

  test("admin can register a user and user can authenticate", async () => {
    // Create a test client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user
    const userName = `User ${Date.now()}`;
    const agentName = `Agent ${Date.now()}`;
    const userEmail = `user${Date.now()}@example.com`;

    const {
      client: userClient,
      user,
      apiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName,
      userEmail,
      agentName,
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.name).toBe(userName);
    expect(user.email).toBe(userEmail);
    expect(apiKey).toBeDefined();

    // Verify user client is authenticated
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as UserProfileResponse).user).toBeDefined();
    expect((profileResponse as UserProfileResponse).user.id).toBe(user.id);
    expect((profileResponse as UserProfileResponse).user.name).toBe(userName);
  });

  // TODO: once we have a user-centric API, switch to a user-centric test
  test("users can update their profile information", async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user
    const { client: userClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Update user profile
    const newName = "Updated Contact Person";
    const updateResponse = await userClient.updateUserProfile({
      name: newName,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UserProfileResponse).user).toBeDefined();
    expect((updateResponse as UserProfileResponse).user.name).toBe(newName);

    // Verify changes persisted
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as UserProfileResponse).user.name).toBe(newName);
  });

  test("admin can list all registered users", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register multiple users
    const userData = [
      { name: `User A ${Date.now()}`, email: `user${Date.now()}@example.com` },
      { name: `User B ${Date.now()}`, email: `userb${Date.now()}@example.com` },
      { name: `User C ${Date.now()}`, email: `userc${Date.now()}@example.com` },
    ];

    for (const data of userData) {
      await registerUserAndAgentAndGetClient({
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
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register a user without initial metadata or imageUrl
    const userName = `Combined Update User ${Date.now()}`;
    const userEmail = `combined-update-${Date.now()}@example.com`;
    const agentName = "Combined Update Agent";

    const { client: userClient, user } = await registerUserAndAgentAndGetClient(
      {
        adminApiKey,
        userName,
        userEmail,
        agentName,
      },
    );

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
    const updateResponse = await userClient.updateUserProfile({
      name: newName,
      imageUrl: newImageUrl,
      metadata: newMetadata,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UserProfileResponse).user.imageUrl).toBe(
      newImageUrl,
    );

    // Verify changes persisted
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);

    const updatedProfile = (profileResponse as UserProfileResponse).user;
    expect(updatedProfile.name).toBe(newName);
    expect(updatedProfile.imageUrl).toBe(newImageUrl);
    expect(updatedProfile.metadata).toEqual(newMetadata);

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

  test("fails to update email if already in use", async () => {
    // Create a SIWE-authenticated client
    const userEmail = `email@example.com`;
    await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Test User",
      userEmail,
    });

    // Try to create a user with the same email
    await expect(
      createSiweAuthenticatedClient({
        adminApiKey,
        userName: "SIWE Test User",
        userEmail,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    // Create another user with a different email
    const { client: otherUserClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Other User",
      userEmail: "other-user@example.com",
    });
    // Try to update the email to the other user's email
    const updateResponse = await otherUserClient.updateUserProfile({
      email: userEmail,
    });
    expect(updateResponse.success).toBe(false);
    expect((updateResponse as ErrorResponse).error).toContain(
      "Email already in use",
    );
  });

  test("SIWE user can access their profile and manage agents", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient, user } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Test User",
      userEmail: "siwe-test@example.com",
    });

    // Test: User can get their profile via SIWE session
    const profileResponse = await siweClient.getUserProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as UserProfileResponse).user).toBeDefined();
    expect((profileResponse as UserProfileResponse).user.id).toBe(user.id);
    expect((profileResponse as UserProfileResponse).user.name).toBe(user.name);
    expect((profileResponse as UserProfileResponse).user.metadata).toBeNull();

    // Test: User can update their profile via SIWE session, including metadata
    const newName = "Updated SIWE User";
    const newMetadata = {
      foo: "bar",
    };
    const updateResponse = await siweClient.updateUserProfile({
      name: newName,
      metadata: newMetadata,
    });
    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UserProfileResponse).user.name).toBe(newName);
    expect((updateResponse as UserProfileResponse).user.metadata).toEqual(
      newMetadata,
    );

    // Test: User can create an agent via SIWE session
    const createAgentResponse = await siweClient.createAgent(
      "SIWE Created Agent",
      "Agent created via SIWE session",
    );
    expect(createAgentResponse.success).toBe(true);
    expect((createAgentResponse as AgentProfileResponse).agent).toBeDefined();
    expect((createAgentResponse as AgentProfileResponse).agent.name).toBe(
      "SIWE Created Agent",
    );

    // Test: User can list their agents via SIWE session
    const agentsResponse =
      (await siweClient.getUserAgents()) as GetUserAgentsResponse;
    expect(agentsResponse.success).toBe(true);
    expect(agentsResponse.agents).toBeDefined();
    expect(agentsResponse.agents.length).toBe(1);
    expect(agentsResponse.agents[0]?.name).toBe("SIWE Created Agent");
    expect(agentsResponse.agents[0]?.isVerified).toBe(false);

    // Test: User can get a specific agent via SIWE session
    const agentId = (createAgentResponse as AgentProfileResponse).agent.id;
    const specificAgentResponse = await siweClient.getUserAgent(agentId);
    expect(specificAgentResponse.success).toBe(true);
    expect((specificAgentResponse as AgentProfileResponse).agent.id).toBe(
      agentId,
    );
  });

  test("SIWE user can update their agent profiles", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Agent Profile Test User",
      userEmail: "agent-profile-test@example.com",
    });

    // Create an agent via SIWE session
    const createAgentResponse = await siweClient.createAgent(
      "Original Agent Name",
      "Original agent description",
      "https://example.com/original-image.jpg",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;
    expect(agent.name).toBe("Original Agent Name");
    expect(agent.description).toBe("Original agent description");
    expect(agent.imageUrl).toBe("https://example.com/original-image.jpg");

    // Test: User can update agent name only
    const updateNameResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        name: "Updated Agent Name",
      },
    );
    expect(updateNameResponse.success).toBe(true);
    const updatedAgent1 = (updateNameResponse as AgentProfileResponse).agent;
    expect(updatedAgent1.name).toBe("Updated Agent Name");
    expect(updatedAgent1.description).toBe("Original agent description"); // Should remain unchanged
    expect(updatedAgent1.imageUrl).toBe(
      "https://example.com/original-image.jpg",
    ); // Should remain unchanged

    // Test: User can update description only
    const updateDescResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        description: "Updated agent description",
      },
    );
    expect(updateDescResponse.success).toBe(true);
    const updatedAgent2 = (updateDescResponse as AgentProfileResponse).agent;
    expect(updatedAgent2.name).toBe("Updated Agent Name"); // Should remain from previous update
    expect(updatedAgent2.description).toBe("Updated agent description");
    expect(updatedAgent2.imageUrl).toBe(
      "https://example.com/original-image.jpg",
    ); // Should remain unchanged

    // Test: User can update imageUrl only
    const updateImageResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        imageUrl: "https://example.com/updated-image.jpg",
      },
    );
    expect(updateImageResponse.success).toBe(true);
    const updatedAgent3 = (updateImageResponse as AgentProfileResponse).agent;
    expect(updatedAgent3.name).toBe("Updated Agent Name"); // Should remain from previous update
    expect(updatedAgent3.description).toBe("Updated agent description"); // Should remain from previous update
    expect(updatedAgent3.imageUrl).toBe(
      "https://example.com/updated-image.jpg",
    );

    // Test: User can update email field
    const updateEmailResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        email: "updated-email@example.com",
      },
    );
    expect(updateEmailResponse.success).toBe(true);
    const updatedAgent4 = (updateEmailResponse as AgentProfileResponse).agent;
    expect(updatedAgent4.email).toBe("updated-email@example.com");

    // Test: User can update metadata field
    const updateMetadataResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        metadata: {
          ref: {
            name: "Updated Ref Name",
            version: "1.0.0",
            url: "https://example.com/updated-ref.com",
          },
        },
      },
    );
    expect(updateMetadataResponse.success).toBe(true);
    const updatedAgent5 = (updateMetadataResponse as AgentProfileResponse)
      .agent;
    expect(updatedAgent5.metadata).toBeDefined();
    expect(updatedAgent5.metadata?.ref?.name).toBe("Updated Ref Name");
    expect(updatedAgent5.metadata?.ref?.version).toBe("1.0.0");
    expect(updatedAgent5.metadata?.ref?.url).toBe(
      "https://example.com/updated-ref.com",
    );

    // Test: User can update all fields at once
    const updateAllResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        name: "Final Agent Name",
        description: "Final agent description",
        imageUrl: "https://example.com/final-image.jpg",
        email: "final-email@example.com",
        metadata: {
          ref: {
            name: "Final Ref Name",
            version: "1.0.1",
            url: "https://example.com/final-ref.com",
          },
        },
      },
    );
    expect(updateAllResponse.success).toBe(true);
    const finalAgent = (updateAllResponse as AgentProfileResponse).agent;
    expect(finalAgent.name).toBe("Final Agent Name");
    expect(finalAgent.description).toBe("Final agent description");
    expect(finalAgent.imageUrl).toBe("https://example.com/final-image.jpg");

    // Test: Verify changes persisted by getting the agent again
    const getAgentResponse = await siweClient.getUserAgent(agent.id);
    expect(getAgentResponse.success).toBe(true);
    const persistedAgent = (getAgentResponse as AgentProfileResponse).agent;
    expect(persistedAgent.name).toBe("Final Agent Name");
    expect(persistedAgent.description).toBe("Final agent description");
    expect(persistedAgent.imageUrl).toBe("https://example.com/final-image.jpg");
  });

  test("user cannot update an agent they don't own", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Agent Profile Test User",
      userEmail: "agent-profile-test@example.com",
    });

    // Create an agent via SIWE session
    const createAgentResponse = await siweClient.createAgent(
      "Original Agent Name",
      "Original agent description",
      "https://example.com/original-image.jpg",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Test: User cannot update agent they don't own
    // Create another user and try to update the first user's agent
    const { client: otherUserClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Other User",
      userEmail: "other-user@example.com",
    });

    const unauthorizedUpdateResponse =
      await otherUserClient.updateUserAgentProfile(agent.id, {
        name: "Unauthorized Update",
      });
    expect(unauthorizedUpdateResponse.success).toBe(false);
    expect((unauthorizedUpdateResponse as ErrorResponse).error).toContain(
      "Access denied",
    );
  });

  test("user cannot update an agent with invalid fields", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Agent Profile Test User",
      userEmail: "agent-profile-test@example.com",
    });

    // Create an agent via SIWE session
    const createAgentResponse = await siweClient.createAgent(
      "Original Agent Name",
      "Original agent description",
      "https://example.com/original-image.jpg",
    );
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Test: Invalid fields are rejected
    const invalidFieldsResponse = await siweClient.request(
      "put",
      `/api/user/agents/${agent.id}/profile`,
      {
        name: "Valid Name",
        invalidField: "Should be rejected",
      },
    );
    expect((invalidFieldsResponse as ErrorResponse).success).toBe(false);
    expect((invalidFieldsResponse as ErrorResponse).error).toContain(
      "Invalid request format",
    );
  });

  test("get user agents pagination works with default parameters", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
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
      const response = await siweClient.createAgent(
        name,
        `Description for ${name}`,
      );
      expect(response.success).toBe(true);
      // Small delay to ensure different timestamps
      await wait(10);
    }

    // Test default pagination (should return all agents)
    const defaultResponse = await siweClient.getUserAgents();
    expect(defaultResponse.success).toBe(true);
    const defaultAgents = (defaultResponse as GetUserAgentsResponse).agents;
    expect(defaultAgents).toHaveLength(5);
    expect(Array.isArray(defaultAgents)).toBe(true);

    // Check that stats and other metric-related fields are included
    expect(defaultAgents[0]?.trophies).toBeDefined();
    expect(defaultAgents[0]?.skills).toBeDefined();
    expect(defaultAgents[0]?.stats).toBeDefined();
    expect(defaultAgents[0]?.stats?.completedCompetitions).toBe(0);
    expect(defaultAgents[0]?.stats?.totalTrades).toBe(0);
    expect(defaultAgents[0]?.stats?.totalVotes).toBe(0);
    expect(defaultAgents[0]?.stats?.bestPlacement).toBeUndefined();
    expect(defaultAgents[0]?.stats?.rank).toBeUndefined();
    expect(defaultAgents[0]?.stats?.score).toBeUndefined();
  });

  test("user agents pagination respects limit parameter", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Limit Test User",
      userEmail: "limit-test@example.com",
    });

    // Create 6 agents
    for (let i = 1; i <= 6; i++) {
      const response = await siweClient.createAgent(
        `Agent ${i.toString().padStart(2, "0")}`,
        `Description for Agent ${i}`,
      );
      expect(response.success).toBe(true);
      await wait(10);
    }

    // Test limit of 3
    const limitedResponse = await siweClient.getUserAgents({ limit: 3 });
    expect(limitedResponse.success).toBe(true);
    const limitedAgents = (limitedResponse as GetUserAgentsResponse).agents;
    expect(limitedAgents).toHaveLength(3);

    // Test limit of 2
    const limit2Response = await siweClient.getUserAgents({ limit: 2 });
    expect(limit2Response.success).toBe(true);
    const limit2Agents = (limit2Response as GetUserAgentsResponse).agents;
    expect(limit2Agents).toHaveLength(2);

    // Test limit larger than total
    const largeLimitResponse = await siweClient.getUserAgents({ limit: 20 });
    expect(largeLimitResponse.success).toBe(true);
    const largeLimitAgents = (largeLimitResponse as GetUserAgentsResponse)
      .agents;
    expect(largeLimitAgents).toHaveLength(6);
  });

  test("user agents pagination respects offset parameter", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Offset Test User",
      userEmail: "offset-test@example.com",
    });

    // Create 6 agents
    for (let i = 1; i <= 6; i++) {
      const response = await siweClient.createAgent(
        `Agent ${i.toString().padStart(2, "0")}`,
        `Description for Agent ${i}`,
      );
      expect(response.success).toBe(true);
      await wait(10);
    }

    // Get all agents first to establish baseline
    const allResponse = await siweClient.getUserAgents();
    expect(allResponse.success).toBe(true);
    const allAgents = (allResponse as GetUserAgentsResponse).agents;
    expect(allAgents).toHaveLength(6);

    // Test offset of 2
    const offset2Response = await siweClient.getUserAgents({ offset: 2 });
    expect(offset2Response.success).toBe(true);
    const offset2Agents = (offset2Response as GetUserAgentsResponse).agents;
    expect(offset2Agents).toHaveLength(4);

    // Test offset of 4
    const offset4Response = await siweClient.getUserAgents({ offset: 4 });
    expect(offset4Response.success).toBe(true);
    const offset4Agents = (offset4Response as GetUserAgentsResponse).agents;
    expect(offset4Agents).toHaveLength(2);

    // Test offset larger than total
    const largeOffsetResponse = await siweClient.getUserAgents({ offset: 10 });
    expect(largeOffsetResponse.success).toBe(true);
    const largeOffsetAgents = (largeOffsetResponse as GetUserAgentsResponse)
      .agents;
    expect(largeOffsetAgents).toHaveLength(0);
  });

  test("user agents pagination combines limit and offset correctly", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Limit Offset Test User",
      userEmail: "limit-offset-test@example.com",
    });

    // Create 8 agents
    for (let i = 1; i <= 8; i++) {
      const response = await siweClient.createAgent(
        `Agent ${i.toString().padStart(2, "0")}`,
        `Description for Agent ${i}`,
      );
      expect(response.success).toBe(true);
      await wait(10);
    }

    // Test pagination: page 1 (offset 0, limit 3)
    const page1Response = await siweClient.getUserAgents({
      limit: 3,
      offset: 0,
    });
    expect(page1Response.success).toBe(true);
    const page1Agents = (page1Response as GetUserAgentsResponse).agents;
    expect(page1Agents).toHaveLength(3);

    // Test pagination: page 2 (offset 3, limit 3)
    const page2Response = await siweClient.getUserAgents({
      limit: 3,
      offset: 3,
    });
    expect(page2Response.success).toBe(true);
    const page2Agents = (page2Response as GetUserAgentsResponse).agents;
    expect(page2Agents).toHaveLength(3);

    // Test pagination: page 3 (offset 6, limit 3) - should only return 2 agents
    const page3Response = await siweClient.getUserAgents({
      limit: 3,
      offset: 6,
    });
    expect(page3Response.success).toBe(true);
    const page3Agents = (page3Response as GetUserAgentsResponse).agents;
    expect(page3Agents).toHaveLength(2);

    // Verify no overlap between pages by checking agent IDs
    const page1Ids = page1Agents.map((a: Agent) => a.id);
    const page2Ids = page2Agents.map((a: Agent) => a.id);
    const page3Ids = page3Agents.map((a: Agent) => a.id);

    const allPageIds = [...page1Ids, ...page2Ids, ...page3Ids];
    const uniqueIds = new Set(allPageIds);
    expect(uniqueIds.size).toBe(allPageIds.length); // No duplicates
  });

  test("user agents sorting works correctly", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
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
      const response = await siweClient.createAgent(
        agent.name,
        agent.description,
      );
      expect(response.success).toBe(true);
      await wait(50); // Larger delay for timestamp differentiation
    }

    // Test name ascending sort
    const nameAscResponse = await siweClient.getUserAgents({ sort: "name" });
    expect(nameAscResponse.success).toBe(true);
    const nameAscAgents = (nameAscResponse as GetUserAgentsResponse).agents;
    expect(nameAscAgents).toHaveLength(4);
    expect(nameAscAgents[0]?.name).toBe("Alpha Agent");
    expect(nameAscAgents[1]?.name).toBe("Beta Agent");
    expect(nameAscAgents[2]?.name).toBe("Gamma Agent");
    expect(nameAscAgents[3]?.name).toBe("Zebra Agent");

    // Test name descending sort
    const nameDescResponse = await siweClient.getUserAgents({ sort: "-name" });
    expect(nameDescResponse.success).toBe(true);
    const nameDescAgents = (nameDescResponse as GetUserAgentsResponse).agents;
    expect(nameDescAgents).toHaveLength(4);
    expect(nameDescAgents[0]?.name).toBe("Zebra Agent");
    expect(nameDescAgents[1]?.name).toBe("Gamma Agent");
    expect(nameDescAgents[2]?.name).toBe("Beta Agent");
    expect(nameDescAgents[3]?.name).toBe("Alpha Agent");

    // Test created date ascending sort (oldest first)
    const createdAscResponse = await siweClient.getUserAgents({
      sort: "createdAt",
    });
    expect(createdAscResponse.success).toBe(true);
    const createdAscAgents = (createdAscResponse as GetUserAgentsResponse)
      .agents;
    expect(createdAscAgents).toHaveLength(4);
    // First created should be "Zebra Agent" (created first in our loop)
    expect(createdAscAgents[0]?.name).toBe("Zebra Agent");
    expect(createdAscAgents[3]?.name).toBe("Gamma Agent");

    // Test created date descending sort (newest first)
    const createdDescResponse = await siweClient.getUserAgents({
      sort: "-createdAt",
    });
    expect(createdDescResponse.success).toBe(true);
    const createdDescAgents = (createdDescResponse as GetUserAgentsResponse)
      .agents;
    expect(createdDescAgents).toHaveLength(4);
    // Last created should be "Gamma Agent" (created last in our loop)
    expect(createdDescAgents[0]?.name).toBe("Gamma Agent");
    expect(createdDescAgents[3]?.name).toBe("Zebra Agent");
  });

  test("user agents sorting combined with pagination", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Sort Pagination Test User",
      userEmail: "sort-pagination-test@example.com",
    });

    // Create 6 agents with names that will sort predictably
    const names = ["Hotel", "Alpha", "India", "Bravo", "Juliet", "Charlie"];

    for (const name of names) {
      const response = await siweClient.createAgent(
        `${name} Agent`,
        `Description for ${name}`,
      );
      expect(response.success).toBe(true);
      await wait(10);
    }

    // Get first page of 2, sorted by name ascending
    const page1Response = await siweClient.getUserAgents({
      sort: "name",
      limit: 2,
      offset: 0,
    });
    expect(page1Response.success).toBe(true);
    const page1Agents = (page1Response as GetUserAgentsResponse).agents;
    expect(page1Agents).toHaveLength(2);
    expect(page1Agents[0]?.name).toBe("Alpha Agent");
    expect(page1Agents[1]?.name).toBe("Bravo Agent");

    // Get second page of 2, sorted by name ascending
    const page2Response = await siweClient.getUserAgents({
      sort: "name",
      limit: 2,
      offset: 2,
    });
    expect(page2Response.success).toBe(true);
    const page2Agents = (page2Response as GetUserAgentsResponse).agents;
    expect(page2Agents).toHaveLength(2);
    expect(page2Agents[0]?.name).toBe("Charlie Agent");
    expect(page2Agents[1]?.name).toBe("Hotel Agent");
  });

  test("user agents pagination only returns agents owned by authenticated user", async () => {
    // Create two different users
    const { client: user1Client } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "User 1",
      userEmail: "user1@example.com",
    });

    const { client: user2Client } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "User 2",
      userEmail: "user2@example.com",
    });

    // User 1 creates 3 agents
    for (let i = 1; i <= 3; i++) {
      const response = await user1Client.createAgent(
        `User1 Agent ${i}`,
        `Description ${i}`,
      );
      expect(response.success).toBe(true);
    }

    // User 2 creates 2 agents
    for (let i = 1; i <= 2; i++) {
      const response = await user2Client.createAgent(
        `User2 Agent ${i}`,
        `Description ${i}`,
      );
      expect(response.success).toBe(true);
    }

    // User 1 should only see their own agents
    const user1Response = await user1Client.getUserAgents();
    expect(user1Response.success).toBe(true);
    const user1Agents = (user1Response as GetUserAgentsResponse).agents;
    expect(user1Agents).toHaveLength(3);
    user1Agents.forEach((agent: Agent) => {
      expect(agent.name).toMatch(/^User1 Agent/);
    });

    // User 2 should only see their own agents
    const user2Response = await user2Client.getUserAgents();
    expect(user2Response.success).toBe(true);
    const user2Agents = (user2Response as GetUserAgentsResponse).agents;
    expect(user2Agents).toHaveLength(2);
    user2Agents.forEach((agent: Agent) => {
      expect(agent.name).toMatch(/^User2 Agent/);
    });

    // Test pagination isolation - User 1 with pagination
    const user1PaginatedResponse = await user1Client.getUserAgents({
      limit: 2,
    });
    expect(user1PaginatedResponse.success).toBe(true);
    const user1PaginatedAgents = (
      user1PaginatedResponse as GetUserAgentsResponse
    ).agents;
    expect(user1PaginatedAgents).toHaveLength(2);
    user1PaginatedAgents.forEach((agent: Agent) => {
      expect(agent.name).toMatch(/^User1 Agent/);
    });
  });

  test("user agents API returns consistent structure with pagination", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Structure Test User",
      userEmail: "structure-test@example.com",
    });

    // Create a couple of agents
    const response1 = await siweClient.createAgent(
      "Test Agent 1",
      "Description 1",
    );
    expect(response1.success).toBe(true);
    const response2 = await siweClient.createAgent(
      "Test Agent 2",
      "Description 2",
    );
    expect(response2.success).toBe(true);

    // Test response structure with no pagination
    const noPaginationResponse = await siweClient.getUserAgents();
    expect(noPaginationResponse.success).toBe(true);
    expect(
      (noPaginationResponse as GetUserAgentsResponse).userId,
    ).toBeDefined();
    expect(
      (noPaginationResponse as GetUserAgentsResponse).agents,
    ).toBeDefined();
    expect(
      Array.isArray((noPaginationResponse as GetUserAgentsResponse).agents),
    ).toBe(true);

    // Test response structure with pagination
    const paginatedResponse = await siweClient.getUserAgents({
      limit: 1,
      offset: 0,
    });
    expect(paginatedResponse.success).toBe(true);
    expect((paginatedResponse as GetUserAgentsResponse).userId).toBeDefined();
    expect((paginatedResponse as GetUserAgentsResponse).agents).toBeDefined();
    expect(
      Array.isArray((paginatedResponse as GetUserAgentsResponse).agents),
    ).toBe(true);

    // Verify agent structure (should not include API key for security)
    const agents = (paginatedResponse as GetUserAgentsResponse).agents;
    if (agents.length > 0) {
      const agent = agents[0];
      expect(agent?.id).toBeDefined();
      expect(agent?.ownerId).toBeDefined();
      expect(agent?.name).toBeDefined();
      expect(agent?.status).toBeDefined();
      expect(agent?.createdAt).toBeDefined();
      expect(agent?.updatedAt).toBeDefined();
      // API key should NOT be present in the response for security
      expect(agent?.apiKey).toBeUndefined();
    }
  });

  test("user agents pagination handles edge cases gracefully", async () => {
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Edge Case Test User",
      userEmail: "edge-case-test@example.com",
    });

    // Create a few agents
    for (let i = 1; i <= 3; i++) {
      const response = await siweClient.createAgent(
        `Agent ${i}`,
        `Description ${i}`,
      );
      expect(response.success).toBe(true);
    }

    // Test zero offset
    const zeroOffsetResponse = await siweClient.getUserAgents({ offset: 0 });
    expect(zeroOffsetResponse.success).toBe(true);
    const zeroOffsetAgents = (zeroOffsetResponse as GetUserAgentsResponse)
      .agents;
    expect(zeroOffsetAgents).toHaveLength(3);

    // Test minimum limit
    const minLimitResponse = await siweClient.getUserAgents({ limit: 1 });
    expect(minLimitResponse.success).toBe(true);
    const minLimitAgents = (minLimitResponse as GetUserAgentsResponse).agents;
    expect(minLimitAgents).toHaveLength(1);

    // Test that pagination still works with empty sort string
    const emptySortResponse = await siweClient.getUserAgents({ sort: "" });
    expect(emptySortResponse.success).toBe(true);
    const emptySortAgents = (emptySortResponse as GetUserAgentsResponse).agents;
    expect(emptySortAgents).toHaveLength(3);
  });

  test("user cannot create agents with duplicate names", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Duplicate Agent Name Test User",
      userEmail: "duplicate-agent-name-test@example.com",
    });

    const agentName = "Duplicate Agent Name";
    const agentDescription = "Test agent for duplicate name testing";

    // Create the first agent successfully
    const firstAgentResponse = await siweClient.createAgent(
      agentName,
      agentDescription,
    );
    expect(firstAgentResponse.success).toBe(true);

    // Try to create a second agent with the same name - should fail with 409
    const secondAgentResponse = await siweClient.createAgent(
      agentName,
      agentDescription,
    );
    expect(secondAgentResponse.success).toBe(false);
    expect((secondAgentResponse as ErrorResponse).status).toBe(409);
    expect((secondAgentResponse as ErrorResponse).error).toContain(
      "already exists for this user",
    );
  });

  describe("User Agent API Key Access", () => {
    test("user can retrieve their own agent's API key", async () => {
      // Create a SIWE authenticated user client
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "API Key Test User",
        userEmail: "api-key-test@example.com",
      });

      // Create an agent for this user
      const agentResponse = await userClient.createAgent(
        "Test Agent for API Key",
        "Agent description for API key testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Get the agent's API key
      const apiKeyResponse = await userClient.getUserAgentApiKey(agent.id);
      expect(apiKeyResponse.success).toBe(true);

      const keyData = apiKeyResponse as UserAgentApiKeyResponse;
      expect(keyData.agentId).toBe(agent.id);
      expect(keyData.agentName).toBe(agent.name);
      expect(keyData.apiKey).toBeDefined();
      expect(typeof keyData.apiKey).toBe("string");
      expect(keyData.apiKey.length).toBeGreaterThan(0);
    });

    test("user cannot retrieve API key for agent they don't own", async () => {
      // Create two different users
      const { client: user1Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "User 1",
        userEmail: "user1-apikey@example.com",
      });

      const { client: user2Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "User 2",
        userEmail: "user2-apikey@example.com",
      });

      // User 1 creates an agent
      const agentResponse = await user1Client.createAgent(
        "User 1 Agent",
        "Agent owned by User 1",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // User 2 tries to get User 1's agent API key
      const apiKeyResponse = await user2Client.getUserAgentApiKey(agent.id);
      expect(apiKeyResponse.success).toBe(false);

      const errorResponse = apiKeyResponse as ErrorResponse;
      expect(errorResponse.status).toBe(403);
      expect(errorResponse.error).toContain("Access denied");
    });

    test("unauthenticated user cannot retrieve any agent API key", async () => {
      // Create an agent first
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Agent Owner",
        userEmail: "agent-owner@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Test Agent",
        "Agent for unauthorized access test",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create unauthenticated client
      const unauthenticatedClient = createTestClient();

      // Try to get the agent's API key without authentication
      const apiKeyResponse = await unauthenticatedClient.getUserAgentApiKey(
        agent.id,
      );
      expect(apiKeyResponse.success).toBe(false);

      const errorResponse = apiKeyResponse as ErrorResponse;
      expect(errorResponse.status).toBe(401);
    });

    test("user gets 404 for non-existent agent API key", async () => {
      // Create a SIWE authenticated user client
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "404 Test User",
        userEmail: "404-test@example.com",
      });

      // Try to get API key for non-existent agent
      const fakeAgentId = "00000000-0000-0000-0000-000000000000";
      const apiKeyResponse = await userClient.getUserAgentApiKey(fakeAgentId);
      expect(apiKeyResponse.success).toBe(false);

      const errorResponse = apiKeyResponse as ErrorResponse;
      expect(errorResponse.status).toBe(404);
      expect(errorResponse.error).toContain("Agent not found");
    });

    test("user gets 400 for invalid agent ID format", async () => {
      // Create a SIWE authenticated user client
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Invalid ID Test User",
        userEmail: "invalid-id-test@example.com",
      });

      // Try to get API key with invalid UUID format
      const invalidAgentId = "not-a-valid-uuid";
      const apiKeyResponse =
        await userClient.getUserAgentApiKey(invalidAgentId);
      expect(apiKeyResponse.success).toBe(false);

      const errorResponse = apiKeyResponse as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("Invalid request format");
    });

    test("API key endpoint returns consistent format", async () => {
      // Create a SIWE authenticated user client
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Format Test User",
        userEmail: "format-test@example.com",
      });

      // Create an agent
      const agentResponse = await userClient.createAgent(
        "Format Test Agent",
        "Agent for format consistency testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Get the agent's API key
      const apiKeyResponse = await userClient.getUserAgentApiKey(agent.id);
      expect(apiKeyResponse.success).toBe(true);

      const keyData = apiKeyResponse as UserAgentApiKeyResponse;

      // Verify response structure
      expect(keyData).toHaveProperty("success");
      expect(keyData).toHaveProperty("agentId");
      expect(keyData).toHaveProperty("agentName");
      expect(keyData).toHaveProperty("apiKey");

      // Verify types
      expect(typeof keyData.success).toBe("boolean");
      expect(typeof keyData.agentId).toBe("string");
      expect(typeof keyData.agentName).toBe("string");
      expect(typeof keyData.apiKey).toBe("string");

      // Verify values match agent data
      expect(keyData.agentId).toBe(agent.id);
      expect(keyData.agentName).toBe(agent.name);
    });

    test("retrieved API key works for agent authentication", async () => {
      // Create a SIWE authenticated user client
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Auth Test User",
        userEmail: "auth-test@example.com",
      });

      // Create an agent
      const agentResponse = await userClient.createAgent(
        "Auth Test Agent",
        "Agent for authentication testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Get the agent's API key
      const apiKeyResponse = await userClient.getUserAgentApiKey(agent.id);
      expect(apiKeyResponse.success).toBe(true);

      const keyData = apiKeyResponse as UserAgentApiKeyResponse;

      // Create a new client using the retrieved API key
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const agentClient = adminClient.createAgentClient(keyData.apiKey);

      // Verify the agent client can authenticate and get its profile
      const profileResponse = await agentClient.getAgentProfile();
      expect(profileResponse.success).toBe(true);

      const profileData = profileResponse as AgentProfileResponse;
      expect(profileData.agent.id).toBe(agent.id);
      expect(profileData.agent.name).toBe(agent.name);
    });
  });

  test("SIWE user can get competitions for their agents", async () => {
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
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register three agents
    const { client: client1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

    const { client: client2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Two",
      });

    const { client: client3, agent: agent3 } =
      await registerUserAndAgentAndGetClient({
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
    // Agent 1: Bad trade (loses money) - should be ranked 3rd (worst)
    await client1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Zero address trade
      amount: "100",
      reason: "Bad trade for Agent 1",
    });

    // Agent 2: Good trade (USDC to USDT) - should be ranked 1st (best)
    const tradeResult2 = (await client2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "50",
      reason: "Good trade for Agent 2",
    })) as TradeResponse;

    // Agent 3: Medium trade (smaller amount) - should be ranked 2nd (middle)
    await client3.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "10",
      reason: "Medium trade for Agent 3",
    });

    // In order to correctly assert the rankings we need to know if the
    // usdc -> usdt trade is positive or negative as of the latest snapshot
    const twoMoreThanThree = tradeResult2.transaction.price > 1;

    // Wait to ensure snapshots are taken
    await wait(1500);

    // Get agent competitions for each user
    const response1 =
      (await client1.getUserCompetitions()) as UserCompetitionsResponse;

    const response2 =
      (await client2.getUserCompetitions()) as UserCompetitionsResponse;

    const response3 =
      (await client3.getUserCompetitions()) as UserCompetitionsResponse;

    expect(response2.competitions[0]?.id).toBe(competition.id);
    expect(response2.competitions[0]?.agents.length).toBe(1);
    expect(response2.competitions[0]?.agents[0]?.id).toBe(agent2.id);
    expect(response2.competitions[0]?.agents[0]?.rank).toBe(
      twoMoreThanThree ? 1 : 2,
    );

    expect(response3.competitions[0]?.id).toBe(competition.id);
    expect(response3.competitions[0]?.agents.length).toBe(1);
    expect(response3.competitions[0]?.agents[0]?.id).toBe(agent3.id);
    expect(response3.competitions[0]?.agents[0]?.rank).toBe(
      twoMoreThanThree ? 2 : 1,
    );

    expect(response1.competitions[0]?.id).toBe(competition.id);
    expect(response1.competitions[0]?.agents.length).toBe(1);
    expect(response1.competitions[0]?.agents[0]?.id).toBe(agent1.id);
    expect(response1.competitions[0]?.agents[0]?.rank).toBe(3);
  });

  describe("User Competitions Sorting and Pagination", () => {
    test("user competitions throw 400 error for invalid sort fields", async () => {
      // Create a user with agent
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Invalid Sort Test User",
        userEmail: "invalid-sort-test@example.com",
      });

      // Test valid sort fields that should work now
      const validSortResponse = await userClient.getUserCompetitions({
        sort: "agentName",
      });
      expect(validSortResponse.success).toBe(true);

      const validRankSortResponse = await userClient.getUserCompetitions({
        sort: "-rank",
      });
      expect(validRankSortResponse.success).toBe(true);

      // Test actually invalid sort field that should still fail
      const invalidSortResponse = await userClient.getUserCompetitions({
        sort: "invalidFieldName",
      });
      expect(invalidSortResponse.success).toBe(false);
      expect((invalidSortResponse as ErrorResponse).status).toBe(400);
      expect((invalidSortResponse as ErrorResponse).error).toContain(
        "cannot sort by field",
      );
    });

    test("user competitions pagination count accuracy with multiple agents (exposes pagination bug)", async () => {
      // This test is designed to expose the pagination count mismatch bug
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a user with multiple agents
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Pagination Bug Test User",
        userEmail: "pagination-bug-test@example.com",
      });

      // Create 2 agents for the same user
      const agent1Response = await userClient.createAgent(
        "Pagination Test Agent 1",
        "Agent 1 for pagination bug testing",
      );
      expect(agent1Response.success).toBe(true);
      const agent1 = (agent1Response as AgentProfileResponse).agent;

      const agent2Response = await userClient.createAgent(
        "Pagination Test Agent 2",
        "Agent 2 for pagination bug testing",
      );
      expect(agent2Response.success).toBe(true);
      const agent2 = (agent2Response as AgentProfileResponse).agent;

      // Create 3 competitions where both agents participate
      for (let i = 0; i < 3; i++) {
        const createResponse = await adminClient.createCompetition(
          `Multi-Agent Pagination Competition ${i}`,
          `Competition ${i} with multiple agents from same user`,
        );
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;

        // Both agents join the same competition (creates 2 DB rows per competition)
        await userClient.joinCompetition(
          createCompResponse.competition.id,
          agent1.id,
        );
        await userClient.joinCompetition(
          createCompResponse.competition.id,
          agent2.id,
        );
      }

      // Test pagination - this should expose the count mismatch bug
      const paginationResponse = await userClient.getUserCompetitions({
        limit: 2,
        offset: 0,
      });
      expect(paginationResponse.success).toBe(true);

      const comps = (paginationResponse as UserCompetitionsResponse)
        .competitions;
      const pagination = (paginationResponse as UserCompetitionsResponse)
        .pagination;

      // The key test: despite having 6 DB rows (3 competitions × 2 agents each),
      // we should see 3 unique competitions and correct pagination counts
      expect(pagination.total).toBe(3); // Should be 3 unique competitions, not 6 DB rows
      expect(comps.length).toBe(2); // Requested limit
      expect(pagination.hasMore).toBe(true); // 0 + 2 < 3 = true

      // Verify each competition shows both user's agents
      for (const comp of comps) {
        expect(comp.agents).toBeDefined();
        expect(comp.agents.length).toBe(2); // Should show both agents for this user
      }
    });

    test("user competitions hasMore calculation is accurate", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a user with agent
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "HasMore Test User",
        userEmail: "hasmore-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "HasMore Test Agent",
        "Agent for hasMore testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create exactly 5 competitions
      for (let i = 0; i < 5; i++) {
        const createResponse = await adminClient.createCompetition(
          `HasMore Competition ${i}`,
          `Competition ${i} for hasMore testing`,
        );
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await userClient.joinCompetition(
          createCompResponse.competition.id,
          agent.id,
        );
      }

      // Test scenario where hasMore should be true
      const page1Response = await userClient.getUserCompetitions({
        limit: 3,
        offset: 0,
      });
      expect(page1Response.success).toBe(true);
      expect(
        (page1Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(true);
      // 0 + 3 < 5 = true

      // Test scenario where hasMore should be false
      const page2Response = await userClient.getUserCompetitions({
        limit: 3,
        offset: 3,
      });
      expect(page2Response.success).toBe(true);
      expect(
        (page2Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(false);
      // 3 + 3 >= 5 = false (even though we only get 2 items back)

      // Verify the returned count matches what we expect
      const page2Comps = (page2Response as UserCompetitionsResponse)
        .competitions;
      expect(page2Comps.length).toBe(2); // Only 2 competitions left (5 - 3 = 2)
    });

    test("user competitions pagination handles offset beyond total", async () => {
      // Create a user with agent and limited competitions
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Offset Edge Test User",
        userEmail: "offset-edge-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Offset Edge Test Agent",
        "Agent for offset edge tests",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create only 2 competitions
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      for (let i = 0; i < 2; i++) {
        const createResponse = await adminClient.createCompetition(
          `Edge Test Competition ${i}`,
          `Competition ${i} for edge testing`,
        );
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await userClient.joinCompetition(
          createCompResponse.competition.id,
          agent.id,
        );
      }

      // Test offset beyond total (should return empty array)
      const beyondTotalResponse = await userClient.getUserCompetitions({
        offset: 10,
        limit: 5,
      });
      expect(beyondTotalResponse.success).toBe(true);
      const beyondComps = (beyondTotalResponse as UserCompetitionsResponse)
        .competitions;
      expect(beyondComps.length).toBe(0);
      expect(
        (beyondTotalResponse as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(false);
    });

    test("user competitions valid sort fields work correctly", async () => {
      // Test that the currently supported sort fields work as expected
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Valid Sort Test User",
        userEmail: "valid-sort-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Valid Sort Test Agent",
        "Agent for valid sort testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create competitions with predictable names for sorting
      const firstComp = "Alpha Competition";
      const secondComp = "Beta Competition";
      const thirdComp = "Charlie Competition";

      const create1Response = await adminClient.createCompetition(
        firstComp,
        `Description for ${firstComp}`,
      );
      expect(create1Response.success).toBe(true);
      const competitionIdForFirstComp = (
        create1Response as CreateCompetitionResponse
      ).competition.id;
      await userClient.joinCompetition(competitionIdForFirstComp, agent.id);
      await wait(50);

      const create2Response = await adminClient.createCompetition(
        secondComp,
        `Description for ${secondComp}`,
      );
      expect(create2Response.success).toBe(true);
      const createCompResponse2 = create2Response as CreateCompetitionResponse;
      const competitionIdForSecondComp = createCompResponse2.competition.id;
      await userClient.joinCompetition(competitionIdForSecondComp, agent.id);
      await wait(50);

      const create3Response = await adminClient.createCompetition(
        thirdComp,
        `Description for ${thirdComp}`,
      );
      expect(create3Response.success).toBe(true);
      const competitionIdForThirdComp = (
        create3Response as CreateCompetitionResponse
      ).competition.id;
      await userClient.joinCompetition(competitionIdForThirdComp, agent.id);
      await wait(50);

      // Start/end the first competition, start/end the second competition, and keep the third pending
      const startCompResponse = await adminClient.startExistingCompetition(
        competitionIdForFirstComp,
        [agent.id],
      );
      expect(startCompResponse.success).toBe(true);
      const endCompResponse = await adminClient.endCompetition(
        competitionIdForFirstComp,
      );
      expect(endCompResponse.success).toBe(true);
      const startCompResponse2 = await adminClient.startExistingCompetition(
        competitionIdForSecondComp,
        [agent.id],
      );
      expect(startCompResponse2.success).toBe(true);

      // Test name ascending sort (should work)
      const nameAscResponse = await userClient.getUserCompetitions({
        sort: "name",
      });
      expect(nameAscResponse.success).toBe(true);
      const nameAscComps = (nameAscResponse as UserCompetitionsResponse)
        .competitions;
      expect(nameAscComps.length).toBe(3);
      expect(nameAscComps[0]?.name).toBe("Alpha Competition");
      expect(nameAscComps[1]?.name).toBe("Beta Competition");
      expect(nameAscComps[2]?.name).toBe("Charlie Competition");

      // Test createdAt descending sort (should work)
      const createdDescResponse = await userClient.getUserCompetitions({
        sort: "-createdAt",
      });
      expect(createdDescResponse.success).toBe(true);
      const createdDescComps = (createdDescResponse as UserCompetitionsResponse)
        .competitions;
      expect(createdDescComps.length).toBe(3);
      // Newest first should be "Charlie Competition" (created last)
      expect(createdDescComps[0]?.name).toBe("Charlie Competition");

      // Sort by status ascending
      const statusResponse = await userClient.getUserCompetitions({
        sort: "status",
      });
      expect(statusResponse.success).toBe(true);
      const statusAgents = (statusResponse as UserCompetitionsResponse)
        .competitions;
      expect(statusAgents).toHaveLength(3);
      // The `competition` status should be in order
      expect(statusAgents[0]?.status).toBe("pending");
      expect(statusAgents[1]?.status).toBe("active");
      expect(statusAgents[2]?.status).toBe("ended");

      // Sort by status descending
      const statusDescResponse = await userClient.getUserCompetitions({
        sort: "-status",
      });
      expect(statusDescResponse.success).toBe(true);
      const statusDescAgents = (statusDescResponse as UserCompetitionsResponse)
        .competitions;
      expect(statusDescAgents).toHaveLength(3);
      // The `competition` status should be in order
      expect(statusDescAgents[0]?.status).toBe("ended");
      expect(statusDescAgents[1]?.status).toBe("active");
      expect(statusDescAgents[2]?.status).toBe("pending");
    });

    test("user competitions correct sort format works", async () => {
      // Test the CORRECT format that the API expects: "fieldName" and "-fieldName"
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Correct Format Test User",
        userEmail: "correct-format-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Correct Format Test Agent",
        "Agent for correct format testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create competitions with predictable names
      const competitionNames = [
        "Zebra Competition",
        "Alpha Competition",
        "Beta Competition",
      ];

      for (const name of competitionNames) {
        const createResponse = await adminClient.createCompetition(
          name,
          `Description for ${name}`,
        );
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await userClient.joinCompetition(
          createCompResponse.competition.id,
          agent.id,
        );

        // Small delay to ensure different timestamps
        await wait(50);
      }

      // Test correct format: name ascending (no prefix)
      const nameAscResponse = await userClient.getUserCompetitions({
        sort: "name",
      });
      expect(nameAscResponse.success).toBe(true);
      const nameAscComps = (nameAscResponse as UserCompetitionsResponse)
        .competitions;
      expect(nameAscComps.length).toBe(3);
      expect(nameAscComps[0]?.name).toBe("Alpha Competition");
      expect(nameAscComps[1]?.name).toBe("Beta Competition");
      expect(nameAscComps[2]?.name).toBe("Zebra Competition");

      // Test correct format: name descending (minus prefix)
      const nameDescResponse = await userClient.getUserCompetitions({
        sort: "-name",
      });
      expect(nameDescResponse.success).toBe(true);
      const nameDescComps = (nameDescResponse as UserCompetitionsResponse)
        .competitions;
      expect(nameDescComps.length).toBe(3);
      expect(nameDescComps[0]?.name).toBe("Zebra Competition");
      expect(nameDescComps[1]?.name).toBe("Beta Competition");
      expect(nameDescComps[2]?.name).toBe("Alpha Competition");

      // Test correct format: createdAt ascending
      const createdAscResponse = await userClient.getUserCompetitions({
        sort: "createdAt",
      });
      expect(createdAscResponse.success).toBe(true);
      const createdAscComps = (createdAscResponse as UserCompetitionsResponse)
        .competitions;
      expect(createdAscComps.length).toBe(3);
      // Oldest first should be "Zebra Competition" (created first)
      expect(createdAscComps[0]?.name).toBe("Zebra Competition");

      // Test correct format: createdAt descending
      const createdDescResponse = await userClient.getUserCompetitions({
        sort: "-createdAt",
      });
      expect(createdDescResponse.success).toBe(true);
      const createdDescComps = (createdDescResponse as UserCompetitionsResponse)
        .competitions;
      expect(createdDescComps.length).toBe(3);
      // Newest first should be "Beta Competition" (created last)
      expect(createdDescComps[0]?.name).toBe("Beta Competition");
    });

    test("user competitions multiple sort fields work correctly", async () => {
      // Test multiple sort fields using the correct format: "field1,field2,-field3"
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Multiple Sort Test User",
        userEmail: "multiple-sort-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Multiple Sort Test Agent",
        "Agent for multiple sort testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create competitions with same names but different timestamps to test multi-field sorting
      const competitionData = [
        { name: "Alpha Competition", delay: 100 },
        { name: "Alpha Competition", delay: 200 }, // Same name, different time
        { name: "Beta Competition", delay: 150 },
      ];

      for (const comp of competitionData) {
        const createResponse = await adminClient.createCompetition(
          comp.name,
          `Description for ${comp.name}`,
        );
        expect(createResponse.success).toBe(true);
        const createCompResponse = createResponse as CreateCompetitionResponse;
        await userClient.joinCompetition(
          createCompResponse.competition.id,
          agent.id,
        );

        // Controlled delay to ensure different timestamps
        await wait(comp.delay);
      }

      // Test multiple sort fields: name ascending, then createdAt descending
      const multipleSortResponse = await userClient.getUserCompetitions({
        sort: "name,-createdAt",
      });
      expect(multipleSortResponse.success).toBe(true);
      const multipleSortComps = (
        multipleSortResponse as UserCompetitionsResponse
      ).competitions;
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
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "AgentName Sort Test User",
        userEmail: "agentname-sort-test@example.com",
      });

      // Create multiple agents with different names for sorting
      const agentNames = ["Zebra Agent", "Alpha Agent", "Beta Agent"];
      const agents = [];

      for (const name of agentNames) {
        const agentResponse = await userClient.createAgent(
          name,
          `Description for ${name}`,
        );
        expect(agentResponse.success).toBe(true);
        agents.push((agentResponse as AgentProfileResponse).agent);
      }

      // Create competitions and have different agents join different competitions
      const competitions = [];
      for (let i = 0; i < 3; i++) {
        const createResponse = await adminClient.createCompetition(
          `AgentName Sort Competition ${i}`,
          `Competition ${i} for agentName sorting`,
        );
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        competitions.push(competition);

        // Each competition gets a different agent (to test primary agent name sorting)
        await userClient.joinCompetition(competition.id, agents[i]!.id);

        // Small delay to ensure different timestamps
        await wait(50);
      }

      // Test agentName ascending sort (should work now!)
      const agentNameAscResponse = await userClient.getUserCompetitions({
        sort: "agentName",
      });
      expect(agentNameAscResponse.success).toBe(true);
      const agentNameAscComps = (
        agentNameAscResponse as UserCompetitionsResponse
      ).competitions;
      expect(agentNameAscComps.length).toBe(3);

      // Verify sorting by primary agent name (alphabetically first)
      // Should be: Alpha Agent, Beta Agent, Zebra Agent
      expect(agentNameAscComps[0]?.agents?.[0]?.name).toBe("Alpha Agent");
      expect(agentNameAscComps[1]?.agents?.[0]?.name).toBe("Beta Agent");
      expect(agentNameAscComps[2]?.agents?.[0]?.name).toBe("Zebra Agent");

      // Test agentName descending sort
      const agentNameDescResponse = await userClient.getUserCompetitions({
        sort: "-agentName",
      });
      expect(agentNameDescResponse.success).toBe(true);
      const agentNameDescComps = (
        agentNameDescResponse as UserCompetitionsResponse
      ).competitions;
      expect(agentNameDescComps.length).toBe(3);

      // Should be: Zebra Agent, Beta Agent, Alpha Agent
      expect(agentNameDescComps[0]?.agents?.[0]?.name).toBe("Zebra Agent");
      expect(agentNameDescComps[1]?.agents?.[0]?.name).toBe("Beta Agent");
      expect(agentNameDescComps[2]?.agents?.[0]?.name).toBe("Alpha Agent");
    });

    test("user competitions agentName sorting with multiple agents per competition", async () => {
      // Test agentName sorting when competitions have multiple agents from the same user
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Multi-Agent Sort Test User",
        userEmail: "multi-agent-sort-test@example.com",
      });

      // Create agents with specific names to test primary agent selection
      const agent1Response = await userClient.createAgent(
        "Charlie Agent",
        "Third agent alphabetically",
      );
      expect(agent1Response.success).toBe(true);
      const agent1 = (agent1Response as AgentProfileResponse).agent;

      const agent2Response = await userClient.createAgent(
        "Alpha Agent",
        "First agent alphabetically",
      );
      expect(agent2Response.success).toBe(true);
      const agent2 = (agent2Response as AgentProfileResponse).agent;

      const agent3Response = await userClient.createAgent(
        "Beta Agent",
        "Second agent alphabetically",
      );
      expect(agent3Response.success).toBe(true);
      const agent3 = (agent3Response as AgentProfileResponse).agent;

      // Create two competitions
      const comp1Response = await adminClient.createCompetition(
        "Multi-Agent Competition 1",
        "Competition with Charlie and Alpha agents",
      );
      expect(comp1Response.success).toBe(true);
      const comp1 = (comp1Response as CreateCompetitionResponse).competition;

      const comp2Response = await adminClient.createCompetition(
        "Multi-Agent Competition 2",
        "Competition with Beta and Charlie agents",
      );
      expect(comp2Response.success).toBe(true);
      const comp2 = (comp2Response as CreateCompetitionResponse).competition;

      // Competition 1: Charlie + Alpha agents (primary should be "Alpha Agent")
      await userClient.joinCompetition(comp1.id, agent1.id); // Charlie
      await userClient.joinCompetition(comp1.id, agent2.id); // Alpha

      // Competition 2: Beta + Charlie agents (primary should be "Beta Agent")
      await userClient.joinCompetition(comp2.id, agent3.id); // Beta
      await userClient.joinCompetition(comp2.id, agent1.id); // Charlie

      // Test agentName ascending sort
      const sortResponse = await userClient.getUserCompetitions({
        sort: "agentName",
      });
      expect(sortResponse.success).toBe(true);
      const sortedComps = (sortResponse as UserCompetitionsResponse)
        .competitions;
      expect(sortedComps.length).toBe(2);

      // Business Rule: Primary agent name is lexicographically first agent name
      // Competition 1 primary: "Alpha Agent" (Alpha < Charlie)
      // Competition 2 primary: "Beta Agent" (Beta < Charlie)
      // Sort order: "Alpha Agent" < "Beta Agent"

      const comp1Result = sortedComps.find(
        (c) => c.name === "Multi-Agent Competition 1",
      );
      const comp2Result = sortedComps.find(
        (c) => c.name === "Multi-Agent Competition 2",
      );

      expect(comp1Result).toBeDefined();
      expect(comp2Result).toBeDefined();

      // Verify Competition 1 comes first (Alpha < Beta)
      expect(sortedComps[0]?.name).toBe("Multi-Agent Competition 1");
      expect(sortedComps[1]?.name).toBe("Multi-Agent Competition 2");

      // Verify each competition shows all user's agents
      expect(comp1Result?.agents?.length).toBe(2);
      expect(comp2Result?.agents?.length).toBe(2);
    });

    test("user competitions rank sorting works correctly", async () => {
      // Test the new rank computed sort field using established patterns from agent.test.ts
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Rank Sort Test User",
        userEmail: "rank-sort-test@example.com",
      });

      // Create multiple agents for testing different performance levels
      const agents = [];
      for (let i = 1; i <= 3; i++) {
        const agentResponse = await userClient.createAgent(
          `Rank Test Agent ${i}`,
          `Agent ${i} for rank testing`,
        );
        expect(agentResponse.success).toBe(true);
        agents.push((agentResponse as AgentProfileResponse).agent);
      }

      // Create two competitions with different ranking scenarios
      const comp1Response = await createTestCompetition(
        adminClient,
        "Multi-Agent Competition",
        "Competition with multiple agents for ranking",
      );
      const comp1 = comp1Response.competition;

      const comp2Response = await createTestCompetition(
        adminClient,
        "Single Agent Competition",
        "Competition with single agent",
      );
      const comp2 = comp2Response.competition;

      // Join competitions
      await userClient.joinCompetition(comp1.id, agents[0]!.id); // Will be rank 1 (best)
      await userClient.joinCompetition(comp1.id, agents[1]!.id); // Will be rank 2 (middle)
      await userClient.joinCompetition(comp1.id, agents[2]!.id); // Will be rank 3 (worst)
      await userClient.joinCompetition(comp2.id, agents[0]!.id); // Will be rank 1 (only agent)

      // Start first competition and create ranking differences using established patterns
      await startExistingTestCompetition(adminClient, comp1.id, [
        agents[0]!.id,
        agents[1]!.id,
        agents[2]!.id,
      ]);

      // Create ranking differences using the established burn address pattern
      // Agent 1: Small profitable trade (best rank)
      const agent1Client = adminClient.createAgentClient(agents[0]!.apiKey!);
      await agent1Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth, // ETH - should maintain/increase value
        amount: "50",
        reason: "Agent 1 small trade - USDC to ETH",
      });

      // Agent 2: Mixed performance (middle rank)
      const agent2Client = adminClient.createAgentClient(agents[1]!.apiKey!);
      await agent2Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn - bad trade
        amount: "25",
        reason: "Agent 2 bad trade - burning tokens",
      });

      // Agent 3: Poor performance using burn address pattern (worst rank)
      const agent3Client = adminClient.createAgentClient(agents[2]!.apiKey!);
      await agent3Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "50",
        reason: "Agent 3 terrible trade - burning large amount",
      });

      // End first competition and start second
      await adminClient.endCompetition(comp1.id);
      await startExistingTestCompetition(adminClient, comp2.id, [
        agents[0]!.id,
      ]);

      // Wait for portfolio snapshots to be created
      await wait(2000);

      // Test rank ascending sort (best ranks first)
      const rankAscResponse = await userClient.getUserCompetitions({
        sort: "rank",
      });
      expect(rankAscResponse.success).toBe(true);
      const rankAscComps = (rankAscResponse as UserCompetitionsResponse)
        .competitions;
      expect(rankAscComps.length).toBe(2);

      // Find competitions by name to verify sorting
      const multiAgentComp = rankAscComps.find(
        (c) => c.name === "Multi-Agent Competition",
      );
      const singleAgentComp = rankAscComps.find(
        (c) => c.name === "Single Agent Competition",
      );

      expect(multiAgentComp).toBeDefined();
      expect(singleAgentComp).toBeDefined();

      // Both should have rank 1 for this user's best agent, but multi-agent comp had more competition
      expect(multiAgentComp!.agents?.[0]?.rank).toBe(1); // Agent 1 won the 3-agent competition
      expect(singleAgentComp!.agents?.[0]?.rank).toBe(1); // Agent 1 alone in competition

      // Test rank descending sort
      const rankDescResponse = await userClient.getUserCompetitions({
        sort: "-rank",
      });
      expect(rankDescResponse.success).toBe(true);
      const rankDescComps = (rankDescResponse as UserCompetitionsResponse)
        .competitions;
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
    });

    test("user competitions rank sorting with undefined ranks", async () => {
      // Test rank sorting when some competitions have no ranking data
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Undefined Rank Test User",
        userEmail: "undefined-rank-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Undefined Rank Test Agent",
        "Agent for testing undefined rank handling",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create one started competition (will have rank) and one unstarted (no rank)
      const startedCompResponse = await createTestCompetition(
        adminClient,
        "Started Competition",
        "Competition that will be started",
      );
      const startedComp = startedCompResponse.competition;

      const unstartedCompResponse = await createTestCompetition(
        adminClient,
        "Unstarted Competition",
        "Competition that will not be started",
      );
      const unstartedComp = unstartedCompResponse.competition;

      // Join both competitions
      await userClient.joinCompetition(startedComp.id, agent.id);
      await userClient.joinCompetition(unstartedComp.id, agent.id);

      // Start only one competition
      await startExistingTestCompetition(adminClient, startedComp.id, [
        agent.id,
      ]);
      await wait(1000);

      // Test rank ascending sort - competitions with undefined ranks should go to end
      const rankSortResponse = await userClient.getUserCompetitions({
        sort: "rank",
      });
      expect(rankSortResponse.success).toBe(true);
      const rankSortComps = (rankSortResponse as UserCompetitionsResponse)
        .competitions;
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
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "New Sort Validation User",
        userEmail: "new-sort-validation@example.com",
      });

      // Test that agentName is now a valid sort field (should not throw 400)
      const agentNameResponse = await userClient.getUserCompetitions({
        sort: "agentName",
      });
      expect(agentNameResponse.success).toBe(true);

      // Test that rank is now a valid sort field (should not throw 400)
      const rankResponse = await userClient.getUserCompetitions({
        sort: "rank",
      });
      expect(rankResponse.success).toBe(true);

      // Test that descending variants work
      const agentNameDescResponse = await userClient.getUserCompetitions({
        sort: "-agentName",
      });
      expect(agentNameDescResponse.success).toBe(true);

      const rankDescResponse = await userClient.getUserCompetitions({
        sort: "-rank",
      });
      expect(rankDescResponse.success).toBe(true);

      // Test that invalid sort fields still throw 400
      const invalidResponse = await userClient.getUserCompetitions({
        sort: "invalidField",
      });
      expect(invalidResponse.success).toBe(false);
      expect((invalidResponse as ErrorResponse).status).toBe(400);
      expect((invalidResponse as ErrorResponse).error).toContain(
        "cannot sort by field",
      );
    });

    test("user competitions combined sort with new fields", async () => {
      // Test combining new computed sort fields with existing database fields
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Combined Sort Test User",
        userEmail: "combined-sort-test@example.com",
      });

      const agentResponse = await userClient.createAgent(
        "Combined Sort Test Agent",
        "Agent for combined sort testing",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Create competitions with same agent names but different creation times
      for (let i = 0; i < 3; i++) {
        const createResponse = await adminClient.createCompetition(
          `Combined Sort Competition ${i}`,
          `Competition ${i} for combined sort testing`,
        );
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await userClient.joinCompetition(competition.id, agent.id);

        // Controlled delay for predictable timestamps
        await wait(100);
      }

      // Test combined sort: agentName ascending, then createdAt descending
      // Since all have same agent, should sort by createdAt desc as secondary
      const combinedResponse = await userClient.getUserCompetitions({
        sort: "agentName,-createdAt",
      });
      expect(combinedResponse.success).toBe(true);
      const combinedComps = (combinedResponse as UserCompetitionsResponse)
        .competitions;
      expect(combinedComps.length).toBe(3);

      // Verify newest competition comes first (since agentName is same for all)
      expect(combinedComps[0]?.name).toBe("Combined Sort Competition 2");
      expect(combinedComps[1]?.name).toBe("Combined Sort Competition 1");
      expect(combinedComps[2]?.name).toBe("Combined Sort Competition 0");
    });

    test("user competitions agentName sorting with pagination", async () => {
      // Test pagination with agentName computed sorting
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
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
        const agentResponse = await userClient.createAgent(
          name,
          `Description for ${name}`,
        );
        expect(agentResponse.success).toBe(true);
        agents.push((agentResponse as AgentProfileResponse).agent);
      }

      // Create 5 competitions, each with a different agent
      for (let i = 0; i < 5; i++) {
        const createResponse = await adminClient.createCompetition(
          `AgentName Pagination Competition ${i}`,
          `Competition ${i} for agentName pagination testing`,
        );
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await userClient.joinCompetition(competition.id, agents[i]!.id);

        await wait(50);
      }

      // Test first page (limit 2, offset 0) with agentName sorting
      const page1Response = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 2,
        offset: 0,
      });
      expect(page1Response.success).toBe(true);
      const page1Comps = (page1Response as UserCompetitionsResponse)
        .competitions;
      expect(page1Comps.length).toBe(2);
      expect((page1Response as UserCompetitionsResponse).pagination.total).toBe(
        5,
      );
      expect(
        (page1Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(true);

      // Should be Alpha and Beta (first 2 alphabetically)
      expect(page1Comps[0]?.agents?.[0]?.name).toBe("Alpha Agent");
      expect(page1Comps[1]?.agents?.[0]?.name).toBe("Beta Agent");

      // Test second page (limit 2, offset 2)
      const page2Response = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 2,
        offset: 2,
      });
      expect(page2Response.success).toBe(true);
      const page2Comps = (page2Response as UserCompetitionsResponse)
        .competitions;
      expect(page2Comps.length).toBe(2);
      expect((page2Response as UserCompetitionsResponse).pagination.total).toBe(
        5,
      );
      expect(
        (page2Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(true);

      // Should be Charlie and Delta
      expect(page2Comps[0]?.agents?.[0]?.name).toBe("Charlie Agent");
      expect(page2Comps[1]?.agents?.[0]?.name).toBe("Delta Agent");

      // Test final page (limit 2, offset 4)
      const page3Response = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 2,
        offset: 4,
      });
      expect(page3Response.success).toBe(true);
      const page3Comps = (page3Response as UserCompetitionsResponse)
        .competitions;
      expect(page3Comps.length).toBe(1); // Only Echo left
      expect((page3Response as UserCompetitionsResponse).pagination.total).toBe(
        5,
      );
      expect(
        (page3Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(false);

      // Should be Echo
      expect(page3Comps[0]?.agents?.[0]?.name).toBe("Echo Agent");

      // Verify no overlapping results between pages
      const allPageIds = [
        ...page1Comps.map((c) => c.id),
        ...page2Comps.map((c) => c.id),
        ...page3Comps.map((c) => c.id),
      ];
      const uniqueIds = new Set(allPageIds);
      expect(uniqueIds.size).toBe(allPageIds.length); // No duplicates
    });

    test("user competitions rank sorting with pagination", async () => {
      // Test pagination with rank computed sorting
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Rank Pagination Test User",
        userEmail: "rank-pagination-test@example.com",
      });

      // Create multiple agents
      const agents = [];
      for (let i = 0; i < 4; i++) {
        const agentResponse = await userClient.createAgent(
          `Rank Test Agent ${i}`,
          `Agent ${i} for rank pagination testing`,
        );
        expect(agentResponse.success).toBe(true);
        agents.push((agentResponse as AgentProfileResponse).agent);
      }

      // Create 2 started competitions (will have ranks) and 2 unstarted (no ranks)
      const competitions = [];

      // Create started competitions with different performance levels
      for (let i = 0; i < 2; i++) {
        const createResponse = await createTestCompetition(
          adminClient,
          `Started Rank Competition ${i}`,
          `Started competition ${i} for rank testing`,
        );
        const competition = createResponse.competition;
        competitions.push(competition);

        await userClient.joinCompetition(competition.id, agents[i]!.id);
        await startExistingTestCompetition(adminClient, competition.id, [
          agents[i]!.id,
        ]);

        // Create different performance levels using established burn address pattern
        const agentClient = adminClient.createAgentClient(agents[i]!.apiKey!);
        if (i === 0) {
          // Best performer: keep valuable assets
          await agentClient.executeTrade({
            fromToken: config.specificChainTokens.eth.usdc,
            toToken: config.specificChainTokens.eth.eth,
            amount: "100",
            reason: "Smart trade - buying ETH",
          });
        } else {
          // Poor performer: burn tokens to create lower rank
          await agentClient.executeTrade({
            fromToken: config.specificChainTokens.eth.usdc,
            toToken: "0x000000000000000000000000000000000000dead", // Burn address
            amount: "150",
            reason: "Bad trade - burning tokens",
          });
        }

        // End this competition before starting the next one (only one can be active)
        await adminClient.endCompetition(competition.id);
      }

      // Unstarted competitions
      for (let i = 2; i < 4; i++) {
        const createResponse = await createTestCompetition(
          adminClient,
          `Unstarted Rank Competition ${i}`,
          `Unstarted competition ${i} for rank testing`,
        );
        const competition = createResponse.competition;
        competitions.push(competition);

        await userClient.joinCompetition(competition.id, agents[i]!.id);
      }

      // Wait for portfolio snapshots
      await wait(1500);

      // Test first page with rank sorting (started competitions should come first)
      const page1Response = await userClient.getUserCompetitions({
        sort: "rank",
        limit: 2,
        offset: 0,
      });
      expect(page1Response.success).toBe(true);
      const page1Comps = (page1Response as UserCompetitionsResponse)
        .competitions;
      expect(page1Comps.length).toBe(2);
      expect((page1Response as UserCompetitionsResponse).pagination.total).toBe(
        4,
      );
      expect(
        (page1Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(true);

      // First 2 should be the started competitions (with ranks)
      expect(page1Comps[0]?.agents?.[0]?.rank).toBe(1);
      expect(page1Comps[1]?.agents?.[0]?.rank).toBe(1);

      // Test second page (should be unstarted competitions)
      const page2Response = await userClient.getUserCompetitions({
        sort: "rank",
        limit: 2,
        offset: 2,
      });
      expect(page2Response.success).toBe(true);
      const page2Comps = (page2Response as UserCompetitionsResponse)
        .competitions;
      expect(page2Comps.length).toBe(2);
      expect((page2Response as UserCompetitionsResponse).pagination.total).toBe(
        4,
      );
      expect(
        (page2Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(false);

      // Last 2 should be the unstarted competitions (undefined ranks)
      expect(page2Comps[0]?.agents?.[0]?.rank).toBeUndefined();
      expect(page2Comps[1]?.agents?.[0]?.rank).toBeUndefined();
    });

    test("user competitions pagination accuracy with computed sorting", async () => {
      // Test that pagination counts are accurate when using computed sorting
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Computed Pagination Test User",
        userEmail: "computed-pagination-test@example.com",
      });

      // Create multiple agents with different names
      const agentNames = ["Zebra", "Alpha", "Beta", "Gamma", "Delta", "Echo"];
      const agents = [];

      for (const name of agentNames) {
        const agentResponse = await userClient.createAgent(
          `${name} Agent`,
          `Agent named ${name}`,
        );
        expect(agentResponse.success).toBe(true);
        agents.push((agentResponse as AgentProfileResponse).agent);
      }

      // Create 6 competitions, each with a different agent
      for (let i = 0; i < 6; i++) {
        const createResponse = await adminClient.createCompetition(
          `Computed Pagination Competition ${i}`,
          `Competition ${i} for computed pagination testing`,
        );
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await userClient.joinCompetition(competition.id, agents[i]!.id);
      }

      // Test various pagination scenarios with computed sorting

      // Scenario 1: First 3 items
      const scenario1 = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 3,
        offset: 0,
      });
      expect(scenario1.success).toBe(true);
      expect((scenario1 as UserCompetitionsResponse).competitions.length).toBe(
        3,
      );
      expect((scenario1 as UserCompetitionsResponse).pagination.total).toBe(6);
      expect((scenario1 as UserCompetitionsResponse).pagination.hasMore).toBe(
        true,
      );
      expect((scenario1 as UserCompetitionsResponse).pagination.offset).toBe(0);
      expect((scenario1 as UserCompetitionsResponse).pagination.limit).toBe(3);

      // Scenario 2: Next 3 items
      const scenario2 = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 3,
        offset: 3,
      });
      expect(scenario2.success).toBe(true);
      expect((scenario2 as UserCompetitionsResponse).competitions.length).toBe(
        3,
      );
      expect((scenario2 as UserCompetitionsResponse).pagination.total).toBe(6);
      expect((scenario2 as UserCompetitionsResponse).pagination.hasMore).toBe(
        false,
      );
      expect((scenario2 as UserCompetitionsResponse).pagination.offset).toBe(3);
      expect((scenario2 as UserCompetitionsResponse).pagination.limit).toBe(3);

      // Scenario 3: Offset beyond total
      const scenario3 = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 3,
        offset: 10,
      });
      expect(scenario3.success).toBe(true);
      expect((scenario3 as UserCompetitionsResponse).competitions.length).toBe(
        0,
      );
      expect((scenario3 as UserCompetitionsResponse).pagination.total).toBe(6);
      expect((scenario3 as UserCompetitionsResponse).pagination.hasMore).toBe(
        false,
      );

      // Scenario 4: Large limit
      const scenario4 = await userClient.getUserCompetitions({
        sort: "agentName",
        limit: 20,
        offset: 0,
      });
      expect(scenario4.success).toBe(true);
      expect((scenario4 as UserCompetitionsResponse).competitions.length).toBe(
        6,
      );
      expect((scenario4 as UserCompetitionsResponse).pagination.total).toBe(6);
      expect((scenario4 as UserCompetitionsResponse).pagination.hasMore).toBe(
        false,
      );

      // Verify sorting is correct across all scenarios
      const allSorted = (scenario4 as UserCompetitionsResponse).competitions;
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
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
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
        const agentResponse = await userClient.createAgent(
          data.name,
          `Agent for ${data.comp}`,
        );
        expect(agentResponse.success).toBe(true);
        agents.push((agentResponse as AgentProfileResponse).agent);
      }

      // Create competitions with controlled timing for secondary sort
      for (let i = 0; i < agentData.length; i++) {
        const createResponse = await adminClient.createCompetition(
          agentData[i]!.comp,
          `Competition ${i} for mixed sorting`,
        );
        expect(createResponse.success).toBe(true);
        const competition = (createResponse as CreateCompetitionResponse)
          .competition;
        await userClient.joinCompetition(competition.id, agents[i]!.id);

        // Controlled delay for predictable timestamps
        await wait(100);
      }

      // Test pagination with mixed sort: agentName (computed) + createdAt descending (database)
      const page1Response = await userClient.getUserCompetitions({
        sort: "agentName,-createdAt",
        limit: 3,
        offset: 0,
      });
      expect(page1Response.success).toBe(true);
      const page1Comps = (page1Response as UserCompetitionsResponse)
        .competitions;
      expect(page1Comps.length).toBe(3);
      expect((page1Response as UserCompetitionsResponse).pagination.total).toBe(
        5,
      );
      expect(
        (page1Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(true);

      // Should be: Alpha Agent A, Alpha Agent B, Beta Agent A
      expect(page1Comps[0]?.name).toBe("Competition A"); // Alpha Agent A
      expect(page1Comps[1]?.name).toBe("Competition B"); // Alpha Agent B
      expect(page1Comps[2]?.name).toBe("Competition C"); // Beta Agent A

      // Test second page
      const page2Response = await userClient.getUserCompetitions({
        sort: "agentName,-createdAt",
        limit: 3,
        offset: 3,
      });
      expect(page2Response.success).toBe(true);
      const page2Comps = (page2Response as UserCompetitionsResponse)
        .competitions;
      expect(page2Comps.length).toBe(2);
      expect(
        (page2Response as UserCompetitionsResponse).pagination.hasMore,
      ).toBe(false);

      // Should be: Beta Agent B, Gamma Agent
      expect(page2Comps[0]?.name).toBe("Competition D"); // Beta Agent B
      expect(page2Comps[1]?.name).toBe("Competition E"); // Gamma Agent
    });
  });

  test("user agents have correct stats after one competition", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Best Placement Test User",
      userEmail: "bestplacement-test@example.com",
    });

    // Create an admin client for competition management
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create 5 agents
    const agentNames = [
      "Alpha Agent",
      "Bravo Agent",
      "Charlie Agent",
      "Delta Agent",
      "Echo Agent",
    ];

    const createdAgents: Agent[] = [];
    for (const name of agentNames) {
      const response = await siweClient.createAgent(
        name,
        `Description for ${name}`,
      );
      expect(response.success).toBe(true);
      const agentResponse = response as { success: true; agent: Agent };
      createdAgents.push(agentResponse.agent);
      // Small delay to ensure different timestamps
      await wait(10);
    }

    // Create and start a competition
    const competitionName = `Best Placement Test Competition ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      competitionName,
      "Test competition for bestPlacement verification",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Enter all 5 agents in the competition
    const agentIds = createdAgents.map((agent) => agent.id);
    const startResult = await adminClient.startExistingCompetition(
      competitionId,
      agentIds,
    );
    expect(startResult.success).toBe(true);

    // Create different performance levels by executing different trades
    // Get agent clients for trading
    const agentClients = [];
    for (const agent of createdAgents) {
      const apiKeyResponse = await siweClient.getUserAgentApiKey(agent.id);
      expect(apiKeyResponse.success).toBe(true);
      const agentClient = new ApiClient(
        (apiKeyResponse as UserAgentApiKeyResponse).apiKey,
      );
      agentClients.push(agentClient);
    }

    // Alpha Agent: (3 big stable trades)
    for (let i = 0; i < 3; i++) {
      await agentClients[0]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "1000",
        reason: `Alpha Agent smart trade ${i + 1} - buying ETH`,
      });
      await wait(50);
    }

    // Bravo Agent: (2 small stable trades)
    for (let i = 0; i < 2; i++) {
      await agentClients[1]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
        reason: `Bravo Agent good trade ${i + 1}`,
      });
      await wait(50);
    }

    // Charlie Agent: (1 large volitile trade)
    await agentClients[2]?.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.vision,
      amount: "2000",
      reason: "Charlie Agent trade",
    });
    await wait(50);

    // Delta Agent: (1 large bad trade)
    await agentClients[3]?.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead", // Burn address
      amount: "2000",
      reason: "Delta Agent bad trade - burning tokens",
    });
    await wait(50);

    // Echo Agent: Worst performer (2 bad trades)
    for (let i = 0; i < 2; i++) {
      await agentClients[4]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "2000",
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

    // Get all user agents and verify bestPlacement stats
    const agentsResponse = await siweClient.getUserAgents();
    expect(agentsResponse.success).toBe(true);
    const agents = (agentsResponse as GetUserAgentsResponse).agents;
    expect(agents).toHaveLength(5);

    // Verify each agent has bestPlacement data
    for (const agent of agents) {
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
    const alphaAgent = agents.find((a) => a.name === "Alpha Agent");
    const bravoAgent = agents.find((a) => a.name === "Bravo Agent");
    const charlieAgent = agents.find((a) => a.name === "Charlie Agent");
    const deltaAgent = agents.find((a) => a.name === "Delta Agent");
    const echoAgent = agents.find((a) => a.name === "Echo Agent");

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
    for (const agent of agents) {
      expect(agent.stats?.bestPlacement?.competitionId).toBe(competitionId);
      expect(agent.stats?.bestPlacement?.totalAgents).toBe(5);
    }
  });

  test("two agents in multiple competitions have correct stats", async () => {
    // Create a SIWE-authenticated client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Multi Competition Test User",
      userEmail: "multicomp-test@example.com",
    });

    // Create an admin client for competition management
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create 2 agents
    const agent1Response = await siweClient.createAgent(
      "Agent Foxtrot",
      "The first Agent for this user",
    );
    expect(agent1Response.success).toBe(true);
    const agent1 = (agent1Response as { success: true; agent: Agent }).agent;

    const agent2Response = await siweClient.createAgent(
      "Agent Hotel",
      "Agent that makes volatile trades",
    );
    expect(agent2Response.success).toBe(true);
    const agent2 = (agent2Response as { success: true; agent: Agent }).agent;

    // Create agent clients for trading
    const agent1ApiKeyResponse = await siweClient.getUserAgentApiKey(agent1.id);
    expect(agent1ApiKeyResponse.success).toBe(true);
    const agent1Client = new ApiClient(
      (agent1ApiKeyResponse as UserAgentApiKeyResponse).apiKey,
    );

    const agent2ApiKeyResponse = await siweClient.getUserAgentApiKey(agent2.id);
    expect(agent2ApiKeyResponse.success).toBe(true);
    const agent2Client = new ApiClient(
      (agent2ApiKeyResponse as UserAgentApiKeyResponse).apiKey,
    );

    // FIRST COMPETITION
    const competition1Name = `Multi Competition Test 1 ${Date.now()}`;
    const createComp1Result = await adminClient.createCompetition(
      competition1Name,
      "First test competition for multi-comp verification",
    );
    expect(createComp1Result.success).toBe(true);
    const createComp1Response = createComp1Result as CreateCompetitionResponse;
    const competition1Id = createComp1Response.competition.id;

    // Start first competition with both agents
    const startComp1Result = await adminClient.startExistingCompetition(
      competition1Id,
      [agent1.id, agent2.id],
    );
    expect(startComp1Result.success).toBe(true);

    // Agent 1: Make stable trade (USDC to ETH)
    await agent1Client.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.eth,
      amount: "1000",
      reason: `Agent Foxtrot trade - stable USDC to ETH`,
    });

    // Agent 2: Make bad trade
    await agent2Client.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1000",
      reason: `Agent Hotel trade - volatile USDC to Vision`,
    });

    // End first competition
    const endComp1Result = await adminClient.endCompetition(competition1Id);
    expect(endComp1Result.success).toBe(true);

    // Wait for rankings to be calculated
    await wait(500);

    // SECOND COMPETITION
    const competition2Name = `Multi Competition Test 2 ${Date.now()}`;
    const createComp2Result = await adminClient.createCompetition(
      competition2Name,
      "Second test competition for multi-comp verification",
    );
    expect(createComp2Result.success).toBe(true);
    const createComp2Response = createComp2Result as CreateCompetitionResponse;
    const competition2Id = createComp2Response.competition.id;

    // Start second competition with both agents
    const startComp2Result = await adminClient.startExistingCompetition(
      competition2Id,
      [agent1.id, agent2.id],
    );
    expect(startComp2Result.success).toBe(true);

    // REVERSE THE TRADING PATTERNS
    // Agent 1: make bad trade
    await agent1Client.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1200",
      reason: `Agent Foxtrot volatile trade - USDC to Vision`,
    });

    // Agent 2: Now make stable trade (USDC to ETH)
    await agent2Client.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.eth,
      amount: "1200",
      reason: `Agent Hotel stable trade - stable USDC to ETH`,
    });

    // End second competition
    const endComp2Result = await adminClient.endCompetition(competition2Id);
    expect(endComp2Result.success).toBe(true);

    // Wait for rankings to be calculated
    await wait(500);

    // Get all user agents and verify stats
    const agentsResponse = await siweClient.getUserAgents();
    expect(agentsResponse.success).toBe(true);
    const agents = (agentsResponse as GetUserAgentsResponse).agents;
    expect(agents).toHaveLength(2);

    // Find the specific agents
    const agentFoxtrot = agents.find((a) => a.name === "Agent Foxtrot");
    const agentHotel = agents.find((a) => a.name === "Agent Hotel");

    expect(agentFoxtrot).toBeDefined();
    expect(agentHotel).toBeDefined();

    // Verify both agents have completed 2 competitions
    expect(agentFoxtrot?.stats?.completedCompetitions).toBe(2);
    expect(agentHotel?.stats?.completedCompetitions).toBe(2);

    // Verify trade counts
    expect(agentFoxtrot?.stats?.totalTrades).toBe(2); // 1 from comp1 + 1 from comp2
    expect(agentHotel?.stats?.totalTrades).toBe(2); // 1 from comp1 + 1 from comp2

    // Verify both agents have bestPlacement stats
    expect(agentFoxtrot?.stats?.bestPlacement).toBeDefined();
    expect(agentHotel?.stats?.bestPlacement).toBeDefined();

    // Verify bestPlacement structure
    expect(agentFoxtrot?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(agentFoxtrot?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(2);
    expect(agentFoxtrot?.stats?.bestPlacement?.totalAgents).toBe(2);
    expect([competition1Id, competition2Id]).toContain(
      agentFoxtrot?.stats?.bestPlacement?.competitionId,
    );

    expect(agentHotel?.stats?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
    expect(agentHotel?.stats?.bestPlacement?.rank).toBeLessThanOrEqual(2);
    expect(agentHotel?.stats?.bestPlacement?.totalAgents).toBe(2);
    expect([competition1Id, competition2Id]).toContain(
      agentHotel?.stats?.bestPlacement?.competitionId,
    );

    // Verify both agents have valid bestPnl values
    expect(agentFoxtrot?.stats?.bestPnl).toBeDefined();
    expect(agentHotel?.stats?.bestPnl).toBeDefined();
    expect(typeof agentFoxtrot?.stats?.bestPnl).toBe("number");
    expect(typeof agentHotel?.stats?.bestPnl).toBe("number");

    // Verify that bestPlacement reflects the better performance from either competition
    // The agent with rank 1 should have the better placement
    const agentFoxtrotRank = agentFoxtrot?.stats?.bestPlacement?.rank;
    const agentHotelRank = agentHotel?.stats?.bestPlacement?.rank;

    // Ensure ranks are the same since each agent has won one comp
    expect(agentFoxtrotRank).toBe(agentHotelRank);
    expect(agentFoxtrotRank).toBe(1);
  });

  describe("Email Verification", () => {
    test("unauthenticated user cannot verify email", async () => {
      // Create unauthenticated client
      const unauthenticatedClient = createTestClient();

      // Try to verify email without authentication
      const unauthResponse = await unauthenticatedClient.verifyEmail();
      expect(unauthResponse.success).toBe(false);
      expect((unauthResponse as ErrorResponse).status).toBe(401);
    });

    test("email verification endpoint returns consistent response structure", async () => {
      // Create a SIWE-authenticated client
      const { client: siweClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Response Structure Test User",
        userEmail: "response-structure-test@example.com",
      });

      // Test response structure with invalid token (we know this will fail)
      const response = await siweClient.verifyEmail();

      // Verify response structure regardless of success/failure
      expect(response).toHaveProperty("success");
      expect(typeof response.success).toBe("boolean");

      if (response.success) {
        // Success response structure
        expect(response).toHaveProperty("message");
        expect(typeof response.message).toBe("string");
      } else {
        // Error response structure
        const errorResponse = response as ErrorResponse;
        expect(errorResponse).toHaveProperty("error");
        expect(errorResponse).toHaveProperty("status");
        expect(typeof errorResponse.error).toBe("string");
        expect(typeof errorResponse.status).toBe("number");
      }
    });
  });
});
