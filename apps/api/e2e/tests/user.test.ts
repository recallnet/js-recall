import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  Agent,
  AgentProfileResponse,
  ErrorResponse,
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
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

// TODO: the tests below still have some API key usage, and we need to add more tests for user auth

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

  test("user can update both name and imageUrl in a single request", async () => {
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

    // Define new values for both fields
    const newName = "Combined Update User";
    const newImageUrl = "https://example.com/combined-update-image.jpg";

    // Update both fields in a single request
    const updateResponse = await userClient.updateUserProfile({
      name: newName,
      imageUrl: newImageUrl,
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

    // Test: User can update their profile via SIWE session
    const updateResponse = await siweClient.updateUserProfile({
      name: "Updated SIWE User",
    });
    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UserProfileResponse).user.name).toBe(
      "Updated SIWE User",
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
    const agentsResponse = (await siweClient.getUserAgents()) as {
      success: boolean;
      userId: string;
      agents: Agent[];
    };
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

    // Test: User can update all fields at once
    const updateAllResponse = await siweClient.updateUserAgentProfile(
      agent.id,
      {
        name: "Final Agent Name",
        description: "Final agent description",
        imageUrl: "https://example.com/final-image.jpg",
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
      "Invalid fields",
    );
  });
});
