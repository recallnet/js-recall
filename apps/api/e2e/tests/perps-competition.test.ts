import { randomUUID } from "crypto";
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
  wait,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";

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
    // Note: Using authenticated endpoint as the public endpoint isn't implemented yet
    const positionsResponse = await agentClient.getPerpsPositions();

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

    // Wait for competition start to fully commit
    await wait(1000);

    // Trigger sync from Symphony (simulating what the cron job does)
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await wait(500);

    // Get perps account for the agent
    // Note: Using authenticated endpoint as the public endpoint isn't implemented yet
    const accountResponse = await agentClient.getPerpsAccount();

    expect(accountResponse.success).toBe(true);
    if (accountResponse.success) {
      expect(accountResponse.account).toBeDefined();
      expect(accountResponse.account.agentId).toBe(agent.id);
      expect(accountResponse.account.competitionId).toBe(competition.id);
      // After sync, should have data from mock Symphony server (default $500 initial capital)
      expect(accountResponse.account.totalEquity).toBe("500");
      expect(accountResponse.account.availableBalance).toBe("500");
      expect(accountResponse.account.marginUsed).toBe("0");
      expect(accountResponse.account.openPositions).toBe(0);
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

  test("should get perps positions for authenticated agent", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for this test and get the API client
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Positions Test Agent",
      });

    // Start a perps competition with the agent
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Positions Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Test getting positions for the authenticated agent
    const positionsResponse = await agentClient.getPerpsPositions();

    expect(positionsResponse.success).toBe(true);
    if (positionsResponse.success) {
      expect(positionsResponse.agentId).toBe(agent.id);
      expect(Array.isArray(positionsResponse.positions)).toBe(true);

      // The mock Symphony server should provide some positions
      if (positionsResponse.positions.length > 0) {
        const position = positionsResponse.positions[0];
        expect(position).toBeDefined();
        expect(position?.agentId).toBe(agent.id);
        expect(position?.competitionId).toBe(competition.id);
        expect(position?.marketSymbol).toBeDefined();
        expect(position?.side).toMatch(/^(long|short)$/);
        expect(position?.size).toBeDefined();
        expect(position?.averagePrice).toBeDefined();
      }
    }
  });

  test("should get perps account summary for authenticated agent", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for this test and get the API client
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Perps Account Test Agent",
      });

    // Start a perps competition with the agent
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Account Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Wait for competition start to fully commit
    await wait(1000);

    // Trigger sync from Symphony (simulating what the cron job does)
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await wait(500);

    // Test getting account summary for the authenticated agent
    const accountResponse = await agentClient.getPerpsAccount();

    expect(accountResponse.success).toBe(true);
    if (accountResponse.success) {
      expect(accountResponse.agentId).toBe(agent.id);
      expect(accountResponse.account).toBeDefined();

      const account = accountResponse.account;
      expect(account.agentId).toBe(agent.id);
      expect(account.competitionId).toBe(competition.id);
      // After sync, should have data from mock Symphony server (default $500 initial capital)
      expect(account.totalEquity).toBe("500");
      expect(account.availableBalance).toBe("500");
      expect(account.marginUsed).toBe("0");
      expect(account.totalPnl).toBe("0");
      expect(account.totalVolume).toBe("0");
      expect(account.openPositions).toBe(0);
      expect(account.timestamp).toBeDefined();
    }
  });

  test("should get perps positions for an agent in a competition", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Competition Perps Positions Test Agent",
      });

    // Start a perps competition with the agent
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Competition Perps Positions Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Wait for competition start to fully commit
    await wait(1000);

    // Trigger sync from Symphony (simulating what the cron job does)
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await wait(500);

    // Test getting positions via competition endpoint (requires auth)
    const positionsResponse =
      await agentClient.getAgentPerpsPositionsInCompetition(
        competition.id,
        agent.id,
      );

    expect(positionsResponse.success).toBe(true);
    if (positionsResponse.success) {
      expect(positionsResponse.competitionId).toBe(competition.id);
      expect(positionsResponse.agentId).toBe(agent.id);
      expect(Array.isArray(positionsResponse.positions)).toBe(true);

      // The mock Symphony server should provide some positions
      if (positionsResponse.positions.length > 0) {
        const position = positionsResponse.positions[0];
        expect(position).toBeDefined();
        expect(position?.agentId).toBe(agent.id);
        expect(position?.competitionId).toBe(competition.id);
        expect(position?.marketSymbol).toBeDefined();
        expect(position?.side).toMatch(/^(long|short)$/);
        expect(position?.size).toBeDefined();
        expect(position?.averagePrice).toBeDefined();
      }
    }
  });

  test("should return 404 for non-existent agent in competition", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a dummy agent to start the competition (required)
    const { agent: dummyAgent, client: dummyClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Dummy Agent for Competition Start",
      });

    // Start a perps competition with the dummy agent
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Perps 404 Test ${Date.now()}`,
      agentIds: [dummyAgent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Try to get positions for a DIFFERENT non-existent agent
    const randomAgentId = randomUUID();
    const positionsResponse =
      await dummyClient.getAgentPerpsPositionsInCompetition(
        competition.id,
        randomAgentId,
      );

    expect(positionsResponse.success).toBe(false);
    expect((positionsResponse as ErrorResponse).error).toContain(
      "Agent not found",
    );
  });

  test("should return 400 for paper trading competition", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Paper Trading Test Agent",
      });

    // Start a PAPER TRADING competition (not perps) using the test helper
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `Paper Trading Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Try to get perps positions for a paper trading competition
    const positionsResponse =
      await agentClient.getAgentPerpsPositionsInCompetition(
        competition.id,
        agent.id,
      );

    expect(positionsResponse.success).toBe(false);
    expect((positionsResponse as ErrorResponse).error).toContain(
      "This endpoint is only available for perpetual futures competitions",
    );
  });

  test("should return 404 when no active competition for perps endpoints", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent without starting a competition
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "No Competition Agent",
    });

    // Try to get positions - should fail with 404
    const positionsResponse = await agentClient.getPerpsPositions();
    expect(positionsResponse.success).toBe(false);
    if (!positionsResponse.success) {
      const errorResponse = positionsResponse as ErrorResponse;
      expect(errorResponse.status).toBe(404);
      expect(errorResponse.error).toContain("No active competition");
    }

    // Try to get account - should fail with 404
    const accountResponse = await agentClient.getPerpsAccount();
    expect(accountResponse.success).toBe(false);
    if (!accountResponse.success) {
      const errorResponse = accountResponse as ErrorResponse;
      expect(errorResponse.status).toBe(404);
      expect(errorResponse.error).toContain("No active competition");
    }
  });

  test("should return 400 when competition is paper trading, not perps", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and start a paper trading competition (not perps)
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Paper Trading Agent",
      });

    // Start a regular paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `Paper Trading ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);

    // Try to get perps positions - should fail with 400
    const positionsResponse = await agentClient.getPerpsPositions();
    expect(positionsResponse.success).toBe(false);
    if (!positionsResponse.success) {
      const errorResponse = positionsResponse as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("perpetual futures");
    }

    // Try to get perps account - should fail with 400
    const accountResponse = await agentClient.getPerpsAccount();
    expect(accountResponse.success).toBe(false);
    if (!accountResponse.success) {
      const errorResponse = accountResponse as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("perpetual futures");
    }
  });

  test("should sync and persist agent positions from Symphony to database", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with pre-configured wallet addresses
    // These wallets have mock data pre-configured in MockSymphonyServer
    const { agent: agent1, client: agent1Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With BTC ETH Positions",
        agentWalletAddress: "0x1111111111111111111111111111111111111111", // Pre-configured with BTC/ETH positions
      });

    const { agent: agent2, client: agent2Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With SOL Position",
        agentWalletAddress: "0x2222222222222222222222222222222222222222", // Pre-configured with SOL position
      });

    const { agent: agent3, client: agent3Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With History No Positions",
        agentWalletAddress: "0x3333333333333333333333333333333333333333", // Pre-configured with trading history but no positions
      });

    // Start a perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Position Sync Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Trigger sync from Symphony (simulating what the cron job does)
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify agent1's positions (BTC and ETH) were persisted
    const agent1Positions = await agent1Client.getPerpsPositions();
    expect(agent1Positions.success).toBe(true);
    if (agent1Positions.success) {
      expect(agent1Positions.positions).toHaveLength(2);

      const btcPosition = agent1Positions.positions.find(
        (p) => p.marketSymbol === "BTC",
      );
      expect(btcPosition).toBeDefined();
      expect(btcPosition?.side).toBe("long");
      expect(btcPosition?.size).toBe("0.5");
      expect(btcPosition?.averagePrice).toBe("45000");
      expect(btcPosition?.markPrice).toBe("47000");
      expect(btcPosition?.unrealizedPnl).toBe("1000");

      const ethPosition = agent1Positions.positions.find(
        (p) => p.marketSymbol === "ETH",
      );
      expect(ethPosition).toBeDefined();
      expect(ethPosition?.side).toBe("short");
      expect(ethPosition?.size).toBe("2");
    }

    // Verify agent1's account summary
    const agent1Account = await agent1Client.getPerpsAccount();
    expect(agent1Account.success).toBe(true);
    if (agent1Account.success) {
      expect(agent1Account.account.totalEquity).toBe("1250");
      expect(agent1Account.account.availableBalance).toBe("450");
      expect(agent1Account.account.marginUsed).toBe("800");
      expect(agent1Account.account.totalVolume).toBe("25000");
      expect(agent1Account.account.openPositions).toBe(2);
    }

    // Verify agent2's position (SOL with negative PnL) was persisted
    const agent2Positions = await agent2Client.getPerpsPositions();
    expect(agent2Positions.success).toBe(true);
    if (agent2Positions.success) {
      expect(agent2Positions.positions).toHaveLength(1);

      const solPosition = agent2Positions.positions[0];
      expect(solPosition?.marketSymbol).toBe("SOL");
      expect(solPosition?.side).toBe("long");
      expect(solPosition?.size).toBe("10");
      expect(solPosition?.unrealizedPnl).toBe("-50");
    }

    // Verify agent2's account summary
    const agent2Account = await agent2Client.getPerpsAccount();
    expect(agent2Account.success).toBe(true);
    if (agent2Account.success) {
      expect(agent2Account.account.totalEquity).toBe("950");
      expect(agent2Account.account.marginUsed).toBe("200");
      expect(agent2Account.account.openPositions).toBe(1);
    }

    // Verify agent3's data (has trading history but no positions)
    const agent3Positions = await agent3Client.getPerpsPositions();
    expect(agent3Positions.success).toBe(true);
    if (agent3Positions.success) {
      expect(agent3Positions.positions).toHaveLength(0);
    }

    const agent3Account = await agent3Client.getPerpsAccount();
    expect(agent3Account.success).toBe(true);
    if (agent3Account.success) {
      expect(agent3Account.account.totalEquity).toBe("1100");
      expect(agent3Account.account.availableBalance).toBe("1100");
      expect(agent3Account.account.marginUsed).toBe("0");
      expect(agent3Account.account.totalVolume).toBe("10000");
      expect(agent3Account.account.openPositions).toBe(0);
    }

    // Verify competition summary reflects all agents' data
    const summaryResponse = await adminClient.getCompetitionPerpsSummary(
      competition.id,
    );
    expect(summaryResponse.success).toBe(true);
    if (summaryResponse.success) {
      expect(summaryResponse.summary.totalAgents).toBe(3);
      expect(summaryResponse.summary.totalPositions).toBe(3); // 2 for agent1 + 1 for agent2 + 0 for agent3
      expect(summaryResponse.summary.totalVolume).toBe(40000); // 25000 + 5000 + 10000
      expect(summaryResponse.summary.averageEquity).toBe(1100); // (1250 + 950 + 1100) / 3
    }

    // Verify agent-specific competition endpoint also works
    const agent1CompPositions =
      await adminClient.getAgentPerpsPositionsInCompetition(
        competition.id,
        agent1.id,
      );
    expect(agent1CompPositions.success).toBe(true);
    if (agent1CompPositions.success) {
      expect(agent1CompPositions.positions).toHaveLength(2);
      // Verify the positions match what we set up
      const positions = agent1CompPositions.positions;
      expect(positions.some((p) => p.marketSymbol === "BTC")).toBe(true);
      expect(positions.some((p) => p.marketSymbol === "ETH")).toBe(true);
    }
  });

  test("should get perps competition summary", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents for this test
    const { agent: agent1, client: agent1Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Summary Test Agent 1",
      });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Summary Test Agent 2",
    });

    // Start a perps competition with multiple agents
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Summary Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Wait for competition start to fully commit
    await wait(1000);

    // Trigger sync from Symphony (simulating what the cron job does)
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await wait(500);

    // Get competition summary
    const summaryResponse = await agent1Client.getCompetitionPerpsSummary(
      competition.id,
    );

    expect(summaryResponse.success).toBe(true);
    if (summaryResponse.success) {
      expect(summaryResponse.competitionId).toBe(competition.id);
      expect(summaryResponse.summary).toBeDefined();
      expect(summaryResponse.summary.totalAgents).toBeGreaterThanOrEqual(2);
      expect(summaryResponse.summary.totalPositions).toBeGreaterThanOrEqual(0);
      expect(summaryResponse.summary.totalVolume).toBeGreaterThanOrEqual(0);
      expect(summaryResponse.summary.averageEquity).toBeGreaterThanOrEqual(0);
      expect(summaryResponse.timestamp).toBeDefined();
    }
  });

  test("should return 400 for paper trading competition when getting summary", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for this test
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Paper Trading Summary Test Agent",
      });

    // Start a PAPER TRADING competition (not perps)
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `Paper Trading Summary Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Try to get perps summary for a paper trading competition
    const summaryResponse = await agentClient.getCompetitionPerpsSummary(
      competition.id,
    );

    expect(summaryResponse.success).toBe(false);
    expect((summaryResponse as ErrorResponse).error).toContain(
      "This endpoint is only available for perpetual futures competitions",
    );
  });

  test("should return 403 when agent not in perps competition", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register TWO agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "In Competition Agent",
    });

    const { client: agent2Client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Not In Competition Agent",
    });

    // Start perps competition with only agent1
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Exclusive ${Date.now()}`,
      agentIds: [agent1.id], // Only agent1
    });

    expect(competitionResponse.success).toBe(true);

    // Agent2 tries to get positions - should fail with 403
    const positionsResponse = await agent2Client.getPerpsPositions();
    expect(positionsResponse.success).toBe(false);
    if (!positionsResponse.success) {
      const errorResponse = positionsResponse as ErrorResponse;
      expect(errorResponse.status).toBe(403);
      expect(errorResponse.error).toContain("not registered");
    }

    // Agent2 tries to get account - should fail with 403
    const accountResponse = await agent2Client.getPerpsAccount();
    expect(accountResponse.success).toBe(false);
    if (!accountResponse.success) {
      const errorResponse = accountResponse as ErrorResponse;
      expect(errorResponse.status).toBe(403);
      expect(errorResponse.error).toContain("not registered");
    }
  });
});
