import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  AdminAgentsListResponse,
  AdminSearchUsersAndAgentsResponse,
  AgentMetadata,
  AgentProfileResponse,
  AgentsGetResponse,
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
});
