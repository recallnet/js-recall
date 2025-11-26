import { beforeEach, describe, expect, test } from "vitest";

import {
  type AdminCompetitionTransferViolationsResponse,
  type AgentCompetitionsResponse,
  ApiClient,
  type BalancesResponse,
  type CompetitionAgentsResponse,
  type CompetitionDetailResponse,
  type EnhancedCompetition,
  type ErrorResponse,
  type SpotLiveAlertsResponse,
  type TradeHistoryResponse,
  createTestClient,
  generateTestHandle,
  getAdminApiKey,
  getBaseUrl,
  registerUserAndAgentAndGetClient,
  startSpotLiveTestCompetition,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";
import type { AdminAgentResponse } from "@recallnet/test-utils";

import { ServiceRegistry } from "@/services/index.js";

describe("Spot Live Competition", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    // Get admin API key for each test
    adminApiKey = await getAdminApiKey();
  });

  test("should initialize agent portfolio balances from blockchain on competition start", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents with different wallet addresses
    // Mock will return different balances for each
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With 2K USDC",
        agentWalletAddress: "0xaaaa000000000000000000000000000000000001", // 2000 USDC on Base
      });

    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With 3K USDC",
        agentWalletAddress: "0xbbbb000000000000000000000000000000000002", // 3000 USDC on Eth
      });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Initial Balance Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for initial sync to complete
    await wait(2000);

    // Agent 1 checks their token balances
    const balance1Response = await client1.getBalance(competition.id);
    expect(balance1Response.success).toBe(true);

    const balances1 = (balance1Response as BalancesResponse).balances;
    const usdcBalance1 = balances1.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    expect(usdcBalance1).toBeDefined();
    expect(usdcBalance1?.amount).toBeCloseTo(2000, 1);

    // Agent 1 checks their portfolio balance (calculated USD value)
    const leaderboard1 = await adminClient.getCompetitionAgents(competition.id);
    expect(leaderboard1.success).toBe(true);
    const agent1Entry = (leaderboard1 as CompetitionAgentsResponse).agents.find(
      (a) => a.id === agent1.id,
    );
    expect(agent1Entry).toBeDefined();
    expect(agent1Entry?.portfolioValue).toBeCloseTo(2000, 0); // ~$2000 (USDC at $1, 0 decimals = ±1)

    // Agent 2 checks their token balances
    const balance2Response = await client2.getBalance(competition.id);
    expect(balance2Response.success).toBe(true);

    const balances2 = (balance2Response as BalancesResponse).balances;
    const usdcBalance2 = balances2.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    expect(usdcBalance2).toBeDefined();
    expect(usdcBalance2?.amount).toBeCloseTo(3000, 1);

    // Agent 2 checks their portfolio balance (calculated USD value)
    const agent2Entry = (leaderboard1 as CompetitionAgentsResponse).agents.find(
      (a) => a.id === agent2.id,
    );
    expect(agent2Entry).toBeDefined();
    expect(agent2Entry?.portfolioValue).toBeCloseTo(3000, 0); // ~$3000 (USDC at $1, 0 decimals = ±1)

    // Now force a sync to process swaps that happened since competition start
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent 1 checks updated balances after swap (100 USDC → 50 AERO)
    const updatedBalance1Response = await client1.getBalance(competition.id);
    expect(updatedBalance1Response.success).toBe(true);

    const updatedBalances1 = (updatedBalance1Response as BalancesResponse)
      .balances;
    const updatedUsdc1 = updatedBalances1.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    const aero1 = updatedBalances1.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    );
    expect(updatedUsdc1?.amount).toBeCloseTo(1900, 1); // 100 USDC spent
    expect(aero1?.amount).toBeCloseTo(50, 1); // 50 AERO received

    // Agent 2 checks updated balances after swap (200 USDC → 100 AERO)
    const updatedBalance2Response = await client2.getBalance(competition.id);
    expect(updatedBalance2Response.success).toBe(true);

    const updatedBalances2 = (updatedBalance2Response as BalancesResponse)
      .balances;
    const updatedUsdc2 = updatedBalances2.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    const aero2 = updatedBalances2.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    );
    expect(updatedUsdc2?.amount).toBeCloseTo(2800, 1); // 200 USDC spent
    expect(aero2?.amount).toBeCloseTo(100, 1); // 100 AERO received

    // Verify portfolio values updated (should reflect swap value with AERO price)
    const leaderboard2 = await adminClient.getCompetitionAgents(competition.id);
    expect(leaderboard2.success).toBe(true);

    const updatedAgent1 = (
      leaderboard2 as CompetitionAgentsResponse
    ).agents.find((a) => a.id === agent1.id);
    const updatedAgent2 = (
      leaderboard2 as CompetitionAgentsResponse
    ).agents.find((a) => a.id === agent2.id);

    expect(updatedAgent1).toBeDefined();
    expect(updatedAgent2).toBeDefined();

    // Portfolio values should be close to original (assuming AERO has some value)
    // 1900 USDC + 50 AERO ≈ $1900 + (50 * AERO_price)
    // 2800 USDC + 100 AERO ≈ $2800 + (100 * AERO_price)
    expect(updatedAgent1?.portfolioValue).toBeGreaterThan(1900); // At least USDC value
    expect(updatedAgent2?.portfolioValue).toBeGreaterThan(2800); // At least USDC value
  });

  test("should retrieve competition details with spot live specific fields", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Spot Live Detail Agent 1",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    // Start a spot live competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Spot Live Detail Test ${Date.now()}`,
      agentIds: [agent1.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Get competition details
    const detailResponse = await adminClient.getCompetition(competition.id);
    expect(detailResponse.success).toBe(true);

    // Type assertion since we've verified success
    const typedDetailResponse = detailResponse as CompetitionDetailResponse;
    expect(typedDetailResponse.competition).toBeDefined();
    expect(typedDetailResponse.competition.type).toBe("spot_live_trading");

    // Check for spot live stats
    const comp = typedDetailResponse.competition as EnhancedCompetition;
    expect(comp.stats?.totalAgents).toBeDefined();
    expect(comp.stats?.totalTrades).toBeDefined();
  });

  test("should detect Aerodrome swaps and update agent balances", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with Aerodrome swap activity
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Aerodrome Swap Agent",
        agentWalletAddress: "0x1111111111111111111111111111111111111111",
      });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Aerodrome Swap Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for competition to fully start
    await wait(1000);

    const services = new ServiceRegistry();

    // First manual sync (simulates first cron job) - processes swap 1
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks THEIR trade history after first sync
    const tradesResponse = await agentClient.getTradeHistory(competition.id);
    expect(tradesResponse.success).toBe(true);

    const typedTradesResponse = tradesResponse as TradeHistoryResponse;
    expect(typedTradesResponse.trades).toBeDefined();
    expect(typedTradesResponse.trades.length).toBeGreaterThan(0);

    // Find the Aerodrome swap
    const aerodromeSwap = typedTradesResponse.trades.find(
      (t) => t.txHash === "0xmock_swap_1",
    );
    expect(aerodromeSwap).toBeDefined();
    expect(aerodromeSwap?.tradeType).toBe("spot_live");
    expect(aerodromeSwap?.protocol).toBe("aerodrome");

    // Verify gas data is populated
    expect(aerodromeSwap?.gasUsed).toBeDefined();
    expect(aerodromeSwap?.gasPrice).toBeDefined();
    expect(Number(aerodromeSwap?.gasUsed)).toBeGreaterThan(0);
    expect(Number(aerodromeSwap?.gasPrice)).toBeGreaterThan(0);

    // Agent checks THEIR balances
    const balancesResponse = await agentClient.getBalance(competition.id);
    expect(balancesResponse.success).toBe(true);

    const typedBalancesResponse = balancesResponse as BalancesResponse;
    const balances = typedBalancesResponse.balances;

    // Agent should have AERO tokens now (received from swap)
    const aeroBalance = balances.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    );
    expect(aeroBalance).toBeDefined();
    expect(aeroBalance?.amount).toBeGreaterThan(0);
  });

  test("should process multiple swaps across incremental syncs", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with multiple swaps at different blocks
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi-Sync Agent",
        agentWalletAddress: "0x1111111111111111111111111111111111111111",
      });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Multi-Sync Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    const services = new ServiceRegistry();

    // First sync - processes block 2000000 (swap 1)
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks trades after first sync
    const trades1Response = await agentClient.getTradeHistory(competition.id);
    expect(trades1Response.success).toBe(true);
    const trades1 = (trades1Response as TradeHistoryResponse).trades;
    expect(trades1.length).toBe(1);
    expect(trades1[0]?.txHash).toBe("0xmock_swap_1");

    // Second sync - processes block 2000010 (swap 2)
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks trades after second sync
    const trades2Response = await agentClient.getTradeHistory(competition.id);
    expect(trades2Response.success).toBe(true);
    const trades2 = (trades2Response as TradeHistoryResponse).trades;
    console.log(
      `[TEST] trades2 length: ${trades2.length}, hashes: ${trades2.map((t) => t.txHash).join(", ")}`,
    );
    expect(trades2.length).toBe(2);
    const secondSwap = trades2.find((t) => t.txHash === "0xmock_swap_2");
    expect(secondSwap).toBeDefined();

    // Third sync - processes block 2000020 (swap 3)
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks trades after third sync
    const trades3Response = await agentClient.getTradeHistory(competition.id);
    expect(trades3Response.success).toBe(true);
    const trades3 = (trades3Response as TradeHistoryResponse).trades;
    expect(trades3.length).toBe(3);
    const thirdSwap = trades3.find((t) => t.txHash === "0xmock_swap_3");
    expect(thirdSwap).toBeDefined();
  });

  test("should filter swaps by protocol when Aerodrome filter is enabled", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with Aerodrome + Uniswap swaps
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Protocol Filter Agent",
        agentWalletAddress: "0x4444444444444444444444444444444444444444",
      });

    // Start competition with Aerodrome filter
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Protocol Filter Test ${Date.now()}`,
      agentIds: [agent.id],
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        allowedProtocols: [
          {
            protocol: "aerodrome",
            chain: "base",
          },
        ],
        selfFundingThresholdUsd: 10,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks THEIR trades
    const tradesResponse = await agentClient.getTradeHistory(competition.id);
    expect(tradesResponse.success).toBe(true);

    const typedTradesResponse = tradesResponse as TradeHistoryResponse;
    const trades = typedTradesResponse.trades;

    // Should only have Aerodrome swap, not Uniswap swap
    const aerodromeSwap = trades.find(
      (t) => t.txHash === "0xmock_aerodrome_swap",
    );
    expect(aerodromeSwap).toBeDefined();
    expect(aerodromeSwap?.protocol).toBe("aerodrome");

    // Uniswap swap should be filtered out
    const uniswapSwap = trades.find((t) => t.txHash === "0xmock_uniswap_swap");
    expect(uniswapSwap).toBeUndefined();
  });

  test("should show spot live competition in agent's competition list", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Spot Live List Agent",
        agentWalletAddress: "0x1111111111111111111111111111111111111111",
      });

    // Start a spot live competition
    const competitionName = `Spot Live List Test ${Date.now()}`;
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Agent views THEIR competitions
    const competitionsResponse = await agentClient.getAgentCompetitions(
      agent.id,
    );

    expect(competitionsResponse.success).toBe(true);

    // Type assertion since we've verified success
    const typedCompetitionsResponse =
      competitionsResponse as AgentCompetitionsResponse;
    expect(typedCompetitionsResponse.competitions).toBeDefined();
    expect(Array.isArray(typedCompetitionsResponse.competitions)).toBe(true);

    // Find the spot live competition
    const spotLiveComp = typedCompetitionsResponse.competitions.find(
      (c: EnhancedCompetition) => c.id === competition.id,
    );

    expect(spotLiveComp).toBeDefined();
    expect(spotLiveComp?.type).toBe("spot_live_trading");
    expect(spotLiveComp?.name).toBe(competitionName);
    expect(spotLiveComp?.totalTrades).toBeDefined();
  });

  test("should detect deposit violation and create alert", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with deposit violation
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Deposit",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Deposit Violation Test ${Date.now()}`,
      agentIds: [agent.id],
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        selfFundingThresholdUsd: 50,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync with monitoring enabled
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin checks for self-funding alerts
    const alertsResponse = await adminClient.getSpotLiveSelfFundingAlerts(
      competition.id,
    );
    expect(alertsResponse.success).toBe(true);

    const typedAlertsResponse = alertsResponse as SpotLiveAlertsResponse;
    expect(typedAlertsResponse.alerts).toBeDefined();
    expect(typedAlertsResponse.alerts.length).toBeGreaterThan(0);

    // Find the deposit alert
    const depositAlert = typedAlertsResponse.alerts.find(
      (a) => a.agentId === agent.id && a.violationType === "deposit",
    );
    expect(depositAlert).toBeDefined();
    expect(depositAlert?.reviewed).toBe(false);
    expect(depositAlert?.detectionMethod).toBeDefined();
  });

  test("should detect withdrawal violation and create alert", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with withdrawal violation
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Withdrawal",
      agentWalletAddress: "0x3333333333333333333333333333333333333333",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Withdrawal Violation Test ${Date.now()}`,
      agentIds: [agent.id],
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        selfFundingThresholdUsd: 50,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync with monitoring
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin checks for alerts
    const alertsResponse = await adminClient.getSpotLiveSelfFundingAlerts(
      competition.id,
    );
    expect(alertsResponse.success).toBe(true);

    const typedAlertsResponse = alertsResponse as SpotLiveAlertsResponse;
    expect(typedAlertsResponse.alerts.length).toBeGreaterThan(0);

    // Find the withdrawal alert
    const withdrawalAlert = typedAlertsResponse.alerts.find(
      (a) =>
        a.agentId === agent.id &&
        a.violationType === "withdrawal_exceeds_limit",
    );
    expect(withdrawalAlert).toBeDefined();
    expect(withdrawalAlert?.reviewed).toBe(false);
  });

  test("should allow admin to review spot live self-funding alert", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with deposit
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Alert Review Agent",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Alert Review Test ${Date.now()}`,
      agentIds: [agent.id],
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        selfFundingThresholdUsd: 50,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync to create alerts
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin gets unreviewed alerts
    const alertsResponse = await adminClient.getSpotLiveSelfFundingAlerts(
      competition.id,
      { reviewed: "false" },
    );
    expect(alertsResponse.success).toBe(true);

    const typedAlertsResponse = alertsResponse as SpotLiveAlertsResponse;
    expect(typedAlertsResponse.alerts.length).toBeGreaterThan(0);

    const alert = typedAlertsResponse.alerts[0];
    expect(alert).toBeDefined();

    // Admin reviews the alert
    const reviewResponse = await adminClient.reviewSpotLiveSelfFundingAlert(
      competition.id,
      alert!.id,
      {
        reviewNote: "Reviewed - warning issued",
        actionTaken: "warning",
      },
    );
    expect(reviewResponse.success).toBe(true);

    // Admin verifies alert was marked as reviewed
    const updatedAlertsResponse =
      await adminClient.getSpotLiveSelfFundingAlerts(competition.id, {
        reviewed: "true",
      });
    expect(updatedAlertsResponse.success).toBe(true);

    const typedUpdatedResponse =
      updatedAlertsResponse as SpotLiveAlertsResponse;
    const reviewedAlert = typedUpdatedResponse.alerts.find(
      (a) => a.id === alert!.id,
    );
    expect(reviewedAlert).toBeDefined();
    expect(reviewedAlert?.reviewed).toBe(true);
    expect(reviewedAlert?.reviewNote).toBe("Reviewed - warning issued");
    expect(reviewedAlert?.actionTaken).toBe("warning");
  });

  test("should filter alerts by violation type", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with different violation types
    const { agent: agentDeposit } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Deposit Filter",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    const { agent: agentWithdrawal } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Withdrawal Filter",
      agentWalletAddress: "0x3333333333333333333333333333333333333333",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Alert Filter Test ${Date.now()}`,
      agentIds: [agentDeposit.id, agentWithdrawal.id],
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        selfFundingThresholdUsd: 50,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin filters by deposit violations only
    const depositAlertsResponse =
      await adminClient.getSpotLiveSelfFundingAlerts(competition.id, {
        reviewed: "all",
        violationType: "deposit",
      });
    expect(depositAlertsResponse.success).toBe(true);

    const typedDepositResponse =
      depositAlertsResponse as SpotLiveAlertsResponse;
    typedDepositResponse.alerts.forEach((alert) => {
      expect(alert.violationType).toBe("deposit");
    });

    // Admin filters by withdrawal violations only
    const withdrawalAlertsResponse =
      await adminClient.getSpotLiveSelfFundingAlerts(competition.id, {
        reviewed: "all",
        violationType: "withdrawal_exceeds_limit",
      });
    expect(withdrawalAlertsResponse.success).toBe(true);

    const typedWithdrawalResponse =
      withdrawalAlertsResponse as SpotLiveAlertsResponse;
    typedWithdrawalResponse.alerts.forEach((alert) => {
      expect(alert.violationType).toBe("withdrawal_exceeds_limit");
    });
  });

  test("should rank agents by ROI percentage", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents - one with activity, one without
    const { agent: agentActive } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Active Trading Agent",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const { agent: agentInactive } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Inactive Agent",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `ROI Ranking Test ${Date.now()}`,
      agentIds: [agentActive.id, agentInactive.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin checks leaderboard
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);

    const typedLeaderboard = leaderboardResponse as CompetitionAgentsResponse;
    expect(typedLeaderboard.agents).toBeDefined();
    expect(typedLeaderboard.agents.length).toBe(2);

    // Active agent should rank higher (has positive ROI from trading)
    const activeAgentEntry = typedLeaderboard.agents.find(
      (a) => a.id === agentActive.id,
    );
    const inactiveAgentEntry = typedLeaderboard.agents.find(
      (a) => a.id === agentInactive.id,
    );

    expect(activeAgentEntry).toBeDefined();
    expect(inactiveAgentEntry).toBeDefined();

    // Active agent should have better rank (lower rank number)
    expect(activeAgentEntry?.rank).toBeLessThan(inactiveAgentEntry!.rank);
  });

  test("should handle empty wallet with no activity", async () => {
    // Setup admin client
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with empty wallet
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Empty Wallet Agent",
        agentWalletAddress: "0x5555555555555555555555555555555555555555",
      });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Empty Wallet Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync - should not error
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks THEIR trades
    const tradesResponse = await agentClient.getTradeHistory(competition.id);
    expect(tradesResponse.success).toBe(true);

    const typedTradesResponse = tradesResponse as TradeHistoryResponse;
    expect(typedTradesResponse.trades).toBeDefined();
    expect(typedTradesResponse.trades.length).toBe(0);

    // Agent should still appear in leaderboard
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(leaderboardResponse.success).toBe(true);

    const typedLeaderboard = leaderboardResponse as CompetitionAgentsResponse;
    const agentEntry = typedLeaderboard.agents.find((a) => a.id === agent.id);
    expect(agentEntry).toBeDefined();
  });

  test("should require wallet address for agents joining spot live competitions", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Initial Agent",
    });

    // Create agent WITHOUT wallet
    const agentNoWalletResponse = (await adminClient.registerAgent({
      user: { id: user.id },
      agent: {
        name: "Agent Without Wallet",
        handle: generateTestHandle("Agent Without Wallet"),
        description: "Test agent without wallet",
      },
    })) as AdminAgentResponse;
    const agentNoWallet = agentNoWalletResponse.agent;
    const agentNoWalletClient = new ApiClient(agentNoWallet.apiKey);

    // Register agent WITH wallet
    const { agent: agentWithWallet, client: agentWithWalletClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With Wallet",
        agentWalletAddress: "0x1111111111111111111111111111111111111111",
      });

    // Create a spot live competition
    const competitionResponse = await adminClient.createCompetition({
      name: `Wallet Validation Test ${Date.now()}`,
      type: "spot_live_trading",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        selfFundingThresholdUsd: 10,
        syncIntervalMinutes: 2,
      },
    });

    expect(competitionResponse.success).toBe(true);
    const typedCompetitionResponse = competitionResponse as {
      success: true;
      competition: { id: string; status: string };
    };
    const competition = typedCompetitionResponse.competition;

    // Test 1: Agent WITHOUT wallet should FAIL to join
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

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should allow agents without wallets to join paper trading competitions", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading User",
    });

    // Create agent without wallet
    const agentNoWalletResponse = (await adminClient.registerAgent({
      user: { id: user.id },
      agent: {
        name: "Paper Trading Agent No Wallet",
        handle: generateTestHandle("Paper Trading Agent No Wallet"),
        description: "Test paper trading agent without wallet",
      },
    })) as AdminAgentResponse;
    const agentNoWallet = agentNoWalletResponse.agent;
    const agentNoWalletClient = new ApiClient(agentNoWallet.apiKey);

    // Create PAPER TRADING competition
    const competitionResponse = await adminClient.createCompetition({
      name: `Paper Trading No Wallet ${Date.now()}`,
      type: "trading",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
    });

    expect(competitionResponse.success).toBe(true);
    const typedCompetitionResponse = competitionResponse as {
      success: true;
      competition: { id: string; status: string };
    };
    const competition = typedCompetitionResponse.competition;

    // Agent WITHOUT wallet should SUCCEED for paper trading
    const joinResponse = await agentNoWalletClient.joinCompetition(
      competition.id,
      agentNoWallet.id,
    );
    expect(joinResponse.success).toBe(true);

    // Start competition
    const startResponse = await adminClient.startCompetition({
      competitionId: competition.id,
      agentIds: [agentNoWallet.id],
    });
    expect(startResponse.success).toBe(true);

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should prevent admin from adding agent without wallet to spot live competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Admin Spot Live User",
    });

    // Create agent without wallet
    const agentNoWalletResponse = (await adminClient.registerAgent({
      user: { id: user.id },
      agent: {
        name: "Admin Spot Live No Wallet",
        handle: generateTestHandle("Admin Spot Live No Wallet"),
        description: "Test agent without wallet for admin endpoint",
      },
    })) as AdminAgentResponse;
    const agentNoWallet = agentNoWalletResponse.agent;

    // Create spot live competition
    const competitionResponse = await adminClient.createCompetition({
      name: `Admin Wallet Validation Spot Live ${Date.now()}`,
      type: "spot_live_trading",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
      spotLiveConfig: {
        dataSource: "rpc_direct",
        dataSourceConfig: {
          type: "rpc_direct",
          provider: "alchemy",
          chains: ["base"],
        },
        chains: ["base"],
        selfFundingThresholdUsd: 10,
        syncIntervalMinutes: 2,
      },
    });

    expect(competitionResponse.success).toBe(true);
    const typedCompetitionResponse = competitionResponse as {
      success: true;
      competition: { id: string };
    };
    const competition = typedCompetitionResponse.competition;

    // Admin should NOT be able to add agent without wallet
    const addAgentResponse = await adminClient.addAgentToCompetition(
      competition.id,
      agentNoWallet.id,
    );

    expect(addAgentResponse.success).toBe(false);
    const addErrorResponse = addAgentResponse as ErrorResponse;
    expect(addErrorResponse.error).toContain("wallet address");
    expect(addErrorResponse.error).toContain("participate in this competition");

    // Verify agent with wallet CAN be added
    const { agent: agentWithWallet } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Admin Spot Live With Wallet",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const addWithWalletResponse = await adminClient.addAgentToCompetition(
      competition.id,
      agentWithWallet.id,
    );
    expect(addWithWalletResponse.success).toBe(true);

    // Clean up
    await adminClient.endCompetition(competition.id);
  });

  test("should return transfer violations via admin endpoint for spot live", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with transfers
    const { agent: agentWithTransfer } = await registerUserAndAgentAndGetClient(
      {
        adminApiKey,
        agentName: "Agent With Transfer Spot Live",
        agentWalletAddress: "0x2222222222222222222222222222222222222222",
      },
    );

    const { agent: agentClean } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Clean Agent Spot Live",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Transfer Violations Spot Live ${Date.now()}`,
      agentIds: [agentWithTransfer.id, agentClean.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin gets transfer violations
    const violationsResponse =
      await adminClient.getCompetitionTransferViolations(competition.id);
    expect(violationsResponse.success).toBe(true);

    const typedViolationsResponse =
      violationsResponse as AdminCompetitionTransferViolationsResponse;

    // Should only report agent with transfers
    expect(typedViolationsResponse.violations.length).toBeGreaterThan(0);

    const violation = typedViolationsResponse.violations.find(
      (v) => v.agentId === agentWithTransfer.id,
    );
    expect(violation).toBeDefined();
    expect(violation?.transferCount).toBeGreaterThan(0);

    // Clean agent should not appear
    const cleanViolation = typedViolationsResponse.violations.find(
      (v) => v.agentId === agentClean.id,
    );
    expect(cleanViolation).toBeUndefined();
  });

  test("should return 400 when trying to get spot live alerts for paper trading competition", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading Agent For Alert Test",
    });

    // Start PAPER TRADING competition
    const response = await startTestCompetition({
      adminClient,
      name: `Paper Trading Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Try to get spot live alerts - should fail
    const alertsResponse = await adminClient.getSpotLiveSelfFundingAlerts(
      competition.id,
    );

    expect(alertsResponse.success).toBe(false);
    const errorResponse = alertsResponse as ErrorResponse;
    expect(errorResponse.status).toBe(400);
  });

  test("should return 400 for non-spot-live competition on transfer violations endpoint", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Paper Trading Agent for Violation Test",
    });

    // Start a PAPER TRADING competition
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

  test("should preserve spot live metrics when competition ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Spot Live Preservation Agent 1",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Spot Live Preservation Agent 2",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Spot Live Preservation Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Get active leaderboard
    const activeLeaderboard = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(activeLeaderboard.success).toBe(true);
    const activeAgents = (activeLeaderboard as CompetitionAgentsResponse)
      .agents;

    // Store active metrics
    const activeMetrics = new Map<
      string,
      {
        rank: number;
        portfolioValue: number;
        pnl: number;
      }
    >();

    activeAgents.forEach((agent) => {
      activeMetrics.set(agent.id, {
        rank: agent.rank,
        portfolioValue: agent.portfolioValue,
        pnl: agent.pnl,
      });
    });

    // End competition
    await adminClient.endCompetition(competition.id);
    await wait(2000);

    // Get ended leaderboard
    const endedLeaderboard = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(endedLeaderboard.success).toBe(true);
    const endedAgents = (endedLeaderboard as CompetitionAgentsResponse).agents;

    // Verify metrics are preserved
    endedAgents.forEach((agent) => {
      const activeData = activeMetrics.get(agent.id);
      expect(activeData).toBeDefined();
      expect(agent.rank).toBe(activeData?.rank);
      expect(agent.portfolioValue).toBe(activeData?.portfolioValue);
      expect(agent.pnl).toBe(activeData?.pnl);
    });
  });

  test("should verify spot live trades queryable by agent and admin", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Query Test Agent",
        agentWalletAddress: "0x1111111111111111111111111111111111111111",
      });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Query Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent queries THEIR trades
    const agentTradesResponse = await agentClient.getTradeHistory(
      competition.id,
    );
    expect(agentTradesResponse.success).toBe(true);

    const typedAgentTrades = agentTradesResponse as TradeHistoryResponse;
    expect(typedAgentTrades.trades).toBeDefined();
    expect(typedAgentTrades.trades.length).toBeGreaterThan(0);

    // Verify trade type is spot_live
    const trade = typedAgentTrades.trades[0];
    expect(trade?.tradeType).toBe("spot_live");

    // Admin queries competition trades (public view)
    const competitionTradesResponse = await adminClient.getCompetitionTrades(
      competition.id,
    );
    expect(competitionTradesResponse.success).toBe(true);

    const typedCompTrades = competitionTradesResponse as TradeHistoryResponse;
    expect(typedCompTrades.trades.length).toBeGreaterThan(0);

    // Admin queries specific agent's trades
    const adminAgentTradesResponse =
      await adminClient.getAgentTradesInCompetition(competition.id, agent.id);
    expect(adminAgentTradesResponse.success).toBe(true);

    const typedAdminAgentTrades =
      adminAgentTradesResponse as TradeHistoryResponse;
    expect(typedAdminAgentTrades.trades.length).toBeGreaterThan(0);
    expect(typedAdminAgentTrades.trades[0]?.agentId).toBe(agent.id);
  });

  test("should sync final blockchain data when competition ends", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Spot Live End Test Agent",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Spot Live End Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync during competition
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Get competition details before ending
    const beforeEndResponse = await adminClient.getCompetition(competition.id);
    expect(beforeEndResponse.success).toBe(true);
    const beforeEndComp = (beforeEndResponse as CompetitionDetailResponse)
      .competition;
    expect(beforeEndComp.status).toBe("active");

    // End competition (triggers final sync)
    const endResponse = await adminClient.endCompetition(competition.id);
    expect(endResponse.success).toBe(true);
    await wait(2000);

    // Verify competition is ended
    const afterEndResponse = await adminClient.getCompetition(competition.id);
    expect(afterEndResponse.success).toBe(true);
    const afterEndComp = (afterEndResponse as CompetitionDetailResponse)
      .competition;
    expect(afterEndComp.status).toBe("ended");
  });

  test("should handle multiple agents with different activity levels", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with different mock data
    const { agent: agentActive } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Active Trader",
      agentWalletAddress: "0x1111111111111111111111111111111111111111",
    });

    const { agent: agentDeposit } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Deposit Multi",
      agentWalletAddress: "0x2222222222222222222222222222222222222222",
    });

    const { agent: agentWithdrawal } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent With Withdrawal Multi",
      agentWalletAddress: "0x3333333333333333333333333333333333333333",
    });

    const { agent: agentMulti } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Multi-Protocol Agent",
      agentWalletAddress: "0x4444444444444444444444444444444444444444",
    });

    const { agent: agentEmpty } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Empty Wallet Agent Multi",
      agentWalletAddress: "0x5555555555555555555555555555555555555555",
    });

    // Start competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Multi-Agent Spot Live ${Date.now()}`,
      agentIds: [
        agentActive.id,
        agentDeposit.id,
        agentWithdrawal.id,
        agentMulti.id,
        agentEmpty.id,
      ],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Admin verifies leaderboard includes all agents
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(leaderboardResponse.success).toBe(true);

    const typedLeaderboard = leaderboardResponse as CompetitionAgentsResponse;
    expect(typedLeaderboard.agents.length).toBe(5);

    // Each agent should have a rank
    typedLeaderboard.agents.forEach((agent) => {
      expect(agent.rank).toBeGreaterThan(0);
      expect(agent.portfolioValue).toBeDefined();
    });

    // Admin verifies some alerts were created
    const alertsResponse = await adminClient.getSpotLiveSelfFundingAlerts(
      competition.id,
    );
    expect(alertsResponse.success).toBe(true);

    const typedAlertsResponse = alertsResponse as SpotLiveAlertsResponse;
    // Should have alerts for agents with deposit/withdrawal
    expect(typedAlertsResponse.alerts.length).toBeGreaterThan(0);
  });

  test("should filter swaps by token whitelist", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with wallet that will swap to non-whitelisted token
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Token Whitelist Agent",
        agentWalletAddress: "0x6666666666666666666666666666666666666666",
      });

    // Start competition with token whitelist (ETH and USDC only - NO AERO)
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Token Whitelist Test ${Date.now()}`,
      agentIds: [agent.id],
      spotLiveConfig: {
        dataSource: "rpc_direct" as const,
        dataSourceConfig: {
          type: "rpc_direct" as const,
          provider: "alchemy" as const,
          chains: ["base"],
        },
        chains: ["base"],
        allowedTokens: [
          {
            address: "0x4200000000000000000000000000000000000006",
            specificChain: "base",
          }, // ETH
          {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            specificChain: "base",
          }, // USDC
          // Note: AERO (0x9401...) is NOT whitelisted
        ],
        selfFundingThresholdUsd: 10,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync - will process swap USDC → AERO
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Agent checks trades - AERO swap should be rejected
    const tradesResponse = await agentClient.getTradeHistory(competition.id);
    expect(tradesResponse.success).toBe(true);

    const typedTradesResponse = tradesResponse as TradeHistoryResponse;
    const trades = typedTradesResponse.trades;

    // Should have NO trades (AERO not whitelisted, swap rejected)
    expect(trades.length).toBe(0);

    // Agent checks balances - should still have initial USDC (swap rejected)
    const balancesResponse = await agentClient.getBalance(competition.id);
    expect(balancesResponse.success).toBe(true);

    const typedBalances = balancesResponse as BalancesResponse;
    const usdcBalance = typedBalances.balances.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    const aeroBalance = typedBalances.balances.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    );

    // USDC should remain at starting balance (swap rejected)
    expect(usdcBalance?.amount).toBeCloseTo(5000, 1);
    // AERO should NOT appear in balances (non-whitelisted)
    expect(aeroBalance).toBeUndefined();
  });

  test("should enforce minimum funding threshold at competition start", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with different starting portfolio values
    const { agent: agentSufficientlyFunded } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Sufficiently Funded Agent",
        agentWalletAddress: "0xaaaa000000000000000000000000000000000001", // 2000 USDC
      });

    const { agent: agentUnderfunded } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Underfunded Agent",
      agentWalletAddress: "0x7777777777777777777777777777777777777777", // 50 USDC
    });

    // Start competition with minFundingThreshold = 100
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Min Funding Test ${Date.now()}`,
      agentIds: [agentSufficientlyFunded.id, agentUnderfunded.id],
      spotLiveConfig: {
        dataSource: "rpc_direct" as const,
        dataSourceConfig: {
          type: "rpc_direct" as const,
          provider: "alchemy" as const,
          chains: ["base"],
        },
        chains: ["base"],
        minFundingThreshold: 100, // Agents below $100 removed
        selfFundingThresholdUsd: 10,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    // Wait for competition start to complete (including threshold enforcement)
    await wait(2000);

    // Check competition agents - underfunded agent should be removed
    const agentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);

    const typedAgents = agentsResponse as CompetitionAgentsResponse;

    // Sufficiently funded agent should remain in competition
    const sufficientlyFundedEntry = typedAgents.agents.find(
      (a) => a.id === agentSufficientlyFunded.id,
    );
    expect(sufficientlyFundedEntry).toBeDefined();
    expect(sufficientlyFundedEntry?.active).toBe(true);

    // Underfunded agent should be completely removed from competition
    const underfundedEntry = typedAgents.agents.find(
      (a) => a.id === agentUnderfunded.id,
    );
    expect(underfundedEntry).toBeUndefined();

    // Verify only 1 agent remains (sufficiently funded)
    expect(typedAgents.agents.length).toBe(1);
  });

  test("should filter balances and portfolio by token whitelist", async () => {
    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with multiple tokens
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi-Token Portfolio Agent",
        agentWalletAddress: "0x8888888888888888888888888888888888888888",
      });

    // Start competition with USDC and ETH whitelist (need 2+ tokens for trading)
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Portfolio Filter Test ${Date.now()}`,
      agentIds: [agent.id],
      spotLiveConfig: {
        dataSource: "rpc_direct" as const,
        dataSourceConfig: {
          type: "rpc_direct" as const,
          provider: "alchemy" as const,
          chains: ["base"],
        },
        chains: ["base"],
        allowedTokens: [
          {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            specificChain: "base",
          }, // USDC
          {
            address: "0x4200000000000000000000000000000000000006",
            specificChain: "base",
          }, // ETH
          // Note: AERO (0x9401...) is NOT whitelisted
        ],
        selfFundingThresholdUsd: 10,
        syncIntervalMinutes: 2,
      },
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Agent checks balances - should only see USDC and ETH (whitelisted), not AERO
    const balancesResponse = await agentClient.getBalance(competition.id);
    expect(balancesResponse.success).toBe(true);

    const typedBalances = balancesResponse as BalancesResponse;

    // Should have USDC balance (whitelisted)
    const usdcBalance = typedBalances.balances.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    expect(usdcBalance).toBeDefined();

    // Should have ETH balance (whitelisted)
    const ethBalance = typedBalances.balances.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x4200000000000000000000000000000000000006",
    );
    expect(ethBalance).toBeDefined();

    // Should NOT have AERO balance (not whitelisted)
    const aeroBalance = typedBalances.balances.find(
      (b) =>
        b.tokenAddress.toLowerCase() ===
        "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    );
    expect(aeroBalance).toBeUndefined();

    // Portfolio value should only reflect whitelisted tokens (USDC + ETH)
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(leaderboardResponse.success).toBe(true);

    const typedLeaderboard = leaderboardResponse as CompetitionAgentsResponse;
    const agentEntry = typedLeaderboard.agents.find((a) => a.id === agent.id);

    expect(agentEntry).toBeDefined();
    // Portfolio should only reflect whitelisted tokens (USDC + ETH), AERO excluded from calculation
    expect(agentEntry?.portfolioValue).toBeGreaterThan(1000); // At least USDC value
  });

  test("should rank agents by ROI percentage, NOT portfolio value", async () => {
    // This test DEFINITIVELY proves ROI-based ranking works correctly.
    // Portfolio values are INVERSE of ROI to catch any bugs ranking by portfolio value:
    //
    // Agent 1: $100 → $150 = 50% ROI, portfolio $150 (LOWEST) → should be rank 1
    // Agent 2: $1000 → $1200 = 20% ROI, portfolio $1200 (HIGHEST) → should be rank 2
    // Agent 3: $500 → $550 = 10% ROI, portfolio $550 (MEDIUM) → should be rank 3
    //
    // If incorrectly ranking by portfolio value:
    //   Agent 2 ($1200) > Agent 3 ($550) > Agent 1 ($150) - WRONG!
    //
    // If correctly ranking by ROI:
    //   Agent 1 (50%) > Agent 2 (20%) > Agent 3 (10%) - CORRECT!

    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with specific ROI test wallets
    // These addresses are configured in MockAlchemyRpcProvider to return specific balances
    // that result in inverse correlation between portfolio value and ROI
    const { agent: agentHighROI } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "High ROI Low Portfolio Agent",
      agentWalletAddress: "0x0001000000000000000000000000000000000001", // $100 → $150 = 50% ROI
    });

    const { agent: agentMediumROI } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Medium ROI High Portfolio Agent",
      agentWalletAddress: "0x0002000000000000000000000000000000000002", // $1000 → $1200 = 20% ROI
    });

    const { agent: agentLowROI } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Low ROI Medium Portfolio Agent",
      agentWalletAddress: "0x0003000000000000000000000000000000000003", // $500 → $550 = 10% ROI
    });

    // Start spot live competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `ROI Ranking Definitive Test ${Date.now()}`,
      agentIds: [agentHighROI.id, agentMediumROI.id, agentLowROI.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(2000);

    // Trigger sync to process trades and update portfolio snapshots
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // =====================================================================
    // TEST 1: ACTIVE Competition - Verify ROI-based ranking
    // =====================================================================

    const activeLeaderboard = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(activeLeaderboard.success).toBe(true);

    const activeAgents = (activeLeaderboard as CompetitionAgentsResponse)
      .agents;
    expect(activeAgents.length).toBe(3);

    // Find each agent
    const activeHighROI = activeAgents.find((a) => a.id === agentHighROI.id);
    const activeMediumROI = activeAgents.find(
      (a) => a.id === agentMediumROI.id,
    );
    const activeLowROI = activeAgents.find((a) => a.id === agentLowROI.id);

    expect(activeHighROI).toBeDefined();
    expect(activeMediumROI).toBeDefined();
    expect(activeLowROI).toBeDefined();

    // Verify portfolio values are as expected (to prove this test is testing the right scenario)
    // High ROI agent has LOWEST portfolio value
    expect(activeHighROI?.portfolioValue).toBeCloseTo(150, 0);
    // Medium ROI agent has HIGHEST portfolio value
    expect(activeMediumROI?.portfolioValue).toBeCloseTo(1200, 0);
    // Low ROI agent has MEDIUM portfolio value
    expect(activeLowROI?.portfolioValue).toBeCloseTo(550, 0);

    // Verify ROI-based ranking (NOT portfolio-based)
    // If ranking were by portfolio value, Medium ROI ($1200) would be rank 1 - WRONG!
    // If ranking is correctly by ROI, High ROI (50%) should be rank 1 - CORRECT!
    expect(activeHighROI?.rank).toBe(1); // 50% ROI - HIGHEST ROI = rank 1
    expect(activeMediumROI?.rank).toBe(2); // 20% ROI - MEDIUM ROI = rank 2
    expect(activeLowROI?.rank).toBe(3); // 10% ROI - LOWEST ROI = rank 3

    // Double-check that portfolio value is genuinely inverse of rank
    // (This proves the test is meaningful - if they were correlated, the test would be ambiguous)
    expect(activeHighROI?.portfolioValue).toBeLessThan(
      activeLowROI!.portfolioValue,
    );
    expect(activeLowROI?.portfolioValue).toBeLessThan(
      activeMediumROI!.portfolioValue,
    );

    // =====================================================================
    // TEST 2: ENDED Competition - Verify ranking persists correctly
    // =====================================================================

    // End competition
    await adminClient.endCompetition(competition.id);
    await wait(2000);

    // Get final leaderboard
    const endedLeaderboard = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(endedLeaderboard.success).toBe(true);

    const endedAgents = (endedLeaderboard as CompetitionAgentsResponse).agents;

    const endedHighROI = endedAgents.find((a) => a.id === agentHighROI.id);
    const endedMediumROI = endedAgents.find((a) => a.id === agentMediumROI.id);
    const endedLowROI = endedAgents.find((a) => a.id === agentLowROI.id);

    expect(endedHighROI).toBeDefined();
    expect(endedMediumROI).toBeDefined();
    expect(endedLowROI).toBeDefined();

    // Rankings should be preserved after competition ends
    expect(endedHighROI!.rank).toBe(1); // Still rank 1
    expect(endedMediumROI!.rank).toBe(2); // Still rank 2
    expect(endedLowROI!.rank).toBe(3); // Still rank 3

    // Portfolio values should also be preserved
    expect(endedHighROI!.portfolioValue).toBeCloseTo(150, 0);
    expect(endedMediumROI!.portfolioValue).toBeCloseTo(1200, 0);
    expect(endedLowROI!.portfolioValue).toBeCloseTo(550, 0);
  });

  test("should return totalTrades and simpleReturn in getAgentCompetitions for spot live", async () => {
    // This test verifies that the agent.service.ts attachBulkCompetitionMetrics
    // correctly returns trade counts and ROI for spot_live_trading competitions
    // (previously spot_live was excluded from trade count query and returned simpleReturn: null)

    const adminClient = createTestClient(getBaseUrl());
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent with wallet that has trades
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Competitions Metrics Agent",
        agentWalletAddress: "0x1111111111111111111111111111111111111111", // Has mock trades
      });

    // Start spot live competition
    const response = await startSpotLiveTestCompetition({
      adminClient,
      name: `Agent Competitions Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(response.success).toBe(true);
    const competition = response.competition;

    await wait(1000);

    // Trigger sync to process trades
    const services = new ServiceRegistry();
    await services.spotDataProcessor.processSpotLiveCompetition(competition.id);
    await wait(500);

    // Call getAgentCompetitions - this uses attachBulkCompetitionMetrics
    const competitionsResponse = await agentClient.getAgentCompetitions(
      agent.id,
    );
    expect(competitionsResponse.success).toBe(true);

    const typedResponse = competitionsResponse as AgentCompetitionsResponse;
    const spotLiveComp = typedResponse.competitions.find(
      (c: EnhancedCompetition) => c.id === competition.id,
    );

    expect(spotLiveComp).toBeDefined();
    expect(spotLiveComp?.type).toBe("spot_live_trading");

    // Verify totalTrades is populated (not 0)
    // This confirms spot_live competition IDs are included in the trade count query
    expect(spotLiveComp?.totalTrades).toBeGreaterThan(0);

    // Verify simpleReturn is populated (not null)
    // This confirms spot_live_trading branch returns pnlPercent as simpleReturn
    expect(spotLiveComp?.simpleReturn).toBeDefined();
    expect(spotLiveComp?.simpleReturn).not.toBeNull();
    expect(typeof spotLiveComp?.simpleReturn).toBe("number");
  });
});
