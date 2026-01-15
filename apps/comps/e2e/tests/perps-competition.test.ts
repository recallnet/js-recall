import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import {
  perpetualPositions,
  perpsRiskMetrics,
  portfolioSnapshots,
  riskMetricsSnapshots,
} from "@recallnet/db/schema/trading/defs";
import { ApiClient } from "@recallnet/test-utils";
import {
  type AdminAgentResponse,
  type AdminCompetitionTransferViolationsResponse,
  type AgentPerpsPositionsResponse,
  BlockchainType,
  type CompetitionAgent,
  type CompetitionAllPerpsPositionsResponse,
  type CreateCompetitionResponse,
  type ErrorResponse,
  type PerpsAccountResponse,
  type PerpsAlertsResponse,
  type PerpsPositionsResponse,
} from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createTestClient,
  generateTestHandle,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startPerpsTestCompetition,
  startTestCompetition,
} from "@recallnet/test-utils";

import { config } from "@/config/private";
import { registerUserAndAgentAndGetRpcClient } from "@/e2e/utils/test-helpers";
import { db } from "@/lib/db";
import { perpsRepository } from "@/lib/repositories";
import {
  perpsDataProcessor,
  portfolioSnapshotterService,
} from "@/lib/services";

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
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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
    const comp = await rpcClient.competitions.getById({ id: competition.id });
    expect(comp).toBeDefined();
    expect(comp.type).toBe("perpetual_futures");

    // Check for perps-specific stats
    expect(comp.stats?.totalPositions).toBeDefined();
    expect(comp.stats?.totalTrades).toBe(0);

    // Verify perps competitions include volume and average equity stats
    expect(comp.stats?.totalVolume).toBeDefined();
    // Note: totalVolume can be 0 for a new competition with no trades yet
    expect(comp.stats?.totalVolume).toBeGreaterThanOrEqual(0);

    expect(comp.stats?.averageEquity).toBeDefined();
    // Note: averageEquity can be 0 if no agents have joined yet
    expect(comp.stats?.averageEquity).toBeGreaterThanOrEqual(0);
  });

  test("should return evaluationMetric field for perps competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents for this test
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Evaluation Metric Test Agent",
      });

    // Start a perps competition with Sortino ratio as evaluation metric
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Evaluation Metric Test ${Date.now()}`,
      agentIds: [agent1.id],
      evaluationMetric: "sortino_ratio",
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
    const comp = await rpcClient.competitions.getById({ id: competition.id });
    expect(comp).toBeDefined();
    expect(comp.type).toBe("perpetual_futures");
    expect(comp.evaluationMetric).toBe("sortino_ratio");

    // Also test the list endpoint to verify evaluationMetric is included there
    const listResult = await rpcClient.competitions.list({
      status: "active",
      paging: { limit: 50, offset: 0 },
    });
    const perpsCompetition = listResult.competitions.find(
      (c) => c.id === competition.id,
    );
    expect(perpsCompetition).toBeDefined();
    expect(perpsCompetition?.evaluationMetric).toBe("sortino_ratio");
  });

  test("should not return evaluationMetric for paper trading competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent for this test
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Paper Trading Test Agent",
      });

    // Start a PAPER TRADING competition (not perps)
    const response = await startTestCompetition({
      adminClient,
      name: `Paper Trading Test ${Date.now()}`,
      agentIds: [agent1.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Get competition details
    const comp = await rpcClient.competitions.getById({ id: competition.id });
    expect(comp).toBeDefined();
    expect(comp.type).toBe("trading");
    expect(comp.evaluationMetric).toBeUndefined();
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
    const competitionId = response.competition.id;

    // Get perps positions for the agent in this competition
    // Note: Using authenticated endpoint as the public endpoint isn't implemented yet
    const positionsResponse =
      await agentClient.getPerpsPositions(competitionId);

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

    // Trigger sync from Symphony (simulating what the cron job does)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete

    // Get perps account for the agent
    // Note: Using authenticated endpoint as the public endpoint isn't implemented yet
    const accountResponse = await agentClient.getPerpsAccount(competition.id);

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

    // Register agent and get RPC client for this test
    const { agent, rpcClient } = await registerUserAndAgentAndGetRpcClient({
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
    const competitionsResult = await rpcClient.agent.getCompetitions({
      agentId: agent.id,
      filters: {},
      paging: { limit: 50, offset: 0 },
    });

    expect(competitionsResult).toBeDefined();
    expect(competitionsResult.competitions).toBeDefined();
    expect(Array.isArray(competitionsResult.competitions)).toBe(true);

    // Find the perps competition we just created
    const perpsComp = competitionsResult.competitions.find(
      (c) => c.id === competition.id,
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
    const perpsCompetitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Block Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });
    const competitionId = perpsCompetitionResponse.competition.id;

    // Try to execute trades (paper trading endpoints)
    const trade1Response = await agent1Client.executeTrade({
      fromToken: "0x0000000000000000000000000000000000000000",
      toToken: "0x1234567890123456789012345678901234567890",
      amount: "100",
      competitionId,
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
      competitionId,
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
    const { agent, client, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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
    const paperCompetitionId = paperComp.competition.id;

    await client.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: wethTokenAddress,
      amount: "100",
      competitionId: paperCompetitionId,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      reason: "Test trade 1",
    });

    await client.executeTrade({
      fromToken: wethTokenAddress,
      toToken: usdcTokenAddress,
      amount: "0.01",
      competitionId: paperCompetitionId,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      reason: "Test trade 2",
    });

    await client.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: wethTokenAddress,
      amount: "50",
      competitionId: paperCompetitionId,
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
    const userAgentsResult = await rpcClient.user.getUserAgents({
      limit: 50,
      offset: 0,
    });

    expect(userAgentsResult).toBeDefined();
    expect(userAgentsResult.agents).toBeDefined();
    expect(Array.isArray(userAgentsResult.agents)).toBe(true);
    expect(userAgentsResult.agents.length).toBeGreaterThan(0);

    // Find our agent with proper typing
    const agentData = userAgentsResult.agents.find((a) => a.id === agent.id);

    expect(agentData).toBeDefined();
    expect(agentData?.stats).toBeDefined();

    // Should have both totalTrades (from paper competition) and totalPositions (from perps competition)
    expect(agentData?.stats?.totalTrades).toBe(3); // 3 paper trades
    expect(agentData?.stats?.totalPositions).toBeDefined();

    // Also test the individual agent endpoint
    const singleAgent = await rpcClient.user.getUserAgent({
      agentId: agent.id,
    });

    expect(singleAgent).toBeDefined();
    expect(singleAgent.stats).toBeDefined();
    expect(singleAgent.stats?.totalTrades).toBe(3);
    expect(singleAgent.stats?.totalPositions).toBeDefined();
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
    const positionsResponse = await agentClient.getPerpsPositions(
      competition.id,
    );

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

    // Trigger sync from Symphony (simulating what the cron job does)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete

    // Test getting account summary for the authenticated agent
    const accountResponse = await agentClient.getPerpsAccount(competition.id);

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

    // Trigger sync from Symphony (simulating what the cron job does)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete

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

    // Use a non-existent competition ID to test 404 response
    const nonExistentCompetitionId = randomUUID();

    // Try to get positions - should fail with 404
    const positionsResponse = await agentClient.getPerpsPositions(
      nonExistentCompetitionId,
    );
    expect(positionsResponse.success).toBe(false);
    if (!positionsResponse.success) {
      const errorResponse = positionsResponse as ErrorResponse;
      expect(errorResponse.status).toBe(404);
      expect(errorResponse.error).toContain("Competition not found");
    }

    // Try to get account - should fail with 404
    const accountResponse = await agentClient.getPerpsAccount(
      nonExistentCompetitionId,
    );
    expect(accountResponse.success).toBe(false);
    if (!accountResponse.success) {
      const errorResponse = accountResponse as ErrorResponse;
      expect(errorResponse.status).toBe(404);
      expect(errorResponse.error).toContain("Competition not found");
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
    const competitionId = competitionResponse.competition.id;

    // Try to get perps positions - should fail with 400
    const positionsResponse =
      await agentClient.getPerpsPositions(competitionId);
    expect(positionsResponse.success).toBe(false);
    if (!positionsResponse.success) {
      const errorResponse = positionsResponse as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("perpetual futures");
    }

    // Try to get perps account - should fail with 400
    const accountResponse = await agentClient.getPerpsAccount(competitionId);
    expect(accountResponse.success).toBe(false);
    if (!accountResponse.success) {
      const errorResponse = accountResponse as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("perpetual futures");
    }
  });

  test("should return null (not 0) for unavailable fields on closed positions recovered from fills", async () => {
    // This test verifies that positions recovered from fills (which have null for
    // entryPrice, leverage, collateral, pnlPercentage) return null in the API response
    // rather than being coerced to 0 during serialization.

    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Closed Position Null Fields Test Agent",
      });

    // Start a perps competition
    const competitionResponse = await startPerpsTestCompetition({
      adminClient,
      name: `Closed Position Null Fields Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Directly insert a closed position with null fields (simulating a position
    // recovered from fills where entry price, leverage, etc. are unavailable)
    const closedPositionId = randomUUID();
    const now = new Date();
    await db.insert(perpetualPositions).values({
      id: closedPositionId,
      agentId: agent.id,
      competitionId: competition.id,
      providerPositionId: `fill-recovered-${Date.now()}`,
      providerTradeId: null,
      asset: "ETH",
      isLong: false,
      leverage: null, // Not available from fills
      positionSize: "5000",
      collateralAmount: null, // Not available from fills
      entryPrice: null, // Not available from fills (only close price)
      currentPrice: "3200",
      liquidationPrice: null,
      pnlUsdValue: "-150",
      pnlPercentage: null, // Cannot calculate without entry price
      status: "Closed",
      createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
      lastUpdatedAt: now,
      closedAt: now,
    });

    // Get positions via API
    const positionsResponse = await agentClient.getPerpsPositions(
      competition.id,
    );
    expect(positionsResponse.success).toBe(true);

    const typedResponse = positionsResponse as PerpsPositionsResponse;
    expect(typedResponse.positions).toHaveLength(1);

    const closedPosition = typedResponse.positions[0];

    // Verify the position data
    expect(closedPosition?.asset).toBe("ETH");
    expect(closedPosition?.isLong).toBe(false);
    expect(closedPosition?.status).toBe("Closed");
    expect(closedPosition?.unrealizedPnl).toBe(-150);

    // These fields should be null (not 0) for positions recovered from fills
    // The API serialization should preserve null values, not coerce them to 0
    expect(closedPosition?.averagePrice).toBeNull();
    expect(closedPosition?.leverage).toBeNull();
    expect(closedPosition?.collateral).toBeNull();
    expect(closedPosition?.pnlPercentage).toBeNull();
    expect(closedPosition?.liquidationPrice).toBeNull();
  });

  test("should sync and persist agent positions from Symphony to database", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with pre-configured wallet addresses
    // These wallets have mock data pre-configured in MockSymphonyServer
    const {
      agent: agent1,
      client: agent1Client,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify agent1's positions (BTC and ETH) were persisted
    const agent1Positions = await agent1Client.getPerpsPositions(
      competition.id,
    );
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
    const agent1Account = await agent1Client.getPerpsAccount(competition.id);
    expect(agent1Account.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent1Account = agent1Account as PerpsAccountResponse;
    expect(typedAgent1Account.account.totalEquity).toBe("1250");
    expect(typedAgent1Account.account.availableBalance).toBe("450");
    expect(typedAgent1Account.account.marginUsed).toBe("800");
    expect(typedAgent1Account.account.totalVolume).toBe("25000");
    expect(typedAgent1Account.account.openPositions).toBe(2);

    // Verify agent2's position (SOL with negative PnL) was persisted
    const agent2Positions = await agent2Client.getPerpsPositions(
      competition.id,
    );
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
    const agent2Account = await agent2Client.getPerpsAccount(competition.id);
    expect(agent2Account.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent2Account = agent2Account as PerpsAccountResponse;
    expect(typedAgent2Account.account.totalEquity).toBe("950");
    expect(typedAgent2Account.account.marginUsed).toBe("200");
    expect(typedAgent2Account.account.openPositions).toBe(1);

    // Verify agent3's data (has trading history but no positions)
    const agent3Positions = await agent3Client.getPerpsPositions(
      competition.id,
    );
    expect(agent3Positions.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent3Positions = agent3Positions as PerpsPositionsResponse;
    expect(typedAgent3Positions.positions).toHaveLength(0);

    const agent3Account = await agent3Client.getPerpsAccount(competition.id);
    expect(agent3Account.success).toBe(true);

    // Type assertion since we've verified success
    const typedAgent3Account = agent3Account as PerpsAccountResponse;
    expect(typedAgent3Account.account.totalEquity).toBe("1100");
    expect(typedAgent3Account.account.availableBalance).toBe("1100");
    expect(typedAgent3Account.account.marginUsed).toBe("0");
    expect(typedAgent3Account.account.totalVolume).toBe("10000");
    expect(typedAgent3Account.account.openPositions).toBe(0);

    // Verify competition details reflect all agents' data
    const comp = await rpcClient.competitions.getById({ id: competition.id });
    expect(comp).toBeDefined();
    const stats = comp.stats;
    expect(stats?.totalAgents).toBe(3);
    expect(stats?.totalPositions).toBe(3); // 2 for agent1 + 1 for agent2 + 0 for agent3
    expect(stats?.totalVolume).toBe(40000); // 25000 + 5000 + 10000

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
    await perpsDataProcessor.processPerpsCompetition(competition.id);
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
    const competitionId = competitionResponse.competition.id;

    // Agent2 tries to get positions - should fail with 403
    const positionsResponse =
      await agent2Client.getPerpsPositions(competitionId);
    expect(positionsResponse.success).toBe(false);
    if (!positionsResponse.success) {
      const errorResponse = positionsResponse as ErrorResponse;
      expect(errorResponse.status).toBe(403);
      expect(errorResponse.error).toContain("not registered");
    }

    // Agent2 tries to get account - should fail with 403
    const accountResponse = await agent2Client.getPerpsAccount(competitionId);
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
    const {
      agent,
      client: _agentClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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

    // Trigger sync from Symphony (simulating what the cron job does)

    // First sync - creates initial snapshot at peak ($1700)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait a bit to ensure time passes between snapshots

    // Second sync - creates snapshot at trough ($1200)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait a bit more

    // Third sync - creates snapshot after partial recovery ($1550)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync and calculations to complete
    // Need extra time for read replica to catch up with risk metrics writes

    // Get competition leaderboard - should include risk metrics
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId,
      sort: "rank",
    });
    expect(leaderboardResult).toBeDefined();

    // Find our agent in the leaderboard
    const agentEntry = leaderboardResult.agents.find(
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
    const { agent: agentVolatile, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    // Trigger sync

    // First sync - creates initial snapshot
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait a bit to ensure time passes between snapshots

    // Second sync - creates second snapshot (needed for simple return calculation)
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get leaderboard
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(leaderboardResult).toBeDefined();

    // Agent with worst Calmar ratio (volatility) should be ranked first
    // (negative Calmar due to losses and high drawdown)
    const firstAgent = leaderboardResult.agents[0];
    expect(firstAgent?.id).toBe(agentVolatile.id);
    expect(firstAgent?.hasRiskMetrics).toBe(true);
    expect(firstAgent?.calmarRatio).not.toBeNull();

    // Other agents ranked by their Calmar ratios
    const secondAgent = leaderboardResult.agents[1];
    const thirdAgent = leaderboardResult.agents[2];

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
    const {
      agent,
      client: _agentClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get agent competitions - should include risk metrics
    const competitionsResult = await rpcClient.agent.getCompetitions({
      agentId: agent.id,
      filters: {},
      paging: { limit: 50, offset: 0 },
    });
    expect(competitionsResult).toBeDefined();

    // Find our perps competition
    const perpsComp = competitionsResult.competitions.find(
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
    const {
      agent,
      client: _agentClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get leaderboard
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(leaderboardResult).toBeDefined();

    const agentEntry = leaderboardResult.agents.find(
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

    // Trigger sync to process transfers
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for processing to complete

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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

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
      "perpetual futures and spot live trading",
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
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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
    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get the leaderboard
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });

    expect(leaderboardResult).toBeDefined();

    // Verify we have all agents
    expect(leaderboardResult.agents).toHaveLength(3);

    // Find each agent in the leaderboard
    const agent1Entry = leaderboardResult.agents.find(
      (e) => e.id === agent1.id,
    );
    const agent2Entry = leaderboardResult.agents.find(
      (e) => e.id === agent2.id,
    );
    const agent3Entry = leaderboardResult.agents.find(
      (e) => e.id === agent3.id,
    );

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
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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
    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // ============ STEP 1: Get data while competition is ACTIVE ============

    // Get leaderboard (active competition)
    const activeLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(activeLeaderboardResult).toBeDefined();
    const activeLeaderboard = activeLeaderboardResult.agents;

    // Get competition details
    const activeComp = await rpcClient.competitions.getById({
      id: competition.id,
    });
    expect(activeComp).toBeDefined();

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

    // ============ STEP 3: Get data after competition is ENDED ============

    // Get competition details (should return saved data for ended competition)
    const endedComp = await rpcClient.competitions.getById({
      id: competition.id,
    });
    expect(endedComp).toBeDefined();

    // Verify competition is ended
    expect(endedComp.status).toBe("ended");

    // Get leaderboard
    const endedLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(endedLeaderboardResult).toBeDefined();
    const endedAgents = endedLeaderboardResult.agents;

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
    const refetchResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(refetchResult).toBeDefined();
    const refetchedAgents = refetchResult.agents;

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
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for sync to complete

    // Verify BTC agent's position
    const btcPositions = await agentBTCClient.getPerpsPositions(competition.id);
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
    const btcAccount = await agentBTCClient.getPerpsAccount(competition.id);
    expect(btcAccount.success).toBe(true);
    const typedBTCAccount = btcAccount as PerpsAccountResponse;
    expect(typedBTCAccount.account.totalEquity).toBe("1250");
    expect(typedBTCAccount.account.availableBalance).toBe("450");
    expect(typedBTCAccount.account.marginUsed).toBe("800");
    expect(typedBTCAccount.account.openPositions).toBe(1);

    // Verify ETH agent's position (short)
    const ethPositions = await agentETHClient.getPerpsPositions(competition.id);
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
    const noPositions = await agentNoPosClient.getPerpsPositions(
      competition.id,
    );
    expect(noPositions.success).toBe(true);
    const typedNoPositions = noPositions as PerpsPositionsResponse;
    expect(typedNoPositions.positions).toHaveLength(0);

    const noPosAccount = await agentNoPosClient.getPerpsAccount(competition.id);
    expect(noPosAccount.success).toBe(true);
    const typedNoPosAccount = noPosAccount as PerpsAccountResponse;
    expect(typedNoPosAccount.account.totalEquity).toBe("1100");
    expect(typedNoPosAccount.account.openPositions).toBe(0);
  });

  test("should calculate Calmar ratio with Hyperliquid data", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with volatile portfolio wallet
    const {
      agent,
      client: _agentClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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

    // First sync - peak equity
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Second sync - trough
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Third sync - recovery
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for calculations

    // Get leaderboard with risk metrics
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(leaderboardResult).toBeDefined();

    const agentEntry = leaderboardResult.agents.find(
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

    // Process competition to detect transfers
    await perpsDataProcessor.processPerpsCompetition(competition.id);

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

    await perpsDataProcessor.processPerpsCompetition(competition.id);

    const multiPositions = await agentMultiClient.getPerpsPositions(
      competition.id,
    );
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

    const multiAccount = await agentMultiClient.getPerpsAccount(competition.id);
    expect(multiAccount.success).toBe(true);
    const typedMultiAccount = multiAccount as PerpsAccountResponse;
    expect(typedMultiAccount.account.openPositions).toBe(3);
    expect(typedMultiAccount.account.totalVolume).toBe("66700"); // Realistic volume from 6 fills
  });

  test("should rank multiple Hyperliquid agents by Calmar ratio", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    const { agent: agentSteady, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

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

    await perpsDataProcessor.processPerpsCompetition(competition.id);

    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(leaderboardResult).toBeDefined();

    expect(leaderboardResult.agents).toHaveLength(3);

    const steadyEntry = leaderboardResult.agents.find(
      (e) => e.id === agentSteady.id,
    );
    const volatileEntry = leaderboardResult.agents.find(
      (e) => e.id === agentVolatile.id,
    );
    const negativeEntry = leaderboardResult.agents.find(
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

    const {
      agent: agent3,
      client: _agent3Client,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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

    await perpsDataProcessor.processPerpsCompetition(competition.id);

    const comp = await rpcClient.competitions.getById({ id: competition.id });

    expect(comp).toBeDefined();
    const stats = comp.stats;
    expect(comp.id).toBe(competition.id);
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

    await perpsDataProcessor.processPerpsCompetition(competition.id);

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

    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

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

    await perpsDataProcessor.processPerpsCompetition(competition.id);

    const activeLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });
    expect(activeLeaderboardResult).toBeDefined();
    const activeLeaderboard = activeLeaderboardResult.agents;

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

    const endedComp = await rpcClient.competitions.getById({
      id: competition.id,
    });
    expect(endedComp).toBeDefined();
    expect(endedComp.status).toBe("ended");

    const endedLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(endedLeaderboardResult).toBeDefined();
    const endedAgents = endedLeaderboardResult.agents;

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

    const {
      agent: agentActive,
      client: agentActiveClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
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

    await perpsDataProcessor.processPerpsCompetition(competition.id);

    const activeAccount = await agentActiveClient.getPerpsAccount(
      competition.id,
    );
    expect(activeAccount.success).toBe(true);
    const typedActiveAccount = activeAccount as PerpsAccountResponse;
    expect(typedActiveAccount.account.totalVolume).toBe("66700"); // Realistic volume from 6 fills

    const comp = await rpcClient.competitions.getById({ id: competition.id });
    expect(comp).toBeDefined();
    const stats = comp.stats;
    expect(stats?.totalVolume).toBeGreaterThanOrEqual(75000);
  });

  // ===== Risk Metrics Calculation Tests =====

  test("should calculate and persist Sortino ratio after sufficient snapshots", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with known wallet for risk metrics testing
    const {
      agent,
      client: _agentClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Sortino Ratio Test Agent",
      agentWalletAddress: "0x3333333333333333333333333333333333333333", // Steady growth wallet
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Sortino Ratio Calculation Test ${Date.now()}`,
      agentIds: [agent.id],
      evaluationMetric: "sortino_ratio", // Test with Sortino as primary metric
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for competition to be fully started

    // Create initial snapshot
    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

    // Insert historical snapshots to establish return pattern
    // Agent 0x3333 has $1100 current equity, let's simulate steady 10% growth
    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    await db.insert(portfolioSnapshots).values([
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1020,
        timestamp: minutesAgo(50),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1040,
        timestamp: minutesAgo(40),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1060,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1080,
        timestamp: minutesAgo(20),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1100,
        timestamp: minutesAgo(10),
      },
    ]);

    // Process to calculate risk metrics including Sortino
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Wait for calculations to complete and propagate to read replica

    // Get competition agents with risk metrics
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });

    expect(leaderboardResult).toBeDefined();

    const agentEntry = leaderboardResult.agents.find(
      (entry) => entry.id === agent.id,
    );

    expect(agentEntry).toBeDefined();
    expect(agentEntry?.hasRiskMetrics).toBe(true);

    // Verify Sortino ratio was calculated and persisted
    expect(agentEntry?.sortinoRatio).not.toBeNull();

    // With steady positive returns and no downside, Sortino should be high
    // The exact value depends on the calculation but should be positive
    expect(agentEntry?.sortinoRatio).toBeGreaterThan(0);

    // Verify downside deviation was calculated
    expect(agentEntry?.downsideDeviation).not.toBeNull();

    // With no negative returns, downside deviation should be 0 or very small
    expect(agentEntry?.downsideDeviation).toBeCloseTo(0, 3);

    // Calmar should also still be calculated
    expect(agentEntry?.calmarRatio).not.toBeNull();
    expect(agentEntry?.simpleReturn).not.toBeNull();
    expect(agentEntry?.maxDrawdown).not.toBeNull();

    // Simple return should be 10% (1100/1000 - 1)
    expect(agentEntry?.simpleReturn).toBeCloseTo(0.1, 3);
  });

  test("should calculate Sortino ratio with negative returns correctly", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Use wallet with negative PnL
    const {
      agent,
      client: _agentClient,
      rpcClient,
    } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Negative Sortino Test Agent",
      agentWalletAddress: "0x2222222222222222222222222222222222222222", // $950 equity
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Negative Sortino Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Create snapshots showing decline
    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    await db.insert(portfolioSnapshots).values([
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1000,
        timestamp: minutesAgo(60),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 990,
        timestamp: minutesAgo(45),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 970,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 950,
        timestamp: minutesAgo(15),
      },
    ]);

    // Process to calculate risk metrics
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get competition agents with risk metrics
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
      sort: "rank",
    });

    expect(leaderboardResult).toBeDefined();

    const agentEntry = leaderboardResult.agents.find(
      (entry) => entry.id === agent.id,
    );

    expect(agentEntry).toBeDefined();
    expect(agentEntry?.hasRiskMetrics).toBe(true);

    // With consistent negative returns, Sortino should be negative
    expect(agentEntry?.sortinoRatio).not.toBeNull();
    expect(agentEntry?.sortinoRatio).toBeLessThan(0);

    // Downside deviation should be positive (measuring negative returns)
    expect(agentEntry?.downsideDeviation).not.toBeNull();
    expect(agentEntry?.downsideDeviation).toBeGreaterThan(0);

    // Simple return should be -5% (950/1000 - 1)
    expect(agentEntry?.simpleReturn).toBeCloseTo(-0.05, 3);
  });

  test("should save both Calmar and Sortino to time-series risk_metrics_snapshots table", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent for time-series testing
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Time Series Risk Metrics Agent",
      agentWalletAddress: "0x1111111111111111111111111111111111111111", // Has positions
    });

    // Start perps competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Risk Metrics Time Series Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Create historical snapshots
    const now = new Date();
    const minutesAgo = (minutes: number) =>
      new Date(now.getTime() - minutes * 60 * 1000);

    // Insert 3 snapshots to establish a pattern
    await db.insert(portfolioSnapshots).values([
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1200,
        timestamp: minutesAgo(30),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1225,
        timestamp: minutesAgo(20),
      },
      {
        agentId: agent.id,
        competitionId: competition.id,
        totalValue: 1250,
        timestamp: minutesAgo(10),
      },
    ]);

    // Process competition - this should calculate and save risk metrics
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Query risk_metrics_snapshots table directly to verify time-series storage
    const riskSnapshots = await perpsRepository.getRiskMetricsTimeSeries(
      competition.id,
      {
        limit: 10,
        offset: 0,
      },
    );

    expect(riskSnapshots).toBeDefined();
    expect(riskSnapshots.length).toBeGreaterThan(0);

    const latestSnapshot = riskSnapshots[0];
    expect(latestSnapshot).toBeDefined();
    expect(latestSnapshot?.agentId).toBe(agent.id);
    expect(latestSnapshot?.competitionId).toBe(competition.id);

    // Both Calmar and Sortino should be saved
    expect(latestSnapshot?.calmarRatio).not.toBeNull();
    expect(latestSnapshot?.sortinoRatio).not.toBeNull();

    // Other metrics should also be present
    expect(latestSnapshot?.simpleReturn).not.toBeNull();
    expect(latestSnapshot?.maxDrawdown).not.toBeNull();
    expect(latestSnapshot?.downsideDeviation).not.toBeNull();
    expect(latestSnapshot?.annualizedReturn).not.toBeNull();

    // Timestamp should be recent
    expect(latestSnapshot?.timestamp).toBeDefined();
    const snapshotTime = new Date(latestSnapshot!.timestamp);
    const timeDiff = Date.now() - snapshotTime.getTime();
    expect(timeDiff).toBeLessThan(60000); // Within last minute
  });

  test("should sort leaderboard by simple_return when configured", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create agents with different returns
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Simple Return Agent 1",
        agentWalletAddress: "0x1111111111111111111111111111111111111111",
      });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Simple Return Agent 2",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    // Start a perps competition with simple_return as evaluation metric
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Simple Return Sorting Competition",
      agentIds: [agent1.id, agent2.id],
      evaluationMetric: "simple_return", // Explicitly set to simple_return
    });

    // Manually insert perps risk metrics with different simple returns
    // Agent 1: Higher simple return (20%) but lower Calmar (0.5)
    // Agent 2: Lower simple return (10%) but higher Calmar (2.0)
    await db.insert(perpsRiskMetrics).values([
      {
        agentId: agent1.id,
        competitionId: competition.competition.id,
        simpleReturn: "0.20000000", // 20% return
        annualizedReturn: "0.40000000",
        maxDrawdown: "-0.40000000", // Large drawdown
        calmarRatio: "0.50000000", // Low Calmar due to large drawdown
        sortinoRatio: "1.00000000",
        downsideDeviation: "0.20000000",
        snapshotCount: 10, // Required field
      },
      {
        agentId: agent2.id,
        competitionId: competition.competition.id,
        simpleReturn: "0.10000000", // 10% return
        annualizedReturn: "0.20000000",
        maxDrawdown: "-0.10000000", // Small drawdown
        calmarRatio: "2.00000000", // High Calmar due to small drawdown
        sortinoRatio: "1.50000000",
        downsideDeviation: "0.10000000",
        snapshotCount: 10, // Required field
      },
    ]);

    // Get the leaderboard
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
      sort: "rank",
    });

    expect(leaderboardResult).toBeDefined();

    // Verify leaderboard is sorted by simple_return (not Calmar)
    expect(leaderboardResult.agents).toHaveLength(2);
    expect(leaderboardResult.agents[0]?.id).toBe(agent1.id); // Agent 1 should be first (20% return)
    expect(leaderboardResult.agents[1]?.id).toBe(agent2.id); // Agent 2 should be second (10% return)

    // Verify the metrics are included
    expect(leaderboardResult.agents[0]?.simpleReturn).toBe(0.2);
    expect(leaderboardResult.agents[0]?.calmarRatio).toBe(0.5);
    expect(leaderboardResult.agents[1]?.simpleReturn).toBe(0.1);
    expect(leaderboardResult.agents[1]?.calmarRatio).toBe(2);
  });

  test("should sort leaderboard by sortino_ratio when configured", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create agents
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Sortino Agent 1",
        agentWalletAddress: "0x3333333333333333333333333333333333333333",
      });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Sortino Agent 2",
      agentWalletAddress: "0x4444444444444444444444444444444444444444",
    });

    // Start a perps competition with sortino_ratio as evaluation metric
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Sortino Ratio Sorting Competition",
      agentIds: [agent1.id, agent2.id],
      evaluationMetric: "sortino_ratio", // Explicitly set to sortino_ratio
    });

    // Insert risk metrics with different Sortino ratios
    // Agent 1: Lower Sortino (0.8) but higher Calmar (2.0)
    // Agent 2: Higher Sortino (1.5) but lower Calmar (1.0)
    await db.insert(perpsRiskMetrics).values([
      {
        agentId: agent1.id,
        competitionId: competition.competition.id,
        simpleReturn: "0.15000000",
        annualizedReturn: "0.30000000",
        maxDrawdown: "-0.15000000",
        calmarRatio: "2.00000000", // High Calmar
        sortinoRatio: "0.80000000", // Lower Sortino
        downsideDeviation: "0.18750000",
        snapshotCount: 10, // Required field
      },
      {
        agentId: agent2.id,
        competitionId: competition.competition.id,
        simpleReturn: "0.12000000",
        annualizedReturn: "0.24000000",
        maxDrawdown: "-0.24000000",
        calmarRatio: "1.00000000", // Lower Calmar
        sortinoRatio: "1.50000000", // Higher Sortino
        downsideDeviation: "0.08000000",
        snapshotCount: 10, // Required field
      },
    ]);

    // Get the leaderboard
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
      sort: "rank",
    });

    expect(leaderboardResult).toBeDefined();

    // Verify leaderboard is sorted by sortino_ratio
    expect(leaderboardResult.agents).toHaveLength(2);
    expect(leaderboardResult.agents[0]?.id).toBe(agent2.id); // Agent 2 should be first (1.5 Sortino)
    expect(leaderboardResult.agents[1]?.id).toBe(agent1.id); // Agent 1 should be second (0.8 Sortino)

    // Verify the metrics
    expect(leaderboardResult.agents[0]?.sortinoRatio).toBe(1.5);
    expect(leaderboardResult.agents[0]?.calmarRatio).toBe(1);
    expect(leaderboardResult.agents[1]?.sortinoRatio).toBe(0.8);
    expect(leaderboardResult.agents[1]?.calmarRatio).toBe(2);
  });

  test("should include risk metrics in timeline for perps competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create and start a perps competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Timeline Risk Metrics Agent",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Timeline Risk Metrics Competition",
      agentIds: [agent.id],
    });

    // Add portfolio snapshots - space them 35 minutes apart to ensure different buckets
    const now = new Date();
    const snapshots = [];
    for (let i = 0; i < 3; i++) {
      snapshots.push({
        agentId: agent.id,
        competitionId: competition.competition.id,
        totalValue: 1000 + i * 50,
        cash: 500,
        timestamp: new Date(now.getTime() - (3 - i) * 35 * 60000), // 35 minutes apart
      });
    }

    await db.insert(portfolioSnapshots).values(snapshots);

    // Add corresponding risk metrics snapshots
    const riskSnapshots = snapshots.map((snapshot, i) => ({
      agentId: agent.id,
      competitionId: competition.competition.id,
      timestamp: snapshot.timestamp,
      calmarRatio: (1.5 + i * 0.1).toFixed(8),
      sortinoRatio: (1.2 + i * 0.15).toFixed(8),
      simpleReturn: (0.05 * (i + 1)).toFixed(8),
      annualizedReturn: (0.1 * (i + 1)).toFixed(8),
      maxDrawdown: (-0.1 - i * 0.02).toFixed(8),
      downsideDeviation: (0.05 + i * 0.01).toFixed(8),
    }));

    await db.insert(riskMetricsSnapshots).values(riskSnapshots);

    // Get timeline data using the service directly
    const rawTimeline =
      await portfolioSnapshotterService.getAgentPortfolioTimeline(
        competition.competition.id,
        30, // bucket size
        true, // includeRiskMetrics for perps competition
      );

    // Filter for our specific agent and cast to include risk metrics
    const timeline = rawTimeline.filter(
      (entry) => entry.agentId === agent.id,
    ) as Array<{
      timestamp: string;
      agentId: string;
      agentName: string;
      competitionId: string;
      totalValue: number;
      calmarRatio?: number;
      sortinoRatio?: number;
      simpleReturn?: number;
      annualizedReturn?: number;
      maxDrawdown?: number;
      downsideDeviation?: number;
    }>;

    // Verify timeline includes risk metrics for perps competition
    expect(timeline).toBeDefined();
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // Check that each timeline entry includes risk metrics
    timeline.slice(0, 3).forEach((entry) => {
      expect(entry.timestamp).toBeDefined();
      expect(entry.totalValue).toBeDefined();

      // Risk metrics should be included for perps competition
      expect(entry.calmarRatio).toBeDefined();
      expect(entry.sortinoRatio).toBeDefined();
      expect(entry.simpleReturn).toBeDefined();
      expect(entry.annualizedReturn).toBeDefined();
      expect(entry.maxDrawdown).toBeDefined();
      expect(entry.downsideDeviation).toBeDefined();
    });
  });

  test("should NOT include risk metrics in timeline for paper trading competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create and start a paper trading competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading Timeline Agent",
    });

    const competition = await startTestCompetition({
      adminClient,
      name: "Paper Trading Timeline Competition",
      agentIds: [agent.id],
    });

    // Add portfolio snapshots - space them 35 minutes apart to ensure different buckets
    const now = new Date();
    const snapshots = [];
    for (let i = 0; i < 3; i++) {
      snapshots.push({
        agentId: agent.id,
        competitionId: competition.competition.id,
        totalValue: 1000000 + i * 50000,
        cash: 500000,
        timestamp: new Date(now.getTime() - (3 - i) * 35 * 60000),
      });
    }

    await db.insert(portfolioSnapshots).values(snapshots);

    // Get timeline data for paper trading competition using service directly
    const rawTimeline =
      await portfolioSnapshotterService.getAgentPortfolioTimeline(
        competition.competition.id,
        30, // bucket size
        false, // includeRiskMetrics should be false for paper trading
      );

    // Filter for our specific agent - cast to type with optional risk metrics
    const timeline = rawTimeline.filter(
      (entry) => entry.agentId === agent.id,
    ) as Array<{
      timestamp: string;
      agentId: string;
      agentName: string;
      competitionId: string;
      totalValue: number;
      calmarRatio?: number;
      sortinoRatio?: number;
      simpleReturn?: number;
      annualizedReturn?: number;
      maxDrawdown?: number;
      downsideDeviation?: number;
    }>;

    // Verify timeline does NOT include risk metrics for paper trading
    expect(timeline).toBeDefined();
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // Check that risk metrics are NOT included
    timeline.slice(0, 3).forEach((entry) => {
      expect(entry.timestamp).toBeDefined();
      expect(entry.totalValue).toBeDefined();

      // Risk metrics should NOT be included for paper trading
      expect(entry.calmarRatio).toBeUndefined();
      expect(entry.sortinoRatio).toBeUndefined();
      expect(entry.simpleReturn).toBeUndefined();
      expect(entry.annualizedReturn).toBeUndefined();
      expect(entry.maxDrawdown).toBeUndefined();
      expect(entry.downsideDeviation).toBeUndefined();
    });
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
    expect(joinErrorResponse.error).toContain(
      "participate in this competition",
    );

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
    expect(addErrorResponse.error).toContain("participate in this competition");

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
    const { agent: agentAbove, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    // Get the updated competition agents list
    const agentsResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(agentsResult).toBeDefined();

    // Agent above threshold should remain
    const remainingAbove = agentsResult.agents.find(
      (a) => a.id === agentAbove.id,
    );
    expect(remainingAbove).toBeDefined();

    // Agent below threshold should be removed
    const remainingBelow = agentsResult.agents.find(
      (a) => a.id === agentBelow.id,
    );
    expect(remainingBelow).toBeUndefined();

    // Agent exactly at threshold should remain (not < threshold)
    const remainingExact = agentsResult.agents.find(
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
    const { agent: agentAbove, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    // Get updated agents list
    const agentsResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(agentsResult).toBeDefined();

    // Agent above should remain
    const remainingAbove = agentsResult.agents.find(
      (a) => a.id === agentAbove.id,
    );
    expect(remainingAbove).toBeDefined();

    // Agent below should be removed
    const remainingBelow = agentsResult.agents.find(
      (a) => a.id === agentBelow.id,
    );
    expect(remainingBelow).toBeUndefined();

    // Agent just below ($249.99) should be removed
    const remainingJustBelow = agentsResult.agents.find(
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
    const { agent: agentLow1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    // Get agents list
    const agentsResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(agentsResult).toBeDefined();

    // Both agents should remain (no threshold enforcement)
    expect(agentsResult.agents).toHaveLength(2);

    const agent1Present = agentsResult.agents.find(
      (a) => a.id === agentLow1.id,
    );
    expect(agent1Present).toBeDefined();

    const agent2Present = agentsResult.agents.find(
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
    const { agent: agentWithData, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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

    // Get agents list
    const agentsResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(agentsResult).toBeDefined();

    // Agent with data above threshold should remain
    const agentWithDataPresent = agentsResult.agents.find(
      (a) => a.id === agentWithData.id,
    );
    expect(agentWithDataPresent).toBeDefined();

    // Agent without sync data should remain (no snapshot = not checked)
    const agentNoDataPresent = agentsResult.agents.find(
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
    const { agent: agent500, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
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
    const comp = await rpcClient.competitions.getById({ id: competition.id });
    expect(comp).toBeDefined();

    // Stats should show only 2 agents
    expect(comp.stats?.totalAgents).toBe(2);

    // Verify through agents endpoint as well
    const agentsResult = await rpcClient.competitions.getAgents({
      competitionId: competition.id,
    });
    expect(agentsResult).toBeDefined();
    expect(agentsResult.agents).toHaveLength(2);

    // Verify the correct agents remain
    const agentIds = agentsResult.agents.map((a) => a.id);
    expect(agentIds).toContain(agent500.id);
    expect(agentIds).toContain(agent250.id);
    expect(agentIds).not.toContain(agent100.id);

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should get competition timeline via HTTP endpoint with risk metrics for perps", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create and start a perps competition
    const { agent, rpcClient } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Timeline HTTP Test Agent",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Timeline HTTP Test Competition",
      agentIds: [agent.id],
    });

    // Add portfolio snapshots spaced 35 minutes apart for different buckets
    const now = new Date();
    const snapshots = [];
    for (let i = 0; i < 3; i++) {
      snapshots.push({
        agentId: agent.id,
        competitionId: competition.competition.id,
        totalValue: 1000 + i * 50,
        timestamp: new Date(now.getTime() - (3 - i) * 35 * 60000),
      });
    }

    await db.insert(portfolioSnapshots).values(snapshots);

    // Add corresponding risk metrics snapshots
    const riskSnapshots = snapshots.map((snapshot, i) => ({
      agentId: agent.id,
      competitionId: competition.competition.id,
      timestamp: snapshot.timestamp,
      calmarRatio: (1.5 + i * 0.1).toFixed(8),
      sortinoRatio: (1.2 + i * 0.15).toFixed(8),
      simpleReturn: (0.05 * (i + 1)).toFixed(8),
      annualizedReturn: (0.1 * (i + 1)).toFixed(8),
      maxDrawdown: (-0.1 - i * 0.02).toFixed(8),
      downsideDeviation: (0.05 + i * 0.01).toFixed(8),
    }));

    await db.insert(riskMetricsSnapshots).values(riskSnapshots);

    // Call the RPC endpoint
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competition.competition.id,
      bucket: 30, // bucket size
    });

    expect(timeline).toBeDefined();

    // Find our specific agent's timeline
    const agentTimelineData = timeline.find(
      (agentData) => agentData.agentId === agent.id,
    );

    // Verify we got timeline data for the agent
    expect(agentTimelineData).toBeDefined();
    expect(agentTimelineData?.timeline).toBeDefined();
    expect(agentTimelineData?.timeline.length).toBeGreaterThanOrEqual(3);

    // Verify each timeline entry includes risk metrics for perps competition
    agentTimelineData?.timeline.slice(0, 3).forEach((entry) => {
      expect(entry.timestamp).toBeDefined();
      expect(entry.totalValue).toBeDefined();

      // Risk metrics should be included for perps
      expect(entry.calmarRatio).toBeDefined();
      expect(entry.sortinoRatio).toBeDefined();
      expect(entry.simpleReturn).toBeDefined();
      expect(entry.annualizedReturn).toBeDefined();
      expect(entry.maxDrawdown).toBeDefined();
      expect(entry.downsideDeviation).toBeDefined();
    });
  });

  test("should NOT include risk metrics in timeline via HTTP endpoint for paper trading", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create and start a paper trading competition
    const { agent, rpcClient } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Paper Trading Timeline HTTP Agent",
    });

    const competition = await startTestCompetition({
      adminClient,
      name: "Paper Trading Timeline HTTP Test",
      agentIds: [agent.id],
    });

    // Add portfolio snapshots
    const now = new Date();
    const snapshots = [];
    for (let i = 0; i < 3; i++) {
      snapshots.push({
        agentId: agent.id,
        competitionId: competition.competition.id,
        totalValue: 1000000 + i * 50000,
        timestamp: new Date(now.getTime() - (3 - i) * 35 * 60000),
      });
    }

    await db.insert(portfolioSnapshots).values(snapshots);

    // Call the RPC endpoint
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competition.competition.id,
      bucket: 30,
    });

    expect(timeline).toBeDefined();

    // Find our specific agent's timeline
    const agentTimelineData = timeline.find(
      (agentData) => agentData.agentId === agent.id,
    );

    expect(agentTimelineData).toBeDefined();
    expect(agentTimelineData?.timeline).toBeDefined();
    expect(agentTimelineData?.timeline.length).toBeGreaterThanOrEqual(3);

    // Verify risk metrics are NOT included for paper trading
    agentTimelineData?.timeline.slice(0, 3).forEach((entry) => {
      expect(entry.timestamp).toBeDefined();
      expect(entry.totalValue).toBeDefined();

      // Risk metrics should NOT be included for paper trading
      expect(entry.calmarRatio).toBeUndefined();
      expect(entry.sortinoRatio).toBeUndefined();
      expect(entry.simpleReturn).toBeUndefined();
      expect(entry.annualizedReturn).toBeUndefined();
      expect(entry.maxDrawdown).toBeUndefined();
      expect(entry.downsideDeviation).toBeUndefined();
    });
  });

  test("should preserve original evaluation metric and rankings when competition ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Use new wallets with equity progressions that produce different Sortino vs Calmar rankings
    // Agent 1: Good Sortino, Poor Calmar (progression: 1000 → 1600 → 1200)
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Good Sortino Agent",
        agentWalletAddress: "0xeeee111111111111111111111111111111111111",
      });

    // Agent 2: Poor Sortino, Good Calmar (progression: 1000 → 1020 → 990 → 1010 → 980 → 1050)
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Good Calmar Agent",
      agentWalletAddress: "0xffff111111111111111111111111111111111111",
    });

    // Start a perps competition with sortino_ratio as evaluation metric
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Evaluation Metric Preservation Test",
      agentIds: [agent1.id, agent2.id],
      evaluationMetric: "sortino_ratio", // Rank by Sortino
    });

    const competitionId = competition.competition.id;

    // Process multiple times to create the equity progression snapshots
    // Agent 1 needs 3 snapshots (1000 → 1600 → 1200)
    // Agent 2 needs 6 snapshots (1000 → 1020 → 990 → 1010 → 980 → 1050)

    // Snapshot 1
    await perpsDataProcessor.processPerpsCompetition(competitionId);

    // Snapshot 2
    await perpsDataProcessor.processPerpsCompetition(competitionId);

    // Snapshot 3
    await perpsDataProcessor.processPerpsCompetition(competitionId);

    // Snapshot 4
    await perpsDataProcessor.processPerpsCompetition(competitionId);

    // Snapshot 5 (final for agent 2)
    await perpsDataProcessor.processPerpsCompetition(competitionId);

    // Get leaderboard before ending - should be sorted by Sortino
    const activeLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId,
      sort: "rank",
    });
    expect(activeLeaderboardResult).toBeDefined();
    const activeAgents = activeLeaderboardResult.agents;

    // Store original rankings and metrics
    const agent1Active = activeAgents.find((a) => a.id === agent1.id);
    const agent2Active = activeAgents.find((a) => a.id === agent2.id);

    expect(agent1Active).toBeDefined();
    expect(agent2Active).toBeDefined();

    const originalRankings = {
      agent1: {
        rank: agent1Active?.rank,
        sortino: agent1Active?.sortinoRatio,
        calmar: agent1Active?.calmarRatio,
      },
      agent2: {
        rank: agent2Active?.rank,
        sortino: agent2Active?.sortinoRatio,
        calmar: agent2Active?.calmarRatio,
      },
    };

    // End the competition - this triggers calculateAndPersistFinalLeaderboard
    await adminClient.endCompetition(competitionId);

    // Try to update the competition's evaluation metric AFTER it has ended
    await adminClient.updateCompetition(competitionId, {
      evaluationMetric: "calmar_ratio", // Try to change to Calmar
    });

    // Get leaderboard after the update attempt
    const endedLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId,
    });
    expect(endedLeaderboardResult).toBeDefined();
    const endedAgents = endedLeaderboardResult.agents;

    // Rankings should be PRESERVED (still using Sortino-based rankings from when it ended)
    const agent1Ended = endedAgents.find((a) => a.id === agent1.id);
    const agent2Ended = endedAgents.find((a) => a.id === agent2.id);

    expect(agent1Ended?.rank).toBe(originalRankings.agent1.rank);
    expect(agent2Ended?.rank).toBe(originalRankings.agent2.rank);

    // Metrics should be preserved as they were
    expect(agent1Ended?.sortinoRatio).toBe(originalRankings.agent1.sortino);
    expect(agent1Ended?.calmarRatio).toBe(originalRankings.agent1.calmar);
    expect(agent2Ended?.sortinoRatio).toBe(originalRankings.agent2.sortino);
    expect(agent2Ended?.calmarRatio).toBe(originalRankings.agent2.calmar);
  });

  test("should verify different bucket sizes return appropriate timeline granularity", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create and start a perps competition
    const { agent, rpcClient } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "Bucket Size Test Agent",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Bucket Size Test Competition",
      agentIds: [agent.id],
    });

    // Add many snapshots over 3 hours (every 10 minutes = 18 snapshots)
    const now = new Date();
    const snapshots = [];
    for (let i = 0; i < 18; i++) {
      snapshots.push({
        agentId: agent.id,
        competitionId: competition.competition.id,
        totalValue: 1000 + i * 10,
        timestamp: new Date(now.getTime() - (18 - i) * 10 * 60000),
      });
    }

    await db.insert(portfolioSnapshots).values(snapshots);

    // Test 1: Small bucket (10 minutes) - should return more data points
    const timeline10minResult = await rpcClient.competitions.getTimeline({
      competitionId: competition.competition.id,
      bucket: 10,
    });
    expect(timeline10minResult).toBeDefined();
    const agentData10min = timeline10minResult.find(
      (agentData) => agentData.agentId === agent.id,
    );
    const count10min = agentData10min?.timeline.length || 0;

    // Test 2: Larger bucket (30 minutes) - should return fewer data points
    const timeline30minResult = await rpcClient.competitions.getTimeline({
      competitionId: competition.competition.id,
      bucket: 30,
    });
    expect(timeline30minResult).toBeDefined();
    const agentData30min = timeline30minResult.find(
      (agentData) => agentData.agentId === agent.id,
    );
    const count30min = agentData30min?.timeline.length || 0;

    // Test 3: Very large bucket (60 minutes) - should return even fewer
    const timeline60minResult = await rpcClient.competitions.getTimeline({
      competitionId: competition.competition.id,
      bucket: 60,
    });
    expect(timeline60minResult).toBeDefined();
    const agentData60min = timeline60minResult.find(
      (agentData) => agentData.agentId === agent.id,
    );
    const count60min = agentData60min?.timeline.length || 0;

    // Verify bucket size affects granularity: smaller bucket = more data points
    expect(count10min).toBeGreaterThan(count30min);
    expect(count30min).toBeGreaterThan(count60min);
  });

  test("should correctly handle mixed metrics state in leaderboard", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Create 3 agents
    const { agent: agentGoodMetrics, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Agent With Good Metrics",
        agentWalletAddress: "0x3333333333333333333333333333333333333333", // $1100 equity
      });

    const { agent: agentPoorMetrics } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Poor Metrics",
      agentWalletAddress: "0x2222222222222222222222222222222222222222", // $950 equity
    });

    const { agent: agentHighEquityNoMetrics } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent High Equity No Metrics",
        agentWalletAddress: "0x1111111111111111111111111111111111111111", // $1250 equity on Symphony (HIGHEST)
      });

    // Start perps competition with calmar_ratio
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Mixed Metrics State Competition",
      agentIds: [
        agentGoodMetrics.id,
        agentPoorMetrics.id,
        agentHighEquityNoMetrics.id,
      ],
      evaluationMetric: "calmar_ratio",
    });

    // Process competition - this will calculate risk metrics for all agents
    await perpsDataProcessor.processPerpsCompetition(
      competition.competition.id,
    );

    // Now manually DELETE risk metrics for the high equity agent to simulate mixed state
    await db
      .delete(perpsRiskMetrics)
      .where(
        and(
          eq(perpsRiskMetrics.agentId, agentHighEquityNoMetrics.id),
          eq(perpsRiskMetrics.competitionId, competition.competition.id),
        ),
      );

    // Get leaderboard
    const leaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
      sort: "rank",
    });

    expect(leaderboardResult).toBeDefined();
    expect(leaderboardResult.agents).toHaveLength(3);

    // Find each agent
    const goodMetrics = leaderboardResult.agents.find(
      (a) => a.id === agentGoodMetrics.id,
    );
    const poorMetrics = leaderboardResult.agents.find(
      (a) => a.id === agentPoorMetrics.id,
    );
    const noMetrics = leaderboardResult.agents.find(
      (a) => a.id === agentHighEquityNoMetrics.id,
    );

    expect(goodMetrics).toBeDefined();
    expect(poorMetrics).toBeDefined();
    expect(noMetrics).toBeDefined();

    // Agents with metrics should rank by Calmar ratio
    expect(goodMetrics?.hasRiskMetrics).toBe(true);
    expect(poorMetrics?.hasRiskMetrics).toBe(true);

    // Agent without metrics should rank LAST despite having highest equity
    expect(noMetrics?.hasRiskMetrics).toBe(false);
    expect(noMetrics?.portfolioValue).toBe(1250); // Highest portfolio
    expect(noMetrics?.rank).toBe(3); // But ranks LAST due to NULL metrics

    // Agents with metrics should rank 1-2 by their Calmar ratios
    expect(goodMetrics?.rank).toBeLessThan(3);
    expect(poorMetrics?.rank).toBeLessThan(3);
  });

  test("should reject updating evaluation metric on active competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Active Competition Metric Change Agent",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    // Start competition with calmar_ratio
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Active Competition Metric Test",
      agentIds: [agent.id],
      evaluationMetric: "calmar_ratio",
    });

    expect(competition.success).toBe(true);
    expect(competition.competition.status).toBe("active");

    // Attempt to update evaluation metric while competition is active
    const updateResponse = await adminClient.updateCompetition(
      competition.competition.id,
      {
        evaluationMetric: "sortino_ratio",
      },
    );

    // Verify update was rejected
    expect(updateResponse.success).toBe(false);
    expect((updateResponse as ErrorResponse).error).toContain(
      "Cannot update perps configuration once competition has started",
    );
  });

  test("should return empty timeline for competition with no snapshots", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent, rpcClient } = await registerUserAndAgentAndGetRpcClient({
      adminApiKey,
      agentName: "No Snapshots Timeline Agent",
    });

    // Create a pending perps competition (not started yet)
    const createResponse = await adminClient.createCompetition({
      name: "No Snapshots Timeline Test",
      type: "perpetual_futures",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(createResponse.success).toBe(true);
    const competitionId = (createResponse as CreateCompetitionResponse)
      .competition.id;

    // Add agent to competition but don't start it
    await adminClient.addAgentToCompetition(competitionId, agent.id);

    // Try to get timeline - should return empty or minimal data
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId,
      bucket: 30,
    });

    expect(timeline).toBeDefined();

    // Timeline should be empty or have no data
    expect(timeline).toBeDefined();
    expect(Array.isArray(timeline)).toBe(true);
    // Should be empty since competition hasn't started and has no snapshots
    expect(timeline.length).toBe(0);
  });

  test("should preserve calmar_ratio rankings when competition with calmar evaluation ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Use existing wallets with known performance
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Calmar Preservation Agent 1",
        agentWalletAddress: "0x3333333333333333333333333333333333333333", // $1100, steady growth
      });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Calmar Preservation Agent 2",
      agentWalletAddress: "0x2222222222222222222222222222222222222222", // $950, negative return
    });

    // Start competition with calmar_ratio (default)
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Calmar Preservation Test",
      agentIds: [agent1.id, agent2.id],
      evaluationMetric: "calmar_ratio",
    });

    // Process to calculate metrics
    await perpsDataProcessor.processPerpsCompetition(
      competition.competition.id,
    );

    // Get active leaderboard
    const activeLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
      sort: "rank",
    });
    expect(activeLeaderboardResult).toBeDefined();
    const activeAgents = activeLeaderboardResult.agents;

    const agent1Active = activeAgents.find((a) => a.id === agent1.id);
    const agent2Active = activeAgents.find((a) => a.id === agent2.id);

    const originalCalmar1 = agent1Active?.calmarRatio;
    const originalCalmar2 = agent2Active?.calmarRatio;
    const originalRank1 = agent1Active?.rank;
    const originalRank2 = agent2Active?.rank;

    // End competition
    await adminClient.endCompetition(competition.competition.id);

    // Get ended leaderboard
    const endedLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
    });
    expect(endedLeaderboardResult).toBeDefined();
    const endedAgents = endedLeaderboardResult.agents;

    const agent1Ended = endedAgents.find((a) => a.id === agent1.id);
    const agent2Ended = endedAgents.find((a) => a.id === agent2.id);

    // Rankings and metrics should be preserved
    expect(agent1Ended?.rank).toBe(originalRank1);
    expect(agent2Ended?.rank).toBe(originalRank2);
    expect(agent1Ended?.calmarRatio).toBe(originalCalmar1);
    expect(agent2Ended?.calmarRatio).toBe(originalCalmar2);
  });

  test("should preserve simple_return rankings when competition with simple_return evaluation ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Use wallets with different returns
    const { agent: agent1, rpcClient } =
      await registerUserAndAgentAndGetRpcClient({
        adminApiKey,
        agentName: "Simple Return Preservation Agent 1",
        agentWalletAddress: "0x1111111111111111111111111111111111111111", // $1250, good return
      });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Simple Return Preservation Agent 2",
      agentWalletAddress: "0x3333333333333333333333333333333333333333", // $1100, moderate return
    });

    // Start competition with simple_return
    const competition = await startPerpsTestCompetition({
      adminClient,
      name: "Simple Return Preservation Test",
      agentIds: [agent1.id, agent2.id],
      evaluationMetric: "simple_return",
    });

    // Process to calculate metrics
    await perpsDataProcessor.processPerpsCompetition(
      competition.competition.id,
    );

    // Get active leaderboard
    const activeLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
      sort: "rank",
    });
    expect(activeLeaderboardResult).toBeDefined();
    const activeAgents = activeLeaderboardResult.agents;

    const agent1Active = activeAgents.find((a) => a.id === agent1.id);
    const agent2Active = activeAgents.find((a) => a.id === agent2.id);

    const originalReturn1 = agent1Active?.simpleReturn;
    const originalReturn2 = agent2Active?.simpleReturn;
    const originalRank1 = agent1Active?.rank;
    const originalRank2 = agent2Active?.rank;

    // End competition
    await adminClient.endCompetition(competition.competition.id);

    // Get ended leaderboard
    const endedLeaderboardResult = await rpcClient.competitions.getAgents({
      competitionId: competition.competition.id,
    });
    expect(endedLeaderboardResult).toBeDefined();
    const endedAgents = endedLeaderboardResult.agents;

    const agent1Ended = endedAgents.find((a) => a.id === agent1.id);
    const agent2Ended = endedAgents.find((a) => a.id === agent2.id);

    // Rankings and metrics should be preserved
    expect(agent1Ended?.rank).toBe(originalRank1);
    expect(agent2Ended?.rank).toBe(originalRank2);
    expect(agent1Ended?.simpleReturn).toBe(originalReturn1);
    expect(agent2Ended?.simpleReturn).toBe(originalReturn2);
  });

  test("should allow same position to exist in multiple sequential competitions", async () => {
    // The same providerPositionId should be allowed in different competitions
    // (unique constraint is now composite: providerPositionId + competitionId)

    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with wallet that has BTC position configured in Hyperliquid mock
    // This wallet returns consistent position data with deterministic providerPositionId
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi-Competition Position Agent",
        agentWalletAddress: "0x5555555555555555555555555555555555555555", // BTC long position
      });

    // ===== COMPETITION 1 =====
    const competition1 = await startPerpsTestCompetition({
      adminClient,
      name: `Position Constraint Test Comp 1 - ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(competition1.success).toBe(true);
    const comp1Id = competition1.competition.id;

    // Sync positions for competition 1
    await perpsDataProcessor.processPerpsCompetition(comp1Id);

    // Verify position was stored for competition 1 via API
    const comp1Positions = await agentClient.getPerpsPositions(comp1Id);
    expect(comp1Positions.success).toBe(true);
    const typedComp1Positions = comp1Positions as PerpsPositionsResponse;
    expect(typedComp1Positions.positions).toHaveLength(1);

    const btcPositionComp1 = typedComp1Positions.positions[0];
    expect(btcPositionComp1?.marketSymbol).toBe("BTC");
    expect(btcPositionComp1?.isLong).toBe(true);

    // End competition 1
    await adminClient.endCompetition(comp1Id);

    // ===== COMPETITION 2 =====
    // Start a NEW competition with the SAME agent (same wallet, same positions)
    const competition2 = await startPerpsTestCompetition({
      adminClient,
      name: `Position Constraint Test Comp 2 - ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(competition2.success).toBe(true);
    const comp2Id = competition2.competition.id;

    // Sync positions for competition 2
    // Before the fix, this would FAIL with unique constraint violation
    // because providerPositionId was globally unique
    await perpsDataProcessor.processPerpsCompetition(comp2Id);

    // Verify position was stored for competition 2 via API
    const comp2Positions = await agentClient.getPerpsPositions(comp2Id);
    expect(comp2Positions.success).toBe(true);
    const typedComp2Positions = comp2Positions as PerpsPositionsResponse;
    expect(typedComp2Positions.positions).toHaveLength(1);

    const btcPositionComp2 = typedComp2Positions.positions[0];
    expect(btcPositionComp2?.marketSymbol).toBe("BTC");
    expect(btcPositionComp2?.isLong).toBe(true);

    // Both competitions should have the same position data (same wallet, same asset)
    expect(btcPositionComp1?.marketSymbol).toBe(btcPositionComp2?.marketSymbol);
    expect(btcPositionComp1?.isLong).toBe(btcPositionComp2?.isLong);

    // Clean up
    await adminClient.endCompetition(comp2Id);
  });

  test("should allow same position in multiple sequential Symphony competitions", async () => {
    // Same test as above but with Symphony provider to ensure fix works for both

    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with wallet that has BTC/ETH positions configured in Symphony mock
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Symphony Multi-Competition Agent",
        agentWalletAddress: "0x1111111111111111111111111111111111111111", // BTC/ETH positions
      });

    // ===== COMPETITION 1 =====
    const competition1 = await startPerpsTestCompetition({
      adminClient,
      name: `Symphony Position Constraint Test Comp 1 - ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(competition1.success).toBe(true);
    const comp1Id = competition1.competition.id;

    // Sync positions
    await perpsDataProcessor.processPerpsCompetition(comp1Id);

    // Verify positions stored via API
    const comp1Positions = await agentClient.getPerpsPositions(comp1Id);
    expect(comp1Positions.success).toBe(true);
    const typedComp1Positions = comp1Positions as PerpsPositionsResponse;
    expect(typedComp1Positions.positions).toHaveLength(2); // BTC and ETH

    // End competition 1
    await adminClient.endCompetition(comp1Id);

    // ===== COMPETITION 2 =====
    const competition2 = await startPerpsTestCompetition({
      adminClient,
      name: `Symphony Position Constraint Test Comp 2 - ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "symphony",
        initialCapital: 1000,
        apiUrl: "http://localhost:4567",
      },
    });

    expect(competition2.success).toBe(true);
    const comp2Id = competition2.competition.id;

    // Sync positions - this would fail before the fix
    await perpsDataProcessor.processPerpsCompetition(comp2Id);

    // Verify positions stored for competition 2 via API
    const comp2Positions = await agentClient.getPerpsPositions(comp2Id);
    expect(comp2Positions.success).toBe(true);
    const typedComp2Positions = comp2Positions as PerpsPositionsResponse;
    expect(typedComp2Positions.positions).toHaveLength(2); // BTC and ETH

    // Verify both competitions have BTC positions with matching data
    const btcComp1 = typedComp1Positions.positions.find(
      (p) => p.marketSymbol === "BTC",
    );
    const btcComp2 = typedComp2Positions.positions.find(
      (p) => p.marketSymbol === "BTC",
    );

    expect(btcComp1).toBeDefined();
    expect(btcComp2).toBeDefined();
    expect(btcComp1?.isLong).toBe(btcComp2?.isLong);
    expect(btcComp1?.averagePrice).toBe(btcComp2?.averagePrice);

    // Clean up
    await adminClient.endCompetition(comp2Id);
  });

  test("should allow same position in multiple CONCURRENT competitions", async () => {
    // This test verifies the fix works for concurrent competitions
    // (both competitions active at the same time with the same agent)

    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with wallet that has BTC position configured in Hyperliquid mock
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Concurrent Competition Agent",
        agentWalletAddress: "0x5555555555555555555555555555555555555555", // BTC long position
      });

    // ===== START BOTH COMPETITIONS (CONCURRENT) =====
    const competition1 = await startPerpsTestCompetition({
      adminClient,
      name: `Concurrent Position Test Comp 1 - ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(competition1.success).toBe(true);
    const comp1Id = competition1.competition.id;

    // Start competition 2 WHILE competition 1 is still active
    const competition2 = await startPerpsTestCompetition({
      adminClient,
      name: `Concurrent Position Test Comp 2 - ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(competition2.success).toBe(true);
    const comp2Id = competition2.competition.id;

    // Both competitions are now active with the same agent

    // ===== SYNC POSITIONS FOR COMPETITION 1 =====
    await perpsDataProcessor.processPerpsCompetition(comp1Id);

    // Verify competition 1 has exactly 1 position
    const comp1PositionsInitial = await agentClient.getPerpsPositions(comp1Id);
    expect(comp1PositionsInitial.success).toBe(true);
    const typedComp1Initial = comp1PositionsInitial as PerpsPositionsResponse;
    expect(typedComp1Initial.positions).toHaveLength(1);
    expect(typedComp1Initial.positions[0]?.marketSymbol).toBe("BTC");

    // Competition 2 may already have positions from startup sync
    // (startPerpsTestCompetition calls startCompetition which syncs initial data)
    const comp2PositionsBeforeSync =
      await agentClient.getPerpsPositions(comp2Id);
    expect(comp2PositionsBeforeSync.success).toBe(true);
    const _typedComp2BeforeSync =
      comp2PositionsBeforeSync as PerpsPositionsResponse;
    // We don't assert on this because the startup sync behavior may vary

    // ===== SYNC POSITIONS FOR COMPETITION 2 =====
    // Before the fix, this would fail with unique constraint violation
    await perpsDataProcessor.processPerpsCompetition(comp2Id);

    // Verify competition 2 now has exactly 1 position
    const comp2PositionsAfterSync =
      await agentClient.getPerpsPositions(comp2Id);
    expect(comp2PositionsAfterSync.success).toBe(true);
    const typedComp2AfterSync =
      comp2PositionsAfterSync as PerpsPositionsResponse;
    expect(typedComp2AfterSync.positions).toHaveLength(1);
    expect(typedComp2AfterSync.positions[0]?.marketSymbol).toBe("BTC");

    // ===== VERIFY COMPETITION ISOLATION =====
    // Re-fetch competition 1 positions - should still be exactly 1
    const comp1PositionsAfterComp2Sync =
      await agentClient.getPerpsPositions(comp1Id);
    expect(comp1PositionsAfterComp2Sync.success).toBe(true);
    const typedComp1AfterComp2Sync =
      comp1PositionsAfterComp2Sync as PerpsPositionsResponse;
    expect(typedComp1AfterComp2Sync.positions).toHaveLength(1);

    // Both should have BTC positions with matching data (same underlying position)
    const btcComp1 = typedComp1AfterComp2Sync.positions[0];
    const btcComp2 = typedComp2AfterSync.positions[0];
    expect(btcComp1?.marketSymbol).toBe("BTC");
    expect(btcComp2?.marketSymbol).toBe("BTC");
    expect(btcComp1?.isLong).toBe(btcComp2?.isLong);
    expect(btcComp1?.isLong).toBe(true);

    // ===== VERIFY MULTIPLE SYNCS DON'T CREATE DUPLICATES =====
    // Sync both competitions again
    await perpsDataProcessor.processPerpsCompetition(comp1Id);
    await perpsDataProcessor.processPerpsCompetition(comp2Id);

    // Position counts should remain exactly 1 for each competition
    const comp1PositionsFinal = await agentClient.getPerpsPositions(comp1Id);
    const comp2PositionsFinal = await agentClient.getPerpsPositions(comp2Id);

    expect(comp1PositionsFinal.success).toBe(true);
    expect(comp2PositionsFinal.success).toBe(true);

    const typedComp1Final = comp1PositionsFinal as PerpsPositionsResponse;
    const typedComp2Final = comp2PositionsFinal as PerpsPositionsResponse;

    expect(typedComp1Final.positions).toHaveLength(1);
    expect(typedComp2Final.positions).toHaveLength(1);

    // ===== VERIFY VIA COMPETITION-WIDE ENDPOINT =====
    // Use the competition-level endpoint to verify total position counts
    const comp1AllPositions =
      await adminClient.getCompetitionAllPerpsPositions(comp1Id);
    const comp2AllPositions =
      await adminClient.getCompetitionAllPerpsPositions(comp2Id);

    expect(comp1AllPositions.success).toBe(true);
    expect(comp2AllPositions.success).toBe(true);

    const typedComp1All =
      comp1AllPositions as CompetitionAllPerpsPositionsResponse;
    const typedComp2All =
      comp2AllPositions as CompetitionAllPerpsPositionsResponse;

    expect(typedComp1All.positions).toHaveLength(1);
    expect(typedComp2All.positions).toHaveLength(1);

    // Verify positions belong to the correct competition via embedded data
    expect(typedComp1All.positions[0]?.agent.id).toBe(agent.id);
    expect(typedComp2All.positions[0]?.agent.id).toBe(agent.id);

    // Clean up - end both competitions
    await adminClient.endCompetition(comp1Id);
    await adminClient.endCompetition(comp2Id);
  });

  test("should detect deposit violation and create perps self-funding alert", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with transfers configured in mock Hyperliquid server
    // 0x8888 has a deposit transfer configured that triggers transfer_history alerts
    const { agent: agentWithDeposit } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Agent With Deposit Violation",
      agentWalletAddress: "0x8888888888888888888888888888888888888888",
    });

    // Start Hyperliquid competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Self-Funding Alert Test ${Date.now()}`,
      agentIds: [agentWithDeposit.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Process competition to detect transfers and create alerts
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get self-funding alerts via admin API - filter to transfer_history only
    const alertsResponse = await adminClient.getPerpsSelfFundingAlerts(
      competition.id,
      { detectionMethod: "transfer_history" },
    );

    expect(alertsResponse.success).toBe(true);
    const typedAlertsResponse = alertsResponse as PerpsAlertsResponse;
    expect(typedAlertsResponse.alerts).toBeDefined();
    expect(typedAlertsResponse.alerts.length).toBeGreaterThan(0);

    // Find the transfer_history alert for our deposit agent
    const depositAlert = typedAlertsResponse.alerts.find(
      (a) =>
        a.agentId === agentWithDeposit.id &&
        a.detectionMethod === "transfer_history",
    );
    expect(depositAlert).toBeDefined();
    expect(depositAlert?.reviewed).toBe(false);
    expect(depositAlert?.detectionMethod).toBe("transfer_history");
  });

  test("should allow admin to review perps self-funding alert", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with deposit
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Agent For Review Test",
      agentWalletAddress: "0x8888888888888888888888888888888888888888",
    });

    // Start competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Alert Review Test ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Process to create alerts
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Get unreviewed alerts
    const alertsResponse = await adminClient.getPerpsSelfFundingAlerts(
      competition.id,
      { reviewed: "false" },
    );

    expect(alertsResponse.success).toBe(true);
    const typedAlertsResponse = alertsResponse as PerpsAlertsResponse;
    expect(typedAlertsResponse.alerts.length).toBeGreaterThan(0);

    const alert = typedAlertsResponse.alerts[0];
    expect(alert).toBeDefined();

    // Review the alert
    const reviewResponse = await adminClient.reviewPerpsSelfFundingAlert(
      competition.id,
      alert!.id,
      {
        reviewNote: "Reviewed - warning issued for deposit violation",
        actionTaken: "warning",
      },
    );

    expect(reviewResponse.success).toBe(true);

    // Verify alert was marked as reviewed
    const updatedAlertsResponse = await adminClient.getPerpsSelfFundingAlerts(
      competition.id,
      { reviewed: "true" },
    );

    expect(updatedAlertsResponse.success).toBe(true);
    const typedUpdatedResponse = updatedAlertsResponse as PerpsAlertsResponse;

    const reviewedAlert = typedUpdatedResponse.alerts.find(
      (a) => a.id === alert!.id,
    );
    expect(reviewedAlert).toBeDefined();
    expect(reviewedAlert?.reviewed).toBe(true);
    expect(reviewedAlert?.reviewNote).toBe(
      "Reviewed - warning issued for deposit violation",
    );
    expect(reviewedAlert?.actionTaken).toBe("warning");
  });

  test("should filter perps alerts by detection method", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with deposit
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perps Detection Method Filter Test Agent",
      agentWalletAddress: "0x8888888888888888888888888888888888888888",
    });

    // Start competition
    const response = await startPerpsTestCompetition({
      adminClient,
      name: `Perps Alert Filter Test ${Date.now()}`,
      agentIds: [agent.id],
      perpsProvider: {
        provider: "hyperliquid",
        apiUrl: "http://localhost:4568",
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Process to create alerts
    await perpsDataProcessor.processPerpsCompetition(competition.id);

    // Filter by transfer_history detection method
    const transferHistoryAlerts = await adminClient.getPerpsSelfFundingAlerts(
      competition.id,
      { reviewed: "all", detectionMethod: "transfer_history" },
    );

    expect(transferHistoryAlerts.success).toBe(true);
    const typedTransferHistoryResponse =
      transferHistoryAlerts as PerpsAlertsResponse;

    // All returned alerts should have transfer_history detection method
    typedTransferHistoryResponse.alerts.forEach((alert) => {
      expect(alert.detectionMethod).toBe("transfer_history");
    });
  });

  test("should return 400 for non-perps competition on perps alerts endpoint", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading Agent for Perps Alert Test",
    });

    // Start a PAPER TRADING competition (not perps)
    const response = await startTestCompetition({
      adminClient,
      name: `Paper Trading Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Try to get perps alerts for paper trading competition
    const alertsResponse = await adminClient.getPerpsSelfFundingAlerts(
      competition.id,
    );

    expect(alertsResponse.success).toBe(false);
    const errorResponse = alertsResponse as ErrorResponse;
    expect(errorResponse.status).toBe(400);
  });
});
