import { beforeEach, describe, expect, test } from "vitest";

import { specificChainTokens } from "@recallnet/services/lib";
import {
  AgentProfileResponse,
  AgentTrophy,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CreateCompetitionResponse,
  ErrorResponse,
  StartCompetitionResponse,
  UserAgentApiKeyResponse,
} from "@recallnet/test-utils";
import {
  createPrivyAuthenticatedClient,
  createTestAgent,
  createTestClient,
  getAdminApiKey,
  looseTradingConstraints,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";
import { wait } from "@recallnet/test-utils";

describe("Competition API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  describe("Trophy Logic", () => {
    test("should populate trophies with correct ranking based on predictable trading outcomes", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register 4 users and agents for different ranking scenarios
      const { client: agent1Client, agent: agent1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Gold Trophy Agent",
          agentDescription: "Agent designed to win 1st place",
        });

      const { client: agent2Client, agent: agent2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Silver Trophy Agent",
          agentDescription: "Agent designed to get 2nd place",
        });

      const { client: agent3Client, agent: agent3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Bronze Trophy Agent",
          agentDescription: "Agent designed to get 3rd place",
        });

      const { client: agent4Client, agent: agent4 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Participation Trophy Agent",
          agentDescription: "Agent designed to get last place",
        });

      // Create and start competition
      const competitionName = `Trophy Ranking Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: competitionName,
        description: "Competition for testing trophy ranking logic",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id, agent3.id, agent4.id],
      });

      // Execute predictable trading strategies to force rankings

      // Agent 1: Best performer - buy valuable ETH
      for (let i = 0; i < 3; i++) {
        await agent1Client.executeTrade({
          fromToken: specificChainTokens.eth.usdc,
          toToken: specificChainTokens.eth.eth, // ETH - valuable asset
          amount: "100",
          competitionId,
          reason: `Agent 1 winning trade ${i + 1} - buying ETH`,
        });
      }

      // Agent 2: Second best - mixed strategy (some good, some bad)
      await agent2Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: specificChainTokens.eth.eth, // Good trade
        amount: "100",
        competitionId,
        reason: "Agent 2 good trade - buying ETH",
      });
      await agent2Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Bad trade - burn tokens
        amount: "50",
        competitionId,
        reason: "Agent 2 mediocre trade - burning some tokens",
      });

      // Agent 3: Third place - burn moderate amount
      await agent3Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "200",
        competitionId,
        reason: "Agent 3 poor trade - burning tokens for 3rd place",
      });

      // Agent 4: Last place - burn most tokens
      await agent4Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "500",
        competitionId,
        reason: "Agent 4 terrible trade - burning most tokens for last place",
      });

      // Wait for portfolio snapshots to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // End the competition to trigger trophy creation
      const endResponse = await adminClient.endCompetition(competitionId);
      expect(endResponse.success).toBe(true);

      // Wait for leaderboard processing and trophy creation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify each agent gets the correct trophy using /api/agents/{agentId} endpoint

      // Agent 1: Should get 1st place trophy (rank 1)
      const agent1Response = await adminClient.getPublicAgent(agent1.id);
      expect(agent1Response.success).toBe(true);
      if (!agent1Response.success)
        throw new Error("Failed to get agent1 profile");

      const agent1Trophies = agent1Response.agent.trophies;
      expect(Array.isArray(agent1Trophies)).toBe(true);
      expect(agent1Trophies?.length).toBeGreaterThan(0);

      const agent1Trophy = agent1Trophies?.find(
        (t: AgentTrophy) => t.competitionId === competitionId,
      );
      expect(agent1Trophy).toBeDefined();
      expect(agent1Trophy?.name).toBe(competitionName);
      expect(agent1Trophy?.rank).toBe(1); // Gold trophy
      expect(agent1Trophy?.createdAt).toBeDefined();
      expect(typeof agent1Trophy?.imageUrl === "string").toBe(true);

      // Agent 2: Should get 2nd place trophy (rank 2)
      const agent2Response = await adminClient.getPublicAgent(agent2.id);
      expect(agent2Response.success).toBe(true);
      if (!agent2Response.success)
        throw new Error("Failed to get agent2 profile");

      const agent2Trophies = agent2Response.agent.trophies;
      expect(Array.isArray(agent2Trophies)).toBe(true);
      expect(agent2Trophies?.length).toBeGreaterThan(0);

      const agent2Trophy = agent2Trophies?.find(
        (t: AgentTrophy) => t.competitionId === competitionId,
      );
      expect(agent2Trophy).toBeDefined();
      expect(agent2Trophy?.name).toBe(competitionName);
      expect(agent2Trophy?.rank).toBe(2); // Silver trophy
      expect(agent2Trophy?.createdAt).toBeDefined();
      expect(typeof agent2Trophy?.imageUrl === "string").toBe(true);

      // Agent 3: Should get 3rd place trophy (rank 3)
      const agent3Response = await adminClient.getPublicAgent(agent3.id);
      expect(agent3Response.success).toBe(true);
      if (!agent3Response.success)
        throw new Error("Failed to get agent3 profile");

      const agent3Trophies = agent3Response.agent.trophies;
      expect(Array.isArray(agent3Trophies)).toBe(true);
      expect(agent3Trophies?.length).toBeGreaterThan(0);

      const agent3Trophy = agent3Trophies?.find(
        (t: AgentTrophy) => t.competitionId === competitionId,
      );
      expect(agent3Trophy).toBeDefined();
      expect(agent3Trophy?.name).toBe(competitionName);
      expect(agent3Trophy?.rank).toBe(3); // Bronze trophy
      expect(agent3Trophy?.createdAt).toBeDefined();
      expect(typeof agent3Trophy?.imageUrl === "string").toBe(true);

      // Agent 4: Should get 4th place trophy (rank 4 - participation)
      const agent4Response = await adminClient.getPublicAgent(agent4.id);
      expect(agent4Response.success).toBe(true);
      if (!agent4Response.success)
        throw new Error("Failed to get agent4 profile");

      const agent4Trophies = agent4Response.agent.trophies;
      expect(Array.isArray(agent4Trophies)).toBe(true);
      expect(agent4Trophies?.length).toBeGreaterThan(0);

      const agent4Trophy = agent4Trophies?.find(
        (t: AgentTrophy) => t.competitionId === competitionId,
      );
      expect(agent4Trophy).toBeDefined();
      expect(agent4Trophy?.name).toBe(competitionName);
      expect(agent4Trophy?.rank).toBe(4); // Participation trophy
      expect(agent4Trophy?.createdAt).toBeDefined();
      expect(typeof agent4Trophy?.imageUrl === "string").toBe(true);
    });

    test("should populate trophies correctly via user-specific endpoints (Privy)", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create Privy authenticated user with agents
      const { client: user1Client } = await createPrivyAuthenticatedClient({
        userName: "Trophy User 1",
        userEmail: "trophy-user-1@example.com",
      });

      const { client: user2Client } = await createPrivyAuthenticatedClient({
        userName: "Trophy User 2",
        userEmail: "trophy-user-2@example.com",
      });

      // Create agents for each user
      const agent1Response = await createTestAgent(
        user1Client,
        "User 1 Gold Agent",
        "Agent designed to win 1st place for User 1",
      );
      expect(agent1Response.success).toBe(true);
      const agent1 = (agent1Response as AgentProfileResponse).agent;

      const agent2Response = await createTestAgent(
        user2Client,
        "User 2 Silver Agent",
        "Agent designed to get 2nd place for User 2",
      );
      expect(agent2Response.success).toBe(true);
      const agent2 = (agent2Response as AgentProfileResponse).agent;

      // Create and start competition
      const competitionName = `User Trophy Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition({
        name: competitionName,
        description: "Competition for testing user trophy endpoints",
      });
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id],
      });

      // Execute predictable trading strategies
      // User 1 Agent: Best performer - buy valuable ETH
      const agent1ApiKeyResponse = await user1Client.getUserAgentApiKey(
        agent1.id,
      );
      expect(agent1ApiKeyResponse.success).toBe(true);
      const agent1Client = adminClient.createAgentClient(
        (agent1ApiKeyResponse as UserAgentApiKeyResponse).apiKey,
      );
      await agent1Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: specificChainTokens.eth.eth, // ETH - valuable asset
        amount: "200",
        competitionId,
        reason: "User 1 winning trade - buying ETH",
      });

      // User 2 Agent: Poor performer - burn tokens
      const agent2ApiKeyResponse = await user2Client.getUserAgentApiKey(
        agent2.id,
      );
      expect(agent2ApiKeyResponse.success).toBe(true);
      const agent2Client = adminClient.createAgentClient(
        (agent2ApiKeyResponse as UserAgentApiKeyResponse).apiKey,
      );
      await agent2Client.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "300",
        competitionId,
        reason: "User 2 poor trade - burning tokens for 2nd place",
      });

      // Wait for portfolio snapshots to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // End the competition to trigger trophy creation
      const endResponse = await adminClient.endCompetition(competitionId);
      expect(endResponse.success).toBe(true);

      // Wait for leaderboard processing and trophy creation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test 1: getUserAgents() should return trophies
      const user1AgentsResponse = await user1Client.getUserAgents();
      expect(user1AgentsResponse.success).toBe(true);
      if (!user1AgentsResponse.success)
        throw new Error("Failed to get user1 agents");

      const user1Agents = user1AgentsResponse.agents;
      expect(user1Agents.length).toBeGreaterThan(0);

      const user1Agent = user1Agents.find((a) => a.id === agent1.id);
      expect(user1Agent).toBeDefined();
      expect(Array.isArray(user1Agent?.trophies)).toBe(true);
      expect(user1Agent?.trophies?.length).toBeGreaterThan(0);

      const user1Trophy = user1Agent?.trophies?.find(
        (t) => t.competitionId === competitionId,
      );
      expect(user1Trophy).toBeDefined();
      expect(user1Trophy?.name).toBe(competitionName);
      expect(user1Trophy?.rank).toBe(1); // Gold trophy
      expect(user1Trophy?.createdAt).toBeDefined();
      expect(typeof user1Trophy?.imageUrl === "string").toBe(true);

      const user2AgentsResponse = await user2Client.getUserAgents();
      expect(user2AgentsResponse.success).toBe(true);
      if (!user2AgentsResponse.success)
        throw new Error("Failed to get user2 agents");

      const user2Agents = user2AgentsResponse.agents;
      const user2Agent = user2Agents.find((a) => a.id === agent2.id);
      expect(user2Agent).toBeDefined();
      expect(Array.isArray(user2Agent?.trophies)).toBe(true);
      expect(user2Agent?.trophies?.length).toBeGreaterThan(0);

      const user2Trophy = user2Agent?.trophies?.find(
        (t) => t.competitionId === competitionId,
      );
      expect(user2Trophy).toBeDefined();
      expect(user2Trophy?.name).toBe(competitionName);
      expect(user2Trophy?.rank).toBe(2); // Silver trophy
      expect(user2Trophy?.createdAt).toBeDefined();
      expect(typeof user2Trophy?.imageUrl === "string").toBe(true);

      // Test 2: getUserAgent(agentId) should return trophies
      const user1SpecificAgentResponse = await user1Client.getUserAgent(
        agent1.id,
      );
      expect(user1SpecificAgentResponse.success).toBe(true);
      if (!user1SpecificAgentResponse.success)
        throw new Error("Failed to get user1 specific agent");

      const user1SpecificAgent = user1SpecificAgentResponse.agent;
      expect(Array.isArray(user1SpecificAgent.trophies)).toBe(true);
      expect(user1SpecificAgent.trophies?.length).toBeGreaterThan(0);

      const user1SpecificTrophy = user1SpecificAgent.trophies?.find(
        (t) => t.competitionId === competitionId,
      );
      expect(user1SpecificTrophy).toBeDefined();
      expect(user1SpecificTrophy?.name).toBe(competitionName);
      expect(user1SpecificTrophy?.rank).toBe(1); // Gold trophy
      expect(user1SpecificTrophy?.createdAt).toBeDefined();
      expect(typeof user1SpecificTrophy?.imageUrl === "string").toBe(true);
    });

    test("should handle user with no competitions via user endpoints", async () => {
      // Create Privy authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "No Trophies User",
        userEmail: "no-trophies-user@example.com",
      });

      // Create agent but don't put them in any competitions
      const agentResponse = await createTestAgent(
        userClient,
        "No Competitions Agent",
        "Agent that won't participate in any competitions",
      );
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AgentProfileResponse).agent;

      // Test getUserAgents() - should return empty trophies
      const agentsResponse = await userClient.getUserAgents();
      expect(agentsResponse.success).toBe(true);
      if (!agentsResponse.success) throw new Error("Failed to get user agents");

      const agents = agentsResponse.agents;
      const userAgent = agents.find((a) => a.id === agent.id);
      expect(userAgent).toBeDefined();
      expect(userAgent?.trophies).toEqual([]);

      // Test getUserAgent(agentId) - should return empty trophies
      const specificAgentResponse = await userClient.getUserAgent(agent.id);
      expect(specificAgentResponse.success).toBe(true);
      if (!specificAgentResponse.success)
        throw new Error("Failed to get specific agent");

      const specificAgent = specificAgentResponse.agent;
      expect(specificAgent.trophies).toEqual([]);
    });

    test("should handle agent with no competitions - empty trophies array", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent but don't put them in any competitions
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Competitions Agent",
      });

      const response = await adminClient.getPublicAgent(agent.id);
      expect(response.success).toBe(true);
      if (!response.success) throw new Error("Failed to get agent profile");
      expect(response.agent.trophies).toEqual([]);
    });

    test("should not create trophies for active competitions", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Active Competition Agent",
        });

      // Create and start competition but don't end it
      const competitionName = `Active Competition ${Date.now()}`;
      const createResult = await adminClient.createCompetition({
        name: competitionName,
        description: "Test active competition",
      });
      expect(createResult.success).toBe(true);
      if (!createResult.success)
        throw new Error("Failed to create competition");
      const competitionId = createResult.competition.id;

      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      // Execute a trade
      await agentClient.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: specificChainTokens.eth.eth,
        amount: "100",
        competitionId,
        reason: "Trade in active competition",
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check trophies - should not include the active competition
      const response = await adminClient.getPublicAgent(agent.id);
      expect(response.success).toBe(true);
      if (!response.success) throw new Error("Failed to get agent profile");
      const activeTrophy = response.agent.trophies?.find(
        (t: AgentTrophy) => t.competitionId === competitionId,
      );
      expect(activeTrophy).toBeUndefined(); // No trophy for active competition
    });

    test("should validate agent IDs before combining with pre-registered agents", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create multiple agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Two",
      });

      const { agent: agent3 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Three",
      });

      // Create a competition first
      const competitionName = `Pre-registered Test Competition ${Date.now()}`;
      const createResult = (await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition for pre-registered agent validation",
      })) as CreateCompetitionResponse;
      expect(createResult.success).toBe(true);
      const competitionId = createResult.competition.id;

      // Add agent1 to the competition (pre-registered)
      await adminClient.addAgentToCompetition(competitionId, agent1.id);

      // Deactivate agent2
      await adminClient.deactivateAgent(
        agent2.id,
        "Testing inactive agent validation",
      );

      // Test: Try to start competition with invalid agent2 and valid agent3
      // Should fail because agent2 is inactive, even though agent1 is pre-registered
      const startResponse = (await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent2.id, agent3.id], // agent2 is inactive, agent3 is valid
        crossChainTradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      })) as ErrorResponse;

      expect(startResponse.success).toBe(false);
      expect(startResponse.error).toContain(
        "Cannot start competition: the following agent IDs are invalid or inactive:",
      );
      expect(startResponse.error).toContain(agent2.id);
      // Should NOT mention agent1 (pre-registered) or agent3 (valid) in the error
      expect(startResponse.error).not.toContain(agent1.id);
      expect(startResponse.error).not.toContain(agent3.id);

      // Test: Try to start competition with only valid agents
      // Should succeed because agent1 is pre-registered and agent3 is valid
      const startResponse2 = await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent3.id], // Only valid agent
        crossChainTradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      expect(startResponse2.success).toBe(true);
      const competition = (startResponse2 as StartCompetitionResponse)
        .competition;
      expect(competition.status).toBe("active");
    });
  });

  describe("Competition Rewards Logic", () => {
    test("should create a competition with rewards", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create 4 agents and register them
      const agents = [];
      for (let i = 0; i < 4; i++) {
        const { agent: agent1 } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Rewards Agent ${i}`,
        });
        agents.push(agent1);
      }

      // Create a competition with rewards
      const competitionName = `Rewards Competition ${Date.now()}`;
      const rewards = {
        1: 100,
        2: 50,
        3: 25,
        4: 10,
      };

      const createResult = await adminClient.createCompetition({
        name: competitionName,
        description: "Test rewards competition",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        tradingConstraints: looseTradingConstraints,
        rewards,
      });
      expect(createResult.success).toBe(true);
      expect(
        (createResult as CreateCompetitionResponse).competition.rewards,
      ).toEqual(
        Object.entries(rewards).map(([rank, reward]) => ({
          rank: parseInt(rank),
          reward,
        })),
      );
      const competitionId = (createResult as CreateCompetitionResponse)
        .competition.id;
      const competitionRewardsInitial = (
        createResult as CreateCompetitionResponse
      ).competition.rewards;

      // Start the competition
      const startResult = await adminClient.startExistingCompetition({
        competitionId,
        agentIds: agents.map((a) => a.id),
      });
      expect(startResult.success).toBe(true);
      const endResult = await adminClient.endCompetition(competitionId);
      expect(endResult.success).toBe(true);

      // Get the final competition agent
      const finalCompetitionAgentInfo =
        await adminClient.getCompetitionAgents(competitionId);
      expect(finalCompetitionAgentInfo.success).toBe(true);
      const competitionAgents = (
        finalCompetitionAgentInfo as CompetitionAgentsResponse
      ).agents.sort((a, b) => a.rank - b.rank);

      // Get the final competition rewards
      const finalCompetitionRewards =
        await adminClient.getCompetition(competitionId);
      expect(finalCompetitionRewards.success).toBe(true);
      const competitionRewards = (
        finalCompetitionRewards as CompetitionDetailResponse
      ).competition.rewards;

      // Check that the final competition rewards are the same as the initial rewards, plus awarded to the agents
      expect(competitionRewards?.length).toEqual(4);
      for (let i = 0; i < 4; i++) {
        expect(competitionRewards?.[i]?.rank).toEqual(
          competitionRewardsInitial?.[i]?.rank,
        );
        expect(competitionRewards?.[i]?.reward).toEqual(
          competitionRewardsInitial?.[i]?.reward,
        );
        expect(competitionRewards?.[i]?.agentId).toEqual(
          competitionAgents[i]?.id,
        );
      }
    });
  });

  describe("Rewards Ineligibility", () => {
    test("should exclude ineligible agents from rank-based rewards", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create three agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Winner Agent",
        });
      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Excluded Agent",
        });
      const { agent: agent3, client: client3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Third Place Agent",
        });

      // Create competition with rank-based rewards and exclusion list
      const createResponse = await adminClient.createCompetition({
        name: "Exclusion Test Competition",
        type: "trading",
        rewards: {
          1: 1000,
          2: 500,
          3: 250,
        },
        rewardsIneligible: [agent2.id], // Exclude agent2
      });
      expect(createResponse.success).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Start competition with all three agents
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id, agent3.id],
      });

      // Make predictable trades so we know rankings (burn tokens - less burned = better)
      // Agent 1: Best performer (burns least)
      await client1.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Agent1 wins - burns least",
      });

      // Agent 2: Second best but excluded from rewards
      await client2.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "100",
        reason: "Agent2 rank 2 but excluded",
      });

      // Agent 3: Third place (burns most)
      await client3.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "500",
        reason: "Agent3 loses - burns most",
      });

      // Wait for snapshots
      await wait(2000);

      // End competition
      await adminClient.endCompetition(competitionId);

      // Get competition with rewards
      const detailResponse = await adminClient.getCompetition(competitionId);
      expect(detailResponse.success).toBe(true);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;

      // Verify rewards were assigned
      expect(competition.rewards).toBeDefined();
      expect(competition.rewards?.length).toBeGreaterThan(0);

      // Verify agent2 (excluded, rank 2) did not get assigned to any reward slot
      const agent2Reward = competition.rewards?.find(
        (r) => r.agentId === agent2.id,
      );
      expect(agent2Reward).toBeUndefined();

      // Verify agent1 (leaderboard rank 1) got the rank 1 reward ($1000)
      const agent1Reward = competition.rewards?.find(
        (r) => r.agentId === agent1.id,
      );
      expect(agent1Reward).toBeDefined();
      expect(agent1Reward?.rank).toBe(1);
      expect(agent1Reward?.reward).toBe(1000);

      // Verify agent3 (leaderboard rank 3) got the rank 3 reward ($250)
      // Note: Excluded agents don't cause "bumping" - reward slots just stay empty
      const agent3Reward = competition.rewards?.find(
        (r) => r.agentId === agent3.id,
      );
      expect(agent3Reward).toBeDefined();
      expect(agent3Reward?.rank).toBe(3); // Gets rank 3 slot
      expect(agent3Reward?.reward).toBe(250); // Gets rank 3's reward amount

      // Verify rank 2 reward slot is unassigned (excluded agent's slot stays empty)
      const rank2Reward = competition.rewards?.find((r) => r.rank === 2);
      expect(rank2Reward).toBeDefined();
      expect(rank2Reward?.agentId).toBeNull(); // No agent assigned to this slot
    });

    test("should allow competition with no excluded agents (backward compatible)", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Regular Agent",
        });

      // Create competition without exclusions
      const createResponse = await adminClient.createCompetition({
        name: "No Exclusions Competition",
        type: "trading",
        rewards: { 1: 1000 },
        // rewardsIneligible not set (null/undefined)
      });
      expect(createResponse.success).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Start and end competition
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      await agentClient.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Trade to establish rank",
      });

      await wait(2000);
      await adminClient.endCompetition(competitionId);

      // Verify agent gets reward
      const detailResponse = await adminClient.getCompetition(competitionId);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;
      const agentReward = competition.rewards?.find(
        (r) => r.agentId === agent.id,
      );
      expect(agentReward).toBeDefined();
    });

    test("should handle empty exclusion array (backward compatible)", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent With Empty Array",
        });

      // Create competition with empty exclusion array
      const createResponse = await adminClient.createCompetition({
        name: "Empty Array Competition",
        type: "trading",
        rewards: { 1: 1000 },
        rewardsIneligible: [], // Empty array = no exclusions
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Start and end competition
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent.id],
      });

      await agentClient.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Trade to establish rank",
      });

      await wait(2000);
      await adminClient.endCompetition(competitionId);

      // Verify agent gets reward (empty array should not exclude)
      const detailResponse = await adminClient.getCompetition(competitionId);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;
      const agentReward = competition.rewards?.find(
        (r) => r.agentId === agent.id,
      );
      expect(agentReward).toBeDefined();
    });

    test("should handle rewardsIneligible when using startCompetition endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create two agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Start Winner",
        });
      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Start Excluded",
        });

      // Use startCompetition (not createCompetition) with rewardsIneligible
      const startResponse = await adminClient.startCompetition({
        name: "Start Competition with Exclusions",
        agentIds: [agent1.id, agent2.id],
        rewards: {
          1: 500,
          2: 250,
        },
        rewardsIneligible: [agent2.id], // Exclude agent2
      });

      expect(startResponse.success).toBe(true);
      const competitionId = (startResponse as StartCompetitionResponse)
        .competition.id;

      // Make trades
      await client1.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Winner",
      });

      await client2.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "100",
        reason: "Excluded agent",
      });

      await wait(2000);
      await adminClient.endCompetition(competitionId);

      // Verify exclusion worked via startCompetition endpoint
      const detailResponse = await adminClient.getCompetition(competitionId);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;

      // Agent2 should not get reward
      const agent2Reward = competition.rewards?.find(
        (r) => r.agentId === agent2.id,
      );
      expect(agent2Reward).toBeUndefined();

      // Agent1 should get reward
      const agent1Reward = competition.rewards?.find(
        (r) => r.agentId === agent1.id,
      );
      expect(agent1Reward).toBeDefined();
      expect(agent1Reward?.rank).toBe(1);
      expect(agent1Reward?.reward).toBe(500);
    });

    test("should exclude globally ineligible agents from rewards across all competitions", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create three agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Regular Agent",
        });
      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Globally Ineligible Agent",
        });
      const { agent: agent3, client: client3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Another Regular Agent",
        });

      // Mark agent2 as globally ineligible via admin API
      const updateResponse = await adminClient.updateAgentAsAdmin(agent2.id, {
        isRewardsIneligible: true,
        rewardsIneligibilityReason: "Test agent - not eligible for any rewards",
      });
      expect(updateResponse.success).toBe(true);

      // Create competition with rewards (NO competition-specific exclusions)
      const createResponse = await adminClient.createCompetition({
        name: "Global Ineligibility Test",
        type: "trading",
        rewards: {
          1: 1000,
          2: 500,
          3: 250,
        },
        // rewardsIneligible not set - testing ONLY global exclusions
      });
      expect(createResponse.success).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Start competition with all three agents
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id, agent3.id],
      });

      // Make predictable trades (burn tokens - less burned = better)
      await client1.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Agent1 rank 1",
      });

      await client2.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "100",
        reason: "Agent2 rank 2 but globally ineligible",
      });

      await client3.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "500",
        reason: "Agent3 rank 3",
      });

      await wait(2000);
      await adminClient.endCompetition(competitionId);

      // Verify agent2 (globally ineligible, rank 2) did not get reward
      const detailResponse = await adminClient.getCompetition(competitionId);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;

      const agent2Reward = competition.rewards?.find(
        (r) => r.agentId === agent2.id,
      );
      expect(agent2Reward).toBeUndefined();

      // Verify agent1 and agent3 got their respective rewards
      const agent1Reward = competition.rewards?.find(
        (r) => r.agentId === agent1.id,
      );
      const agent3Reward = competition.rewards?.find(
        (r) => r.agentId === agent3.id,
      );
      expect(agent1Reward).toBeDefined();
      expect(agent1Reward?.rank).toBe(1);
      expect(agent3Reward).toBeDefined();
      expect(agent3Reward?.rank).toBe(3);

      // Verify rank 2 slot is empty (globally ineligible agent's slot)
      const rank2Reward = competition.rewards?.find((r) => r.rank === 2);
      expect(rank2Reward).toBeDefined();
      expect(rank2Reward?.agentId).toBeNull();
    });

    test("should combine global and competition-specific exclusions", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create four agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Regular 1",
        });
      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Comp Excluded",
        });
      const { agent: agent3, client: client3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Global Excluded",
        });
      const { agent: agent4, client: client4 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Regular 2",
        });

      // Mark agent3 as globally ineligible
      await adminClient.updateAgentAsAdmin(agent3.id, {
        isRewardsIneligible: true,
        rewardsIneligibilityReason: "Test agent - globally excluded",
      });

      // Create competition with agent2 in competition-specific exclusion list
      const createResponse = await adminClient.createCompetition({
        name: "Combined Exclusions Test",
        type: "trading",
        rewards: {
          1: 1000,
          2: 500,
          3: 250,
          4: 100,
        },
        rewardsIneligible: [agent2.id], // Competition-specific exclusion
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Start competition with all four agents
      await adminClient.startExistingCompetition({
        competitionId,
        agentIds: [agent1.id, agent2.id, agent3.id, agent4.id],
      });

      // Make predictable trades
      await client1.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Agent1 rank 1",
      });

      await client2.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "50",
        reason: "Agent2 rank 2 - competition excluded",
      });

      await client3.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "200",
        reason: "Agent3 rank 3 - globally excluded",
      });

      await client4.executeTrade({
        competitionId,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "600",
        reason: "Agent4 rank 4",
      });

      await wait(2000);
      await adminClient.endCompetition(competitionId);

      // Verify both agent2 (competition) and agent3 (global) are excluded
      const detailResponse = await adminClient.getCompetition(competitionId);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;

      const agent2Reward = competition.rewards?.find(
        (r) => r.agentId === agent2.id,
      );
      const agent3Reward = competition.rewards?.find(
        (r) => r.agentId === agent3.id,
      );
      expect(agent2Reward).toBeUndefined();
      expect(agent3Reward).toBeUndefined();

      // Verify agent1 and agent4 got rewards
      const agent1Reward = competition.rewards?.find(
        (r) => r.agentId === agent1.id,
      );
      const agent4Reward = competition.rewards?.find(
        (r) => r.agentId === agent4.id,
      );
      expect(agent1Reward).toBeDefined();
      expect(agent1Reward?.rank).toBe(1);
      expect(agent4Reward).toBeDefined();
      expect(agent4Reward?.rank).toBe(4);

      // Verify rank 2 and rank 3 slots are empty
      const rank2Reward = competition.rewards?.find((r) => r.rank === 2);
      const rank3Reward = competition.rewards?.find((r) => r.rank === 3);
      expect(rank2Reward?.agentId).toBeNull();
      expect(rank3Reward?.agentId).toBeNull();
    });

    test("should allow admin to toggle agent global ineligibility", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create an agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Toggle Test Agent",
        });

      // Mark as ineligible
      let updateResponse = await adminClient.updateAgentAsAdmin(agent.id, {
        isRewardsIneligible: true,
        rewardsIneligibilityReason: "Testing toggle functionality",
      });
      expect(updateResponse.success).toBe(true);

      // Create first competition and verify exclusion works
      const comp1Response = await adminClient.createCompetition({
        name: "Toggle Test Competition 1",
        rewards: { 1: 100 },
      });
      const comp1Id = (comp1Response as CreateCompetitionResponse).competition
        .id;

      await adminClient.startExistingCompetition({
        competitionId: comp1Id,
        agentIds: [agent.id],
      });

      await agentClient.executeTrade({
        competitionId: comp1Id,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Trade while ineligible",
      });

      await wait(2000);
      await adminClient.endCompetition(comp1Id);

      // Verify no reward
      const comp1Detail = await adminClient.getCompetition(comp1Id);
      const comp1 = (comp1Detail as CompetitionDetailResponse).competition;
      const comp1Reward = comp1.rewards?.find((r) => r.agentId === agent.id);
      expect(comp1Reward).toBeUndefined();

      // Re-enable agent for rewards
      updateResponse = await adminClient.updateAgentAsAdmin(agent.id, {
        isRewardsIneligible: false,
        rewardsIneligibilityReason: undefined,
      });
      expect(updateResponse.success).toBe(true);

      // Create second competition and verify agent now gets rewards
      const comp2Response = await adminClient.createCompetition({
        name: "Toggle Test Competition 2",
        rewards: { 1: 100 },
      });
      const comp2Id = (comp2Response as CreateCompetitionResponse).competition
        .id;

      await adminClient.startExistingCompetition({
        competitionId: comp2Id,
        agentIds: [agent.id],
      });

      await agentClient.executeTrade({
        competitionId: comp2Id,
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        reason: "Trade while eligible",
      });

      await wait(2000);
      await adminClient.endCompetition(comp2Id);

      // Verify agent gets reward this time
      const comp2Detail = await adminClient.getCompetition(comp2Id);
      const comp2 = (comp2Detail as CompetitionDetailResponse).competition;
      const comp2Reward = comp2.rewards?.find((r) => r.agentId === agent.id);
      expect(comp2Reward).toBeDefined();
      expect(comp2Reward?.reward).toBe(100);
    });
  });
});
