import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { competitions } from "@recallnet/db/schema/core/defs";
import {
  perpsAccountSummaries,
  portfolioSnapshots,
} from "@recallnet/db/schema/trading/defs";

import config from "@/config/index.js";
import { db } from "@/database/db.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  type AdminAgentResponse,
  type AdminCompetitionTransferViolationsResponse,
  type AgentCompetitionsResponse,
  type AgentPerpsPositionsResponse,
  type AgentProfileResponse,
  BlockchainType,
  type CompetitionAgent,
  type CompetitionAgentsResponse,
  type CompetitionAllPerpsPositionsResponse,
  type CompetitionDetailResponse,
  type EnhancedCompetition,
  type ErrorResponse,
  type GetUserAgentsResponse,
  type PerpsAccountResponse,
  type PerpsPositionsResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  createTestClient,
  generateTestHandle,
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

    // Type assertion since we've verified success
    const typedDetailResponse = detailResponse as CompetitionDetailResponse;
    expect(typedDetailResponse.competition).toBeDefined();
    expect(typedDetailResponse.competition.type).toBe("perpetual_futures");

    // Check for perps-specific stats (perpsCompetitionConfig is available on enhanced competition response)
    // The detail endpoint returns an enhanced competition with stats
    const comp = typedDetailResponse.competition as EnhancedCompetition;

    expect(comp?.stats?.totalPositions).toBeDefined();
    expect(comp.stats?.totalTrades).toBe(0);

    // Verify perps competitions include volume and average equity stats
    expect(comp?.stats?.totalVolume).toBeDefined();
    expect(typeof comp?.stats?.totalVolume).toBe("number");
    // Note: totalVolume can be 0 for a new competition with no trades yet
    expect(comp?.stats?.totalVolume).toBeGreaterThanOrEqual(0);

    expect(comp?.stats?.averageEquity).toBeDefined();
    expect(typeof comp?.stats?.averageEquity).toBe("number");
    // Note: averageEquity can be 0 if no agents have joined yet
    expect(comp?.stats?.averageEquity).toBeGreaterThanOrEqual(0);
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

    // Type assertion since we've verified success
    const typedPositionsResponse = positionsResponse as PerpsPositionsResponse;
    expect(typedPositionsResponse.positions).toBeDefined();
    expect(Array.isArray(typedPositionsResponse.positions)).toBe(true);
    // Mock server returns no positions by default
    expect(typedPositionsResponse.positions.length).toBe(0);
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

    // Type assertion since we've verified success
    const typedAccountResponse = accountResponse as PerpsAccountResponse;
    expect(typedAccountResponse.account).toBeDefined();
    expect(typedAccountResponse.account.agentId).toBe(agent.id);
    expect(typedAccountResponse.account.competitionId).toBe(competition.id);
    // After sync, should have data from mock Symphony server (default $500 initial capital)
    expect(typedAccountResponse.account.totalEquity).toBe("500");
    expect(typedAccountResponse.account.availableBalance).toBe("500");
    expect(typedAccountResponse.account.marginUsed).toBe("0");
    expect(typedAccountResponse.account.openPositions).toBe(0);
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

    // Type assertion since we've verified success
    const typedCompetitionsResponse =
      competitionsResponse as AgentCompetitionsResponse;
    expect(typedCompetitionsResponse.competitions).toBeDefined();
    expect(Array.isArray(typedCompetitionsResponse.competitions)).toBe(true);

    // Find the perps competition we just created
    const perpsComp = typedCompetitionsResponse.competitions.find(
      (c: EnhancedCompetition) => c.id === competition.id,
    );

    expect(perpsComp).toBeDefined();
    expect(perpsComp?.type).toBe("perpetual_futures");
    expect(perpsComp?.name).toBe(competitionName);
    expect(perpsComp?.totalPositions).toBeDefined();
    expect(perpsComp?.totalTrades).toBe(0);
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

    // Type assertion since we've verified success
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

    // Type assertion since we've verified success
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

    // Type assertion since we've verified success
    const typedPositionsResponse = positionsResponse as PerpsPositionsResponse;
    expect(typedPositionsResponse.agentId).toBe(agent.id);
    expect(Array.isArray(typedPositionsResponse.positions)).toBe(true);

    // The mock Symphony server should provide some positions
    if (typedPositionsResponse.positions.length > 0) {
      const position = typedPositionsResponse.positions[0];
      expect(position).toBeDefined();
      expect(position?.agentId).toBe(agent.id);
      expect(position?.competitionId).toBe(competition.id);
      expect(position?.marketSymbol).toBeDefined();
      expect(position?.isLong).toBeDefined();
      expect(position?.size).toBeDefined();
      expect(position?.averagePrice).toBeDefined();
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

    // Type assertion since we've verified success
    const typedAccountResponse = accountResponse as PerpsAccountResponse;
    expect(typedAccountResponse.agentId).toBe(agent.id);
    expect(typedAccountResponse.account).toBeDefined();

    const account = typedAccountResponse.account;
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

    // Type assertion since we've verified success
    const typedPositionsResponse =
      positionsResponse as AgentPerpsPositionsResponse;
    expect(typedPositionsResponse.competitionId).toBe(competition.id);
    expect(typedPositionsResponse.agentId).toBe(agent.id);
    expect(Array.isArray(typedPositionsResponse.positions)).toBe(true);

    // The mock Symphony server should provide some positions
    if (typedPositionsResponse.positions.length > 0) {
      const position = typedPositionsResponse.positions[0];
      expect(position).toBeDefined();
      expect(position?.agentId).toBe(agent.id);
      expect(position?.competitionId).toBe(competition.id);
      expect(position?.marketSymbol).toBeDefined();
      expect(position?.isLong).toBeDefined();
      expect(position?.size).toBeDefined();
      expect(position?.averagePrice).toBeDefined();
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

    // Type assertion since we've verified success
    const typedAgent1Positions = agent1Positions as PerpsPositionsResponse;
    expect(typedAgent1Positions.positions).toHaveLength(2);

    const btcPosition = typedAgent1Positions.positions.find(
      (p) => p.marketSymbol === "BTC",
    );
    expect(btcPosition).toBeDefined();
    expect(btcPosition?.isLong).toBe(true);
    expect(btcPosition?.size).toBe(23500);
    expect(btcPosition?.averagePrice).toBe(45000);
    expect(btcPosition?.markPrice).toBe(47000);
    expect(btcPosition?.unrealizedPnl).toBe(1000);

    const ethPosition = typedAgent1Positions.positions.find(
      (p) => p.marketSymbol === "ETH",
    );
    expect(ethPosition).toBeDefined();
    expect(ethPosition?.isLong).toBe(false);
    expect(ethPosition?.size).toBe(6300);

    // Verify agent1's account summary
    const agent1Account = await agent1Client.getPerpsAccount();
    expect(agent1Account.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent1Account = agent1Account as PerpsAccountResponse;
    expect(typedAgent1Account.account.totalEquity).toBe("1250");
    expect(typedAgent1Account.account.availableBalance).toBe("450");
    expect(typedAgent1Account.account.marginUsed).toBe("800");
    expect(typedAgent1Account.account.totalVolume).toBe("25000");
    expect(typedAgent1Account.account.openPositions).toBe(2);

    // Verify agent2's position (SOL with negative PnL) was persisted
    const agent2Positions = await agent2Client.getPerpsPositions();
    expect(agent2Positions.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent2Positions = agent2Positions as PerpsPositionsResponse;
    expect(typedAgent2Positions.positions).toHaveLength(1);

    const solPosition = typedAgent2Positions.positions[0];
    expect(solPosition?.marketSymbol).toBe("SOL");
    expect(solPosition?.isLong).toBe(true);
    expect(solPosition?.size).toBe(950); // USD value
    expect(solPosition?.unrealizedPnl).toBe(-50);

    // Verify agent2's account summary
    const agent2Account = await agent2Client.getPerpsAccount();
    expect(agent2Account.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent2Account = agent2Account as PerpsAccountResponse;
    expect(typedAgent2Account.account.totalEquity).toBe("950");
    expect(typedAgent2Account.account.marginUsed).toBe("200");
    expect(typedAgent2Account.account.openPositions).toBe(1);

    // Verify agent3's data (has trading history but no positions)
    const agent3Positions = await agent3Client.getPerpsPositions();
    expect(agent3Positions.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent3Positions = agent3Positions as PerpsPositionsResponse;
    expect(typedAgent3Positions.positions).toHaveLength(0);

    const agent3Account = await agent3Client.getPerpsAccount();
    expect(agent3Account.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent3Account = agent3Account as PerpsAccountResponse;
    expect(typedAgent3Account.account.totalEquity).toBe("1100");
    expect(typedAgent3Account.account.availableBalance).toBe("1100");
    expect(typedAgent3Account.account.marginUsed).toBe("0");
    expect(typedAgent3Account.account.totalVolume).toBe("10000");
    expect(typedAgent3Account.account.openPositions).toBe(0);

    // Verify competition details reflect all agents' data
    const competitionDetails = await adminClient.getCompetition(competition.id);
    expect(competitionDetails.success).toBe(true);

    // Type assertion since we've verified success
    if (competitionDetails.success && "competition" in competitionDetails) {
      const stats = competitionDetails.competition.stats;
      expect(stats?.totalAgents).toBe(3);
      expect(stats?.totalPositions).toBe(3); // 2 for agent1 + 1 for agent2 + 0 for agent3
      expect(stats?.totalVolume).toBe(40000); // 25000 + 5000 + 10000
    }

    // Verify agent-specific competition endpoint also works
    const agent1CompPositions =
      await adminClient.getAgentPerpsPositionsInCompetition(
        competition.id,
        agent1.id,
      );
    expect(agent1CompPositions.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent1CompPositions =
      agent1CompPositions as AgentPerpsPositionsResponse;
    expect(typedAgent1CompPositions.positions).toHaveLength(2);
    // Verify the positions match what we set up
    const positions = typedAgent1CompPositions.positions;
    expect(positions.some((p) => p.marketSymbol === "BTC")).toBe(true);
    expect(positions.some((p) => p.marketSymbol === "ETH")).toBe(true);
  });

  test("should get all perps positions for a competition with pagination and embedded agent info", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with pre-configured wallet addresses
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Multiple Positions",
      agentWalletAddress: "0x1111111111111111111111111111111111111111", // BTC/ETH positions
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Single Position",
      agentWalletAddress: "0x2222222222222222222222222222222222222222", // SOL position
    });

    // Start a perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps All Positions Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Trigger sync to populate positions
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test 1: Get all positions without pagination
    const allPositions = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
    );
    expect(allPositions.success).toBe(true);

    // Type assertion since we've verified success
    const typedAllPositions =
      allPositions as CompetitionAllPerpsPositionsResponse;
    expect(typedAllPositions.positions).toHaveLength(3); // BTC, ETH, SOL
    expect(typedAllPositions.pagination.total).toBe(3);
    expect(typedAllPositions.pagination.hasMore).toBe(false);

    // Verify embedded agent info is present
    const btcPosition = typedAllPositions.positions.find(
      (p) => p.marketSymbol === "BTC",
    );
    expect(btcPosition).toBeDefined();
    expect(btcPosition?.agent).toBeDefined();
    expect(btcPosition?.agent.name).toBe("Agent With Multiple Positions");
    expect(btcPosition?.agent.id).toBe(agent1.id);

    const solPosition = typedAllPositions.positions.find(
      (p) => p.marketSymbol === "SOL",
    );
    expect(solPosition).toBeDefined();
    expect(solPosition?.agent).toBeDefined();
    expect(solPosition?.agent.name).toBe("Agent With Single Position");
    expect(solPosition?.agent.id).toBe(agent2.id);

    // Test 2: Get positions with pagination
    const page1 = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
      2, // limit
      0, // offset
    );
    expect(page1.success).toBe(true);

    // Type assertion since we've verified success
    const typedPage1 = page1 as CompetitionAllPerpsPositionsResponse;
    expect(typedPage1.positions).toHaveLength(2);
    expect(typedPage1.pagination.total).toBe(3);
    expect(typedPage1.pagination.hasMore).toBe(true);
    expect(typedPage1.pagination.limit).toBe(2);
    expect(typedPage1.pagination.offset).toBe(0);

    const page2 = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
      2, // limit
      2, // offset
    );
    expect(page2.success).toBe(true);

    // Type assertion since we've verified success
    const typedPage2 = page2 as CompetitionAllPerpsPositionsResponse;
    expect(typedPage2.positions).toHaveLength(1);
    expect(typedPage2.pagination.total).toBe(3);
    expect(typedPage2.pagination.hasMore).toBe(false);
    expect(typedPage2.pagination.limit).toBe(2);
    expect(typedPage2.pagination.offset).toBe(2);

    // Test 3: Get positions with status filter (all positions are Open by default)
    const openPositions = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
      undefined, // no limit
      undefined, // no offset
      "Open", // status filter
    );
    expect(openPositions.success).toBe(true);

    // Type assertion since we've verified success
    const typedOpenPositions =
      openPositions as CompetitionAllPerpsPositionsResponse;
    expect(typedOpenPositions.positions).toHaveLength(3); // All are open
    typedOpenPositions.positions.forEach((pos) => {
      expect(pos.status).toBe("Open");
    });

    // Test 4: Try to access from paper trading competition (should fail)
    const paperTradingComp = await adminClient.createCompetition({
      name: `Paper Trading ${Date.now()}`,
      type: "trading",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });

    if (paperTradingComp.success) {
      const invalidResponse = await adminClient.getCompetitionAllPerpsPositions(
        paperTradingComp.competition.id,
      );
      expect(invalidResponse.success).toBe(false);
      if (!invalidResponse.success) {
        const errorResponse = invalidResponse as ErrorResponse;
        expect(errorResponse.status).toBe(400);
        expect(errorResponse.error).toContain("perpetual futures");
      }
    }
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

  test("should calculate Calmar ratio using simple returns", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with the 0x4444 wallet that demonstrates portfolio volatility
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Calmar Test Agent",
        agentWalletAddress: "0x4444444444444444444444444444444444444444",
      });

    // Start perps competition with this agent
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Calmar Ratio Test Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;
    const competitionId = competition.id;

    // Wait to ensure competition is fully started
    await wait(1000);

    // Trigger sync from Symphony (simulating what the cron job does)
    const services = new ServiceRegistry();

    // First sync - creates initial snapshot at peak ($1700)
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait a bit to ensure time passes between snapshots
    await wait(500);

    // Second sync - creates snapshot at trough ($1200)
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait a bit more
    await wait(500);

    // Third sync - creates snapshot after partial recovery ($1550)
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync and calculations to complete
    // Need extra time for read replica to catch up with risk metrics writes
    await wait(1000);

    // Get competition leaderboard - should include risk metrics
    const leaderboardResponse = await agentClient.getCompetitionAgents(
      competitionId,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);
    if (!leaderboardResponse.success) throw new Error("Failed to get agents");

    // Find our agent in the leaderboard
    const agentEntry = leaderboardResponse.agents.find(
      (entry) => entry.id === agent.id,
    );
    expect(agentEntry).toBeDefined();

    // Verify risk metrics are present and calculated
    expect(agentEntry?.hasRiskMetrics).toBe(true);
    expect(agentEntry?.calmarRatio).not.toBeNull();
    expect(agentEntry?.simpleReturn).not.toBeNull();
    expect(agentEntry?.maxDrawdown).not.toBeNull();

    // Simple return calculation:
    // Portfolio goes from $1700 (first) → $1200 (trough) → $1550 (final)
    // Simple Return = ($1550 / $1700) - 1 = -0.088 or -8.8%
    expect(agentEntry?.simpleReturn).toBeCloseTo(-0.088, 2);

    // Max drawdown calculation:
    // Peak is $1700, trough is $1200
    // Drawdown = ($1200 / $1700) - 1 = -0.294 or -29.4%
    expect(agentEntry?.maxDrawdown).toBeCloseTo(-0.294, 2);

    // Calmar ratio = Annualized Return / |Max Drawdown|
    // For periods < 1 day, the service doesn't annualize (returns period return as-is)
    // So: Calmar = -0.088 / |−0.294| = -0.088 / 0.294 = -0.299
    // Negative because we have a negative return
    expect(agentEntry?.calmarRatio).toBeCloseTo(-0.299, 2);
  });

  test("should rank agents by Calmar ratio when available", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with different portfolio performance
    const { agent: agentVolatile } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Volatility",
      agentWalletAddress: "0x4444444444444444444444444444444444444444",
    });

    const { agent: agentPositive } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Positive PnL",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const { agent: agentNegative } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Negative PnL",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    // Start perps competition with all agents
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Calmar Ranking Test ${Date.now()}`,
      agentIds: [agentVolatile.id, agentPositive.id, agentNegative.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait to ensure transfers happen AFTER competition start
    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();

    // First sync - creates initial snapshot
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait a bit to ensure time passes between snapshots
    await wait(100);

    // Second sync - creates second snapshot (needed for simple return calculation)
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    await wait(500);

    // Get leaderboard
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);

    const typedLeaderboard = leaderboardResponse as CompetitionAgentsResponse;

    // Agent with worst Calmar ratio (volatility) should be ranked first
    // (negative Calmar due to losses and high drawdown)
    const firstAgent = typedLeaderboard.agents[0];
    expect(firstAgent?.id).toBe(agentVolatile.id);
    expect(firstAgent?.hasRiskMetrics).toBe(true);
    expect(firstAgent?.calmarRatio).not.toBeNull();

    // Other agents ranked by their Calmar ratios
    const secondAgent = typedLeaderboard.agents[1];
    const thirdAgent = typedLeaderboard.agents[2];

    // 0x1111 has $1250 equity (positive PnL), 0x2222 has $950 equity (negative PnL)
    expect(secondAgent?.id).toBe(agentPositive.id);
    // All agents have risk metrics calculated using simple returns
    expect(secondAgent?.hasRiskMetrics).toBe(true);
    expect(secondAgent?.calmarRatio).not.toBeNull();

    expect(thirdAgent?.id).toBe(agentNegative.id);
    // All agents have risk metrics calculated using simple returns
    expect(thirdAgent?.hasRiskMetrics).toBe(true);
    expect(thirdAgent?.calmarRatio).not.toBeNull();
  });

  test("should expose risk metrics in agent competitions endpoint", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with volatile portfolio for risk metrics testing
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Risk Metrics Test Agent",
        agentWalletAddress: "0x4444444444444444444444444444444444444444",
      });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Risk Metrics API Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Trigger sync
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    // Get agent competitions - should include risk metrics
    const competitionsResponse = await agentClient.getAgentCompetitions(
      agent.id,
    );
    expect(competitionsResponse.success).toBe(true);

    // Type assertion
    const typedResponse = competitionsResponse as {
      success: true;
      competitions: EnhancedCompetition[];
      pagination: unknown;
    };

    // Find our perps competition
    const perpsComp = typedResponse.competitions.find(
      (c) => c.id === competition.id,
    );
    expect(perpsComp).toBeDefined();
    expect(perpsComp?.type).toBe("perpetual_futures");

    // Verify risk metrics are included
    expect(perpsComp?.hasRiskMetrics).toBe(true);
    expect(perpsComp?.calmarRatio).not.toBeNull();
    expect(perpsComp?.simpleReturn).not.toBeNull();
    expect(perpsComp?.maxDrawdown).not.toBeNull();
  });

  test("should calculate risk metrics using simple return for all agents", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with flat performance (0x3333)
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Flat Performance Agent",
        agentWalletAddress: "0x3333333333333333333333333333333333333333",
      });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Simple Return Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Trigger sync
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    // Get leaderboard
    const leaderboardResponse = await agentClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);
    if (!leaderboardResponse.success) throw new Error("Failed to get agents");

    const agentEntry = leaderboardResponse.agents.find(
      (entry) => entry.id === agent.id,
    );

    // Agent should have risk metrics calculated using simple return
    expect(agentEntry).toBeDefined();
    expect(agentEntry?.hasRiskMetrics).toBe(true);
    expect(agentEntry?.calmarRatio).not.toBeNull();
    expect(agentEntry?.simpleReturn).not.toBeNull(); // Simple return
    expect(agentEntry?.maxDrawdown).not.toBeNull();

    // Portfolio value should match mock data
    expect(agentEntry?.portfolioValue).toBe(1100);
  });

  test("should detect and report competition transfer violations via admin endpoint", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with specific wallets
    // 0x4444 has transfers configured in mock Symphony server
    const { agent: agentWithTransfers } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With Transfer Violations",
        agentWalletAddress: "0x4444444444444444444444444444444444444444",
      });

    // 0x1111 has no transfers configured
    const { agent: agentNoTransfers } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Without Transfers",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Transfer Violation Detection Test ${Date.now()}`,
      agentIds: [agentWithTransfers.id, agentNoTransfers.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait to ensure competition is fully started
    await wait(1000);

    // Trigger sync to process transfers
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for processing to complete
    await wait(500);

    // Call the admin endpoint to check for transfer violations
    const violationsResponse =
      await adminClient.getCompetitionTransferViolations(competition.id);

    expect(violationsResponse.success).toBe(true);

    // Type assertion since we've verified success
    const typedViolationsResponse =
      violationsResponse as AdminCompetitionTransferViolationsResponse;

    // Should only include agents with transfers (violations)
    // 0x4444 has transfers configured in mock server
    expect(typedViolationsResponse.violations).toHaveLength(1);

    const violation = typedViolationsResponse.violations[0];
    expect(violation).toBeDefined();
    expect(violation?.agentId).toBe(agentWithTransfers.id);
    expect(violation?.agentName).toBe("Agent With Transfer Violations");
    expect(violation?.transferCount).toBeGreaterThan(0);

    // Agent without transfers should NOT be in the response
    const noTransferViolation = typedViolationsResponse.violations.find(
      (v) => v.agentId === agentNoTransfers.id,
    );
    expect(noTransferViolation).toBeUndefined();
  });

  test("should return empty array when no transfer violations exist", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents that don't have transfers in mock data
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Clean Agent 1",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Clean Agent 2",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `No Violations Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Trigger sync
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    // Check for violations - should be empty
    const violationsResponse =
      await adminClient.getCompetitionTransferViolations(competition.id);

    expect(violationsResponse.success).toBe(true);

    const typedViolationsResponse =
      violationsResponse as AdminCompetitionTransferViolationsResponse;
    expect(typedViolationsResponse.violations).toHaveLength(0);
  });

  test("should return 400 for non-perps competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading Agent for Violation Test",
    });

    // Start a PAPER TRADING competition (not perps)
    const response = await startTestCompetition({
      adminClient,
      name: `Paper Trading Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Try to get transfer violations for paper trading competition
    const violationsResponse =
      await adminClient.getCompetitionTransferViolations(competition.id);

    expect(violationsResponse.success).toBe(false);
    const errorResponse = violationsResponse as ErrorResponse;
    expect(errorResponse.status).toBe(400);
    expect(errorResponse.error).toContain(
      "not a perpetual futures competition",
    );
  });

  test("should return 404 for non-existent competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const fakeCompetitionId = randomUUID();

    // Try to get transfer violations for non-existent competition
    const violationsResponse =
      await adminClient.getCompetitionTransferViolations(fakeCompetitionId);

    expect(violationsResponse.success).toBe(false);
    const errorResponse = violationsResponse as ErrorResponse;
    expect(errorResponse.status).toBe(404);
    expect(errorResponse.error).toContain("not found");
  });

  test("should rank agents by Calmar ratio, NOT portfolio value", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register three agents with different expected outcomes:
    // Agent 1: Best Calmar (steady 20% growth, no drawdown)
    // Agent 2: Worst Calmar (negative return)
    // Agent 3: Middle Calmar (high return but with drawdown)
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Best Calmar - Steady Growth",
      agentWalletAddress: "0x3333333333333333333333333333333333333333", // Final: $1100
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Worst Calmar - Negative Return",
      agentWalletAddress: "0x2222222222222222222222222222222222222222", // Final: $950
    });

    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Middle Calmar - High Equity But Drawdown",
      agentWalletAddress: "0x1111111111111111111111111111111111111111", // Final: $1250 (HIGHEST!)
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Calmar Ratio Ranking Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Take initial snapshot to establish starting values
    const services = new ServiceRegistry();
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competition.id,
    );
    await wait(100);

    // Create snapshots AFTER competition starts with small time increments
    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    // Insert snapshots to simulate different performance patterns
    await db.insert(portfolioSnapshots).values([
      // Agent 1: Steady 10% growth, no drawdown → BEST Calmar
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1050,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1100,
        timestamp: minutesAgo(1),
      },

      // Agent 2: -5% loss → WORST Calmar (negative)
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 980,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 950,
        timestamp: minutesAgo(1),
      },

      // Agent 3: 25% gain with 10.7% drawdown → MIDDLE Calmar
      // Goes 1000 → 1400 (peak) → 1250 (drawdown)
      {
        agentId: agent3.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent3.id,
        competitionId: competition.id,
        totalValue: 1400,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent3.id,
        competitionId: competition.id,
        totalValue: 1250,
        timestamp: minutesAgo(1),
      },
    ]);

    // Process to calculate Calmar ratios with the historical data
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(1000);

    // Get the leaderboard as admin (uses active competition)
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );

    expect(leaderboardResponse.success).toBe(true);
    const typedResponse = leaderboardResponse as CompetitionAgentsResponse;

    // Verify we have all agents
    expect(typedResponse.agents).toHaveLength(3);

    // Find each agent in the leaderboard
    const agent1Entry = typedResponse.agents.find((e) => e.id === agent1.id);
    const agent2Entry = typedResponse.agents.find((e) => e.id === agent2.id);
    const agent3Entry = typedResponse.agents.find((e) => e.id === agent3.id);

    expect(agent1Entry).toBeDefined();
    expect(agent2Entry).toBeDefined();
    expect(agent3Entry).toBeDefined();

    // Verify ranking is by Calmar ratio, not portfolio value
    // Expected outcomes based on our mock data:
    // Agent 1 (Steady Growth): 10% return, 0% drawdown → Best Calmar
    // Agent 2 (Negative Return): -5% return → Worst Calmar (negative)
    // Agent 3 (High Equity): 25% return, 10.7% drawdown → Middle Calmar

    // Agent 3 has the HIGHEST portfolio value ($1250) but should NOT be first!
    expect(agent3Entry?.portfolioValue).toBe(1250); // Highest portfolio
    expect(agent3Entry?.rank).not.toBe(1); // But NOT rank 1

    // Agent 1 should rank first despite lower portfolio value
    expect(agent1Entry?.portfolioValue).toBe(1100); // Lower than agent 3
    expect(agent1Entry?.rank).toBe(1); // But ranks FIRST

    // Agent 2 should rank last
    expect(agent2Entry?.portfolioValue).toBe(950); // Lowest portfolio
    expect(agent2Entry?.rank).toBe(3); // And ranks LAST

    // Verify all agents are defined (already checked above with toBeDefined)
    expect(agent1Entry).toBeTruthy();
    expect(agent2Entry).toBeTruthy();
    expect(agent3Entry).toBeTruthy();

    // TypeScript narrowing - we've verified they're defined
    if (!agent1Entry || !agent2Entry || !agent3Entry) {
      throw new Error("Agents not properly defined in leaderboard");
    }

    // All agents should have risk metrics in this test
    expect(agent1Entry.hasRiskMetrics).toBe(true);
    expect(agent2Entry.hasRiskMetrics).toBe(true);
    expect(agent3Entry.hasRiskMetrics).toBe(true);

    // All have risk metrics - should be ranked by Calmar ratio
    const entries = [agent1Entry, agent2Entry, agent3Entry];
    const calmarRanking = [...entries].sort(
      (a, b) => (b.calmarRatio ?? -999999) - (a.calmarRatio ?? -999999),
    );

    const actualRanking = [...entries].sort((a, b) => a.rank - b.rank);

    // Rankings should match Calmar-based order, not portfolio value order
    expect(actualRanking[0]?.id).toBe(calmarRanking[0]?.id);
    expect(actualRanking[1]?.id).toBe(calmarRanking[1]?.id);
    expect(actualRanking[2]?.id).toBe(calmarRanking[2]?.id);

    // Verify this is different from portfolio value ranking
    const portfolioRanking = [...entries].sort(
      (a, b) => b.portfolioValue - a.portfolioValue,
    );

    // Verify that Calmar ranking is being used, not portfolio ranking
    // The rankings should differ since Agent 3 has highest portfolio but not best Calmar
    expect(calmarRanking[0]?.id).not.toBe(portfolioRanking[0]?.id);
    expect(actualRanking[0]?.id).toBe(calmarRanking[0]?.id);
    expect(actualRanking[0]?.id).not.toBe(portfolioRanking[0]?.id);
  });

  test("should preserve perps metrics and rankings when competition ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register three agents with different expected outcomes (same as ranking test)
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Steady Growth - For Ended Test",
      agentWalletAddress: "0x3333333333333333333333333333333333333333", // $1100
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Negative Return - For Ended Test",
      agentWalletAddress: "0x2222222222222222222222222222222222222222", // $950
    });

    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "High Equity Volatile - For Ended Test",
      agentWalletAddress: "0x1111111111111111111111111111111111111111", // $1250
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Ended Perps Preservation Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Take initial snapshot to establish starting values
    const services = new ServiceRegistry();
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competition.id,
    );
    await wait(100);

    // Create snapshots AFTER competition starts with small time increments
    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    // Insert snapshots to simulate different performance patterns
    await db.insert(portfolioSnapshots).values([
      // Agent 1: 10% return, no drawdown → Best Calmar
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1050,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1100,
        timestamp: minutesAgo(1),
      },

      // Agent 2: -5% return → Worst Calmar
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 980,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 950,
        timestamp: minutesAgo(1),
      },

      // Agent 3: 25% return with drawdown → Middle Calmar
      {
        agentId: agent3.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent3.id,
        competitionId: competition.id,
        totalValue: 1400,
        timestamp: minutesAgo(30), // Peak
      },
      {
        agentId: agent3.id,
        competitionId: competition.id,
        totalValue: 1250,
        timestamp: minutesAgo(1), // Drawdown from peak
      },
    ]);

    // Process to calculate Calmar ratios
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(1000);

    // ============ STEP 1: Get data while competition is ACTIVE ============

    // Get leaderboard via the admin endpoint (active competition)
    const activeLeaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(activeLeaderboardResponse.success).toBe(true);
    const activeLeaderboard = (
      activeLeaderboardResponse as CompetitionAgentsResponse
    ).agents;

    // Get competition details with agents (uses getCompetitionAgents)
    const activeCompResponse = await adminClient.getCompetition(competition.id);
    expect(activeCompResponse.success).toBe(true);

    // Store active metrics for each agent
    const activeMetrics = new Map<
      string,
      {
        rank: number;
        portfolioValue: number;
        calmarRatio: number | null;
        simpleReturn: number | null;
        maxDrawdown: number | null;
        hasRiskMetrics: boolean;
      }
    >();

    activeLeaderboard.forEach((entry) => {
      activeMetrics.set(entry.id, {
        rank: entry.rank,
        portfolioValue: entry.portfolioValue,
        calmarRatio: entry.calmarRatio ?? null,
        simpleReturn: entry.simpleReturn ?? null,
        maxDrawdown: entry.maxDrawdown ?? null,
        hasRiskMetrics: entry.hasRiskMetrics ?? false,
      });
    });

    // Verify active competition has correct ranking (Calmar-based, not portfolio-based)
    const agent1Active = activeLeaderboard.find((e) => e.id === agent1.id);
    const agent3Active = activeLeaderboard.find((e) => e.id === agent3.id);

    // First ensure both agents exist
    expect(agent1Active).toBeDefined();
    expect(agent3Active).toBeDefined();

    // Now we can safely assert without optional chaining
    expect(agent3Active?.portfolioValue).toBeGreaterThan(
      agent1Active!.portfolioValue,
    ); // Agent 3 has more money
    expect(agent1Active?.rank).toBeLessThan(agent3Active!.rank); // But Agent 1 ranks better

    // ============ STEP 2: END the competition ============

    const endResponse = await adminClient.endCompetition(competition.id);
    expect(endResponse.success).toBe(true);

    // Wait for any async operations to complete
    await wait(2000);

    // ============ STEP 3: Get data after competition is ENDED ============

    // Get competition details (should return saved data for ended competition)
    const endedCompResponse = await adminClient.getCompetition(competition.id);
    expect(endedCompResponse.success).toBe(true);
    const endedCompetition = (endedCompResponse as CompetitionDetailResponse)
      .competition;

    // Verify competition is ended
    expect(endedCompetition.status).toBe("ended");

    // Get leaderboard via the specific competition endpoint
    const endedLeaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(endedLeaderboardResponse.success).toBe(true);
    const endedAgents = (endedLeaderboardResponse as CompetitionAgentsResponse)
      .agents;

    // ============ STEP 4: Verify ALL metrics are PRESERVED ============

    endedAgents.forEach((agent: CompetitionAgent) => {
      const activeData = activeMetrics.get(agent.id);
      expect(activeData).toBeDefined();

      // Verify ranking is preserved
      expect(agent.rank).toBe(activeData?.rank);

      // Verify portfolio value is preserved
      expect(agent.portfolioValue).toBe(activeData?.portfolioValue);

      // Verify risk metrics are preserved EXACTLY
      expect(agent.calmarRatio).toBe(activeData?.calmarRatio);
      expect(agent.simpleReturn).toBe(activeData?.simpleReturn);
      expect(agent.maxDrawdown).toBe(activeData?.maxDrawdown);
      expect(agent.hasRiskMetrics).toBe(activeData?.hasRiskMetrics);
    });

    // ============ STEP 5: Verify Calmar-based ranking is still correct ============

    const agent1Ended = endedAgents.find(
      (a: CompetitionAgent) => a.id === agent1.id,
    );
    const agent2Ended = endedAgents.find(
      (a: CompetitionAgent) => a.id === agent2.id,
    );
    const agent3Ended = endedAgents.find(
      (a: CompetitionAgent) => a.id === agent3.id,
    );

    expect(agent1Ended).toBeDefined();
    expect(agent2Ended).toBeDefined();
    expect(agent3Ended).toBeDefined();

    // Agent 1 should still rank first (best Calmar)
    expect(agent1Ended?.rank).toBe(1);

    // Agent 3 should still have highest portfolio but NOT rank first
    expect(agent3Ended?.portfolioValue).toBe(1250);
    expect(agent3Ended?.rank).not.toBe(1);

    // Agent 2 should still rank last
    expect(agent2Ended?.rank).toBe(3);

    // ============ STEP 6: Verify data persists across multiple fetches ============

    // Fetch again to ensure data is consistently retrieved from DB
    const refetchResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(refetchResponse.success).toBe(true);
    const refetchedAgents = (refetchResponse as CompetitionAgentsResponse)
      .agents;

    // Should still have same metrics
    refetchedAgents.forEach((agent: CompetitionAgent) => {
      const activeData = activeMetrics.get(agent.id);
      expect(activeData).toBeDefined();

      expect(agent.calmarRatio).toBe(activeData?.calmarRatio);
      expect(agent.simpleReturn).toBe(activeData?.simpleReturn);
      expect(agent.maxDrawdown).toBe(activeData?.maxDrawdown);
    });
  });

  test("should start a perps competition with Hyperliquid provider", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for this test
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Test Agent 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Test Agent 2",
    });

    // Start a perps competition with Hyperliquid
    const competitionName = `Hyperliquid Perps Test ${Date.now()}`;
    const response = await startPerpsTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
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

  test("should sync agent positions from Hyperliquid to database", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with pre-configured Hyperliquid wallet addresses
    const { agent: agentBTC, client: agentBTCClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid BTC Position Agent",
        agentWalletAddress: "0x5555555555555555555555555555555555555555", // Pre-configured with BTC long
      });

    const { agent: agentETH, client: agentETHClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid ETH Position Agent",
        agentWalletAddress: "0x6666666666666666666666666666666666666666", // Pre-configured with ETH short
      });

    const { agent: agentNoPos, client: agentNoPosClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid No Positions Agent",
        agentWalletAddress: "0x7777777777777777777777777777777777777777", // Pre-configured with closed positions only
      });

    // Start a Hyperliquid perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Position Sync Test ${Date.now()}`,
      agentIds: [agentBTC.id, agentETH.id, agentNoPos.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Trigger sync from Hyperliquid
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await wait(500);

    // Verify BTC agent's position
    const btcPositions = await agentBTCClient.getPerpsPositions();
    expect(btcPositions.success).toBe(true);
    const typedBTCPositions = btcPositions as PerpsPositionsResponse;
    expect(typedBTCPositions.positions).toHaveLength(1);

    const btcPosition = typedBTCPositions.positions[0];
    expect(btcPosition?.marketSymbol).toBe("BTC");
    expect(btcPosition?.isLong).toBe(true);
    expect(btcPosition?.size).toBe(23500);
    expect(btcPosition?.averagePrice).toBe(45000);
    expect(btcPosition?.unrealizedPnl).toBe(1000);

    // Verify BTC agent's account summary
    const btcAccount = await agentBTCClient.getPerpsAccount();
    expect(btcAccount.success).toBe(true);
    const typedBTCAccount = btcAccount as PerpsAccountResponse;
    expect(typedBTCAccount.account.totalEquity).toBe("1250");
    expect(typedBTCAccount.account.availableBalance).toBe("450");
    expect(typedBTCAccount.account.marginUsed).toBe("800");
    expect(typedBTCAccount.account.openPositions).toBe(1);

    // Verify ETH agent's position (short)
    const ethPositions = await agentETHClient.getPerpsPositions();
    expect(ethPositions.success).toBe(true);
    const typedETHPositions = ethPositions as PerpsPositionsResponse;
    expect(typedETHPositions.positions).toHaveLength(1);

    const ethPosition = typedETHPositions.positions[0];
    expect(ethPosition?.marketSymbol).toBe("ETH");
    expect(ethPosition?.isLong).toBe(false);
    expect(ethPosition?.size).toBe(6300);
    expect(ethPosition?.averagePrice).toBe(3200);
    expect(ethPosition?.unrealizedPnl).toBe(-50);

    // Verify agent with no open positions
    const noPositions = await agentNoPosClient.getPerpsPositions();
    expect(noPositions.success).toBe(true);
    const typedNoPositions = noPositions as PerpsPositionsResponse;
    expect(typedNoPositions.positions).toHaveLength(0);

    const noPosAccount = await agentNoPosClient.getPerpsAccount();
    expect(noPosAccount.success).toBe(true);
    const typedNoPosAccount = noPosAccount as PerpsAccountResponse;
    expect(typedNoPosAccount.account.totalEquity).toBe("1100");
    expect(typedNoPosAccount.account.openPositions).toBe(0);
  });

  test("should calculate Calmar ratio with Hyperliquid data", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with volatile portfolio wallet
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Calmar Test Agent",
        agentWalletAddress: "0x8888888888888888888888888888888888888888", // Pre-configured for volatility testing
      });

    // Start Hyperliquid perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Calmar Test ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    const services = new ServiceRegistry();

    // First sync - peak equity
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    // Second sync - trough
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    // Third sync - recovery
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for calculations
    await wait(1000);

    // Get leaderboard with risk metrics
    const leaderboardResponse = (await agentClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    )) as CompetitionAgentsResponse;
    expect(leaderboardResponse.success).toBe(true);

    const agentEntry = leaderboardResponse.agents.find(
      (entry) => entry.id === agent.id,
    );

    expect(agentEntry).toBeDefined();
    expect(agentEntry?.hasRiskMetrics).toBe(true);
    expect(agentEntry?.calmarRatio).not.toBeNull();
    expect(agentEntry?.simpleReturn).not.toBeNull();
    expect(agentEntry?.maxDrawdown).not.toBeNull();

    // Portfolio: $1700 → $1200 → $1550
    // Simple Return = ($1550 / $1700) - 1 = -0.088
    expect(agentEntry?.simpleReturn).toBeCloseTo(-0.088, 2);

    // Max drawdown = ($1200 / $1700) - 1 = -0.294
    expect(agentEntry?.maxDrawdown).toBeCloseTo(-0.294, 2);

    // Calmar = -0.088 / 0.294 = -0.299
    expect(agentEntry?.calmarRatio).toBeCloseTo(-0.299, 2);
  });

  test("should detect transfer violations with Hyperliquid provider", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with transfers configured in mock
    const { agent: agentWithTransfers } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Agent With Transfers",
        agentWalletAddress: "0x8888888888888888888888888888888888888888", // Has test transfers
      });

    const { agent: agentClean } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Clean Agent",
      agentWalletAddress: "0x5555555555555555555555555555555555555555", // No transfers
    });

    // Start Hyperliquid competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Transfer Violation Test ${Date.now()}`,
      agentIds: [agentWithTransfers.id, agentClean.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Process competition to detect transfers
    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    // Check for violations
    const violationsResponse =
      await adminClient.getCompetitionTransferViolations(competition.id);

    expect(violationsResponse.success).toBe(true);
    const typedViolationsResponse =
      violationsResponse as AdminCompetitionTransferViolationsResponse;

    // Should only report agent with transfers
    expect(typedViolationsResponse.violations).toHaveLength(1);

    const violation = typedViolationsResponse.violations[0];
    expect(violation?.agentId).toBe(agentWithTransfers.id);
    expect(violation?.agentName).toBe("Hyperliquid Agent With Transfers");
    expect(violation?.transferCount).toBeGreaterThan(0);

    // Clean agent should not appear
    const cleanViolation = typedViolationsResponse.violations.find(
      (v) => v.agentId === agentClean.id,
    );
    expect(cleanViolation).toBeUndefined();
  });

  test("should sync multiple positions per agent from Hyperliquid", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agentMulti, client: agentMultiClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Multi-Position Agent",
        agentWalletAddress: "0x9999999999999999999999999999999999999999",
      });

    const { agent: agentBTC } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid BTC Only Agent",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Multi-Position Test ${Date.now()}`,
      agentIds: [agentMulti.id, agentBTC.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    const multiPositions = await agentMultiClient.getPerpsPositions();
    expect(multiPositions.success).toBe(true);
    const typedMultiPositions = multiPositions as PerpsPositionsResponse;
    expect(typedMultiPositions.positions).toHaveLength(3);

    const btcPos = typedMultiPositions.positions.find(
      (p) => p.marketSymbol === "BTC",
    );
    const ethPos = typedMultiPositions.positions.find(
      (p) => p.marketSymbol === "ETH",
    );
    const solPos = typedMultiPositions.positions.find(
      (p) => p.marketSymbol === "SOL",
    );

    expect(btcPos).toBeDefined();
    expect(ethPos).toBeDefined();
    expect(solPos).toBeDefined();

    expect(btcPos?.isLong).toBe(true);
    expect(ethPos?.isLong).toBe(false);
    expect(solPos?.isLong).toBe(true);

    const multiAccount = await agentMultiClient.getPerpsAccount();
    expect(multiAccount.success).toBe(true);
    const typedMultiAccount = multiAccount as PerpsAccountResponse;
    expect(typedMultiAccount.account.openPositions).toBe(3);
    expect(typedMultiAccount.account.totalVolume).toBe("66700"); // Realistic volume from 6 fills
  });

  test("should rank multiple Hyperliquid agents by Calmar ratio", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agentSteady } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Steady Growth",
      agentWalletAddress: "0x7777777777777777777777777777777777777777",
    });

    const { agent: agentVolatile } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Volatile",
      agentWalletAddress: "0x8888888888888888888888888888888888888888",
    });

    const { agent: agentNegative } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Negative",
      agentWalletAddress: "0x6666666666666666666666666666666666666666",
    });

    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Ranking Test ${Date.now()}`,
      agentIds: [agentSteady.id, agentVolatile.id, agentNegative.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    const services = new ServiceRegistry();
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competition.id,
    );
    await wait(100);

    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    await db.insert(portfolioSnapshots).values([
      {
        agentId: agentSteady.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agentSteady.id,
        competitionId: competition.id,
        totalValue: 1100,
        timestamp: minutesAgo(1),
      },
      {
        agentId: agentVolatile.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agentVolatile.id,
        competitionId: competition.id,
        totalValue: 1700,
        timestamp: minutesAgo(30), // Peak
      },
      {
        agentId: agentVolatile.id,
        competitionId: competition.id,
        totalValue: 1550,
        timestamp: minutesAgo(1),
      },
      {
        agentId: agentNegative.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agentNegative.id,
        competitionId: competition.id,
        totalValue: 850,
        timestamp: minutesAgo(1),
      },
    ]);

    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(1000);

    const leaderboardResponse = (await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    )) as CompetitionAgentsResponse;
    expect(leaderboardResponse.success).toBe(true);

    expect(leaderboardResponse.agents).toHaveLength(3);

    const steadyEntry = leaderboardResponse.agents.find(
      (e) => e.id === agentSteady.id,
    );
    const volatileEntry = leaderboardResponse.agents.find(
      (e) => e.id === agentVolatile.id,
    );
    const negativeEntry = leaderboardResponse.agents.find(
      (e) => e.id === agentNegative.id,
    );

    expect(steadyEntry).toBeDefined();
    expect(volatileEntry).toBeDefined();
    expect(negativeEntry).toBeDefined();

    expect(steadyEntry?.rank).toBe(1);
    expect(volatileEntry?.rank).toBe(2);
    expect(negativeEntry?.rank).toBe(3);

    expect(volatileEntry?.portfolioValue).toBeGreaterThan(
      steadyEntry!.portfolioValue,
    );
    expect(steadyEntry?.rank).toBeLessThan(volatileEntry!.rank);
  });

  test("should get Hyperliquid competition summary with correct aggregations", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Summary Agent 1",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Summary Agent 2",
      agentWalletAddress: "0x6666666666666666666666666666666666666666",
    });

    const { agent: agent3, client: agent3Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Summary Agent 3",
        agentWalletAddress: "0x7777777777777777777777777777777777777777",
      });

    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Summary Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id, agent3.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    const competitionDetails = (await agent3Client.getCompetition(
      competition.id,
    )) as CompetitionDetailResponse;

    expect(competitionDetails.success).toBe(true);
    expect(competitionDetails.competition).toBeDefined();
    const stats = competitionDetails.competition.stats;
    expect(competitionDetails.competition.id).toBe(competition.id);
    expect(stats?.totalAgents).toBe(3);
    expect(stats?.totalPositions).toBe(2);
    expect(stats?.totalVolume).toBeGreaterThanOrEqual(30000);
  });

  test("should paginate all Hyperliquid positions with embedded agent info", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Paginated Agent 1",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Paginated Agent 2",
      agentWalletAddress: "0x9999999999999999999999999999999999999999",
    });

    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Pagination Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    const allPositions = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
    );
    expect(allPositions.success).toBe(true);
    const typedAllPositions =
      allPositions as CompetitionAllPerpsPositionsResponse;
    expect(typedAllPositions.positions).toHaveLength(4);

    const btcPosition = typedAllPositions.positions.find(
      (p) => p.marketSymbol === "BTC" && p.agentId === agent1.id,
    );
    expect(btcPosition).toBeDefined();
    expect(btcPosition?.agent).toBeDefined();
    expect(btcPosition?.agent.name).toBe("Hyperliquid Paginated Agent 1");

    const page1 = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
      2,
      0,
    );
    expect(page1.success).toBe(true);
    const typedPage1 = page1 as CompetitionAllPerpsPositionsResponse;
    expect(typedPage1.positions).toHaveLength(2);
    expect(typedPage1.pagination.hasMore).toBe(true);

    const page2 = await adminClient.getCompetitionAllPerpsPositions(
      competition.id,
      2,
      2,
    );
    expect(page2.success).toBe(true);
    const typedPage2 = page2 as CompetitionAllPerpsPositionsResponse;
    expect(typedPage2.positions).toHaveLength(2);
    expect(typedPage2.pagination.hasMore).toBe(false);
  });

  test("should preserve Hyperliquid data when competition ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid End Test Agent 1",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid End Test Agent 2",
      agentWalletAddress: "0x6666666666666666666666666666666666666666",
    });

    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid End Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    const services = new ServiceRegistry();
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competition.id,
    );
    await wait(100);

    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    await db.insert(portfolioSnapshots).values([
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent1.id,
        competitionId: competition.id,
        totalValue: 1250,
        timestamp: minutesAgo(1),
      },
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent2.id,
        competitionId: competition.id,
        totalValue: 850,
        timestamp: minutesAgo(1),
      },
    ]);

    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(1000);

    const activeLeaderboardResponse = (await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    )) as CompetitionAgentsResponse;
    expect(activeLeaderboardResponse.success).toBe(true);
    const activeLeaderboard = activeLeaderboardResponse.agents;

    const activeMetrics = new Map<
      string,
      {
        rank: number;
        portfolioValue: number;
        calmarRatio: number | null;
        simpleReturn: number | null;
        maxDrawdown: number | null;
        hasRiskMetrics: boolean;
      }
    >();

    activeLeaderboard.forEach((entry) => {
      activeMetrics.set(entry.id, {
        rank: entry.rank,
        portfolioValue: entry.portfolioValue,
        calmarRatio: entry.calmarRatio ?? null,
        simpleReturn: entry.simpleReturn ?? null,
        maxDrawdown: entry.maxDrawdown ?? null,
        hasRiskMetrics: entry.hasRiskMetrics ?? false,
      });
    });

    const endResponse = await adminClient.endCompetition(competition.id);
    expect(endResponse.success).toBe(true);
    await wait(2000);

    const endedCompResponse = await adminClient.getCompetition(competition.id);
    expect(endedCompResponse.success).toBe(true);
    const endedCompetition = (endedCompResponse as CompetitionDetailResponse)
      .competition;
    expect(endedCompetition.status).toBe("ended");

    const endedLeaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(endedLeaderboardResponse.success).toBe(true);
    const endedAgents = (endedLeaderboardResponse as CompetitionAgentsResponse)
      .agents;

    endedAgents.forEach((agent: CompetitionAgent) => {
      const activeData = activeMetrics.get(agent.id);
      expect(activeData).toBeDefined();

      expect(agent.rank).toBe(activeData?.rank);
      expect(agent.portfolioValue).toBe(activeData?.portfolioValue);
      expect(agent.calmarRatio).toBe(activeData?.calmarRatio);
      expect(agent.simpleReturn).toBe(activeData?.simpleReturn);
      expect(agent.maxDrawdown).toBe(activeData?.maxDrawdown);
      expect(agent.hasRiskMetrics).toBe(activeData?.hasRiskMetrics);
    });
  });

  test("should verify Hyperliquid trading volume calculations", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agentActive, client: agentActiveClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Active Trader",
        agentWalletAddress: "0x9999999999999999999999999999999999999999",
      });

    const { agent: agentMinimal } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Minimal Trader",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Volume Test ${Date.now()}`,
      agentIds: [agentActive.id, agentMinimal.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    const services = new ServiceRegistry();
    await services.perpsDataProcessor.processPerpsCompetition(competition.id);
    await wait(500);

    const activeAccount = await agentActiveClient.getPerpsAccount();
    expect(activeAccount.success).toBe(true);
    const typedActiveAccount = activeAccount as PerpsAccountResponse;
    expect(typedActiveAccount.account.totalVolume).toBe("66700"); // Realistic volume from 6 fills

    const competitionDetails = (await adminClient.getCompetition(
      competition.id,
    )) as CompetitionDetailResponse;
    expect(competitionDetails.success).toBe(true);
    expect(competitionDetails.competition).toBeDefined();
    const stats = competitionDetails.competition.stats;
    expect(stats?.totalVolume).toBeGreaterThanOrEqual(75000);
  });

  test("should require wallet address for agents joining perps competitions", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // First register a user with a normal agent
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Initial Agent",
    });

    // Now create an agent WITHOUT a wallet address for this user
    const agentNoWalletResponse = (await adminClient.registerAgent({
      user: { id: user.id },
      agent: {
        name: "Agent Without Wallet",
        handle: generateTestHandle("Agent Without Wallet"),
        description: "Test agent without wallet",
        // Explicitly NOT providing walletAddress
      },
    })) as AdminAgentResponse;
    const agentNoWallet = agentNoWalletResponse.agent;
    const agentNoWalletClient = new ApiClient(agentNoWallet.apiKey);

    // Register an agent WITH a wallet address for comparison
    const { agent: agentWithWallet, client: agentWithWalletClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With Wallet",
        agentWalletAddress: "0x1234567890123456789012345678901234567890",
      });

    // Create a perps competition
    const competitionResponse = await adminClient.createCompetition({
      name: `Wallet Validation Test ${Date.now()}`,
      type: "perpetual_futures",
      startDate: new Date(Date.now() + 86400000).toISOString(), // Start tomorrow
      endDate: new Date(Date.now() + 172800000).toISOString(), // End in 2 days
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 100,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(competitionResponse.success).toBe(true);
    const typedCompetitionResponse = competitionResponse as {
      success: true;
      competition: { id: string; status: string };
    };
    const competition = typedCompetitionResponse.competition;

    // Test 1: Agent WITHOUT wallet should FAIL to join perps competition
    const joinNoWalletResponse = await agentNoWalletClient.joinCompetition(
      competition.id,
      agentNoWallet.id,
    );
    expect(joinNoWalletResponse.success).toBe(false);
    const joinErrorResponse = joinNoWalletResponse as ErrorResponse;
    expect(joinErrorResponse.status).toBe(400);
    expect(joinErrorResponse.error).toContain("wallet address");
    expect(joinErrorResponse.error).toContain("perpetual futures");

    // Test 2: Agent WITH wallet should SUCCEED to join
    const joinWithWalletResponse = await agentWithWalletClient.joinCompetition(
      competition.id,
      agentWithWallet.id,
    );
    expect(joinWithWalletResponse.success).toBe(true);

    // Test 3: Try to start competition with agent without wallet - should FAIL
    const startWithNoWalletResponse = await adminClient.startCompetition({
      competitionId: competition.id,
      agentIds: [agentNoWallet.id, agentWithWallet.id],
    });
    expect(startWithNoWalletResponse.success).toBe(false);
    const startErrorResponse = startWithNoWalletResponse as ErrorResponse;
    expect(startErrorResponse.error).toContain("wallet address");
    expect(startErrorResponse.error).toContain(agentNoWallet.name);

    // Test 4: Starting with only the agent WITH wallet should SUCCEED
    const startWithWalletResponse = await adminClient.startCompetition({
      competitionId: competition.id,
      agentIds: [agentWithWallet.id],
    });
    expect(startWithWalletResponse.success).toBe(true);
    const typedStartResponse = startWithWalletResponse as {
      success: true;
      competition: { status: string };
    };
    expect(typedStartResponse.competition.status).toBe("active");

    // End the competition to clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should prevent admin from adding agent without wallet to perps competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // First register a user with a normal agent
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Initial Agent Admin Test",
    });

    // Now create an agent WITHOUT a wallet address for this user
    const agentNoWalletResponse = (await adminClient.registerAgent({
      user: { id: user.id },
      agent: {
        name: "Admin Test No Wallet",
        handle: generateTestHandle("Admin Test No Wallet"),
        description: "Test agent without wallet for admin endpoint",
        // Explicitly NOT providing walletAddress
      },
    })) as AdminAgentResponse;
    const agentNoWallet = agentNoWalletResponse.agent;

    // Create a perps competition
    const competitionResponse = await adminClient.createCompetition({
      name: `Admin Wallet Validation Test ${Date.now()}`,
      type: "perpetual_futures",
      startDate: new Date(Date.now() + 86400000).toISOString(), // Start tomorrow
      endDate: new Date(Date.now() + 172800000).toISOString(), // End in 2 days
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        selfFundingThreshold: 100,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(competitionResponse.success).toBe(true);
    const typedCompetitionResponse = competitionResponse as {
      success: true;
      competition: { id: string; status: string };
    };
    const competition = typedCompetitionResponse.competition;

    // Admin should NOT be able to add agent without wallet to perps competition
    const addAgentResponse = await adminClient.addAgentToCompetition(
      competition.id,
      agentNoWallet.id,
    );

    expect(addAgentResponse.success).toBe(false);
    const addErrorResponse = addAgentResponse as ErrorResponse;
    expect(addErrorResponse.error).toContain("wallet address");
    expect(addErrorResponse.error).toContain("perpetual futures");

    // Verify agent with wallet CAN be added by admin
    const { agent: agentWithWallet } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Admin Test With Wallet",
      agentWalletAddress: "0xabcdef1234567890123456789012345678901234",
    });

    const addWithWalletResponse = await adminClient.addAgentToCompetition(
      competition.id,
      agentWithWallet.id,
    );

    expect(addWithWalletResponse.success).toBe(true);

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should allow agents without wallets to join paper trading competitions", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // First register a user with a normal agent
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Initial Paper Agent",
    });

    // Now create an agent WITHOUT a wallet address for this user
    const agentNoWalletResponse = (await adminClient.registerAgent({
      user: { id: user.id },
      agent: {
        name: "Paper Trading Agent No Wallet",
        handle: generateTestHandle("Paper Trading Agent No Wallet"),
        description: "Test paper trading agent without wallet",
        // Explicitly NOT providing walletAddress
      },
    })) as AdminAgentResponse;
    const agentNoWallet = agentNoWalletResponse.agent;
    const agentNoWalletClient = new ApiClient(agentNoWallet.apiKey);

    // Create a PAPER TRADING competition (not perps)
    const competitionResponse = await adminClient.createCompetition({
      name: `Paper Trading No Wallet Test ${Date.now()}`,
      type: "trading", // Paper trading, not perps
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
    });

    expect(competitionResponse.success).toBe(true);
    const typedCompetitionResponse = competitionResponse as {
      success: true;
      competition: { id: string; status: string };
    };
    const competition = typedCompetitionResponse.competition;

    // Agent WITHOUT wallet should SUCCEED to join paper trading competition
    const joinResponse = await agentNoWalletClient.joinCompetition(
      competition.id,
      agentNoWallet.id,
    );
    expect(joinResponse.success).toBe(true);

    // Should also be able to start the competition
    const startResponse = await adminClient.startCompetition({
      competitionId: competition.id,
      agentIds: [agentNoWallet.id],
    });
    expect(startResponse.success).toBe(true);
    const typedStartResponse = startResponse as {
      success: true;
      competition: { status: string };
    };
    expect(typedStartResponse.competition.status).toBe("active");

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should enforce minFundingThreshold during competition startup with Symphony provider", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with specific wallet addresses that have known equity values
    const { agent: agentAbove } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Above Threshold",
      agentWalletAddress: "0xcccc111111111111111111111111111111111111", // $500
    });

    const { agent: agentBelow } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Below Threshold",
      agentWalletAddress: "0xbbbb111111111111111111111111111111111111", // $100
    });

    const { agent: agentExact } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Exactly At Threshold",
      agentWalletAddress: "0xaaaa111111111111111111111111111111111111", // $250
    });

    // Start competition with minFundingThreshold of $250
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Min Funding Threshold Test ${Date.now()}`,
      agentIds: [agentAbove.id, agentBelow.id, agentExact.id],
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        minFundingThreshold: 250, // Set the threshold
        apiUrl: "http://localhost:4567",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for the monitoring to complete
    await wait(2000);

    // Get the updated competition agents list
    const agentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);
    const typedResponse = agentsResponse as CompetitionAgentsResponse;

    // Agent above threshold should remain
    const remainingAbove = typedResponse.agents.find(
      (a) => a.id === agentAbove.id,
    );
    expect(remainingAbove).toBeDefined();

    // Agent below threshold should be removed
    const remainingBelow = typedResponse.agents.find(
      (a) => a.id === agentBelow.id,
    );
    expect(remainingBelow).toBeUndefined();

    // Agent exactly at threshold should remain (not < threshold)
    const remainingExact = typedResponse.agents.find(
      (a) => a.id === agentExact.id,
    );
    expect(remainingExact).toBeDefined();

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should enforce minFundingThreshold during competition startup with Hyperliquid provider", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with specific Hyperliquid wallet addresses
    const { agent: agentAbove } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Agent Above",
      agentWalletAddress: "0xcccc222222222222222222222222222222222222", // $500
    });

    const { agent: agentBelow } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Agent Below",
      agentWalletAddress: "0xbbbb222222222222222222222222222222222222", // $100
    });

    const { agent: agentJustBelow } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Hyperliquid Agent Just Below",
      agentWalletAddress: "0xdddd222222222222222222222222222222222222", // $249.99
    });

    // Start competition with minFundingThreshold
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Hyperliquid Min Funding Test ${Date.now()}`,
      agentIds: [agentAbove.id, agentBelow.id, agentJustBelow.id],
      perpsProvider: {
        provider: "hyperliquid",
        minFundingThreshold: 250,
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for monitoring
    await wait(2000);

    // Get updated agents list
    const agentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);
    const typedResponse = agentsResponse as CompetitionAgentsResponse;

    // Agent above should remain
    const remainingAbove = typedResponse.agents.find(
      (a) => a.id === agentAbove.id,
    );
    expect(remainingAbove).toBeDefined();

    // Agent below should be removed
    const remainingBelow = typedResponse.agents.find(
      (a) => a.id === agentBelow.id,
    );
    expect(remainingBelow).toBeUndefined();

    // Agent just below ($249.99) should be removed
    const remainingJustBelow = typedResponse.agents.find(
      (a) => a.id === agentJustBelow.id,
    );
    expect(remainingJustBelow).toBeUndefined();

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should not enforce threshold when minFundingThreshold is not set", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with low balances
    const { agent: agentLow1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Low Balance Agent 1",
      agentWalletAddress: "0xbbbb111111111111111111111111111111111111", // $100
    });

    const { agent: agentLow2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Low Balance Agent 2",
      agentWalletAddress: "0xdddd111111111111111111111111111111111111", // $249.99
    });

    // Start competition WITHOUT minFundingThreshold
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `No Threshold Test ${Date.now()}`,
      agentIds: [agentLow1.id, agentLow2.id],
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        // NOT setting minFundingThreshold
        apiUrl: "http://localhost:4567",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for monitoring
    await wait(2000);

    // Get agents list
    const agentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);
    const typedResponse = agentsResponse as CompetitionAgentsResponse;

    // Both agents should remain (no threshold enforcement)
    expect(typedResponse.agents).toHaveLength(2);

    const agent1Present = typedResponse.agents.find(
      (a) => a.id === agentLow1.id,
    );
    expect(agent1Present).toBeDefined();

    const agent2Present = typedResponse.agents.find(
      (a) => a.id === agentLow2.id,
    );
    expect(agent2Present).toBeDefined();

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should handle agents that fail to sync when checking minFundingThreshold", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with known wallet
    const { agent: agentWithData } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Data",
      agentWalletAddress: "0xcccc111111111111111111111111111111111111", // $500
    });

    // Register agent with a wallet that has no mock data (will fail to sync)
    const { agent: agentNoData } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Without Sync Data",
      agentWalletAddress: "0xeeee111111111111111111111111111111111111", // Not in mock data
    });

    // Start competition with minFundingThreshold
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Failed Sync Threshold Test ${Date.now()}`,
      agentIds: [agentWithData.id, agentNoData.id],
      perpsProvider: {
        provider: "symphony",
        minFundingThreshold: 250,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for monitoring
    await wait(2000);

    // Get agents list
    const agentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);
    const typedResponse = agentsResponse as CompetitionAgentsResponse;

    // Agent with data above threshold should remain
    const agentWithDataPresent = typedResponse.agents.find(
      (a) => a.id === agentWithData.id,
    );
    expect(agentWithDataPresent).toBeDefined();

    // Agent without sync data should remain (no snapshot = not checked)
    const agentNoDataPresent = typedResponse.agents.find(
      (a) => a.id === agentNoData.id,
    );
    expect(agentNoDataPresent).toBeDefined();

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should properly track removed agents in competition stats", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent500 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 500",
      agentWalletAddress: "0xcccc111111111111111111111111111111111111", // $500
    });

    const { agent: agent100 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 100",
      agentWalletAddress: "0xbbbb111111111111111111111111111111111111", // $100
    });

    const { agent: agent250 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 250",
      agentWalletAddress: "0xaaaa111111111111111111111111111111111111", // $250
    });

    // Start with 3 agents (one below threshold)
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Stats Update Test ${Date.now()}`,
      agentIds: [agent500.id, agent100.id, agent250.id],
      perpsProvider: {
        provider: "symphony",
        minFundingThreshold: 250,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // After startup enforcement, only 2 agents should remain (agent100 removed for being below $250)
    expect(competition.agentIds).toHaveLength(2);

    // Verify the removed agent is the one below threshold
    expect(competition.agentIds).toContain(agent500.id); // $500 - should remain
    expect(competition.agentIds).toContain(agent250.id); // $250 - exactly at threshold, should remain
    expect(competition.agentIds).not.toContain(agent100.id); // $100 - below threshold, should be removed

    // Get competition details to verify stats
    const detailsResponse = await adminClient.getCompetition(competition.id);
    expect(detailsResponse.success).toBe(true);
    const typedDetails = detailsResponse as CompetitionDetailResponse;

    // Stats should show only 2 agents
    expect(typedDetails.competition.stats?.totalAgents).toBe(2);

    // Verify through agents endpoint as well
    const agentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);
    const typedAgents = agentsResponse as CompetitionAgentsResponse;
    expect(typedAgents.agents).toHaveLength(2);

    // Verify the correct agents remain
    const agentIds = typedAgents.agents.map((a) => a.id);
    expect(agentIds).toContain(agent500.id);
    expect(agentIds).toContain(agent250.id);
    expect(agentIds).not.toContain(agent100.id);

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  describe("Daily Volume Requirements", () => {
    test("should remove agent with insufficient daily volume after 24h (Symphony)", async () => {
      const adminClient = createTestClient(getBaseUrl());
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent with insufficient volume wallet
      const { agent: agentLowVolume } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Low Volume Agent",
        agentWalletAddress: "0xeeee111111111111111111111111111111111111", // $100 volume (insufficient)
      });

      // Start competition with startDate = 24 hours ago (key for triggering check!)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await startPerpsTestCompetition({
        adminClient,
        name: `Volume Enforcement Test ${Date.now()}`,
        agentIds: [agentLowVolume.id],
        perpsProvider: {
          provider: "symphony",
          apiUrl: "http://localhost:4567",
        },
        startDate: twentyFourHoursAgo.toISOString(), // Start 24h ago!
      });

      expect(response.success).toBe(true);
      const competition = response.competition;

      // Manually update competition startDate to 24h ago (gets overwritten during start)
      await db
        .update(competitions)
        .set({ startDate: twentyFourHoursAgo })
        .where(eq(competitions.id, competition.id));

      await wait(1000);

      const services = new ServiceRegistry();

      // First sync - creates initial snapshot at current time
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Manually create a historical account summary from 24h ago
      // This is the "yesterday" record the volume check will compare against
      await db.insert(perpsAccountSummaries).values({
        agentId: agentLowVolume.id,
        competitionId: competition.id,
        timestamp: twentyFourHoursAgo, // 24h ago - matches competition start
        totalEquity: "500", // Started with $500
        initialCapital: "500",
        totalVolume: "0", // No volume 24h ago
        totalUnrealizedPnl: null,
        totalRealizedPnl: null,
        totalPnl: null,
        totalFeesPaid: null,
        availableBalance: null,
        marginUsed: null,
        totalTrades: null,
        openPositionsCount: null,
        closedPositionsCount: null,
        liquidatedPositionsCount: null,
        roi: null,
        roiPercent: null,
        averageTradeSize: null,
        accountStatus: null,
        rawData: null,
      });

      await wait(100);

      // Second sync - triggers 24h check (volume = $100, required = $250)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Verify agent was removed
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(agentsResponse.success).toBe(true);
      const typedResponse = agentsResponse as CompetitionAgentsResponse;
      expect(typedResponse.agents).toHaveLength(0); // Agent removed!

      // Clean up
      await adminClient.endCompetition(competition.id);
    });

    test("should keep agent with sufficient daily volume after 24h (Symphony)", async () => {
      const adminClient = createTestClient(getBaseUrl());
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent with sufficient volume wallet
      const { agent: agentGoodVolume } = await registerUserAndAgentAndGetClient(
        {
          adminApiKey,
          agentName: "Good Volume Agent",
          agentWalletAddress: "0xffff111111111111111111111111111111111111", // $400 volume (sufficient)
        },
      );

      // Start competition 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await startPerpsTestCompetition({
        adminClient,
        name: `Volume Enforcement Pass Test ${Date.now()}`,
        agentIds: [agentGoodVolume.id],
        perpsProvider: {
          provider: "symphony",
          apiUrl: "http://localhost:4567",
        },
        startDate: twentyFourHoursAgo.toISOString(),
      });

      expect(response.success).toBe(true);
      const competition = response.competition;

      await wait(1000);

      const services = new ServiceRegistry();

      // First sync - creates initial snapshot (volume = 0)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Second sync - triggers 24h check (volume = $400, required = $250)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Verify agent was NOT removed
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(agentsResponse.success).toBe(true);
      const typedResponse = agentsResponse as CompetitionAgentsResponse;
      expect(typedResponse.agents).toHaveLength(1); // Agent still there!
      expect(typedResponse.agents[0]?.id).toBe(agentGoodVolume.id);

      // Clean up
      await adminClient.endCompetition(competition.id);
    });

    test("should use period start equity for fairness (Symphony)", async () => {
      const adminClient = createTestClient(getBaseUrl());
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent that makes big profit during the day
      const { agent: agentProfit } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Profitable Agent",
        agentWalletAddress: "0xabcd111111111111111111111111111111111111", // $500 → $2000, $400 volume
      });

      // Start competition 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await startPerpsTestCompetition({
        adminClient,
        name: `Volume Fairness Test ${Date.now()}`,
        agentIds: [agentProfit.id],
        perpsProvider: {
          provider: "symphony",
          apiUrl: "http://localhost:4567",
        },
        startDate: twentyFourHoursAgo.toISOString(),
      });

      expect(response.success).toBe(true);
      const competition = response.competition;

      await wait(1000);

      const services = new ServiceRegistry();

      // First sync - equity=$500, volume=0
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Second sync - equity=$2000, volume=$400
      // Requirement = Max($500, $500 * 0.8) * 0.5 = $250 (uses START equity!)
      // If we used current equity: Max($500, $2000 * 0.8) * 0.5 = $800 (UNFAIR!)
      // $400 >= $250 → Should NOT be removed
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Verify agent was NOT removed (fair calculation!)
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(agentsResponse.success).toBe(true);
      const typedResponse = agentsResponse as CompetitionAgentsResponse;
      expect(typedResponse.agents).toHaveLength(1);
      expect(typedResponse.agents[0]?.id).toBe(agentProfit.id);

      // Clean up
      await adminClient.endCompetition(competition.id);
    });

    test("should remove agent with insufficient daily volume after 24h (Hyperliquid)", async () => {
      const adminClient = createTestClient(getBaseUrl());
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent with insufficient volume wallet
      const { agent: agentLowVolume } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Low Volume Agent",
        agentWalletAddress: "0xeeee222222222222222222222222222222222222", // $100 volume (insufficient)
      });

      // Start competition 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await startPerpsTestCompetition({
        adminClient,
        name: `Hyperliquid Volume Enforcement Test ${Date.now()}`,
        agentIds: [agentLowVolume.id],
        perpsProvider: {
          provider: "hyperliquid",
          apiUrl: "http://localhost:4568",
        },
        startDate: twentyFourHoursAgo.toISOString(),
      });

      expect(response.success).toBe(true);
      const competition = response.competition;

      // Manually update competition startDate to 24h ago (gets overwritten during start)
      await db
        .update(competitions)
        .set({ startDate: twentyFourHoursAgo })
        .where(eq(competitions.id, competition.id));

      await wait(1000);

      const services = new ServiceRegistry();

      // First sync - creates initial snapshot at current time
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Manually create a historical account summary from 24h ago
      await db.insert(perpsAccountSummaries).values({
        agentId: agentLowVolume.id,
        competitionId: competition.id,
        timestamp: twentyFourHoursAgo, // 24h ago - matches competition start
        totalEquity: "500", // Started with $500
        initialCapital: "500",
        totalVolume: "0", // No volume 24h ago
        totalUnrealizedPnl: null,
        totalRealizedPnl: null,
        totalPnl: null,
        totalFeesPaid: null,
        availableBalance: null,
        marginUsed: null,
        totalTrades: null,
        openPositionsCount: null,
        closedPositionsCount: null,
        liquidatedPositionsCount: null,
        roi: null,
        roiPercent: null,
        averageTradeSize: null,
        accountStatus: null,
        rawData: null,
      });

      await wait(100);

      // Second sync - triggers 24h check (volume = $100, required = $250)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Verify agent was removed
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(agentsResponse.success).toBe(true);
      const typedResponse = agentsResponse as CompetitionAgentsResponse;
      expect(typedResponse.agents).toHaveLength(0); // Agent removed!

      // Clean up
      await adminClient.endCompetition(competition.id);
    });

    test("should keep agent with sufficient daily volume after 24h (Hyperliquid)", async () => {
      const adminClient = createTestClient(getBaseUrl());
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent with sufficient volume wallet
      const { agent: agentGoodVolume } = await registerUserAndAgentAndGetClient(
        {
          adminApiKey,
          agentName: "Hyperliquid Good Volume Agent",
          agentWalletAddress: "0xffff222222222222222222222222222222222222", // $400 volume (sufficient)
        },
      );

      // Start competition 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await startPerpsTestCompetition({
        adminClient,
        name: `Hyperliquid Volume Pass Test ${Date.now()}`,
        agentIds: [agentGoodVolume.id],
        perpsProvider: {
          provider: "hyperliquid",
          apiUrl: "http://localhost:4568",
        },
        startDate: twentyFourHoursAgo.toISOString(),
      });

      expect(response.success).toBe(true);
      const competition = response.competition;

      await wait(1000);

      const services = new ServiceRegistry();

      // First sync - creates initial snapshot (volume = 0)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Second sync - triggers 24h check (volume = $400, required = $250)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Verify agent was NOT removed
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(agentsResponse.success).toBe(true);
      const typedResponse = agentsResponse as CompetitionAgentsResponse;
      expect(typedResponse.agents).toHaveLength(1);
      expect(typedResponse.agents[0]?.id).toBe(agentGoodVolume.id);

      // Clean up
      await adminClient.endCompetition(competition.id);
    });

    test("should use period start equity for fairness (Hyperliquid)", async () => {
      const adminClient = createTestClient(getBaseUrl());
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent that makes big profit during the day
      const { agent: agentProfit } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Hyperliquid Profitable Agent",
        agentWalletAddress: "0xabcd222222222222222222222222222222222222", // $500 → $2000, $400 volume
      });

      // Start competition 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await startPerpsTestCompetition({
        adminClient,
        name: `Hyperliquid Fairness Test ${Date.now()}`,
        agentIds: [agentProfit.id],
        perpsProvider: {
          provider: "hyperliquid",
          apiUrl: "http://localhost:4568",
        },
        startDate: twentyFourHoursAgo.toISOString(),
      });

      expect(response.success).toBe(true);
      const competition = response.competition;

      await wait(1000);

      const services = new ServiceRegistry();

      // First sync - equity=$500, volume=0
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Second sync - equity=$2000, volume=$400
      // Requirement = Max($500, $500 * 0.8) * 0.75 = $375 (uses START equity!)
      // $400 >= $375 → Should NOT be removed (fair!)
      await services.perpsDataProcessor.processPerpsCompetition(competition.id);
      await wait(500);

      // Verify agent was NOT removed (fair calculation!)
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(agentsResponse.success).toBe(true);
      const typedResponse = agentsResponse as CompetitionAgentsResponse;
      expect(typedResponse.agents).toHaveLength(1);
      expect(typedResponse.agents[0]?.id).toBe(agentProfit.id);

      // Clean up
      await adminClient.endCompetition(competition.id);
    });
  });
});
