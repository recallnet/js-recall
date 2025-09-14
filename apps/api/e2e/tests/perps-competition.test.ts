import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import {
  type AgentProfileResponse,
  BlockchainType,
  type EnhancedCompetition,
  type ErrorResponse,
  type GetUserAgentsResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startPerpsTestCompetition,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";

describe("Perps Competition", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    // Get admin API key for each test
    adminApiKey = await getAdminApiKey();
  });

  test("should start a perps competition with Symphony provider", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for this test
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Test Agent 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Test Agent 2",
    });

    // Start a perps competition
    const competitionName = `Perps Test ${Date.now()}`;
    const response = await startPerpsTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

    // Verify competition was started
    expect(response.success).toBe(true);
    expect(response.competition).toBeDefined();
    expect(response.competition.type).toBe("perpetual_futures");
    expect(response.competition.status).toBe("active");
    expect(response.competition.name).toBe(competitionName);
    expect(response.competition.agentIds).toContain(agent1.id);
    expect(response.competition.agentIds).toContain(agent2.id);
  });

  test("should retrieve competition details with perps-specific fields", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for this test
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Detail Agent 1",
    });

    // Start a perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Detail Test ${Date.now()}`,
      agentIds: [agent1.id],
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 100,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Get competition details
    const detailResponse = await adminClient.getCompetition(competition.id);
    expect(detailResponse.success).toBe(true);

    if (detailResponse.success) {
      expect(detailResponse.competition).toBeDefined();
      expect(detailResponse.competition.type).toBe("perpetual_futures");

      // Check for perps-specific stats (perpsCompetitionConfig is available on enhanced competition response)
      // The detail endpoint returns an enhanced competition with stats
      const comp = detailResponse.competition as EnhancedCompetition;
      if (comp.stats) {
        expect(comp.stats.totalPositions).toBeDefined();
        expect(comp.stats.totalTrades).toBeUndefined();
      }
    }
  });

  test("should get perps positions for an agent", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Position Agent",
      });

    // Start a perps competition with this agent
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Position Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);

    // Get perps positions for the agent in this competition
    const positionsResponse = await agentClient.getAgentPerpsPositions(
      agent.id,
    );

    expect(positionsResponse.success).toBe(true);
    if (positionsResponse.success) {
      expect(positionsResponse.positions).toBeDefined();
      expect(Array.isArray(positionsResponse.positions)).toBe(true);
      // Mock server returns no positions by default
      expect(positionsResponse.positions.length).toBe(0);
    }
  });

  test("should get perps account summary for an agent", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Account Agent",
      });

    // Start a perps competition with this agent
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Account Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Get perps account for the agent
    const accountResponse = await agentClient.getAgentPerpsAccount(agent.id);

    expect(accountResponse.success).toBe(true);
    if (accountResponse.success) {
      expect(accountResponse.account).toBeDefined();
      expect(accountResponse.account.agentId).toBe(agent.id);
      expect(accountResponse.account.competitionId).toBe(competition.id);
      expect(accountResponse.account.totalEquity).toBe("500.00"); // Mock server default
      expect(accountResponse.account.openPositions).toBe(0); // Use openPositions instead
    }
  });

  test("should get all perps positions in a competition", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for this test
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Comp Agent 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Comp Agent 2",
    });

    // Start a perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps All Positions Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Get all positions in the competition
    const positionsResponse = await adminClient.getCompetitionPerpsPositions(
      competition.id,
    );

    expect(positionsResponse.success).toBe(true);
    if (positionsResponse.success) {
      expect(positionsResponse.positions).toBeDefined();
      expect(Array.isArray(positionsResponse.positions)).toBe(true);
      // Mock server returns no positions by default
      expect(positionsResponse.positions.length).toBe(0);
    }
  });

  test("should show perps competition in agent's competition list", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps List Agent",
      });

    // Start a perps competition with this agent
    const competitionName = `Perps List Test ${Date.now()}`;
    const response = await startPerpsTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Get agent's competitions
    const competitionsResponse = await agentClient.getAgentCompetitions(
      agent.id,
    );

    expect(competitionsResponse.success).toBe(true);
    if (competitionsResponse.success) {
      expect(competitionsResponse.competitions).toBeDefined();
      expect(Array.isArray(competitionsResponse.competitions)).toBe(true);

      // Find the perps competition we just created
      const perpsComp = competitionsResponse.competitions.find(
        (c: EnhancedCompetition) => c.id === competition.id,
      );

      expect(perpsComp).toBeDefined();
      if (perpsComp) {
        expect(perpsComp.type).toBe("perpetual_futures");
        expect(perpsComp.name).toBe(competitionName);
        expect(perpsComp.totalPositions).toBeDefined();
        expect(perpsComp.totalTrades).toBeUndefined();
      }
    }
  });

  test("should prevent paper trading endpoints during perps competition", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for this test
    const { agent: agent1, client: agent1Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Block Agent 1",
      });
    const { agent: agent2, client: agent2Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Block Agent 2",
      });

    // Start a perps competition
    await startPerpsTestCompetition({
      adminClient,
      name: `Perps Block Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    // Try to execute trades (paper trading endpoints)
    const trade1Response = await agent1Client.executeTrade({
      fromToken: "0x0000000000000000000000000000000000000000",
      toToken: "0x1234567890123456789012345678901234567890",
      amount: "100",
      reason: "Test trade during perps competition",
      fromChain: BlockchainType.EVM,
    });

    expect(trade1Response.success).toBe(false);
    if (!trade1Response.success) {
      const errorResponse = trade1Response as ErrorResponse;
      expect(errorResponse.error).toBeDefined();
    }

    // Agent 2 should also be blocked
    const trade2Response = await agent2Client.executeTrade({
      fromToken: "0x1234567890123456789012345678901234567890",
      toToken: "0x0000000000000000000000000000000000000000",
      amount: "50",
      reason: "Test trade 2",
      fromChain: BlockchainType.EVM,
    });

    expect(trade2Response.success).toBe(false);
  });

  test("should handle non-existent competition gracefully", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Error Agent",
      });

    // Try to get perps positions without being in a perps competition
    const response = await agentClient.getAgentPerpsPositions(agent.id);

    // Since the agent is not in any perps competition, it should return empty or error
    expect(response.success).toBeDefined();
    if (response.success) {
      // If it succeeds, should return empty positions
      expect(response.positions).toBeDefined();
      expect(Array.isArray(response.positions)).toBe(true);
      expect(response.positions.length).toBe(0);
    } else {
      // Or it might return an error
      expect((response as ErrorResponse).error).toBeDefined();
    }
  });

  test("should include perps competitions in global leaderboard stats", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for both competition types
    const { agent: paperAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading Agent for Global",
    });
    const { agent: perpsAgent, client: perpsClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Agent for Global",
      });

    // Start and end a paper trading competition
    const paperCompName = `Paper Trading Global ${Date.now()}`;
    const paperResponse = await adminClient.startCompetition({
      name: paperCompName,
      type: "trading",
      agentIds: [paperAgent.id],
    });
    expect(paperResponse.success).toBe(true);
    if (!paperResponse.success) {
      throw new Error("Failed to start paper trading competition");
    }
    const paperCompId = paperResponse.competition.id;

    // End the paper trading competition so it's included in global stats
    await adminClient.endCompetition(paperCompId);

    // Start and end a perps competition
    const perpsCompName = `Perps Competition Global ${Date.now()}`;
    const perpsResponse = await startPerpsTestCompetition({
      adminClient,
      name: perpsCompName,
      agentIds: [perpsAgent.id],
    });
    expect(perpsResponse.success).toBe(true);
    const perpsCompId = perpsResponse.competition.id;

    // End the perps competition so it's included in global stats
    await adminClient.endCompetition(perpsCompId);

    // Get global leaderboard
    const leaderboardResponse = await perpsClient.getGlobalLeaderboard();

    expect(leaderboardResponse.success).toBe(true);
    if (leaderboardResponse.success) {
      const stats = leaderboardResponse.stats;

      // Should have stats from both competition types
      expect(stats).toBeDefined();
      expect(stats.totalCompetitions).toBeGreaterThanOrEqual(2); // At least our 2 competitions

      // Paper trading contributes totalTrades
      expect(stats.totalTrades).toBeDefined();
      expect(typeof stats.totalTrades).toBe("number");

      // Perps competitions contribute totalPositions
      expect(stats.totalPositions).toBeDefined();
      expect(typeof stats.totalPositions).toBe("number");

      // Should have volume stats
      expect(stats.totalVolume).toBeDefined();
      expect(typeof stats.totalVolume).toBe("number");

      // Should include agents from both competitions
      expect(stats.activeAgents).toBeGreaterThanOrEqual(2);
    }
  });

  test("should show user's agents with both paper trading and perps metrics", async () => {
    // Register a user with an agent
    const { agent, client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: `User Agent ${Date.now()}`,
    });

    // Create admin client for starting competitions
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // FIRST: Run a paper trading competition to completion
    const paperCompName = `User Paper ${Date.now()}`;
    const paperComp = await startTestCompetition({
      adminClient,
      name: paperCompName,
      agentIds: [agent.id],
    });

    // Execute paper trades using proper token addresses
    const usdcTokenAddress = config.specificChainTokens.eth.usdc;
    const wethTokenAddress = config.specificChainTokens.eth.eth;

    await client.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: wethTokenAddress,
      amount: "100",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      reason: "Test trade 1",
    });

    await client.executeTrade({
      fromToken: wethTokenAddress,
      toToken: usdcTokenAddress,
      amount: "0.01",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      reason: "Test trade 2",
    });

    await client.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: wethTokenAddress,
      amount: "50",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      reason: "Test trade 3",
    });

    // End the paper trading competition
    await adminClient.endCompetition(paperComp.competition.id);

    // SECOND: Run a perps competition to completion
    const perpsCompName = `User Perps ${Date.now()}`;
    const perpsComp = await startPerpsTestCompetition({
      adminClient,
      name: perpsCompName,
      agentIds: [agent.id],
    });

    // The perps competition will get positions from the mock Symphony server
    // End the perps competition
    await adminClient.endCompetition(perpsComp.competition.id);

    // NOW check the aggregated metrics across both completed competitions
    const userAgentsResponse = await client.getUserAgents();

    expect(userAgentsResponse.success).toBe(true);
    if (!userAgentsResponse.success) {
      throw new Error("Failed to get user agents");
    }

    const typedResponse = userAgentsResponse as GetUserAgentsResponse;
    expect(typedResponse.agents).toBeDefined();
    expect(Array.isArray(typedResponse.agents)).toBe(true);
    expect(typedResponse.agents.length).toBeGreaterThan(0);

    // Find our agent with proper typing
    const agentData = typedResponse.agents.find((a) => a.id === agent.id);

    expect(agentData).toBeDefined();
    expect(agentData?.stats).toBeDefined();

    // Should have both totalTrades (from paper competition) and totalPositions (from perps competition)
    expect(agentData?.stats?.totalTrades).toBe(3); // 3 paper trades
    expect(agentData?.stats?.totalPositions).toBeDefined();
    expect(typeof agentData?.stats?.totalPositions).toBe("number");

    // Also test the individual agent endpoint
    const singleAgentResponse = await client.getUserAgent(agent.id);

    expect(singleAgentResponse.success).toBe(true);
    if (!singleAgentResponse.success) {
      throw new Error("Failed to get single agent");
    }

    const typedSingleResponse = singleAgentResponse as AgentProfileResponse;
    expect(typedSingleResponse.agent).toBeDefined();
    expect(typedSingleResponse.agent.stats).toBeDefined();
    expect(typedSingleResponse.agent.stats?.totalTrades).toBe(3);
    expect(typedSingleResponse.agent.stats?.totalPositions).toBeDefined();
    expect(typeof typedSingleResponse.agent.stats?.totalPositions).toBe(
      "number",
    );
  });
});
