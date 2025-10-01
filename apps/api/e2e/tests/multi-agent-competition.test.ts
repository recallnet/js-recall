import axios from "axios";
import { assert, beforeEach, describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";

import config from "@/config/index.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  AgentProfileResponse,
  BalancesResponse,
  CompetitionStatusResponse,
  LeaderboardResponse,
  SnapshotResponse,
  SpecificChain,
  TradeResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  createTestClient,
  getAdminApiKey,
  noTradingConstraints,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";

describe("Multi-Agent Competition", () => {
  const services = new ServiceRegistry();

  let adminApiKey: string;

  // Number of agents to create for multi-agent tests
  const NUM_AGENTS = 6;

  // Base tokens for each agent to trade
  const BASE_TOKENS = [
    "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", // VVV
    "0x3992B27dA26848C2b19CeA6Fd25ad5568B68AB98", // DEGEN
    "0x63706e401c06ac8513145b7687A14804d17f814b", // MOBY
    "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c", // SUSHI
    "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", // OBO
    "0x98d0baa52b2D063E780DE12F615f963Fe8537553", // BEAN
  ];

  // Base USDC token address
  const BASE_USDC_ADDRESS = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA";

  // Store agent details for use in tests
  let agentClients: {
    client: ApiClient;
    agent: {
      id: string;
      ownerId: string;
      name: string;
    };
    apiKey: string;
  }[] = [];
  let adminClient: ApiClient;
  let competitionId: string;

  const reason = "multi-agent-competition end-to-end test";

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should create a competition with multiple agents and validate isolation", async () => {
    // Step 1: Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Step 2: Register 6 agents with unique names
    agentClients = [];

    for (let i = 0; i < NUM_AGENTS; i++) {
      const agentName = `Agent ${i + 1} ${Date.now()}`;

      const agentData = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName,
      });

      agentClients.push(agentData);
    }

    expect(agentClients.length).toBe(NUM_AGENTS);

    // Step 3: Start a competition with all agents
    const competitionName = `Multi-Agent Competition ${Date.now()}`;
    const agentIds = agentClients.map((tc) => tc.agent.id);

    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds,
    });

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Step 4: Validate that all agents have the same starting balances

    // Get first agent's balance as reference
    const referenceBalanceResponse =
      (await agentClients[0]?.client.getBalance()) as BalancesResponse;
    expect(referenceBalanceResponse.success).toBe(true);
    expect(referenceBalanceResponse.balances).toBeDefined();

    // Check key token balances for reference
    const referenceBalance = referenceBalanceResponse.balances;

    // Get common tokens from config
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Track reference balances for key tokens
    const referenceUsdcBalance = parseFloat(
      referenceBalance
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    const referenceSolBalance = parseFloat(
      referenceBalance
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );

    // Validate other agents have identical balances
    for (let i = 1; i < NUM_AGENTS; i++) {
      const agentClient = agentClients[i]?.client;
      const agentBalanceResponse =
        (await agentClient?.getBalance()) as BalancesResponse;

      expect(agentBalanceResponse?.success).toBe(true);
      expect(agentBalanceResponse?.balances).toBeDefined();

      const agentBalance = agentBalanceResponse.balances;
      // Validate USDC balance
      const agentUsdcBalance = parseFloat(
        agentBalance
          .find((b) => b.tokenAddress === usdcTokenAddress)
          ?.amount.toString() || "0",
      );
      expect(agentUsdcBalance).toBe(referenceUsdcBalance);

      // Validate SOL balance
      const agentSolBalance = parseFloat(
        agentBalance
          .find((b) => b.tokenAddress === solTokenAddress)
          ?.amount.toString() || "0",
      );
      expect(agentSolBalance).toBe(referenceSolBalance);
    }

    // Step 5: Validate that API keys are properly isolated

    // Try to access Agent 2's data using Agent 1's API key
    // Create a new client with Agent 1's API key
    const agent1ApiKey = agentClients[0]?.apiKey;

    try {
      // Try to get Agent 2's profile directly (would need to know endpoint structure)
      const response = await axios.get(
        `${getBaseUrl()}/api/agent/profile?agentId=${agentClients[1]?.agent.id}`,
        {
          headers: {
            Authorization: `Bearer ${agent1ApiKey}`,
          },
        },
      );

      // If we get here, the request did not properly validate agent ownership
      // This should never happen - either the request should fail or should return Agent 1's data, not Agent 2's
      expect(response.data.agent.id).not.toBe(agentClients[1]?.agent.id);
    } catch (error) {
      // Error is expected - validating it's the right type of error
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        // Should get either a 401 Unauthorized or 403 Forbidden
        const statusCode = error.response.status;
        expect([401, 403]).toContain(statusCode);
      }
    }

    // Verify Agent 1's client can access its own data
    const agent1ProfileResponse =
      (await agentClients[0]?.client.getAgentProfile()) as AgentProfileResponse;
    expect(agent1ProfileResponse.success).toBe(true);
    expect(agent1ProfileResponse.agent.id).toBe(agentClients[0]?.agent.id);

    // Verify Agent 2's client can access its own data
    const agent2ProfileResponse =
      (await agentClients[1]?.client.getAgentProfile()) as AgentProfileResponse;
    expect(agent2ProfileResponse.success).toBe(true);
    expect(agent2ProfileResponse.agent.id).toBe(agentClients[1]?.agent.id);

    // Step 6: Validate that all agents can see the competition and leaderboard
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agentClient = agentClients[i]?.client;

      // Check competition status
      const statusResponse =
        (await agentClient?.getCompetitionStatus()) as CompetitionStatusResponse;
      expect(statusResponse?.success).toBe(true);
      expect(statusResponse?.competition).toBeDefined();
      expect(statusResponse?.competition?.id).toBe(competitionId);

      // Check leaderboard
      const leaderboardResponse =
        (await agentClient?.getCompetitionLeaderboard()) as LeaderboardResponse;
      expect(leaderboardResponse?.success).toBe(true);
      expect(leaderboardResponse?.leaderboard).toBeDefined();
      expect(leaderboardResponse?.leaderboard).toBeInstanceOf(Array);
      expect(leaderboardResponse?.leaderboard?.length).toBe(NUM_AGENTS);

      // Verify this agent is in the leaderboard
      const agentInLeaderboard = leaderboardResponse.leaderboard.find(
        (entry) => entry.agentId === agentClients[i]?.agent.id,
      );
      expect(agentInLeaderboard).toBeDefined();
    }
  });

  test("each agent should purchase a different token resulting in unique portfolio compositions", async () => {
    // Step 1: Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Step 2: Register 6 agents with unique names
    agentClients = [];
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agentName = `Agent ${i + 1} ${Date.now()}`;

      const agentData = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName,
      });

      agentClients.push(agentData);
    }

    expect(agentClients.length).toBe(NUM_AGENTS);
    expect(agentClients.length).toBe(BASE_TOKENS.length);

    // Step 3: Start a competition with all agents
    const competitionName = `Multi-Agent Token Trading ${Date.now()}`;
    const agentIds = agentClients.map((tc) => tc.agent.id);

    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds,
      tradingConstraints: noTradingConstraints,
    });

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Step 4: Each agent trades for a different token
    const tradeAmount = 100;

    // Store token quantities for validation
    const tokenQuantities: { [tokenAddress: string]: number } = {};

    // Execute trades and record results
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agent = agentClients[i];
      const tokenToTrade = BASE_TOKENS[i];

      expect(tokenToTrade).toBeDefined();

      // Execute trade using the client - each agent buys a different BASE token with 100 USDC
      const tradeResponse = (await agent?.client.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: tokenToTrade!,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason,
      })) as TradeResponse;

      // Verify trade was successful
      expect(tradeResponse.success).toBe(true);
      expect(tradeResponse.transaction).toBeDefined();

      // Record the token amount received (will be different for each token due to price differences)
      if (tradeResponse.transaction.toAmount) {
        const tokenAmount = tradeResponse.transaction.toAmount;
        tokenQuantities[tokenToTrade!] = tokenAmount;
      }
      // Wait briefly between trades
      await wait(100);
    }

    // Wait for all trades to settle
    await wait(500);

    // Step 5: Verify each agent has a unique token composition
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agent = agentClients[i];
      const expectedToken = BASE_TOKENS[i];

      // Get agent's current balance
      const balanceResponse =
        (await agent?.client.getBalance()) as BalancesResponse;
      expect(balanceResponse?.success).toBe(true);
      expect(balanceResponse?.balances).toBeDefined();
      // Check that the agent has the expected token
      const tokenBalance = parseFloat(
        balanceResponse.balances
          .find((b) => b.tokenAddress === expectedToken)
          ?.amount.toString() || "0",
      );

      // Verify they have a non-zero balance of their unique token
      expect(tokenBalance).toBeGreaterThan(0);

      // Verify they DON'T have any of the other agents' tokens
      for (let j = 0; j < NUM_AGENTS; j++) {
        if (j !== i) {
          // Skip their own token
          const otherToken = BASE_TOKENS[j];
          const otherTokenBalance = parseFloat(
            balanceResponse.balances
              .find((b) => b.tokenAddress === otherToken)
              ?.amount.toString() || "0",
          );

          // They should have 0 of other agents' tokens
          expect(otherTokenBalance).toBe(0);
          if (otherTokenBalance > 0) {
            // Agent unexpectedly has tokens from another agent's portfolio
          }
        }
      }
    }

    // Step 6: Verify that token quantities differ due to different token prices
    const uniqueQuantities = Object.values(tokenQuantities);

    // Verify that no two agents received the same token quantity (within a reasonable precision)
    for (let i = 0; i < uniqueQuantities.length; i++) {
      for (let j = i + 1; j < uniqueQuantities.length; j++) {
        const qty1 = uniqueQuantities[i];
        const qty2 = uniqueQuantities[j];

        expect(qty1).toBeDefined();
        expect(qty2).toBeDefined();

        // Allow a tiny bit of precision error (0.0001), but quantities should differ by more than this
        const areDifferent = Math.abs(qty1! - qty2!) > 0.0001;
        expect(areDifferent).toBe(true);
      }
    }
  });

  // Test that portfolio values change over time due to price fluctuations
  test("portfolio values should change differently for agents holding different tokens", async () => {
    // Step 1: Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Step 2: Register agents with unique names
    agentClients = [];

    // Store token quantities and initial portfolio values
    const initialPortfolioValues: { [agentId: string]: number | undefined } =
      {};
    const tokensByAgent: { [agentId: string]: string } = {};

    for (let i = 0; i < NUM_AGENTS; i++) {
      const agentName = `Price Agent ${i + 1} ${Date.now()}`;

      const agentData = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName,
      });

      agentClients.push(agentData);
    }

    expect(agentClients.length).toBe(NUM_AGENTS);
    expect(agentClients.length).toBe(BASE_TOKENS.length);

    // Step 3: Start a competition with all agents
    const competitionName = `Portfolio Value Test ${Date.now()}`;
    const agentIds = agentClients.map((tc) => tc.agent.id);

    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds,
      tradingConstraints: noTradingConstraints,
    });

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(1000);

    // Step 4: Each agent trades for a different token
    const tradeAmount = 500; // Using a larger amount to make price fluctuations more noticeable

    // Execute trades for each agent
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agent = agentClients[i]!;
      const tokenToTrade = BASE_TOKENS[i]!;
      tokensByAgent[agent.agent.id] = tokenToTrade;

      // Execute trade - each agent buys a different BASE token with USDC
      const tradeResponse = (await agent?.client.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: tokenToTrade,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason,
      })) as TradeResponse;

      // Verify trade was successful
      expect(tradeResponse.success).toBe(true);
      expect(tradeResponse.transaction).toBeDefined();
      // Wait briefly between trades
      await wait(100);
    }

    // Wait for all trades to settle
    await wait(1000);

    // Step 5: Get initial portfolio values after trades
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agent = agentClients[i];

      assert(agent, "Agent is undefined");

      // Force a snapshot to ensure we have current values
      await services.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );
      await wait(500);

      // Get agent's initial portfolio value
      const snapshotsResponse = (await adminClient.request(
        "get",
        `/api/admin/competition/${competitionId}/snapshots?agentId=${agent.agent.id}`,
      )) as SnapshotResponse;
      expect(snapshotsResponse.success).toBe(true);
      expect(snapshotsResponse.snapshots).toBeDefined();
      expect(snapshotsResponse.snapshots.length).toBeGreaterThan(0);

      // Get the earliest snapshot
      const earliestSnapshot = snapshotsResponse.snapshots[0];
      const initialValue = earliestSnapshot?.totalValue;
      initialPortfolioValues[agent.agent.id] = initialValue;
      const token = tokensByAgent[agent.agent.id];
      assert(token, "Token is undefined");
    }

    // Step 7: Get final portfolio values
    const finalPortfolioValues: { [agentId: string]: number | undefined } = {};
    const portfolioChanges: {
      [agentId: string]: {
        initial: number;
        final: number;
        change: number;
        percentChange: number;
      };
    } = {};
    let allAgentsHaveSameChange = true;
    let previousPercentChange: number | null = null;

    for (let i = 0; i < NUM_AGENTS; i++) {
      const agent = agentClients[i];

      assert(agent, "Agent is undefined");

      // Force one final snapshot to ensure we have the latest prices
      await services.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );
      await wait(500);

      // Get agent's final portfolio value
      const snapshotsResponse = (await adminClient.request(
        "get",
        `/api/admin/competition/${competitionId}/snapshots?agentId=${agent.agent.id}`,
      )) as SnapshotResponse;
      expect(snapshotsResponse.success).toBe(true);
      expect(snapshotsResponse.snapshots).toBeDefined();
      expect(snapshotsResponse.snapshots.length).toBeGreaterThan(0);

      // Get the most recent snapshot
      const latestSnapshot =
        snapshotsResponse.snapshots[snapshotsResponse.snapshots.length - 1];
      const finalValue = latestSnapshot?.totalValue;
      finalPortfolioValues[agent.agent.id] = finalValue;

      assert(finalValue, "Final value is undefined");

      // Calculate change
      const initialValue = initialPortfolioValues[agent.agent.id];
      assert(initialValue, "Initial value is undefined");

      const absoluteChange = finalValue - initialValue;
      const percentChange = (absoluteChange / initialValue) * 100;

      portfolioChanges[agent.agent.id] = {
        initial: initialValue,
        final: finalValue,
        change: absoluteChange,
        percentChange: percentChange,
      };

      // Check if this percent change is different from previous agents
      if (previousPercentChange !== null) {
        // Allow a tiny bit of precision error (0.00001), but changes should differ by more than this
        if (Math.abs(percentChange - previousPercentChange) > 0.00001) {
          allAgentsHaveSameChange = false;
        }
      }
      previousPercentChange = percentChange;
    }

    // Step 8: Verify that no agents have the exact same portfolio change
    expect(allAgentsHaveSameChange).toBe(false);
  }, 60000);
});
