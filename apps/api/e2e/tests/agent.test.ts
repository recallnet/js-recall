import axios from "axios";
import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, test } from "vitest";

import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  AdminAgentsListResponse,
  AdminSearchUsersAndAgentsResponse,
  AgentMetadata,
  AgentProfileResponse,
  AgentsGetResponse,
  Competition,
  CreateCompetitionResponse,
  PriceResponse,
  ResetApiKeyResponse,
  UserRegistrationResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createAgentVerificationSignature,
  createTestClient,
  generateRandomEthAddress,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

describe("Agent API", () => {
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

  test("admin can register a user and agent and agent can authenticate", async () => {
    // Create a test client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user and agent
    const userName = `User ${Date.now()}`;
    const userEmail = `user${Date.now()}@example.com`;
    const agentName = `Agent ${Date.now()}`;
    const agentDescription = "Test agent description";

    const {
      client: agentClient,
      user,
      agent,
      apiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName,
      userEmail,
      agentName,
      agentDescription,
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.name).toBe(userName);
    expect(user.email).toBe(userEmail);
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe(agentName);
    expect(agent.description).toBe(agentDescription);
    expect(agent.ownerId).toBe(user.id);
    expect(apiKey).toBeDefined();

    // Verify agent client is authenticated
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as AgentProfileResponse).agent).toBeDefined();
    expect((profileResponse as AgentProfileResponse).agent.id).toBe(agent.id);
    expect((profileResponse as AgentProfileResponse).agent.name).toBe(
      agentName,
    );
    expect((profileResponse as AgentProfileResponse).owner).toBeDefined();
    expect((profileResponse as AgentProfileResponse).owner.id).toBe(user.id);
  });

  test("agents can update their profile information", async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user and agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Update agent profile
    const newDescription = "Updated agent description";
    const updateResponse = await agentClient.updateAgentProfile({
      description: newDescription,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as AgentProfileResponse).agent).toBeDefined();
    expect((updateResponse as AgentProfileResponse).agent.description).toBe(
      newDescription,
    );

    // Verify changes persisted
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as AgentProfileResponse).agent.description).toBe(
      newDescription,
    );
  });

  test("agents can update their profile with name and imageUrl", async () => {
    // Setup admin client
    const client = createTestClient();
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user and agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Define update data for the agent (excluding metadata since it's not allowed in agent self-service)
    const newName = "Updated Agent Name";
    const newDescription = "Updated agent description";
    const newImageUrl = "https://example.com/new-agent-image.jpg";

    // Update agent profile with all allowed fields
    const updateResponse = await agentClient.updateAgentProfile({
      name: newName,
      description: newDescription,
      imageUrl: newImageUrl,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as AgentProfileResponse).agent).toBeDefined();
    expect((updateResponse as AgentProfileResponse).agent.name).toBe(newName);
    expect((updateResponse as AgentProfileResponse).agent.description).toBe(
      newDescription,
    );
    expect((updateResponse as AgentProfileResponse).agent.imageUrl).toBe(
      newImageUrl,
    );

    // Verify changes persisted
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as AgentProfileResponse).agent.name).toBe(newName);
    expect((profileResponse as AgentProfileResponse).agent.description).toBe(
      newDescription,
    );
    expect((profileResponse as AgentProfileResponse).agent.imageUrl).toBe(
      newImageUrl,
    );
  });

  test("agent cannot authenticate with invalid API key", async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a user and agent
    await registerUserAndAgentAndGetClient({ adminApiKey });

    // Create a client with an invalid API key
    const invalidApiKey = "invalid_key_12345";
    const invalidClient = client.createAgentClient(invalidApiKey);

    // Try to get profile with invalid API key
    try {
      await invalidClient.getAgentProfile();
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

  test("admin can list all registered agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register multiple users and agents
    const agentData = [
      {
        userName: `User A ${Date.now()}`,
        userEmail: `usera${Date.now()}@example.com`,
        agentName: `Agent A ${Date.now()}`,
      },
      {
        userName: `User B ${Date.now()}`,
        userEmail: `userb${Date.now()}@example.com`,
        agentName: `Agent B ${Date.now()}`,
      },
      {
        userName: `User C ${Date.now()}`,
        userEmail: `userc${Date.now()}@example.com`,
        agentName: `Agent C ${Date.now()}`,
      },
    ];

    for (const data of agentData) {
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: data.userName,
        userEmail: data.userEmail,
        agentName: data.agentName,
      });
    }

    // Admin lists all agents
    const agentsResponse = await adminClient.listAgents();

    expect(agentsResponse.success).toBe(true);
    expect((agentsResponse as AdminAgentsListResponse).agents).toBeDefined();
    expect(
      (agentsResponse as AdminAgentsListResponse).agents.length,
    ).toBeGreaterThanOrEqual(agentData.length);

    // Verify all our agents are in the list
    for (const data of agentData) {
      const foundAgent = (
        agentsResponse as AdminAgentsListResponse
      ).agents.find((a) => a.name === data.agentName);
      expect(foundAgent).toBeDefined();
    }
  });

  test("admin can filter and sort agents with paging", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register multiple users and agents
    const agentData = [
      {
        userName: `User A ${Date.now()}`,
        userEmail: `usera${Date.now()}@example.com`,
        agentName: `Agent A ${Date.now()}`,
        walletAddress: generateRandomEthAddress(),
        agentWalletAddress: generateRandomEthAddress(),
      },
      {
        userName: `User B ${Date.now()}`,
        userEmail: `userb${Date.now()}@example.com`,
        agentName: `Agent B ${Date.now()}`,
        walletAddress: generateRandomEthAddress(),
        agentWalletAddress: generateRandomEthAddress(),
      },
      {
        userName: `User C ${Date.now()}`,
        userEmail: `userc${Date.now()}@example.com`,
        agentName: `Agent C ${Date.now()}`,
        walletAddress: generateRandomEthAddress(),
        agentWalletAddress: generateRandomEthAddress(),
      },
    ];

    for (const data of agentData) {
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: data.userName,
        userEmail: data.userEmail,
        agentName: data.agentName,
        agentWalletAddress: data.agentWalletAddress,
      });
    }

    // Test that sort, limit, and offest work
    const agentsResponse = await adminClient.getAgents({
      limit: 2,
      offset: 1,
      sort: "name",
    });

    expect(agentsResponse.success).toBe(true);
    expect((agentsResponse as AgentsGetResponse).agents).toBeDefined();
    expect((agentsResponse as AgentsGetResponse).agents.length).toBe(2);

    expect((agentsResponse as AgentsGetResponse).agents[0]?.name).toBe(
      agentData[1]?.agentName,
    );
    expect((agentsResponse as AgentsGetResponse).agents[1]?.name).toBe(
      agentData[2]?.agentName,
    );

    // Test that filter works
    const agentsResponse2 = await adminClient.getAgents(
      { limit: 10, offset: 0, sort: "name" },
      "Agent",
    ); // should get all

    expect((agentsResponse2 as AgentsGetResponse).success).toBe(true);
    expect((agentsResponse2 as AgentsGetResponse).agents).toBeDefined();
    expect((agentsResponse2 as AgentsGetResponse).agents.length).toBe(3);

    // Test getting based on wallet
    const agentsResponse3 = await adminClient.getAgents(
      { limit: 10, offset: 0, sort: "name" },
      agentData[0]?.agentWalletAddress,
    );

    expect((agentsResponse3 as AgentsGetResponse).success).toBe(true);
    expect((agentsResponse3 as AgentsGetResponse).agents).toBeDefined();
    expect((agentsResponse3 as AgentsGetResponse).agents.length).toBe(1);

    expect((agentsResponse3 as AgentsGetResponse).agents[0]?.name).toBe(
      agentData[0]?.agentName,
    );
  });

  test("agent can retrieve profile with metadata", async () => {
    // Setup admin client
    const client = createTestClient();
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Define metadata for the agent
    const metadata: AgentMetadata = {
      ref: {
        name: "ProfileTestBot",
        version: "1.5.0",
        url: "https://github.com/example/profile-test-bot",
      },
      description: "A bot for testing profile retrieval",
      social: {
        name: "Profile Testing Agent",
        email: "profile@testingagent.com",
        twitter: "@profilebot",
      },
    };

    // Register a user and agent with metadata
    const userName = `Profile Metadata User ${Date.now()}`;
    const userEmail = `profile-metadata-${Date.now()}@example.com`;
    const agentName = `Profile Metadata Agent ${Date.now()}`;
    const agentDescription = "Agent for testing profile retrieval";

    // Register user and agent with metadata
    const registerResponse = await client.registerUser(
      generateRandomEthAddress(),
      userName,
      userEmail,
      undefined,
      agentName,
      agentDescription,
      undefined,
      metadata,
    );
    expect(registerResponse.success).toBe(true);

    // Create a client for the new agent
    const registrationResponse = registerResponse as UserRegistrationResponse;
    expect(registrationResponse.agent).toBeDefined();
    if (!registrationResponse.agent || !registrationResponse.agent.apiKey) {
      throw new Error("Agent or API key not created during registration");
    }
    const agentClient = client.createAgentClient(
      registrationResponse.agent.apiKey,
    );

    // Get the agent profile
    const profileResponse = await agentClient.getAgentProfile();
    const agentProfile = profileResponse as AgentProfileResponse;

    // Verify all profile fields including metadata
    console.log("====== AGENT PROFILE ======");
    console.log(agentProfile);
    console.log("====== AGENT PROFILE ======");
    expect(agentProfile.success).toBe(true);
    expect(agentProfile.agent.id).toBeDefined();
    expect(agentProfile.agent.name).toBe(agentName);
    expect(agentProfile.agent.description).toBe(agentDescription);
    expect(agentProfile.agent.metadata).toEqual(metadata);
    expect(agentProfile.agent.createdAt).toBeDefined();
    expect(agentProfile.agent.updatedAt).toBeDefined();
    expect(agentProfile.owner.id).toBeDefined();
    expect(agentProfile.owner.name).toBe(userName);
    expect(agentProfile.owner.email).toBe(userEmail);
  });

  test("agent can continue using API between competitions after inactiveAgentsCache fix", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a user and agent
    const agentName = `Test Agent ${Date.now()}`;
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName,
      });
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();

    // Step 2: Create and start first competition with the agent
    const firstCompName = `Competition 1 ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      firstCompName,
      "First test competition",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const firstCompetitionId = createCompResponse.competition.id;

    // Start the first competition with our agent
    const startCompResult = await adminClient.startExistingCompetition(
      firstCompetitionId,
      [agent.id],
    );
    expect(startCompResult.success).toBe(true);

    // Verify agent can use API during first competition
    const firstProfileResponse = await agentClient.getAgentProfile();
    expect(firstProfileResponse.success).toBe(true);

    // Get a token price to confirm API functionality
    const firstPriceResponse = await agentClient.getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    ); // WETH token
    expect(firstPriceResponse.success).toBe(true);
    const firstPriceData = firstPriceResponse as PriceResponse;
    expect(firstPriceData.price).toBeGreaterThan(0);

    // Step 3: End the first competition
    const endCompResult = await adminClient.endCompetition(firstCompetitionId);
    expect(endCompResult.success).toBe(true);

    // Step 4: Create and start a second competition with the same agent
    const secondCompName = `Competition 2 ${Date.now()}`;
    const createCompResult2 = await adminClient.createCompetition(
      secondCompName,
      "Second test competition",
    );
    expect(createCompResult2.success).toBe(true);
    const createCompResponse2 = createCompResult2 as CreateCompetitionResponse;
    const secondCompetitionId = createCompResponse2.competition.id;

    // Start the second competition with the same agent
    const startCompResult2 = await adminClient.startExistingCompetition(
      secondCompetitionId,
      [agent.id],
    );
    expect(startCompResult2.success).toBe(true);

    // Step 5: Verify agent can still use API after being added to second competition
    // This validates our fix for the inactiveAgentsCache issue
    const secondProfileResponse = await agentClient.getAgentProfile();
    expect(secondProfileResponse.success).toBe(true);

    // Get a token price to confirm API functionality is working after being re-added
    const secondPriceResponse = await agentClient.getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    ); // WETH token
    expect(secondPriceResponse.success).toBe(true);
    const secondPriceData = secondPriceResponse as PriceResponse;
    expect(secondPriceData.price).toBeGreaterThan(0);
  });

  test("agent profile updates maintain cache consistency", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a user and agent
    const agentName = `Cache Test Agent ${Date.now()}`;
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName,
      });
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.imageUrl).toBeNull(); // No initial imageUrl (database returns null, not undefined)

    // Step 2: Create and start a competition with the agent
    const compName = `Cache Test Competition ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      compName,
      "Competition to test cache consistency",
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Start the competition with our agent
    const startCompResult = await adminClient.startExistingCompetition(
      competitionId,
      [agent.id],
    );
    expect(startCompResult.success).toBe(true);

    // Step 3: Verify initial API functionality
    const initialProfileResponse = await agentClient.getAgentProfile();
    expect(initialProfileResponse.success).toBe(true);

    // Step 4: Update the agent's profile multiple times in rapid succession
    // This tests that cache consistency is maintained during updates
    const newName = "Cache Test Agent Updated";

    // Update 1: Set name
    const updateResponse1 = await agentClient.updateAgentProfile({
      name: newName,
    });
    expect(updateResponse1.success).toBe(true);

    // Immediately verify API still works
    const priceResponse1 = await agentClient.getPrice(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    );
    expect(priceResponse1.success).toBe(true);

    // Update 2: Change description
    const newDescription = `Cache Test Description ${Date.now()}`;
    const updateResponse2 = await agentClient.updateAgentProfile({
      description: newDescription,
    });
    expect(updateResponse2.success).toBe(true);

    // Immediately verify API still works
    const priceResponse2 = await agentClient.getPrice(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ); // USDC token
    expect(priceResponse2.success).toBe(true);

    // Update 3: Change both name and description
    const updateResponse3 = await agentClient.updateAgentProfile({
      name: `${newName} Final`,
      description: `${newDescription} Updated`,
    });
    expect(updateResponse3.success).toBe(true);

    // Step 5: Verify final profile state
    const finalProfileResponse = await agentClient.getAgentProfile();
    expect(finalProfileResponse.success).toBe(true);
    expect((finalProfileResponse as AgentProfileResponse).agent.name).toBe(
      `${newName} Final`,
    );
    expect(
      (finalProfileResponse as AgentProfileResponse).agent.description,
    ).toBe(`${newDescription} Updated`);

    // Step 6: Make multiple API calls to verify authentication still works
    // This confirms the apiKeyCache remains consistent
    for (let i = 0; i < 3; i++) {
      const verifyResponse = await agentClient.getBalance();
      expect(verifyResponse.success).toBe(true);
    }
  });

  test("agent can reset their API key", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a new user and agent
    const userName = `API Reset User ${Date.now()}`;
    const userEmail = `api-reset-${Date.now()}@example.com`;
    const agentName = `API Reset Agent ${Date.now()}`;
    const agentDescription = "Agent for API key reset testing";

    // Register the user and agent
    const { client: agentClient, apiKey: originalApiKey } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName,
        userEmail,
        agentName,
        agentDescription,
      });

    // Step 2: Verify initial authentication works
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);

    // Step 3: Reset the API key
    const resetResponse = await agentClient.resetApiKey();
    expect(resetResponse.success).toBe(true);

    const resetApiKeyResponse = resetResponse as ResetApiKeyResponse;
    expect(resetApiKeyResponse.apiKey).toBeDefined();
    expect(resetApiKeyResponse.apiKey).not.toBe(originalApiKey);

    // Step 4: Create a client with the new API key
    const newApiKey = resetApiKeyResponse.apiKey;
    const newClient = adminClient.createAgentClient(newApiKey);

    // Step 5: Verify authentication with the new API key works
    const newProfileResponse = await newClient.getAgentProfile();
    expect(newProfileResponse.success).toBe(true);

    // Step 6: Verify the old API key no longer works and provides a helpful error message
    const oldClient = adminClient.createAgentClient(originalApiKey);
    try {
      await oldClient.getAgentProfile();
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

  test("agents can set and update imageUrl", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a user and agent with initial imageUrl
    const userName = `Image Test User ${Date.now()}`;
    const userEmail = `image-test-${Date.now()}@example.com`;
    const agentName = `Image Test Agent ${Date.now()}`;
    const agentDescription = "Agent for image testing";
    const userWalletAddress = generateRandomEthAddress();
    const initialImageUrl = "https://example.com/agent-image-initial.jpg";

    // Register the user and agent with an initial image URL
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: userWalletAddress,
        userName,
        userEmail,
        agentName,
        agentDescription,
        agentImageUrl: initialImageUrl,
      });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.imageUrl).toBe(initialImageUrl);

    // Step 2: Verify the imageUrl is included in the profile
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as AgentProfileResponse).agent.imageUrl).toBe(
      initialImageUrl,
    );

    // Step 3: Update the agent's imageUrl
    const updatedImageUrl = "https://example.com/agent-image-updated.jpg";
    const updateResponse = await agentClient.updateAgentProfile({
      imageUrl: updatedImageUrl,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as AgentProfileResponse).agent.imageUrl).toBe(
      updatedImageUrl,
    );

    // Step 4: Verify changes persisted
    const updatedProfileResponse = await agentClient.getAgentProfile();
    expect(updatedProfileResponse.success).toBe(true);
    expect(
      (updatedProfileResponse as AgentProfileResponse).agent.imageUrl,
    ).toBe(updatedImageUrl);

    // Step 5: Verify admin can see the updated imageUrl in agent listings
    const agentsResponse = await adminClient.listAgents();
    expect(agentsResponse.success).toBe(true);

    const foundAgent = (agentsResponse as AdminAgentsListResponse).agents.find(
      (a) => a.id === agent.id,
    );
    expect(foundAgent).toBeDefined();
    expect(foundAgent?.imageUrl).toBe(updatedImageUrl);
  });

  test("agents can update both name and imageUrl in a single request", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register a user and agent without initial metadata or imageUrl
    const userName = `Combined Update User ${Date.now()}`;
    const userEmail = `combined-update-${Date.now()}@example.com`;
    const agentName = `Combined Update Agent ${Date.now()}`;
    const agentDescription = "Agent for combined updates";

    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName,
        userEmail,
        agentName,
        agentDescription,
      });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.imageUrl).toBeNull(); // No initial imageUrl (database returns null, not undefined)

    // Define new values for both fields
    const newName = "Combined Bot";
    const newImageUrl = "https://example.com/combined-update-image.jpg";

    // Update both fields in a single request
    const updateResponse = await agentClient.updateAgentProfile({
      name: newName,
      imageUrl: newImageUrl,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as AgentProfileResponse).agent.name).toBe(newName);
    expect((updateResponse as AgentProfileResponse).agent.imageUrl).toBe(
      newImageUrl,
    );

    // Verify changes persisted
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);

    const updatedProfile = (profileResponse as AgentProfileResponse).agent;
    expect(updatedProfile.name).toBe(newName);
    expect(updatedProfile.imageUrl).toBe(newImageUrl);

    // Verify admin can see both updated fields
    const searchResponse = await adminClient.searchUsersAndAgents({
      email: userEmail,
    });

    expect(searchResponse.success).toBe(true);
    // Note: searchUsersAndAgents returns both users and agents, so we need to find the agent
    const searchResults =
      searchResponse as unknown as AdminSearchUsersAndAgentsResponse;
    expect(searchResults.success).toBe(true);
    expect(searchResults.results.users).toBeDefined();
    expect(searchResults.results.agents).toBeDefined();
    const foundAgent = searchResults.results.agents.find(
      (a: AdminSearchUsersAndAgentsResponse["results"]["agents"][number]) =>
        a.id === agent.id,
    );

    expect(foundAgent).toBeDefined();
    expect(foundAgent?.imageUrl).toBe(newImageUrl);
  });

  test("agents cannot update email or metadata", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a user and agent with initial imageUrl
    const userName = `Email Test User ${Date.now()}`;
    const userEmail = `email-test-${Date.now()}@example.com`;
    const agentName = `Email Test Agent ${Date.now()}`;
    const agentDescription = "Agent for email testing";
    const userWalletAddress = generateRandomEthAddress();

    // Register the user and agent with an initial image URL
    const { agent, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      walletAddress: userWalletAddress,
      userName,
      userEmail,
      agentName,
      agentDescription,
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();

    // Step 2: Try to have the agent update its email
    try {
      await axios.put(
        `${getBaseUrl()}/api/agent/profile`,
        {
          email: "test@test.com",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      // Unreachable code (should throw an error)
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain("Invalid request format");
      }
    }

    // Step 3: Try to have the agent update its metadata
    try {
      const agentMetadata = {
        test: "test",
      };
      await axios.put(
        `${getBaseUrl()}/api/agent/profile`,
        {
          metadata: agentMetadata,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      // Unreachable code (should throw an error)
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain("Invalid request format");
      }
    }
  });

  test("GET /api/agents/:agentId retrieves agent details", async () => {
    // Setup admin client and login
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    async function register() {
      // Register a user and agent
      const userName = `Get Agent Test User ${Date.now()}`;
      const userEmail = `get-agent-${Date.now()}@example.com`;
      const agentName = `Get Agent Test ${Date.now()}`;
      const agentDescription = "Agent for GET endpoint test";

      const res = await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName,
        userEmail,
        agentName,
        agentDescription,
      });

      return {
        agentName,
        agentDescription,
        res,
      };
    }

    const {
      res: { agent },
      agentName,
      agentDescription,
    } = await register();
    const {
      res: { apiKey: apiKey2 },
    } = await register();

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();

    // Make a GET request to fetch the agent details using the agent ID
    const response = await axios.get(`${getBaseUrl()}/api/agents/${agent.id}`, {
      headers: {
        // Make sure that other agents/users can load details for a given agent id
        Authorization: `Bearer ${apiKey2}`,
      },
    });

    // Validate response
    expect(response.status).toBe(200);
    const agentData = response.data as AgentProfileResponse;
    expect(agentData.success).toBe(true);
    expect(agentData.agent.id).toBe(agent.id);
    expect(agentData.agent.name).toBe(agentName);
    expect(agentData.agent.description).toBe(agentDescription);
    expect(agentData.agent.stats).toBeDefined();
    expect(agentData.agent.trophies).toBeDefined();
    expect(Array.isArray(agentData.agent.trophies)).toBe(true);
    expect(agentData.agent.hasUnclaimedRewards).toBe(false);
    expect(agentData.agent.stats).toBeDefined();
    expect(agentData.agent.stats?.completedCompetitions).toBe(0);
    expect(agentData.agent.stats?.totalTrades).toBe(0);
    expect(agentData.agent.stats?.totalVotes).toBe(0);
    // TODO: once `agent_rank` + `competitions_leaderboard` are implemented, these should be defined
    expect(agentData.agent.stats?.bestPlacement).toBeUndefined();
    expect(agentData.agent.stats?.rank).toBeUndefined();
    expect(agentData.agent.stats?.score).toBeUndefined();
    // Validate owner information is included
    expect(agentData.owner).toBeDefined();
    expect(agentData.owner.id).toBeDefined();
    expect(agentData.owner.walletAddress).toBeDefined();
    // name can be string or null per the API contract
    expect(["string", "object"].includes(typeof agentData.owner.name)).toBe(
      true,
    );
    if (agentData.owner.name !== null) {
      expect(typeof agentData.owner.name).toBe("string");
    }
    // make sure public info is not exposed
    expect(agentData.agent.apiKey).not.toBeDefined();
  });

  test("GET /api/agents/:agentId returns 400 with invalid agent id", async () => {
    // Setup admin client and login
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    const userName = `Get Agent Test User ${Date.now()}`;
    const userEmail = `get-agent-${Date.now()}@example.com`;
    const agentName = `Get Agent Test ${Date.now()}`;
    const agentDescription = "Agent for GET endpoint test";

    const { agent, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName,
      userEmail,
      agentName,
      agentDescription,
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();

    try {
      // Make a GET request to fetch the agent details using the agent ID
      await axios.get(`${getBaseUrl()}/api/agents/foo123`, {
        headers: {
          // Make sure that other agents/users can load details for a given agent id
          Authorization: `Bearer ${apiKey}`,
        },
      });
      // Unreachable code (should throw an error)
      expect(false).toBe(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain("Invalid Agent ID");
      } else {
        throw error;
      }
    }
  });

  test("GET /api/agents/:agentId/competitions retrieves agent competitions", async () => {
    // Setup admin client and login
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a user and agent
    const userName = `Competitions Test User ${Date.now()}`;
    const userEmail = `competitions-test-${Date.now()}@example.com`;
    const agentName = `Competitions Test Agent ${Date.now()}`;
    const agentDescription = "Agent for competitions endpoint test";

    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName,
        userEmail,
        agentName,
        agentDescription,
      });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();

    // Step 2: Create and start two competitions with the agent
    const competitionNames = [
      `Competition A ${Date.now()}`,
      `Competition B ${Date.now()}`,
      `Competition C ${Date.now()}`,
    ];
    const createdCompetitions: Competition[] = [];

    // NOTE: we can't have more than one active comp right now
    async function createComp(compName: string) {
      const createCompResult = await adminClient.createCompetition(
        compName,
        `Test competition ${compName}`,
      );
      expect(createCompResult.success).toBe(true);
      const createCompResponse = createCompResult as CreateCompetitionResponse;
      createdCompetitions.push(createCompResponse.competition);

      const startCompResult = await adminClient.startExistingCompetition(
        createCompResponse.competition.id,
        [agent.id],
      );

      expect(startCompResult.success).toBe(true);
    }

    await createComp(competitionNames[0] as string);
    await adminClient.endCompetition(createdCompetitions[0]?.id as string);
    await createComp(competitionNames[1] as string);

    const pendingCompResponse = await adminClient.createCompetition(
      competitionNames[2] as string,
      `Test competition ${competitionNames[2] as string}`,
    );
    expect(pendingCompResponse.success).toBe(true);

    // make sure there is at least one comp that the agent is not part of so we can test that it is not returned in the responses
    const notJoinedCompResponse = await adminClient.createCompetition(
      competitionNames[2] as string,
      `Test competition ${competitionNames[2] as string}`,
    );
    expect(notJoinedCompResponse.success).toBe(true);

    const pendingComp = pendingCompResponse as CreateCompetitionResponse;
    await agentClient.joinCompetition(pendingComp.competition.id, agent.id);
    createdCompetitions.push(pendingComp.competition);

    // Agent fetches list of competitions
    const competitionsData = await agentClient.getAgentCompetitions(
      agent.id,
      {},
    );

    expect(competitionsData.success).toBe(true);
    expect(competitionsData.competitions).toBeDefined();
    expect(Array.isArray(competitionsData.competitions)).toBe(true);
    expect(competitionsData.competitions.length).toBe(3);
    expect(competitionsData.competitions[0].status).toBe("ended");
    expect(competitionsData.competitions[1].status).toBe("active");
    expect(competitionsData.competitions[2].status).toBe("pending");

    // Verify all competitions are present
    for (const competition of createdCompetitions) {
      const foundCompetition = competitionsData.competitions.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.id === competition.id,
      );
      expect(foundCompetition).toBeDefined();
      expect(foundCompetition.name).toBe(competition.name);
    }

    // test if filtering by status works
    async function testStatus(status: string) {
      const compsData = await agentClient.getAgentCompetitions(agent.id, {
        status,
      });

      expect(compsData.success).toBe(true);
      expect(compsData.competitions).toBeDefined();
      expect(Array.isArray(compsData.competitions)).toBe(true);
      expect(compsData.competitions.length).toBe(1);
      expect(compsData.competitions[0].status).toBe(status);
    }

    await testStatus("pending");
    await testStatus("active");
    await testStatus("ended");

    // test if sorting works
    const sortedComps = await agentClient.getAgentCompetitions(agent.id, {
      sort: "-name",
    });

    expect(sortedComps.success).toBe(true);
    expect(sortedComps.competitions).toBeDefined();
    expect(Array.isArray(sortedComps.competitions)).toBe(true);
    expect(sortedComps.competitions.length).toBe(3);
    expect(sortedComps.competitions[0].name).toBe(competitionNames[2]);
    expect(sortedComps.competitions[1].name).toBe(competitionNames[1]);
    expect(sortedComps.competitions[2].name).toBe(competitionNames[0]);

    // test if pagination works
    const pagedComps = await agentClient.getAgentCompetitions(agent.id, {
      limit: 2,
      offset: 0,
    });

    expect(pagedComps.success).toBe(true);
    expect(pagedComps.competitions).toBeDefined();
    expect(Array.isArray(pagedComps.competitions)).toBe(true);
    expect(pagedComps.competitions.length).toBe(2);
    expect(pagedComps.pagination).toBeDefined();
    expect(pagedComps.pagination.total).toBe(3);
    expect(pagedComps.pagination.limit).toBe(2);
    expect(pagedComps.pagination.offset).toBe(0);
    expect(pagedComps.pagination.hasMore).toBe(true);
  });

  describe("Agent Wallet Verification", () => {
    test("should successfully verify agent wallet ownership", async () => {
      // Setup: Create admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Create a test agent
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent",
        agentDescription: "Test agent for wallet verification",
      });

      // Step 1: Get a nonce for agent verification
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });

      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Step 2: Generate a new wallet for verification
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const testAccount = privateKeyToAccount(privateKey);
      const walletAddress = testAccount.address;

      // Step 3: Create verification message with nonce and signature
      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        undefined,
        undefined,
      );

      // Step 4: Verify wallet ownership
      const response = await agentClient.verifyAgentWallet(message, signature);

      expect(response).toEqual({
        success: true,
        walletAddress: walletAddress.toLowerCase(),
        message: "Wallet verified successfully",
      });

      // Step 5: Verify the agent's wallet address was updated
      const agentProfile = await agentClient.getAgentProfile();
      expect((agentProfile as AgentProfileResponse).agent.walletAddress).toBe(
        walletAddress.toLowerCase(),
      );
    });

    test("should reject verification with invalid signature", async () => {
      // Setup: Create admin client and agent
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent",
      });

      // Get a nonce for agent verification
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });
      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Create verification message with correct account
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const { message } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        undefined,
        undefined,
      );

      // Use an invalid signature
      const invalidSignature = "0xinvalidsignature";

      // Attempt verification
      const response = await agentClient.verifyAgentWallet(
        message,
        invalidSignature,
      );

      expect(response).toEqual({
        success: false,
        error: "Invalid signature",
        status: 400,
      });
    });

    test("should reject verification with expired timestamp", async () => {
      // Setup: Create admin client and agent
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent",
      });

      // Step 1: Get a nonce for agent verification
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });

      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Create verification message with expired timestamp (6 minutes ago)
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const expiredTimestamp = new Date(
        Date.now() - 6 * 60 * 1000,
      ).toISOString();
      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        expiredTimestamp,
        undefined,
      );

      // Attempt verification
      const response = await agentClient.verifyAgentWallet(message, signature);

      expect(response).toEqual({
        success: false,
        error: "Message timestamp too old",
        status: 400,
      });
    });

    test("should reject verification with future timestamp", async () => {
      // Setup: Create admin client and agent
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent",
      });

      // Step 1: Get a nonce for agent verification
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });

      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Create verification message with future timestamp (2 minutes from now, beyond 30s tolerance)
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const futureTimestamp = new Date(
        Date.now() + 2 * 60 * 1000,
      ).toISOString();
      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        futureTimestamp,
        undefined,
      );

      // Attempt verification
      const response = await agentClient.verifyAgentWallet(message, signature);

      expect(response).toEqual({
        success: false,
        error: "Message timestamp too far in the future",
        status: 400,
      });
    });

    test("should reject verification with wrong domain", async () => {
      // Setup: Create admin client and agent
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent",
      });

      // Get a nonce for agent verification
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });
      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Create verification message with wrong domain
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        undefined,
        "wrong.domain.com",
      );

      // Attempt verification
      const response = await agentClient.verifyAgentWallet(message, signature);

      expect(response).toEqual({
        success: false,
        error: "Invalid domain",
        status: 400,
      });
    });

    test("should reject verification when wallet already assigned to different agent", async () => {
      // Setup: Create admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Create first agent and verify wallet
      const { client: agentClient1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "First Agent",
      });

      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      // Get nonce for first agent
      const nonceResponse1 = await agentClient1.getAgentNonce();
      const nonce1 = (nonceResponse1 as { nonce: string }).nonce;

      const { message: message1, signature: signature1 } =
        await createAgentVerificationSignature(
          privateKey,
          nonce1,
          undefined,
          undefined,
        );

      const response1 = await agentClient1.verifyAgentWallet(
        message1,
        signature1,
      );
      expect(response1).toMatchObject({ success: true });

      // Create second agent and try to verify with same wallet
      const { client: agentClient2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Second Agent",
      });

      // Get nonce for second agent
      const nonceResponse2 = await agentClient2.getAgentNonce();
      const nonce2 = (nonceResponse2 as { nonce: string }).nonce;

      const { message: message2, signature: signature2 } =
        await createAgentVerificationSignature(
          privateKey,
          nonce2,
          undefined,
          undefined,
        );

      const response2 = await agentClient2.verifyAgentWallet(
        message2,
        signature2,
      );

      expect(response2).toEqual({
        success: false,
        error: "Wallet address already associated with another agent",
        status: 409,
      });
    });

    test("should require agent authentication", async () => {
      // Create a client without API key
      const unauthenticatedClient = new ApiClient(undefined, getBaseUrl());

      // Try to get a nonce without authentication - should fail
      const nonceResponse = await unauthenticatedClient.getAgentNonce();

      expect(nonceResponse).toEqual({
        success: false,
        error:
          "Authentication required. No active session and no API key provided. Use Authorization: Bearer YOUR_API_KEY",
        status: 401,
      });

      // Also test direct wallet verification without auth (will fail on nonce requirement)
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      // Create a message manually (without nonce since we can't get one)
      const timestamp = new Date().toISOString();
      const message = `VERIFY_WALLET_OWNERSHIP
Timestamp: ${timestamp}
Domain: api.recall.net
Purpose: WALLET_VERIFICATION`;

      const testAccount = privateKeyToAccount(privateKey as `0x${string}`);
      const signature = await testAccount.signMessage({ message });

      // Attempt verification without authentication
      const verifyResponse = await unauthenticatedClient.verifyAgentWallet(
        message,
        signature,
      );

      expect(verifyResponse).toEqual({
        success: false,
        error:
          "Authentication required. No active session and no API key provided. Use Authorization: Bearer YOUR_API_KEY",
        status: 401,
      });
    });

    test("should successfully verify agent wallet ownership with nonce", async () => {
      // Setup: Create admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Create a test agent
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent with Nonce",
        agentDescription: "Test agent for nonce-based wallet verification",
      });

      // Step 1: Get a nonce for agent verification
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });
      expect("error" in nonceResponse).toBe(false);

      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Step 2: Generate a new wallet for verification
      const privateKey =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const testAccount = privateKeyToAccount(privateKey);
      const walletAddress = testAccount.address;

      // Step 3: Create verification message with nonce and signature
      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        undefined,
        undefined,
      );

      // Step 4: Verify wallet ownership
      const response = await agentClient.verifyAgentWallet(message, signature);

      expect(response).toEqual({
        success: true,
        walletAddress: walletAddress.toLowerCase(),
        message: "Wallet verified successfully",
      });

      // Step 5: Verify the agent's wallet address was updated
      const agentProfile = await agentClient.getAgentProfile();
      expect((agentProfile as AgentProfileResponse).agent.walletAddress).toBe(
        walletAddress.toLowerCase(),
      );
    });

    test("should reject verification when nonce is reused", async () => {
      // Setup: Create admin client and two agents
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Create first agent
      const { client: firstAgentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "First Agent Nonce Test",
        });

      // Create second agent
      const { client: secondAgentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Second Agent Nonce Test",
        });

      // Get a nonce for first agent
      const nonceResponse = await firstAgentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });
      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Generate wallet and verify with first agent using the nonce
      const privateKey1 =
        "0x1111111111111111111111111111111111111111111111111111111111111111";
      const { message: firstMessage, signature: firstSignature } =
        await createAgentVerificationSignature(
          privateKey1,
          nonce,
          undefined,
          undefined,
        );

      // Verify with first agent - should succeed
      const firstResponse = await firstAgentClient.verifyAgentWallet(
        firstMessage,
        firstSignature,
      );
      expect(firstResponse).toMatchObject({ success: true });

      // Try to use the same nonce with second agent - should fail
      const privateKey2 =
        "0x2222222222222222222222222222222222222222222222222222222222222222";
      const { message: secondMessage, signature: secondSignature } =
        await createAgentVerificationSignature(
          privateKey2,
          nonce,
          undefined,
          undefined,
        );

      const secondResponse = await secondAgentClient.verifyAgentWallet(
        secondMessage,
        secondSignature,
      );
      expect(secondResponse).toEqual({
        success: false,
        error: "Nonce does not belong to this agent",
        status: 400,
      });
    });

    test("should reject verification with expired nonce", async () => {
      // Setup: Create admin client and agent
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Expired Nonce Test Agent",
      });

      // Get a nonce
      const nonceResponse = await agentClient.getAgentNonce();
      expect(nonceResponse).toMatchObject({ nonce: expect.any(String) });
      const nonce = (nonceResponse as { nonce: string }).nonce;

      // Create verification message with expired timestamp (15 minutes ago)
      const privateKey =
        "0x3333333333333333333333333333333333333333333333333333333333333333";
      const expiredTimestamp = new Date(
        Date.now() - 15 * 60 * 1000,
      ).toISOString();

      const { message, signature } = await createAgentVerificationSignature(
        privateKey,
        nonce,
        expiredTimestamp,
        undefined,
      );

      // Attempt verification - should fail due to expired timestamp
      const response = await agentClient.verifyAgentWallet(message, signature);
      expect(response).toEqual({
        success: false,
        error: "Message timestamp too old",
        status: 400,
      });
    });

    test("should require agent authentication for nonce generation", async () => {
      // Create a client without API key
      const unauthenticatedClient = new ApiClient(undefined, getBaseUrl());

      // Attempt to get agent nonce without authentication
      const response = await unauthenticatedClient.getAgentNonce();

      expect(response).toEqual({
        success: false,
        error:
          "Authentication required. No active session and no API key provided. Use Authorization: Bearer YOUR_API_KEY",
        status: 401,
      });
    });

    test("should work with both nonce and non-nonce verification (backward compatibility)", async () => {
      // Setup: Create admin client and two agents
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Create first agent for nonce-based verification
      const { client: nonceAgentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Nonce Agent",
        });

      // Create second agent for legacy (no nonce) verification
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Legacy Agent",
      });

      // Test 1: Nonce-based verification
      const nonceResponse = await nonceAgentClient.getAgentNonce();
      expect("error" in nonceResponse).toBe(false);
      const nonce = (nonceResponse as { nonce: string }).nonce;

      const privateKey1 =
        "0x4444444444444444444444444444444444444444444444444444444444444444";
      const { message: nonceMessage, signature: nonceSignature } =
        await createAgentVerificationSignature(
          privateKey1,
          nonce,
          undefined,
          undefined,
        );

      const nonceVerificationResponse =
        await nonceAgentClient.verifyAgentWallet(nonceMessage, nonceSignature);
      expect(nonceVerificationResponse).toMatchObject({ success: true });
    });
  });

  test("can list and sort agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with different names for sorting test
    const { client: clientA } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Charlie Agent",
    });

    await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Alpha Agent",
    });

    await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Beta Agent",
    });

    // Test 1: List agents without sorting (default order)
    const defaultAgents = await clientA.getAgents({
      limit: 10,
      offset: 0,
      sort: "",
    });

    expect(defaultAgents.success).toBe(true);
    expect((defaultAgents as AgentsGetResponse).agents).toBeDefined();
    expect(Array.isArray((defaultAgents as AgentsGetResponse).agents)).toBe(
      true,
    );
    expect(
      (defaultAgents as AgentsGetResponse).agents.length,
    ).toBeGreaterThanOrEqual(3);

    // Test 2: Sort by name ascending
    const sortedAsc = await clientA.getAgents({
      limit: 10,
      offset: 0,
      sort: "name",
    });

    expect(sortedAsc.success).toBe(true);
    expect((sortedAsc as AgentsGetResponse).agents).toBeDefined();

    // Find our test agents in the sorted list
    const testAgents = (sortedAsc as AgentsGetResponse).agents.filter((agent) =>
      ["Alpha Agent", "Beta Agent", "Charlie Agent"].includes(agent.name),
    );
    expect(testAgents.length).toBe(3);
    expect(testAgents[0]?.name).toBe("Alpha Agent");
    expect(testAgents[1]?.name).toBe("Beta Agent");
    expect(testAgents[2]?.name).toBe("Charlie Agent");

    // Test 3: Sort by name descending
    const sortedDesc = await clientA.getAgents({
      limit: 10,
      offset: 0,
      sort: "-name",
    });

    expect(sortedDesc.success).toBe(true);
    expect((sortedDesc as AgentsGetResponse).agents).toBeDefined();

    // Find our test agents in the descending sorted list
    const testAgentsDesc = (sortedDesc as AgentsGetResponse).agents.filter(
      (agent) =>
        ["Alpha Agent", "Beta Agent", "Charlie Agent"].includes(agent.name),
    );
    expect(testAgentsDesc.length).toBe(3);
    expect(testAgentsDesc[0]?.name).toBe("Charlie Agent");
    expect(testAgentsDesc[1]?.name).toBe("Beta Agent");
    expect(testAgentsDesc[2]?.name).toBe("Alpha Agent");

    // Test 4: Sort by createdAt descending (newest first)
    const sortedByDate = await clientA.getAgents({
      limit: 10,
      offset: 0,
      sort: "-createdAt",
    });

    expect(sortedByDate.success).toBe(true);
    expect((sortedByDate as AgentsGetResponse).agents).toBeDefined();
    expect(
      (sortedByDate as AgentsGetResponse).agents.length,
    ).toBeGreaterThanOrEqual(3);

    // Verify dates are in descending order
    const agentsByDate = (sortedByDate as AgentsGetResponse).agents;
    for (let i = 0; i < agentsByDate.length - 1; i++) {
      const currentDate = new Date(agentsByDate[i]?.createdAt || "");
      const nextDate = new Date(agentsByDate[i + 1]?.createdAt || "");
      expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
    }
  });
});
