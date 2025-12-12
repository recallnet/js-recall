import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";
import { ApiClient } from "@recallnet/test-utils";
import {
  AgentProfileResponse,
  BalancesResponse,
  SpecificChain,
  TradeResponse,
} from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  noTradingConstraints,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import { config } from "@/config/private";

describe("Multi-Agent Competition", () => {
  let adminApiKey: string;

  // Number of agents to create for multi-agent tests
  const NUM_AGENTS = 6;
  // Base USDC token address
  const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
    const referenceBalanceResponse = (await agentClients[0]?.client.getBalance(
      competitionId,
    )) as BalancesResponse;
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
      const agentBalanceResponse = (await agentClient?.getBalance(
        competitionId,
      )) as BalancesResponse;

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
        `${getBaseUrl()}/agent/profile?agentId=${agentClients[1]?.agent.id}`,
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
      const competitionResponse =
        await agentClient?.getCompetition(competitionId);
      expect(competitionResponse).toBeDefined();
      if (!competitionResponse?.success) {
        throw new Error("Failed to get competition");
      }
      const competition = competitionResponse.competition;
      expect(competition.id).toBe(competitionId);

      // Check leaderboard
      const leaderboardResponse = await agentClient?.getCompetitionAgents(
        competitionId,
        { sort: "rank" },
      );
      expect(leaderboardResponse?.success).toBe(true);
      if (!leaderboardResponse?.success)
        throw new Error("Failed to get agents");

      expect(leaderboardResponse.agents).toBeDefined();
      expect(leaderboardResponse.agents).toBeInstanceOf(Array);
      expect(leaderboardResponse.agents.length).toBe(NUM_AGENTS);

      // Verify this agent is in the leaderboard
      const agentInLeaderboard = leaderboardResponse.agents.find(
        (entry) => entry.id === agentClients[i]?.agent.id,
      );
      expect(agentInLeaderboard).toBeDefined();
    }
  });

  test("each agent should have a unique portfolio composition", async () => {
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
    const competitionName = `Multi-Agent Token Trading ${Date.now()}`;
    const agentIds = agentClients.map((tc) => tc.agent.id);

    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds,
      tradingConstraints: noTradingConstraints,
      paperTradingInitialBalances: [
        { specificChain: "base", tokenSymbol: "usdc", amount: 500 },
      ],
    });

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Step 4: Each agent trades a different amount
    const tradeAmountPerAgent = Array.from(
      { length: NUM_AGENTS },
      (_, i) => i * 10 + 1,
    );

    // Store token quantities for validation
    const tokenQuantities: { [tokenAddress: string]: number } = {};

    // Execute trades and record results
    for (let i = 0; i < NUM_AGENTS; i++) {
      const agent = agentClients[i];
      // Trade to burn address
      const tokenToTrade = "0x000000000000000000000000000000000000dead";

      expect(tokenToTrade).toBeDefined();

      // Execute trade using the client - each agent buys a different BASE token with 100 USDC
      const tradeResponse = (await agent?.client.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: tokenToTrade!,
        amount: tradeAmountPerAgent[i]!.toString(),
        competitionId,
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

    // Step 5: Verify that token quantities differ due to different token prices
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
});
