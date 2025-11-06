import axios from "axios";
import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, test } from "vitest";

import { agents } from "@recallnet/db/schema/core/defs";
import { generateHandleFromName, isValidHandle } from "@recallnet/services/lib";
import { ApiClient } from "@recallnet/test-utils";
import {
  AdminAgentsListResponse,
  AdminSearchUsersAndAgentsResponse,
  AgentCompetitionsResponse,
  AgentMetadata,
  AgentProfileResponse,
  AgentsGetResponse,
  Competition,
  CreateCompetitionResponse,
  EnhancedCompetition,
  ErrorResponse,
  PriceResponse,
  PublicAgentResponse,
  ResetApiKeyResponse,
  UserRegistrationResponse,
} from "@recallnet/test-utils";
import { dbManager } from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createAgentVerificationSignature,
  createPrivyAuthenticatedClient,
  createTestClient,
  generateRandomEthAddress,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { config } from "@/config/index.js";
import { ServiceRegistry } from "@/services/index.js";

describe("Agent API", () => {
  // Clean up test state before each test
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("admin can register a user and agent and agent can authenticate", async () => {
    // Create a test client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    await client.loginAsAdmin(adminApiKey);

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
    expect(agent.handle).toBeDefined();
    expect(agent.description).toBe(agentDescription);
    expect(agent.ownerId).toBe(user.id);
    expect(apiKey).toBeDefined();

    // Verify agent client is authenticated
    const profileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.agent).toBeDefined();
    expect(profileResponse.agent.id).toBe(agent.id);
    expect(profileResponse.agent.name).toBe(agentName);
    // the admin helper above adds a walletAddress to (verifies) the agent
    expect(profileResponse.agent.isVerified).toBe(true);
    expect(profileResponse.owner).toBeDefined();
    expect(profileResponse.owner.id).toBe(user.id);
  });

  test("agents can update their profile information", async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    await client.loginAsAdmin(adminApiKey);

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

  test("agents can update their profile with description and imageUrl", async () => {
    // Setup admin client
    const client = createTestClient();
    await client.loginAsAdmin(adminApiKey);

    // Register a user and agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Define update data for the agent (excluding metadata since it's not allowed in agent self-service)
    const newDescription = "Updated agent description";
    const newImageUrl = "https://example.com/new-agent-image.jpg";

    // Update agent profile with all allowed fields
    const updateResponse = await agentClient.updateAgentProfile({
      description: newDescription,
      imageUrl: newImageUrl,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as AgentProfileResponse).agent).toBeDefined();
    expect((updateResponse as AgentProfileResponse).agent.description).toBe(
      newDescription,
    );
    expect((updateResponse as AgentProfileResponse).agent.imageUrl).toBe(
      newImageUrl,
    );

    // Verify changes persisted
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);
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
    await client.loginAsAdmin(adminApiKey);

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

    // Test that sort, limit, and offset work
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
    await client.loginAsAdmin(adminApiKey);

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
    const registerResponse = await client.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: userName,
      email: userEmail,
      agentName: agentName,
      agentDescription: agentDescription,
      agentMetadata: metadata,
    });
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
    const createCompResult = await adminClient.createCompetition({
      name: firstCompName,
      description: "First test competition",
    });
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const firstCompetitionId = createCompResponse.competition.id;

    // Start the first competition with our agent
    const startCompResult = await adminClient.startExistingCompetition({
      competitionId: firstCompetitionId,
      agentIds: [agent.id],
    });
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
    const createCompResult2 = await adminClient.createCompetition({
      name: secondCompName,
      description: "Second test competition",
    });
    expect(createCompResult2.success).toBe(true);
    const createCompResponse2 = createCompResult2 as CreateCompetitionResponse;
    const secondCompetitionId = createCompResponse2.competition.id;

    // Start the second competition with the same agent
    const startCompResult2 = await adminClient.startExistingCompetition({
      competitionId: secondCompetitionId,
      agentIds: [agent.id],
    });
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
    const createCompResult = await adminClient.createCompetition({
      name: compName,
      description: "Competition to test cache consistency",
    });
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Start the competition with our agent
    const startCompResult = await adminClient.startExistingCompetition({
      competitionId,
      agentIds: [agent.id],
    });
    expect(startCompResult.success).toBe(true);

    // Step 3: Verify initial API functionality
    const initialProfileResponse = await agentClient.getAgentProfile();
    expect(initialProfileResponse.success).toBe(true);

    // Step 4: Update the agent's profile multiple times in rapid succession
    // This tests that cache consistency is maintained during updates
    const originalDescription = "Cache Test Agent Updated";
    const originalImageUrl = "https://example.com/agent-image-updated.jpg";

    // Update 1: Set description
    const updateResponse1 = await agentClient.updateAgentProfile({
      imageUrl: originalImageUrl,
      description: originalDescription,
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

    // Update 3: Change both imageUrl and description
    const newImageUrl = "https://example.com/agent-image-updated.jpg";
    const newDescription2 = `Cache Test Description ${Date.now()}`;
    const updateResponse3 = await agentClient.updateAgentProfile({
      imageUrl: newImageUrl,
      description: newDescription2,
    });
    expect(updateResponse3.success).toBe(true);

    // Step 5: Verify final profile state
    const finalProfileResponse = await agentClient.getAgentProfile();
    expect(finalProfileResponse.success).toBe(true);
    expect(
      (finalProfileResponse as AgentProfileResponse).agent.description,
    ).toBe(newDescription2);
    expect((finalProfileResponse as AgentProfileResponse).agent.imageUrl).toBe(
      newImageUrl,
    );

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
    const newImageUrl = "https://example.com/combined-update-image.jpg";
    const newDescription = "Combined Bot Description";

    // Update both fields in a single request
    const updateResponse = await agentClient.updateAgentProfile({
      description: newDescription,
      imageUrl: newImageUrl,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as AgentProfileResponse).agent.description).toBe(
      newDescription,
    );
    expect((updateResponse as AgentProfileResponse).agent.imageUrl).toBe(
      newImageUrl,
    );

    // Verify changes persisted
    const profileResponse = await agentClient.getAgentProfile();
    expect(profileResponse.success).toBe(true);

    const updatedProfile = (profileResponse as AgentProfileResponse).agent;
    expect(updatedProfile.description).toBe(newDescription);
    expect(updatedProfile.imageUrl).toBe(newImageUrl);

    // Verify admin can see both updated fields
    const searchResponse = await adminClient.searchUsersAndAgents({
      user: {
        email: userEmail,
      },
      agent: {
        name: agentName,
      },
    });

    expect(searchResponse.success).toBe(true);
    // Note: searchUsersAndAgents returns both users and agents, so we need to find the agent
    const searchResults = searchResponse as AdminSearchUsersAndAgentsResponse;
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
    expect(agentData.agent.stats?.bestPlacement).toBeUndefined();
    expect(agentData.agent.stats?.ranks).toBeUndefined();
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
  });

  test("should not expose api key or email in public agent info", async () => {
    // Setup admin client and login
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register a user and agent
    const userName = `Get Agent Test User ${Date.now()}`;
    const userEmail = `get-agent-${Date.now()}@example.com`;
    const agentName = `Get Agent Test ${Date.now()}`;
    const agentEmail = `get-agent-${Date.now()}@example.com`;
    const agentDescription = "Agent for GET endpoint test";

    const res = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName,
      userEmail,
      agentName,
      agentDescription,
    });
    const agentId = res.agent.id;

    // Manually update database entry to include email
    const db = await dbManager.connect();
    await db
      .update(agents)
      .set({ email: agentEmail })
      .where(eq(agents.id, agentId));
    const agent = (
      await db.select().from(agents).where(eq(agents.id, agentId))
    )[0];

    expect(agent).toBeDefined();
    expect(agent?.id).toBeDefined();

    // Make a public GET request to fetch the agent details using the agent ID
    const response = await axios.get(`${getBaseUrl()}/api/agents/${agent?.id}`);

    // Validate response
    expect(response.status).toBe(200);
    const agentData = response.data as AgentProfileResponse;
    expect(agentData.success).toBe(true);
    // make sure public info is not exposed
    expect(agentData.agent.email).not.toBeDefined();
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
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: `Test competition ${compName}`,
      });
      expect(createCompResult.success).toBe(true);
      const createCompResponse = createCompResult as CreateCompetitionResponse;
      createdCompetitions.push(createCompResponse.competition);

      const startCompResult = await adminClient.startExistingCompetition({
        competitionId: createCompResponse.competition.id,
        agentIds: [agent.id],
      });

      expect(startCompResult.success).toBe(true);
    }

    await createComp(competitionNames[0] as string);
    await adminClient.endCompetition(createdCompetitions[0]?.id as string);
    await createComp(competitionNames[1] as string);

    const pendingCompResponse = await adminClient.createCompetition({
      name: competitionNames[2] as string,
      description: `Test competition ${competitionNames[2] as string}`,
    });
    expect(pendingCompResponse.success).toBe(true);

    // make sure there is at least one comp that the agent is not part of so we can test that it is not returned in the responses
    const notJoinedCompResponse = await adminClient.createCompetition({
      name: competitionNames[2] as string,
      description: `Test competition ${competitionNames[2] as string}`,
    });
    expect(notJoinedCompResponse.success).toBe(true);

    const pendingComp = pendingCompResponse as CreateCompetitionResponse;
    await agentClient.joinCompetition(pendingComp.competition.id, agent.id);
    createdCompetitions.push(pendingComp.competition);

    // Agent fetches list of competitions
    const competitionsData = (await agentClient.getAgentCompetitions(
      agent.id,
      {},
    )) as AgentCompetitionsResponse;

    expect(competitionsData).toBeDefined();
    expect(competitionsData!.success).toBe(true);
    expect(competitionsData.competitions).toBeDefined();
    expect(Array.isArray(competitionsData.competitions)).toBe(true);
    expect(competitionsData.competitions.length).toBe(3);
    expect(competitionsData.competitions[0]?.status).toBe("ended");
    expect(competitionsData.competitions[1]?.status).toBe("active");
    expect(competitionsData.competitions[2]?.status).toBe("pending");

    // Verify all competitions are present
    for (const competition of createdCompetitions) {
      const foundCompetition = (
        competitionsData.competitions as EnhancedCompetition[]
      ).find((c) => c.id === competition.id);
      expect(foundCompetition).toBeDefined();
      expect(foundCompetition!.name).toBe(competition.name);
    }

    // test if filtering by status works
    async function testStatus(status: string) {
      const compsData = (await agentClient.getAgentCompetitions(agent.id, {
        status,
      })) as AgentCompetitionsResponse;

      expect(compsData).toBeDefined();
      expect(compsData!.success).toBe(true);
      expect(compsData.competitions).toBeDefined();
      expect(Array.isArray(compsData.competitions)).toBe(true);
      expect(compsData.competitions.length).toBe(1);
      expect(compsData.competitions[0]?.status).toBe(status);
    }

    await testStatus("pending");
    await testStatus("active");
    await testStatus("ended");

    // test if sorting works
    const sortedComps = (await agentClient.getAgentCompetitions(agent.id, {
      sort: "-name",
    })) as AgentCompetitionsResponse;

    expect(sortedComps.success).toBe(true);
    expect(sortedComps.competitions).toBeDefined();
    expect(Array.isArray(sortedComps.competitions)).toBe(true);
    expect(sortedComps.competitions.length).toBe(3);
    expect(sortedComps.competitions[0]?.name).toBe(competitionNames[2]);
    expect(sortedComps.competitions[1]?.name).toBe(competitionNames[1]);
    expect(sortedComps.competitions[2]?.name).toBe(competitionNames[0]);

    // test if pagination works
    const pagedComps = (await agentClient.getAgentCompetitions(agent.id, {
      limit: 2,
      offset: 0,
    })) as AgentCompetitionsResponse;

    expect(pagedComps).toBeDefined();
    expect(pagedComps!.success).toBe(true);
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
      const agentProfile =
        (await agentClient.getAgentProfile()) as AgentProfileResponse;
      expect(agentProfile.agent.walletAddress).toBe(
        walletAddress.toLowerCase(),
      );
      expect(agentProfile.agent.isVerified).toBe(true);
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
          "[AuthMiddleware] Authentication required. Invalid Privy token or no API key provided. Use Authorization: Bearer YOUR_API_KEY",
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
          "[AuthMiddleware] Authentication required. Invalid Privy token or no API key provided. Use Authorization: Bearer YOUR_API_KEY",
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
      const agentProfile =
        (await agentClient.getAgentProfile()) as AgentProfileResponse;
      expect(agentProfile.agent.walletAddress).toBe(
        walletAddress.toLowerCase(),
      );
      expect(agentProfile.agent.isVerified).toBe(true);
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
          "[AuthMiddleware] Authentication required. Invalid Privy token or no API key provided. Use Authorization: Bearer YOUR_API_KEY",
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

  test("agent has stats in agent profile", async () => {
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
    const createCompResult = await adminClient.createCompetition({
      name: firstCompName,
      description: "First test competition",
    });
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const firstCompetitionId = createCompResponse.competition.id;

    // Start the first competition with our agent
    await adminClient.startExistingCompetition({
      competitionId: firstCompetitionId,
      agentIds: [agent.id],
    });
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead", // Burn address - make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await adminClient.endCompetition(firstCompetitionId);

    // Get agent profile info and check skills
    const agentProfile = (await agentClient.getPublicAgent(
      agent.id,
    )) as PublicAgentResponse;
    expect(agentProfile.success).toBe(true);
    expect(agentProfile.agent.stats?.completedCompetitions).toBeGreaterThan(0);
    expect(agentProfile.agent.stats?.totalTrades).toBeGreaterThan(0);
    expect(agentProfile.agent.stats?.bestPlacement).toBeDefined();
    expect(agentProfile.agent.stats?.bestPlacement?.competitionId).toBe(
      firstCompetitionId,
    );
    expect(agentProfile.agent.stats?.bestPlacement?.rank).toBe(1);
    expect(
      agentProfile.agent.stats?.bestPlacement?.totalAgents,
    ).toBeGreaterThan(0);

    // Verify agent has global ranks array
    expect(agentProfile.agent.stats?.ranks).toBeDefined();
    expect(Array.isArray(agentProfile.agent.stats?.ranks)).toBe(true);
    expect(agentProfile.agent.stats?.ranks?.[0]?.rank).toBe(1);
    expect(agentProfile.agent.stats?.ranks?.[0]?.score).toBe(1500);
    expect(agentProfile.agent.stats?.ranks?.[0]?.type).toBe("trading");
  });

  describe("Per-Competition Agent Status", () => {
    test("agent can access all APIs without ever participating in competitions", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register agent but DON'T join any competitions
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Never Competed Agent",
          agentDescription: "Agent that never participates in competitions",
        });

      // Test all basic agent APIs work without competition participation

      // 1. Profile access
      const profileResponse = await agentClient.getAgentProfile();
      expect(profileResponse.success).toBe(true);
      expect((profileResponse as AgentProfileResponse).agent.id).toBe(agent.id);

      // 2. Profile updates
      const updateResponse = await agentClient.updateAgentProfile({
        description: "Updated without ever competing",
      });
      expect(updateResponse.success).toBe(true);
      expect((updateResponse as AgentProfileResponse).agent.description).toBe(
        "Updated without ever competing",
      );

      // 3. Balance check
      const balanceResponse = await agentClient.getBalance();
      expect(balanceResponse.success).toBe(true);

      // Ensure there is an active competition so the pricing endpoints are
      // open, but do NOT add the first agent to it
      const { agent: otherAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Competition Only Agent",
        agentDescription:
          "Agent used to create an active competition for middleware",
      });
      const startActiveCompResponse = await adminClient.startCompetition({
        name: `Enable Price Access ${Date.now()}`,
        description: "Active competition to satisfy price route middleware",
        agentIds: [otherAgent.id],
      });
      expect(startActiveCompResponse.success).toBe(true);

      // 4. Price data access
      const priceResponse = await agentClient.getPrice(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      ); // WETH
      expect(priceResponse.success).toBe(true);
      expect((priceResponse as PriceResponse).price).toBeGreaterThan(0);

      // 5. API key reset
      const resetResponse = await agentClient.resetApiKey();
      expect(resetResponse.success).toBe(true);
      expect((resetResponse as ResetApiKeyResponse).apiKey).toBeDefined();

      // Create new client with reset API key to verify it works
      const newApiKey = (resetResponse as ResetApiKeyResponse).apiKey;
      const newClient = adminClient.createAgentClient(newApiKey);

      // 6. Verify new API key works for profile access
      const newProfileResponse = await newClient.getAgentProfile();
      expect(newProfileResponse.success).toBe(true);

      // 7. Competitions list (should be empty)
      const competitionsResponse = await newClient.getAgentCompetitions(
        agent.id,
        {},
      );
      expect(competitionsResponse.success).toBe(true);
      expect(
        (competitionsResponse as AgentCompetitionsResponse).competitions.length,
      ).toBe(0);

      // 8. Public agent profile access
      const publicProfileResponse = await newClient.getPublicAgent(agent.id);
      expect(publicProfileResponse.success).toBe(true);
      expect((publicProfileResponse as PublicAgentResponse).agent.id).toBe(
        agent.id,
      );
    });

    test("agent can access API after leaving active competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Leave Competition Test Agent",
        });

      // Create and start competition
      const compName = `Leave Competition Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: "Test competition for leave functionality",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      // Verify agent can access API while in active competition
      const profileResponse1 = await agentClient.getAgentProfile();
      expect(profileResponse1.success).toBe(true);

      // Agent leaves active competition
      await agentClient.leaveCompetition(competitionId, agent.id);

      // CRITICAL TEST: Agent should still be able to access API
      const profileResponse2 = await agentClient.getAgentProfile();
      expect(profileResponse2.success).toBe(true);

      // Agent should be able to update profile
      const updateResponse = await agentClient.updateAgentProfile({
        description: "Updated after leaving competition",
      });
      expect(updateResponse.success).toBe(true);
    });

    test("agent maintains API access after competition ends", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Competition End Agent",
        });

      // Create and start competition
      const compName = `Competition End Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: "Test competition for end functionality",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      // Verify agent can access API during competition
      const profileResponse1 = await agentClient.getAgentProfile();
      expect(profileResponse1.success).toBe(true);

      // End competition
      await adminClient.endCompetition(competitionId);

      // CRITICAL TEST: Agent should maintain API access after competition ends
      const profileResponse2 = await agentClient.getAgentProfile();
      expect(profileResponse2.success).toBe(true);

      // Agent should be able to perform other operations
      const balanceResponse = await agentClient.getBalance();
      expect(balanceResponse.success).toBe(true);
    });

    test("competition history is preserved when agent leaves", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "History Test Agent",
        });

      // Create and start competition
      const compName = `History Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: "Test competition for history preservation",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      // Execute a trade to create history
      await agentClient.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
        reason: "Trade before leaving",
      });

      // Agent leaves competition
      await agentClient.leaveCompetition(competitionId, agent.id);

      // CRITICAL TEST: Historical data should still be accessible
      const competitionsResponse = await agentClient.getAgentCompetitions(
        agent.id,
        {},
      );
      expect(competitionsResponse).toBeDefined();
      expect(competitionsResponse!.success).toBe(true);

      const leftCompetition = (
        competitionsResponse as AgentCompetitionsResponse
      ).competitions?.find((c: EnhancedCompetition) => c.id === competitionId);

      expect(leftCompetition).toBeDefined();
      expect(leftCompetition?.totalTrades).toBe(1);
      // Note: We'll need to add agent status field to competition response
      // expect(leftCompetition?.agentStatus).toBe("left");
    });
  });

  describe("Enhanced Agent Competitions Endpoint", () => {
    test("should return competitions with agent-specific metrics", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register multiple agents for competition
      const { client: agentClient1, agent: agent1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Test Agent 1",
        });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent 2",
      });

      // Create and start a competition
      const compName = `Enhanced Metrics Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: "Test competition for enhanced metrics",
      });
      expect(createCompResult.success).toBe(true);
      const createCompResponse = createCompResult as CreateCompetitionResponse;
      const competitionId = createCompResponse.competition.id;

      // Start the competition with both agents
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id],
      });

      // Execute some trades for agent1 to generate metrics
      await agentClient1.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
        reason: "Test trade 1",
      });

      await agentClient1.executeTrade({
        fromToken: config.specificChainTokens.eth.eth,
        toToken: config.specificChainTokens.eth.usdc,
        amount: "0.01",
        reason: "Test trade 2",
      });

      // Wait for portfolio snapshots to be created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get agent competitions with enhanced metrics
      const competitionsResponse = await agentClient1.getAgentCompetitions(
        agent1.id,
        {
          limit: 10,
          offset: 0,
        },
      );

      expect(competitionsResponse.success).toBe(true);
      const response = competitionsResponse as AgentCompetitionsResponse;
      expect(Array.isArray(response.competitions)).toBe(true);
      expect(response.competitions.length).toBeGreaterThan(0);

      // Find our test competition
      const testCompetition = response.competitions.find(
        (comp: EnhancedCompetition) => comp.id === competitionId,
      );
      expect(testCompetition).toBeDefined();

      // Verify enhanced metrics are present
      expect(testCompetition?.portfolioValue).toBeDefined();
      expect(typeof testCompetition?.portfolioValue).toBe("number");
      expect(testCompetition?.pnl).toBeDefined();
      expect(typeof testCompetition?.pnl).toBe("number");
      expect(testCompetition?.pnlPercent).toBeDefined();
      expect(typeof testCompetition?.pnlPercent).toBe("number");
      expect(testCompetition?.totalTrades).toBeDefined();
      expect(typeof testCompetition?.totalTrades).toBe("number");
      expect(testCompetition?.totalTrades).toBe(2); // We executed 2 trades
      expect(testCompetition?.bestPlacement).toBeDefined();
      expect(testCompetition?.bestPlacement?.rank).toBeDefined();
      expect(typeof testCompetition?.bestPlacement?.rank).toBe("number");
      expect(testCompetition?.bestPlacement?.totalAgents).toBeDefined();
      expect(typeof testCompetition?.bestPlacement?.totalAgents).toBe("number");
      expect(testCompetition?.bestPlacement?.totalAgents).toBe(2); // 2 agents in competition
    });

    test("should handle sorting by computed fields", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register an agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Sorting Test Agent",
        });

      // Create multiple competitions
      const comp1Name = `Competition A ${Date.now()}`;
      const comp2Name = `Competition B ${Date.now()}`;

      const createComp1Result = await adminClient.createCompetition({
        name: comp1Name,
        description: "First competition for sorting test",
      });
      expect(createComp1Result.success).toBe(true);
      const comp1Id = (createComp1Result as CreateCompetitionResponse)
        .competition.id;

      const createComp2Result = await adminClient.createCompetition({
        name: comp2Name,
        description: "Second competition for sorting test",
      });
      expect(createComp2Result.success).toBe(true);
      const comp2Id = (createComp2Result as CreateCompetitionResponse)
        .competition.id;

      // Start comp1 first (respecting single active competition constraint)
      await adminClient.startExistingCompetition({
        competitionId: comp1Id,
        agentIds: [agent.id],
      });

      // Execute different numbers of trades in each competition
      // Competition 1: 1 trade
      await agentClient.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
        reason: "Comp 1 trade",
      });

      // End comp1 and start comp2 (respecting single active competition constraint)
      await adminClient.endCompetition(comp1Id);
      await adminClient.startExistingCompetition({
        competitionId: comp2Id,
        agentIds: [agent.id],
      });
      await agentClient.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "50",
        reason: "Comp 2 trade 1",
      });
      await agentClient.executeTrade({
        fromToken: config.specificChainTokens.eth.eth,
        toToken: config.specificChainTokens.eth.usdc,
        amount: "0.01",
        reason: "Comp 2 trade 2",
      });
      await agentClient.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "75",
        reason: "Comp 2 trade 3",
      });

      // Wait for portfolio snapshots
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test sorting by totalTrades descending
      const sortedByTrades = await agentClient.getAgentCompetitions(agent.id, {
        limit: 10,
        offset: 0,
        sort: "-totalTrades",
      });

      expect(sortedByTrades.success).toBe(true);
      const tradesResponse = sortedByTrades as AgentCompetitionsResponse;
      expect(Array.isArray(tradesResponse.competitions)).toBe(true);

      // Find our test competitions
      const testComps = tradesResponse.competitions.filter(
        (comp: EnhancedCompetition) => [comp1Id, comp2Id].includes(comp.id),
      );
      expect(testComps.length).toBe(2);

      // Verify sorting: competition with more trades should come first
      const firstComp = testComps[0];
      const secondComp = testComps[1];

      // Assert that both competitions exist
      expect(firstComp).toBeDefined();
      expect(secondComp).toBeDefined();

      // For trading competitions, totalTrades should always be defined
      // We explicitly executed trades in both competitions above
      expect(firstComp?.totalTrades).toBeDefined();
      expect(secondComp?.totalTrades).toBeDefined();

      // Use type assertion after verifying they're defined
      expect(firstComp?.totalTrades as number).toBeGreaterThanOrEqual(
        secondComp?.totalTrades as number,
      );

      // Test sorting by portfolioValue ascending
      const sortedByPortfolio = await agentClient.getAgentCompetitions(
        agent.id,
        {
          limit: 10,
          offset: 0,
          sort: "portfolioValue",
        },
      );

      expect(sortedByPortfolio.success).toBe(true);
      const portfolioResponse = sortedByPortfolio as AgentCompetitionsResponse;
      expect(Array.isArray(portfolioResponse.competitions)).toBe(true);

      // Verify portfolio values are in ascending order
      for (let i = 0; i < portfolioResponse.competitions.length - 1; i++) {
        const currentComp = portfolioResponse.competitions[i];
        const nextComp = portfolioResponse.competitions[i + 1];
        if (currentComp && nextComp) {
          expect(currentComp.portfolioValue).toBeLessThanOrEqual(
            nextComp.portfolioValue,
          );
        }
      }
    });

    test("should sort competitions by bestPlacement with undefined ordering rules", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register two agents for ranking
      const { client: agentClient1, agent: agent1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "BestPlacement Agent 1",
        });

      const { client: agentClient2, agent: agent2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "BestPlacement Agent 2",
        });

      // Create three competitions: two ended with opposite performances, one pending (undefined rank)
      const comp1Name = `BP Comp 1 ${Date.now()}`; // agent1 should rank better
      const comp2Name = `BP Comp 2 ${Date.now()}`; // agent2 should rank better
      const comp3Name = `BP Comp 3 Pending ${Date.now()}`; // pending => undefined rank

      // Competition 1
      const createComp1Res = await adminClient.createCompetition({
        name: comp1Name,
        description: "BestPlacement sorting test - comp1",
      });
      expect(createComp1Res.success).toBe(true);
      const comp1Id = (createComp1Res as CreateCompetitionResponse).competition
        .id;
      await adminClient.startExistingCompetition({
        competitionId: comp1Id,
        agentIds: [agent1.id, agent2.id],
      });
      // Agent1 good performance, Agent2 poor
      await agentClient1.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
        reason: "agent1 good trade",
      });
      await agentClient2.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "100",
        reason: "agent2 bad trade",
      });
      await adminClient.endCompetition(comp1Id);

      // Competition 2
      const createComp2Res = await adminClient.createCompetition({
        name: comp2Name,
        description: "BestPlacement sorting test - comp2",
      });
      expect(createComp2Res.success).toBe(true);
      const comp2Id = (createComp2Res as CreateCompetitionResponse).competition
        .id;
      await adminClient.startExistingCompetition({
        competitionId: comp2Id,
        agentIds: [agent1.id, agent2.id],
      });
      // Agent2 good performance, Agent1 poor
      await agentClient2.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
        reason: "agent2 good trade",
      });
      await agentClient1.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "50",
        reason: "agent1 bad trade",
      });
      await adminClient.endCompetition(comp2Id);

      // Competition 3 (pending) with only agent1 joined => undefined rank
      const createComp3Res = await adminClient.createCompetition({
        name: comp3Name,
        description: "BestPlacement sorting test - pending",
      });
      expect(createComp3Res.success).toBe(true);
      const comp3Id = (createComp3Res as CreateCompetitionResponse).competition
        .id;
      await agentClient1.joinCompetition(comp3Id, agent1.id);

      // Give snapshotter a brief moment where applicable
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Ascending: expect comp1 (rank 1) first, then comp2 (rank 2), pending (undefined) last
      const ascRes = (await agentClient1.getAgentCompetitions(agent1.id, {
        sort: "bestPlacement",
        limit: 10,
        offset: 0,
      })) as AgentCompetitionsResponse;
      expect(ascRes.success).toBe(true);
      const ascIds = ascRes.competitions.map((c: EnhancedCompetition) => c.id);
      expect(ascIds).toEqual([comp1Id, comp2Id, comp3Id]);

      // Descending: pending (undefined) should be first, then worse rank first (2), then better (1)
      const descRes = (await agentClient1.getAgentCompetitions(agent1.id, {
        sort: "-bestPlacement",
        limit: 10,
        offset: 0,
      })) as AgentCompetitionsResponse;
      expect(descRes.success).toBe(true);
      const descIds = descRes.competitions.map(
        (c: EnhancedCompetition) => c.id,
      );
      expect(descIds).toEqual([comp3Id, comp2Id, comp1Id]);
    });

    test("should handle edge cases gracefully", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register an agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Edge Case Test Agent",
        });

      // Create a competition but don't execute any trades
      const compName = `No Trades Competition ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: "Competition with no trades for edge case testing",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      // Start the competition with just this agent
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      // Get competitions without any trades or portfolio snapshots
      const competitionsResponse = await agentClient.getAgentCompetitions(
        agent.id,
        {
          limit: 10,
          offset: 0,
        },
      );

      expect(competitionsResponse.success).toBe(true);
      const edgeResponse = competitionsResponse as AgentCompetitionsResponse;
      expect(Array.isArray(edgeResponse.competitions)).toBe(true);

      // Find our test competition
      const testCompetition = edgeResponse.competitions.find(
        (comp: EnhancedCompetition) => comp.id === competitionId,
      );
      expect(testCompetition).toBeDefined();

      // Verify default values for edge cases
      expect(testCompetition?.portfolioValue).toBeGreaterThan(0); // Agents start with initial balances
      expect(testCompetition?.pnl).toBe(0); // No trades = 0 P&L
      expect(testCompetition?.pnlPercent).toBe(0); // No trades = 0% P&L
      expect(testCompetition?.totalTrades).toBe(0); // No trades = 0
      expect(testCompetition?.bestPlacement).toBeDefined();
      expect(testCompetition?.bestPlacement?.rank).toBeGreaterThan(0); // Should have a rank
      expect(testCompetition?.bestPlacement?.totalAgents).toBe(1); // Only 1 agent
    });

    test("should handle invalid sort fields gracefully", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register an agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Invalid Sort Test Agent",
        });

      // Test with invalid sort field - should not crash
      const invalidSortResponse = await agentClient.getAgentCompetitions(
        agent.id,
        {
          limit: 10,
          offset: 0,
          sort: "invalidField",
        },
      );

      expect(invalidSortResponse.success).toBe(true);
      const invalidResponse = invalidSortResponse as AgentCompetitionsResponse;
      expect(Array.isArray(invalidResponse.competitions)).toBe(true);

      // Test with empty sort field
      const emptySortResponse = await agentClient.getAgentCompetitions(
        agent.id,
        {
          limit: 10,
          offset: 0,
          sort: "",
        },
      );

      expect(emptySortResponse.success).toBe(true);
      const emptyResponse = emptySortResponse as AgentCompetitionsResponse;
      expect(Array.isArray(emptyResponse.competitions)).toBe(true);
    });

    test("should maintain backward compatibility with existing sorting", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register an agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Backward Compatibility Test Agent",
        });

      // Test existing database field sorting still works
      const sortByNameResponse = await agentClient.getAgentCompetitions(
        agent.id,
        {
          limit: 10,
          offset: 0,
          sort: "name",
        },
      );

      expect(sortByNameResponse.success).toBe(true);
      const nameResponse = sortByNameResponse as AgentCompetitionsResponse;
      expect(Array.isArray(nameResponse.competitions)).toBe(true);

      // Test sorting by createdAt
      const sortByDateResponse = await agentClient.getAgentCompetitions(
        agent.id,
        {
          limit: 10,
          offset: 0,
          sort: "-createdAt",
        },
      );

      expect(sortByDateResponse.success).toBe(true);
      const dateResponse = sortByDateResponse as AgentCompetitionsResponse;
      expect(Array.isArray(dateResponse.competitions)).toBe(true);
    });
  });

  describe("Multi-Agent Ranking and Cross-Competition Tests", () => {
    test("should calculate multi-agent rankings accurately with different performance levels", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register 4 agents for comprehensive ranking test
      const agents: Array<{ id: string }> = [];
      const agentClients: ApiClient[] = [];

      for (let i = 1; i <= 4; i++) {
        const { client, agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Ranking Test Agent ${i}`,
        });
        agents.push(agent);
        agentClients.push(client);
      }

      // Create a competition with all 4 agents
      const compName = `Multi-Agent Ranking Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description: "Competition for testing multi-agent ranking accuracy",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      // Start competition with all agents
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: agents.map((agent) => agent.id),
      });

      // Execute different trading strategies to create distinct performance levels
      // Agent 1: Top performer (keeps valuable assets - ETH)
      for (let i = 0; i < 3; i++) {
        await agentClients[0]?.executeTrade({
          fromToken: config.specificChainTokens.eth.usdc,
          toToken: config.specificChainTokens.eth.eth, // ETH - valuable
          amount: "100",
          reason: `Agent 1 smart trade ${i + 1} - buying ETH`,
        });
      }

      // Agent 2: Medium performer (mixed strategy - some good, some bad trades)
      await agentClients[1]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth, // ETH - good trade
        amount: "100",
        reason: "Agent 2 good trade - buying ETH",
      });
      await agentClients[1]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address - bad trade
        amount: "50",
        reason: "Agent 2 bad trade - burning tokens",
      });

      // Agent 3: Poor performer (burns most tokens)
      await agentClients[2]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address - terrible trade
        amount: "200",
        reason: "Agent 3 terrible trade - burning large amount",
      });

      // Agent 4: Worst performer (burns everything)
      await agentClients[3]?.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address - catastrophic trade
        amount: "500",
        reason: "Agent 4 catastrophic trade - burning everything",
      });

      // Trigger portfolio snapshots proactively
      const services = new ServiceRegistry();
      await services.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );

      // Check rankings for each agent
      const rankingResults = [];
      for (let i = 0; i < 4; i++) {
        const competitionsResponse = await agentClients[
          i
        ]?.getAgentCompetitions(agents[i]!.id, {
          limit: 10,
          offset: 0,
        });

        expect(competitionsResponse).toBeDefined();
        expect(competitionsResponse!.success).toBe(true);
        const response = competitionsResponse as AgentCompetitionsResponse;

        const testCompetition = response.competitions.find(
          (comp: EnhancedCompetition) => comp.id === competitionId,
        );
        expect(testCompetition).toBeDefined();

        if (testCompetition) {
          rankingResults.push({
            agentIndex: i + 1,
            agentId: agents[i]?.id,
            rank: testCompetition.bestPlacement?.rank,
            totalAgents: testCompetition.bestPlacement?.totalAgents,
            totalTrades: testCompetition.totalTrades,
            portfolioValue: testCompetition.portfolioValue,
            pnl: testCompetition.pnl,
          });
        }
      }

      // Verify ranking logic
      expect(rankingResults.length).toBe(4);

      // All agents should see the same total agent count
      rankingResults.forEach((result) => {
        expect(result.totalAgents).toBe(4);
      });

      // Verify trade counts match expected strategies
      const agent1Result = rankingResults.find((r) => r.agentIndex === 1);
      const agent2Result = rankingResults.find((r) => r.agentIndex === 2);
      const agent3Result = rankingResults.find((r) => r.agentIndex === 3);
      const agent4Result = rankingResults.find((r) => r.agentIndex === 4);

      expect(agent1Result).toBeDefined();
      expect(agent2Result).toBeDefined();
      expect(agent3Result).toBeDefined();
      expect(agent4Result).toBeDefined();

      expect(agent1Result?.totalTrades).toBe(3); // Top performer
      expect(agent2Result?.totalTrades).toBe(2); // Medium performer
      expect(agent3Result?.totalTrades).toBe(1); // Poor performer
      expect(agent4Result?.totalTrades).toBe(1); // Worst performer

      // Verify performance-based ranking: agents who kept valuable assets should rank better
      // Agent 1 (bought ETH) should have better portfolio value than agents who burned tokens
      expect(agent1Result?.portfolioValue).toBeGreaterThan(
        agent3Result!.portfolioValue,
      );
      expect(agent1Result?.portfolioValue).toBeGreaterThan(
        agent4Result!.portfolioValue,
      );

      // Agent 2 (mixed strategy) should perform better than pure burn agents
      expect(agent2Result?.portfolioValue).toBeGreaterThan(
        agent3Result!.portfolioValue,
      );
      expect(agent2Result?.portfolioValue).toBeGreaterThan(
        agent4Result!.portfolioValue,
      );

      // All ranks should be valid (1-4) and unique
      const ranks = rankingResults
        .map((r) => r.rank)
        .filter((rank): rank is number => rank !== undefined);
      expect(ranks.every((rank) => rank >= 1 && rank <= 4)).toBe(true);
      expect(new Set(ranks).size).toBe(4); // All ranks should be unique
    });

    test("should handle cross-competition metrics correctly (2 ended + 1 active)", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register 2 agents for cross-competition testing
      const { client: agentClient1, agent: agent1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Cross-Competition Agent 1",
        });

      const { client: agentClient2, agent: agent2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Cross-Competition Agent 2",
        });

      // Create and run 3 competitions sequentially (2 to end, 1 to keep active)
      // This respects the single active competition constraint while reducing API calls
      const competitions: string[] = [];

      for (let i = 1; i <= 3; i++) {
        const compName = `Cross-Competition Test ${i} ${Date.now()}`;
        const createCompResult = await adminClient.createCompetition({
          name: compName,
          description: `Competition ${i} for cross-competition testing`,
        });
        expect(createCompResult.success).toBe(true);
        const competitionId = (createCompResult as CreateCompetitionResponse)
          .competition.id;
        competitions.push(competitionId);

        // Start this competition with both agents
        await adminClient.startExistingCompetition({
          competitionId,
          agentIds: [agent1.id, agent2.id],
        });

        // Execute trades in this competition with different patterns
        // Agent 1: Escalating strategy (1, 2, 3 trades respectively)
        for (let j = 0; j < i; j++) {
          await agentClient1.executeTrade({
            fromToken: config.specificChainTokens.eth.usdc,
            toToken: config.specificChainTokens.eth.eth, // ETH
            amount: "100",
            reason: `Agent 1 trade ${j + 1} in competition ${i}`,
          });
        }

        // Agent 2: Alternating strategy (good/bad competitions)
        if ((i - 1) % 2 === 0) {
          // Even competitions: good trades (buy ETH)
          for (let j = 0; j < 2; j++) {
            await agentClient2.executeTrade({
              fromToken: config.specificChainTokens.eth.usdc,
              toToken: config.specificChainTokens.eth.eth, // ETH
              amount: "50",
              reason: `Agent 2 good trade ${j + 1} in competition ${i}`,
            });
          }
        } else {
          // Odd competitions: bad trades (burn tokens)
          await agentClient2.executeTrade({
            fromToken: config.specificChainTokens.eth.usdc,
            toToken: "0x000000000000000000000000000000000000dead", // Burn
            amount: "100",
            reason: `Agent 2 bad trade in competition ${i}`,
          });
        }

        // End this competition if it's not the last one (keep the 3rd active)
        if (i < 3) {
          await adminClient.endCompetition(competitionId);
        }
      }

      // Wait for portfolio snapshots
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get competitions for agent 1
      const agent1Competitions = await agentClient1.getAgentCompetitions(
        agent1.id,
        {
          limit: 10,
          offset: 0,
          sort: "-totalTrades",
        },
      );

      expect(agent1Competitions.success).toBe(true);
      const agent1Response = agent1Competitions as AgentCompetitionsResponse;

      // Filter to our test competitions
      const agent1TestComps = agent1Response.competitions.filter(
        (comp: EnhancedCompetition) => competitions.includes(comp.id),
      );
      expect(agent1TestComps.length).toBe(3);

      // Get competitions for agent 2
      const agent2Competitions = await agentClient2.getAgentCompetitions(
        agent2.id,
        {
          limit: 10,
          offset: 0,
          sort: "-totalTrades",
        },
      );

      expect(agent2Competitions.success).toBe(true);
      const agent2Response = agent2Competitions as AgentCompetitionsResponse;

      // Filter to our test competitions
      const agent2TestComps = agent2Response.competitions.filter(
        (comp: EnhancedCompetition) => competitions.includes(comp.id),
      );
      expect(agent2TestComps.length).toBe(3);

      // Verify agent 1's escalating trade pattern (1, 2, 3 trades respectively)
      const agent1CompsSorted = agent1TestComps.sort(
        (a, b) => competitions.indexOf(a.id) - competitions.indexOf(b.id),
      );

      for (let i = 0; i < agent1CompsSorted.length; i++) {
        expect(agent1CompsSorted[i]?.totalTrades).toBe(i + 1);
        expect(agent1CompsSorted[i]?.bestPlacement?.totalAgents).toBe(2);
      }

      // Verify agent 2's alternating pattern (2, 1, 2 trades respectively)
      const agent2CompsSorted = agent2TestComps.sort(
        (a, b) => competitions.indexOf(a.id) - competitions.indexOf(b.id),
      );

      for (let i = 0; i < agent2CompsSorted.length; i++) {
        const expectedTrades = i % 2 === 0 ? 2 : 1; // Even: 2 trades, Odd: 1 trade
        expect(agent2CompsSorted[i]?.totalTrades).toBe(expectedTrades);
        expect(agent2CompsSorted[i]?.bestPlacement?.totalAgents).toBe(2);
      }

      // Verify that metrics are competition-specific, not aggregated
      const comp1Agent1 = agent1TestComps.find(
        (comp) => comp.id === competitions[0],
      );
      const comp3Agent1 = agent1TestComps.find(
        (comp) => comp.id === competitions[2],
      );

      expect(comp1Agent1).toBeDefined();
      expect(comp3Agent1).toBeDefined();

      expect(comp1Agent1?.totalTrades).toBe(1);
      expect(comp3Agent1?.totalTrades).toBe(3);

      // Portfolio values should be independent per competition
      expect(comp1Agent1?.portfolioValue).toBeDefined();
      expect(comp3Agent1?.portfolioValue).toBeDefined();

      // Rankings should be calculated per competition
      expect(comp1Agent1?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
      expect(comp1Agent1?.bestPlacement?.rank).toBeLessThanOrEqual(2);
      expect(comp3Agent1?.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
      expect(comp3Agent1?.bestPlacement?.rank).toBeLessThanOrEqual(2);

      // Verify competition status affects metrics calculation
      const endedComps = agent1TestComps.filter((comp) =>
        competitions.slice(0, 2).includes(comp.id),
      );
      const activeComps = agent1TestComps.filter((comp) =>
        competitions.slice(2).includes(comp.id),
      );

      expect(endedComps.length).toBe(2);
      expect(activeComps.length).toBe(1);

      // All competitions should have valid metrics regardless of status
      [...endedComps, ...activeComps].forEach((comp) => {
        expect(comp.portfolioValue).toBeDefined();
        expect(comp.pnl).toBeDefined();
        expect(comp.pnlPercent).toBeDefined();
        expect(comp.totalTrades).toBeDefined();
        expect(comp.bestPlacement).toBeDefined();
        expect(comp.bestPlacement?.rank).toBeGreaterThanOrEqual(1);
        expect(comp.bestPlacement?.totalAgents).toBe(2);
      });

      // Verify agent 2's performance varies by strategy
      // Even competitions (good trades) should have better portfolio values than odd ones (burn trades)
      const agent2EvenComps = agent2CompsSorted.filter((_, i) => i % 2 === 0);
      const agent2OddComps = agent2CompsSorted.filter((_, i) => i % 2 === 1);

      // Even competitions should generally have better portfolio values
      agent2EvenComps.forEach((evenComp) => {
        if (evenComp) {
          agent2OddComps.forEach((oddComp) => {
            if (oddComp) {
              expect(evenComp.portfolioValue).toBeGreaterThanOrEqual(
                oddComp.portfolioValue,
              );
            }
          });
        }
      });

      // Verify cross-competition metrics were calculated correctly
      // Both agents should have metrics from all 3 competitions
    });

    test("should only include active agents in ranking calculations", async () => {
      const adminClient = createTestClient();
      const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
      expect(adminLoginSuccess).toBe(true);

      // Register 3 agents for testing active/withdrawn agent ranking behavior
      const { client: agentClient1, agent: agent1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Active Agent 1",
        });

      const { client: agentClient2, agent: agent2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Active Agent 2",
        });

      const { client: agentClient3, agent: agent3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Disqualified Agent 3",
        });

      // Create a competition with all 3 agents
      const compName = `Active-Disqualified Ranking Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: compName,
        description:
          "Competition for testing active vs disqualified agent ranking behavior",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      // Start competition with all agents
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id, agent3.id],
      });

      // Execute trades to create different performance levels
      // Agent 1: Good performance (buys ETH)
      await agentClient1.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "1",
        reason: "Agent 1 good trade",
      });

      // Agent 2: Medium performance (mixed strategy)
      await agentClient2.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "50",
        reason: "Agent 2 medium trade",
      });

      // Agent 3: Poor performance (burns tokens)
      await agentClient3.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "200",
        reason: "Agent 3 bad trade",
      });

      // Trigger portfolio snapshots
      const services = new ServiceRegistry();
      await services.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );

      // Get initial rankings with all agents active
      const initialRankings = [];
      const agentPairs = [
        { client: agentClient1, agent: agent1 },
        { client: agentClient2, agent: agent2 },
        { client: agentClient3, agent: agent3 },
      ];

      for (const { client, agent } of agentPairs) {
        const competitionsResponse = await client.getAgentCompetitions(
          agent.id,
          {
            limit: 10,
            offset: 0,
          },
        );

        expect(competitionsResponse.success).toBe(true);
        const response = competitionsResponse as AgentCompetitionsResponse;

        const testCompetition = response.competitions.find(
          (comp: EnhancedCompetition) => comp.id === competitionId,
        );
        expect(testCompetition).toBeDefined();

        if (testCompetition) {
          initialRankings.push({
            agentId: agent.id,
            agentName: agent.name,
            rank: testCompetition.bestPlacement?.rank,
            totalAgents: testCompetition.bestPlacement?.totalAgents,
            portfolioValue: testCompetition.portfolioValue,
          });
        }
      }

      // Verify initial state: all 3 agents should be ranked
      expect(initialRankings.length).toBe(3);
      initialRankings.forEach((result) => {
        expect(result.totalAgents).toBe(3);
        expect(result.rank).toBeGreaterThanOrEqual(1);
        expect(result.rank).toBeLessThanOrEqual(3);
      });

      // Disqualify agent 3 from the competition (this updates competition_agents table status)
      await adminClient.removeAgentFromCompetition(
        competitionId,
        agent3.id,
        "Agent disqualified for ranking test",
      );

      // Wait a bit for the disqualification to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Trigger portfolio snapshots again to ensure data is updated
      await services.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );

      // Wait a bit more for snapshots to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get rankings after disqualifying agent 3
      const finalRankings = [];
      for (const { client, agent } of agentPairs) {
        const competitionsResponse = await client.getAgentCompetitions(
          agent.id,
          {
            limit: 10,
            offset: 0,
          },
        );

        expect(competitionsResponse.success).toBe(true);
        const response = competitionsResponse as AgentCompetitionsResponse;

        const testCompetition = response.competitions.find(
          (comp: EnhancedCompetition) => comp.id === competitionId,
        );
        expect(testCompetition).toBeDefined();

        if (testCompetition) {
          finalRankings.push({
            agentId: agent.id,
            agentName: agent.name,
            rank: testCompetition.bestPlacement?.rank,
            totalAgents: testCompetition.bestPlacement?.totalAgents,
            portfolioValue: testCompetition.portfolioValue,
          });
        }
      }

      // Verify the fix: only active agents should be included in ranking calculations
      // Active agents (1 and 2) should now see only 2 total agents
      const activeAgent1Result = finalRankings.find(
        (r) => r.agentId === agent1.id,
      );
      const activeAgent2Result = finalRankings.find(
        (r) => r.agentId === agent2.id,
      );
      const disqualifiedAgent3Result = finalRankings.find(
        (r) => r.agentId === agent3.id,
      );

      expect(activeAgent1Result).toBeDefined();
      expect(activeAgent2Result).toBeDefined();
      expect(disqualifiedAgent3Result).toBeDefined();

      // Active agents should see only 2 total agents (excluding disqualified agent 3)
      expect(activeAgent1Result?.totalAgents).toBe(2);
      expect(activeAgent2Result?.totalAgents).toBe(2);

      // Disqualified agent should not have a rank (undefined) since it's not included in calculations
      expect(disqualifiedAgent3Result?.rank).toBeUndefined();
      expect(disqualifiedAgent3Result?.totalAgents).toBeUndefined();

      // Active agents should have valid ranks (1 or 2)
      expect(activeAgent1Result?.rank).toBeGreaterThanOrEqual(1);
      expect(activeAgent1Result?.rank).toBeLessThanOrEqual(2);
      expect(activeAgent2Result?.rank).toBeGreaterThanOrEqual(1);
      expect(activeAgent2Result?.rank).toBeLessThanOrEqual(2);

      // Verify that the ranking logic is consistent between leaderboard and agent table
      // Both should only consider active agents in their calculations
      // This test specifically verifies the fix for app-194 where agent table rankings
      // now match leaderboard rankings by excluding disqualified agents
    });
  });

  describe("Agent handles", () => {
    test("should reject duplicate handles or invalid format", async () => {
      // Create a Privy-authenticated client
      const { client: siweClient } = await createPrivyAuthenticatedClient({
        userName: "Handle Test User",
        userEmail: "handle-test@example.com",
      });

      // Test 1: Custom handle
      const response1 = await siweClient.request<AgentProfileResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Another Agent",
          handle: "custom_handle",
          description: "Test agent with custom handle",
        },
      );

      expect(response1.success).toBe(true);
      expect((response1 as AgentProfileResponse).agent.name).toBe(
        "Another Agent",
      );
      expect((response1 as AgentProfileResponse).agent.handle).toBe(
        "custom_handle",
      );

      // Test 2: Duplicate handle rejection
      const response2 = await siweClient.request<ErrorResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Third Agent",
          handle: "custom_handle", // Same as agent 2
          description: "Should fail with duplicate handle",
        },
      );

      expect(response2.success).toBe(false);
      expect(response2.error).toContain(
        "An agent with handle 'custom_handle' already exists",
      );
      expect(response2.status).toBe(409);

      // Test 3: Handle with special characters
      const response3 = await siweClient.request<AgentProfileResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Agent@123!",
          handle: "agent@123!",
          description: "Test handle generation from special chars",
        },
      );

      expect(response3.success).toBe(false);
      expect((response3 as ErrorResponse).error).toContain(
        "Handle can only contain lowercase letters, numbers, and underscores",
      );
      expect((response3 as ErrorResponse).status).toBe(400);

      // Test 4: Invalid handle format (uppercase)
      const response4 = await siweClient.request<ErrorResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Test Agent",
          handle: "UPPERCASE_HANDLE", // Should fail - must be lowercase
          description: "Should fail with invalid handle format",
        },
      );

      expect(response4.success).toBe(false);
      expect((response4 as ErrorResponse).error).toContain(
        "Handle can only contain lowercase letters, numbers, and underscores",
      );

      // Test 5: Invalid handle format (too long)
      const response5 = await siweClient.request<ErrorResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Test Agent",
          handle: "a".repeat(16), // Should fail - too long
          description: "Should fail with invalid handle format",
        },
      );

      expect(response5.success).toBe(false);
      expect((response5 as ErrorResponse).error).toContain(
        "Handle must be at most 15 characters",
      );
      expect(response5.status).toBe(400);

      // Test 6: Invalid handle format (too short)
      const response6 = await siweClient.request<ErrorResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Test Agent",
          handle: "a", // Should fail - too short
          description: "Should fail with invalid handle format",
        },
      );

      expect(response6.success).toBe(false);
      expect((response6 as ErrorResponse).error).toContain(
        "Handle must be at least 3 characters",
      );
      expect(response6.status).toBe(400);
    });

    test("should update agent handle", async () => {
      // Create a Privy-authenticated client
      const { client: siweClient } = await createPrivyAuthenticatedClient({
        userName: "Handle Update Test User",
        userEmail: "handle-update@example.com",
      });

      // Create an agent
      const createResponse = await siweClient.request<AgentProfileResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Update Test Agent",
          handle: "original_handle",
          description: "Test agent for handle updates",
        },
      );

      expect(createResponse.success).toBe(true);
      let agentId = "";
      agentId = (createResponse as AgentProfileResponse).agent.id;

      // Update the handle
      const updateResponse = await siweClient.updateUserAgentProfile(agentId, {
        handle: "updated_handle",
      });

      expect(updateResponse.success).toBe(true);
      if (updateResponse.success) {
        expect((updateResponse as AgentProfileResponse).agent.handle).toBe(
          "updated_handle",
        );
      }

      // Create another agent
      const createResponse2 = await siweClient.request<AgentProfileResponse>(
        "post",
        "/api/user/agents",
        {
          name: "Second Update Test Agent",
          handle: "second_handle",
          description: "Second test agent",
        },
      );

      expect(createResponse2.success).toBe(true);
      let agent2Id = "";
      agent2Id = (createResponse2 as AgentProfileResponse).agent.id;

      // Try to update agent2's handle to agent1's handle (should fail)
      const updateResponse2 = await siweClient.updateUserAgentProfile(
        agent2Id,
        {
          handle: "updated_handle", // Same as agent 1
        },
      );

      expect(updateResponse2.success).toBe(false);
      expect((updateResponse2 as ErrorResponse).error).toContain(
        "An agent with handle 'updated_handle' already exists",
      );
      expect((updateResponse2 as ErrorResponse).status).toBe(409);
    });
  });

  test("should properly parse handles with zod schema", async () => {
    // Test generateHandleFromName
    const nameTests = [
      "John Doe",
      "Agent@123!",
      "My Cool Agent",
      "_underscore",
      "___triple",
      "A",
      "AB",
      "Special!@#$%Characters",
      "   Spaces   ",
      "Very Long Name That Exceeds Maximum",
    ];

    nameTests.forEach((name) => {
      const handle = generateHandleFromName(name);
      const isValid = isValidHandle(handle);
      expect(isValid).toBe(true);
    });

    // Test isValidHandle
    const handleTests = [
      { handle: "valid_handle", expected: true },
      { handle: "_underscore", expected: true },
      { handle: "__double", expected: true },
      { handle: "123numeric", expected: true },
      { handle: "abc", expected: true },
      { handle: "ab", expected: false }, // too short
      { handle: "a", expected: false }, // too short
      { handle: "verylonghandlethatexceeds", expected: false }, // too long
      { handle: "UPPERCASE", expected: false },
      { handle: "with-dash", expected: false },
      { handle: "with space", expected: false },
      { handle: "", expected: false },
      { handle: "___", expected: true },
    ];

    handleTests.forEach(({ handle, expected }) => {
      const isValid = isValidHandle(handle);
      expect(isValid).toBe(expected);
    });
  });
});
