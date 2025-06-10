import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import {
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  Agent,
  AgentProfileResponse,
  CROSS_CHAIN_TRADING_TYPE,
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
  generateTestCompetitions,
  registerUserAndAgentAndGetClient,
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
      email: userEmail,
    });

    expect(searchResponse.success).toBe(true);
    const foundUser = (
      searchResponse as unknown as AdminSearchUsersAndAgentsResponse
    ).results.users.find((t) => t.email === userEmail);

    expect(foundUser).toBeDefined();
    expect(foundUser?.imageUrl).toBe(newImageUrl);
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
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Test default pagination (should return all agents)
    const defaultResponse = await siweClient.getUserAgents();
    expect(defaultResponse.success).toBe(true);
    const defaultAgents = (defaultResponse as GetUserAgentsResponse).agents;
    expect(defaultAgents).toHaveLength(5);
    expect(Array.isArray(defaultAgents)).toBe(true);
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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
      await new Promise((resolve) => setTimeout(resolve, 50)); // Larger delay for timestamp differentiation
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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
    expect(competitionsResponse.pagination.limit).toBe(10);
    expect(competitionsResponse.pagination.offset).toBe(0);
    expect(competitionsResponse.pagination.total).toBe(15);
    expect(competitionsResponse.pagination.hasMore).toBe(true);

    for (const comp of competitionsResponse.competitions) {
      expect(comp.agents).toBeDefined();
      expect(Array.isArray(comp.agents)).toBe(true);
      expect(comp.agents.every((agent) => agent.ownerId === user1.id)).toBe(
        true,
      );
      expect(
        comp.agents.every((agent) =>
          expect(agent.rank).toBeGreaterThanOrEqual(0),
        ),
      );
    }

    // Test with query parameters
    const competitionsWithParamsResponse = (await client1.getUserCompetitions({
      limit: 5,
      offset: 0,
    })) as UserCompetitionsResponse;

    expect(competitionsWithParamsResponse.success).toBe(true);
    expect(competitionsWithParamsResponse.pagination.limit).toBe(5);
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
});
