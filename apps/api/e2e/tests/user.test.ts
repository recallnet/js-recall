import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  Agent,
  AgentProfileResponse,
  UserProfileResponse,
  UserRegistrationResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createSiweAuthenticatedClient,
  createTestClient,
  generateRandomEthAddress,
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

  // TODO: user auth isn't enabled
  test.skip("user can retrieve profile info", async () => {
    // Setup admin client
    const client = createTestClient();
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user with metadata
    const userName = `Profile Metadata User ${Date.now()}`;
    const email = `profile-metadata-${Date.now()}@example.com`;

    // Register user with metadata
    const registerResponse = await client.registerUser(
      generateRandomEthAddress(),
      userName,
      email,
    );
    expect(registerResponse.success).toBe(true);

    // Create a client for the new user
    const registrationResponse = registerResponse as UserRegistrationResponse;
    expect(registrationResponse.agent?.apiKey).toBeDefined();
    const userClient = client.createAgentClient(
      registrationResponse.agent!.apiKey!,
    );

    // Manually set metadata to mimic UI behavior
    const newName = "Profile Test User";
    await userClient.updateUserProfile({
      name: newName,
    });

    // Get the user profile
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);
    const userProfile = profileResponse as UserProfileResponse;

    // Verify all profile fields including metadata
    expect(userProfile.user.id).toBeDefined();
    expect(userProfile.user.name).toBe(newName);
    expect(userProfile.user.email).toBe(email);
    expect(userProfile.user.metadata).toBeNull();
    expect(userProfile.user.createdAt).toBeDefined();
    expect(userProfile.user.updatedAt).toBeDefined();
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
});
