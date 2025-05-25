import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  AdminSearchUsersAndAgentsResponse,
  AdminUsersListResponse,
  CreateCompetitionResponse,
  PriceResponse,
  ResetApiKeyResponse,
  UserMetadata,
  UserProfileResponse,
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
} from "@/e2e/utils/test-helpers.js";

// TODO: fix user tests

describe.skip("User API", () => {
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

    // Register a team
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

  test("user cannot authenticate with invalid API key", async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a team
    await registerUserAndAgentAndGetClient({ adminApiKey });

    // Create a client with an invalid API key
    const invalidApiKey = "invalid_key_12345";
    const invalidClient = client.createAgentClient(invalidApiKey);

    // Try to get profile with invalid API key
    try {
      await invalidClient.getUserProfile();
      // Should not reach here - authentication should fail
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect authentication error
      expect(error).toBeDefined();
      // Check for 401 status in the error object
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(401);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((error as any).status || 401).toBe(401);
      }
    }
  });

  test("admin can list all registered users", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register multiple teams
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

    // Admin lists all teams
    const usersResponse = await adminClient.listUsers();

    expect(usersResponse.success).toBe(true);
    expect((usersResponse as AdminUsersListResponse).users).toBeDefined();
    expect(
      (usersResponse as AdminUsersListResponse).users.length,
    ).toBeGreaterThanOrEqual(userData.length);

    // Verify all our teams are in the list
    for (const data of userData) {
      const foundUser = (usersResponse as AdminUsersListResponse).users.find(
        (u) => u.name === data.name && u.email === data.email,
      );
      expect(foundUser).toBeDefined();
    }
  });

  test("user can retrieve profile with metadata", async () => {
    // Setup admin client
    const client = createTestClient();
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Define metadata for the team
    const metadata: UserMetadata = {
      custom: {
        name: "Profile Test User",
        email: "profile@testinguser.com",
        twitter: "@profileuser",
      },
    };

    // Register a team with metadata
    const userName = `Profile Metadata Team ${Date.now()}`;
    const email = `profile-metadata-${Date.now()}@example.com`;

    // Register team with metadata
    const registerResponse = await client.registerUser(
      generateRandomEthAddress(),
      userName,
      email,
    );
    expect(registerResponse.success).toBe(true);

    // Create a client for the new team
    const registrationResponse = registerResponse as UserRegistrationResponse;
    expect(registrationResponse.agent?.apiKey).toBeDefined();
    const userClient = client.createAgentClient(
      registrationResponse.agent!.apiKey!,
    );

    // Get the user profile
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);
    const userProfile = profileResponse as UserProfileResponse;

    // Verify all profile fields including metadata
    expect(userProfile.user.id).toBeDefined();
    expect(userProfile.user.name).toBe(userName);
    expect(userProfile.user.email).toBe(email);
    expect(userProfile.user.metadata).toEqual(metadata);
    expect(userProfile.user.createdAt).toBeDefined();
    expect(userProfile.user.updatedAt).toBeDefined();
  });

  test("team can continue using API between competitions after inactiveTeamsCache fix", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a team
    const userName = `Test User ${Date.now()}`;
    const { client: userClient, user } = await registerUserAndAgentAndGetClient(
      {
        adminApiKey,
        userName: userName,
      },
    );
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();

    // Step 2: Create and start first competition with the team
    const firstCompName = `Competition 1 ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      firstCompName,
      "First test competition",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const firstCompetitionId = createCompResponse.competition.id;

    // Start the first competition with our team
    const startCompResult = await adminClient.startExistingCompetition(
      firstCompetitionId,
      [user.id],
    );
    expect(startCompResult.success).toBe(true);

    // Verify team can use API during first competition
    const firstProfileResponse = await userClient.getUserProfile();
    expect(firstProfileResponse.success).toBe(true);

    // Get a token price to confirm API functionality
    const firstPriceResponse = await userClient.getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    ); // WETH token
    expect(firstPriceResponse.success).toBe(true);
    const firstPriceData = firstPriceResponse as PriceResponse;
    expect(firstPriceData.price).toBeGreaterThan(0);

    // Step 3: End the first competition
    const endCompResult = await adminClient.endCompetition(firstCompetitionId);
    expect(endCompResult.success).toBe(true);

    // Step 4: Create and start a second competition with the same team
    const secondCompName = `Competition 2 ${Date.now()}`;
    const createCompResult2 = await adminClient.createCompetition(
      secondCompName,
      "Second test competition",
    );
    expect(createCompResult2.success).toBe(true);
    const createCompResponse2 = createCompResult2 as CreateCompetitionResponse;
    const secondCompetitionId = createCompResponse2.competition.id;

    // Start the second competition with the same team
    const startCompResult2 = await adminClient.startExistingCompetition(
      secondCompetitionId,
      [user.id],
    );
    expect(startCompResult2.success).toBe(true);

    // Step 5: Verify team can still use API after being added to second competition
    // This validates our fix for the inactiveTeamsCache issue
    const secondProfileResponse = await userClient.getUserProfile();
    expect(secondProfileResponse.success).toBe(true);

    // Get a token price to confirm API functionality is working after being re-added
    const secondPriceResponse = await userClient.getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    ); // WETH token
    expect(secondPriceResponse.success).toBe(true);
    const secondPriceData = secondPriceResponse as PriceResponse;
    expect(secondPriceData.price).toBeGreaterThan(0);
  });

  test("team profile updates maintain cache consistency", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a team
    const userName = `Cache Test User ${Date.now()}`;
    const { client: userClient, user } = await registerUserAndAgentAndGetClient(
      {
        adminApiKey,
        userName,
      },
    );
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.metadata).toBeNull(); // No initial metadata (database returns null, not undefined)

    // Step 2: Create and start a competition with the team
    const compName = `Cache Test Competition ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      compName,
      "Competition to test cache consistency",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Start the competition with our team
    const startCompResult = await adminClient.startExistingCompetition(
      competitionId,
      [user.id],
    );
    expect(startCompResult.success).toBe(true);

    // Step 3: Verify initial API functionality
    const initialProfileResponse = await userClient.getUserProfile();
    expect(initialProfileResponse.success).toBe(true);

    // Immediately verify API still works
    const priceResponse1 = await userClient.getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    );
    expect(priceResponse1.success).toBe(true);

    // Update 2: Change contact person
    const newContactPerson = `Cache Test Contact ${Date.now()}`;
    const updateResponse2 = await userClient.updateUserProfile({
      name: newContactPerson,
    });
    expect(updateResponse2.success).toBe(true);

    // Immediately verify API still works
    const priceResponse2 = await userClient.getPrice(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ); // USDC token
    expect(priceResponse2.success).toBe(true);

    // Update 3: Change both metadata and contact person
    const newImageUrl = "https://example.com/team-image-updated.jpg";
    const updateResponse3 = await userClient.updateUserProfile({
      name: `${newContactPerson} Updated`,
      imageUrl: newImageUrl,
    });
    expect(updateResponse3.success).toBe(true);

    // Step 5: Verify final profile state
    const finalProfileResponse = await userClient.getUserProfile();
    expect(finalProfileResponse.success).toBe(true);
    expect((finalProfileResponse as UserProfileResponse).user.name).toBe(
      `${newContactPerson} Updated`,
    );
    expect((finalProfileResponse as UserProfileResponse).user.imageUrl).toBe(
      newImageUrl,
    );

    // Step 6: Make multiple API calls to verify authentication still works
    // This confirms the apiKeyCache remains consistent
    for (let i = 0; i < 3; i++) {
      const verifyResponse = await userClient.getBalance();
      expect(verifyResponse.success).toBe(true);
    }
  });

  test("team can reset their API key", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a new team
    const userName = `API Reset Team ${Date.now()}`;
    const userEmail = `api-reset-${Date.now()}@example.com`;

    // Register the team
    const { client: userClient, apiKey: originalApiKey } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName,
        userEmail,
      });

    // Step 2: Verify initial authentication works
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);

    // Step 3: Reset the API key
    const resetResponse = await userClient.resetApiKey();
    expect(resetResponse.success).toBe(true);

    const resetApiKeyResponse = resetResponse as ResetApiKeyResponse;
    expect(resetApiKeyResponse.apiKey).toBeDefined();
    expect(resetApiKeyResponse.apiKey).not.toBe(originalApiKey);

    // Step 4: Create a client with the new API key
    const newApiKey = resetApiKeyResponse.apiKey;
    const newClient = adminClient.createAgentClient(newApiKey);

    // Step 5: Verify authentication with the new API key works
    const newProfileResponse = await newClient.getUserProfile();
    expect(newProfileResponse.success).toBe(true);

    // Step 6: Verify the old API key no longer works and provides a helpful error message
    const oldClient = adminClient.createAgentClient(originalApiKey);
    try {
      await oldClient.getUserProfile();
      // Should not reach here - authentication should fail
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect authentication error
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(401);
        // Verify error message is helpful
        expect(error.response.data.error).toContain("may have been reset");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((error as any).status || 401).toBe(401);
      }
    }
  });

  test("teams can set and update imageUrl", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a team with initial imageUrl
    const userName = `Image Test Team ${Date.now()}`;
    const userEmail = `image-test-${Date.now()}@example.com`;
    const agentName = "Image Test Contact";
    const walletAddress = generateRandomEthAddress();
    const initialImageUrl = "https://example.com/team-image-initial.jpg";

    // Register the team with an initial image URL
    const { client: userClient, user } = await registerUserAndAgentAndGetClient(
      {
        adminApiKey,
        userName,
        userEmail,
        agentName,
        walletAddress,
        userImageUrl: initialImageUrl,
      },
    );

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.imageUrl).toBe(initialImageUrl);

    // Step 2: Verify the imageUrl is included in the profile
    const profileResponse = await userClient.getUserProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as UserProfileResponse).user.imageUrl).toBe(
      initialImageUrl,
    );

    // Step 3: Update the team's imageUrl
    const updatedImageUrl = "https://example.com/team-image-updated.jpg";
    const updateResponse = await userClient.updateUserProfile({
      imageUrl: updatedImageUrl,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as UserProfileResponse).user.imageUrl).toBe(
      updatedImageUrl,
    );

    // Step 4: Verify changes persisted
    const updatedProfileResponse = await userClient.getUserProfile();
    expect(updatedProfileResponse.success).toBe(true);
    expect((updatedProfileResponse as UserProfileResponse).user.imageUrl).toBe(
      updatedImageUrl,
    );

    // Step 5: Verify admin can see the updated imageUrl in team listings
    const teamsResponse = await adminClient.listUsers();
    expect(teamsResponse.success).toBe(true);

    const foundUser = (teamsResponse as AdminUsersListResponse).users.find(
      (t) => t.id === user.id,
    );
    expect(foundUser).toBeDefined();
    expect(foundUser?.imageUrl).toBe(updatedImageUrl);
  });

  test("teams can update both metadata and imageUrl in a single request", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register a team without initial metadata or imageUrl
    const userName = `Combined Update Team ${Date.now()}`;
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
    const newImageUrl = "https://example.com/combined-update-image.jpg";

    // Update both fields in a single request
    const updateResponse = await userClient.updateUserProfile({
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
});
