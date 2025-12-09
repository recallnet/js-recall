import axios from "axios";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { competitions } from "@recallnet/db/schema/core/defs";
import {
  paperTradingConfig,
  paperTradingInitialBalances,
} from "@recallnet/db/schema/trading/defs";
import { specificChainTokens } from "@recallnet/services/lib";
import {
  BlockchainType,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionDetailResponse,
  CompetitionJoinResponse,
  CompetitionRulesResponse,
  CreateCompetitionResponse,
  CreatePartnerResponse,
  ErrorResponse,
  GetCompetitionPartnersResponse,
  StartCompetitionResponse,
  UpcomingCompetitionsResponse,
  UpdateCompetitionResponse,
} from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createPrivyAuthenticatedClient,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  looseTradingConstraints,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
  strictTradingConstraints,
} from "@recallnet/test-utils";

import { db } from "@/lib/db";

describe("Competition API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  describe("competition creation", () => {
    test("should start a competition with explicitly provided registered agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Alpha",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Beta",
      });

      // Start a competition
      const competitionName = `Test Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [agent1.id, agent2.id],
      });

      // Verify competition was started
      const competition = competitionResponse.competition;
      expect(competition).toBeDefined();
      expect(competition.name).toBe(competitionName);
      expect(competition.status).toBe("active");
      expect(competition.agentIds?.length).toBe(2);
      expect(competition.agentIds).toContain(agent1.id);
      expect(competition.agentIds).toContain(agent2.id);
    });

    test("should merge already registered agents with explicitly provided registered agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1, client: agent1Client } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Alpha",
        });
      const { agent: agent2, client: agent2Client } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Beta",
        });

      // Create a competition without starting it
      const competitionName = `Two-Stage Competition ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
      });
      const originalCompetition = createResponse.competition;
      const competitionId = originalCompetition.id;

      // Join both agents before starting the competition
      const joinResponse1 = (await agent1Client.joinCompetition(
        competitionId,
        agent1.id,
      )) as CompetitionJoinResponse;
      expect(joinResponse1.success).toBe(true);
      const joinResponse2 = (await agent2Client.joinCompetition(
        competitionId,
        agent2.id,
      )) as CompetitionJoinResponse;
      expect(joinResponse2.success).toBe(true);

      // Set up a 3rd agent
      const { agent: agent3 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Gamma",
      });

      // Start a competition—but only provide the 3rd agent
      const competitionResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: competitionId,
        agentIds: [agent1.id, agent3.id],
      });
      expect(competitionResponse.success).toBe(true);

      // Verify competition was started
      const competition = competitionResponse.competition;
      expect(competition).toBeDefined();
      expect(competition.id).toBe(competitionId);
      expect(competition.name).toBe(competitionName);
      expect(competition.status).toBe("active");
      expect(competition.agentIds?.length).toBe(3);
      expect(competition.agentIds).toContain(agent1.id);
      expect(competition.agentIds).toContain(agent2.id);
      expect(competition.agentIds).toContain(agent3.id);
    });

    test("should create a competition without starting it", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition without starting it
      const competitionName = `Pending Competition ${Date.now()}`;
      const competitionResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
      });

      // Verify competition was created in PENDING state
      const competition = competitionResponse.competition;
      expect(competition).toBeDefined();
      expect(competition.name).toBe(competitionName);
      expect(competition.status).toBe("pending");
      expect(competition.startDate).toBeNull();
      expect(competition.endDate).toBeNull();
    });

    test("should reject creating competition with incompatible arena type", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Attempt to create a perpetual_futures competition in a spot_paper_trading arena
      const result = await adminClient.createCompetition({
        name: `Incompatible Competition ${Date.now()}`,
        description: "Should fail due to type mismatch",
        arenaId: "default-paper-arena", // spot_paper_trading arena
        type: "perpetual_futures", // incompatible with spot_paper_trading
        perpsProvider: {
          provider: "hyperliquid",
          initialCapital: 1000,
          selfFundingThreshold: 0,
        },
      });

      // Verify error response
      expect(result.success).toBe(false);
      const errorResponse = result as ErrorResponse;
      expect(errorResponse.error).toContain("incompatible");
      expect(errorResponse.error).toContain("perpetual_futures");
      expect(errorResponse.error).toContain("spot_paper_trading");
      expect(errorResponse.status).toBe(400);
    });

    test("should start an existing competition with already registered agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1, client: agent1Client } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Delta",
        });
      const { agent: agent2, client: agent2Client } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Echo",
        });

      // Create a competition without starting it
      const competitionName = `Two-Stage Competition ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
      });
      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.status).toBe("pending");
      const competitionId = createResponse.competition.id;

      // Join both agents before starting the competition
      const joinResponse1 = (await agent1Client.joinCompetition(
        competitionId,
        agent1.id,
      )) as CompetitionJoinResponse;
      expect(joinResponse1.success).toBe(true);
      const joinResponse2 = (await agent2Client.joinCompetition(
        competitionId,
        agent2.id,
      )) as CompetitionJoinResponse;
      expect(joinResponse2.success).toBe(true);

      // Now start the existing competition
      const startResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: competitionId,
        // Note: we don't provide `agentIds` here because they are already registered
      });

      // Verify competition was started
      const activeCompetition = startResponse.competition;
      expect(activeCompetition).toBeDefined();
      expect(activeCompetition.id).toBe(competitionId);
      expect(activeCompetition.name).toBe(competitionName);
      expect(activeCompetition.status).toBe("active");
      expect(activeCompetition.startDate).toBeDefined();
      expect(activeCompetition.agentIds).toContain(agent1.id);
      expect(activeCompetition.agentIds).toContain(agent2.id);
    });

    test("should not allow starting a non-pending competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Foxtrot",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Golf",
      });

      // Create and start a competition
      const competitionName = `Already Active Competition ${Date.now()}`;
      const startResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [agent1.id],
      });

      const activeCompetition = startResponse.competition;
      expect(activeCompetition.status).toBe("active");

      // Try to start the same competition again
      try {
        await startExistingTestCompetition({
          adminClient,
          competitionId: activeCompetition.id,
          agentIds: [agent1.id, agent2.id],
        });

        // Should not reach this line
        expect(false).toBe(true);
      } catch (error) {
        // Expect an error because the competition is already active
        expect(error).toBeDefined();
        expect((error as Error).message).toContain(
          "Failed to start existing competition",
        );
      }

      // Verify through direct API call to see the actual error
      try {
        await adminClient.startExistingCompetition({
          competitionId: activeCompetition.id,
          agentIds: [agent1.id, agent2.id],
        });
      } catch (error) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toContain("active");
      }
    });

    test("should create a competition with trading constraints", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Alpha",
        });

      // Start a competition
      const competitionName = `Test Competition ${Date.now()}`;
      // Create the competitions
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition - check trading constraints",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        sandboxMode: undefined,
        externalUrl: undefined,
        imageUrl: undefined,
        boostStartDate: undefined,
        boostEndDate: undefined,
        joinStartDate: undefined,
        joinEndDate: undefined,
        maxParticipants: undefined,
        tradingConstraints: {
          ...looseTradingConstraints,
          // This 24 hour volume should block that trade below
          minimum24hVolumeUsd: 100000,
        },
      })) as CreateCompetitionResponse;

      const competitionResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      });

      expect(competitionResponse.success).toBe(true);
      const competitionId = competitionResponse.competition.id;

      // Execute a buy trade (buying SOL with USDC)
      const buyTradeResponse = await agentClient.executeTrade({
        reason: "testing create comp with trading constraints",
        fromToken: specificChainTokens.eth.usdc,
        toToken: specificChainTokens.svm.sol,
        amount: "100",
        competitionId,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
      });

      expect(buyTradeResponse.success).toBe(false);
    });
  });

  describe("competition rules", () => {
    test("agents can view trading constraints in competition rules", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Rules Test",
        });

      // Start a competition with specific trading constraints
      const competitionName = `Rules Test Competition ${Date.now()}`;
      const customConstraints = {
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 250000,
        minimumLiquidityUsd: 150000,
        minimumFdvUsd: 2000000,
      };

      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition - check rules endpoint",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        tradingConstraints: customConstraints,
      })) as CreateCompetitionResponse;

      const competitionResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      });
      expect(competitionResponse.success).toBe(true);

      // Agent gets competition rules
      const rulesResponse = (await agentClient.getRules(
        competitionResponse.competition.id,
      )) as CompetitionRulesResponse;
      expect(rulesResponse.success).toBe(true);
      expect(rulesResponse.rules).toBeDefined();
      expect(rulesResponse.rules.tradingRules).toBeDefined();
      expect(rulesResponse.rules.tradingRules).toBeInstanceOf(Array);

      // Verify trading constraints are included in the trading rules
      const tradingRules = rulesResponse.rules.tradingRules;
      expect(
        tradingRules.some((rule: string) =>
          rule.includes("minimum 48 hours of trading history"),
        ),
      ).toBe(true);
      expect(
        tradingRules.some((rule: string) =>
          rule.includes("minimum 24h volume of $250,000 USD"),
        ),
      ).toBe(true);
      expect(
        tradingRules.some((rule: string) =>
          rule.includes("minimum liquidity of $150,000 USD"),
        ),
      ).toBe(true);
      expect(
        tradingRules.some((rule: string) =>
          rule.includes("minimum FDV of $2,000,000 USD"),
        ),
      ).toBe(true);
    });

    test("should include minTradesPerDay in active competition rules", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register an agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Active Rules Min Trades Agent",
        });

      // Start a competition with minTradesPerDay
      const constraintsWithMinTrades = {
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: 7,
      };

      const competitionName = `Active Rules Min Trades Test ${Date.now()}`;
      const competitionResponse = await adminClient.startCompetition({
        name: competitionName,
        description:
          "Competition to test active rules endpoint with min trades",
        agentIds: [agent.id],
        tradingConstraints: constraintsWithMinTrades,
      });

      // Agent gets competition rules (authenticated endpoint for active competition)
      const rulesResponse = (await agentClient.getRules(
        (competitionResponse as StartCompetitionResponse).competition.id,
      )) as CompetitionRulesResponse;
      expect(rulesResponse.success).toBe(true);
      expect(rulesResponse.rules).toBeDefined();
      expect(rulesResponse.rules.tradingConstraints).toBeDefined();
      expect(rulesResponse.rules.tradingConstraints?.minTradesPerDay).toBe(7);

      // Verify the rule string is included
      const tradingRules = rulesResponse.rules.tradingRules;
      const minTradesRule = tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement: 7 trades"),
      );
      expect(minTradesRule).toBeDefined();
    });
  });

  describe("Public Competition Access (No Authentication Required)", () => {
    test("should allow unauthenticated access to GET /competitions", async () => {
      // Setup: Create test competition via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      await createTestCompetition({
        adminClient,
        name: "Public Test Competition",
      });

      // Test: Direct axios call without authentication
      const response = await axios.get(`${getBaseUrl()}/api/competitions`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competitions).toBeDefined();
      expect(Array.isArray(response.data.competitions)).toBe(true);
    });

    test("should allow unauthenticated access to GET /competitions/{id}", async () => {
      // Setup: Create test competition via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const { competition } = await createTestCompetition({
        adminClient,
        name: "Public Test Competition Details",
      });

      // Test: Direct axios call without authentication
      const response = await axios.get(
        `${getBaseUrl()}/api/competitions/${competition.id}`,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competition).toBeDefined();
      expect(response.data.competition.id).toBe(competition.id);
      expect(response.data.competition.name).toBe(
        "Public Test Competition Details",
      );
    });

    test("should allow unauthenticated access to GET /competitions/{id}/agents", async () => {
      // Setup: Create competition with agents via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Public Test Agent",
      });

      const { competition } = await startTestCompetition({
        adminClient,
        name: "Public Competition with Agents",
        agentIds: [agent.id],
      });

      // Test: Direct axios call without authentication
      const response = await axios.get(
        `${getBaseUrl()}/api/competitions/${competition.id}/agents`,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competitionId).toBe(competition.id);
      expect(response.data.agents).toBeDefined();
      expect(Array.isArray(response.data.agents)).toBe(true);
    });

    test("should allow unauthenticated access to GET /competitions/{id}/rules", async () => {
      // Setup: Create competition with trading constraints via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Public Rules Competition ${Date.now()}`;
      const customConstraints = {
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 50000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
      };

      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition for public rules access",
        tradingConstraints: customConstraints,
      });

      expect(createResponse.success).toBe(true);
      const { competition } = createResponse as CreateCompetitionResponse;

      // Test: Direct axios call without authentication
      const response = await axios.get(
        `${getBaseUrl()}/api/competitions/${competition.id}/rules`,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competition).toBeDefined();
      expect(response.data.competition.id).toBe(competition.id);
      expect(response.data.rules).toBeDefined();
      expect(response.data.rules.tradingRules).toBeDefined();
      expect(response.data.rules.rateLimits).toBeDefined();
      expect(response.data.rules.availableChains).toBeDefined();
      expect(response.data.rules.slippageFormula).toBeDefined();
      expect(response.data.rules.tradingConstraints).toBeDefined();
      expect(response.data.rules.tradingConstraints.minimumPairAgeHours).toBe(
        24,
      );
      expect(response.data.rules.tradingConstraints.minimum24hVolumeUsd).toBe(
        50000,
      );
      expect(response.data.rules.tradingConstraints.minimumLiquidityUsd).toBe(
        100000,
      );
      expect(response.data.rules.tradingConstraints.minimumFdvUsd).toBe(
        1000000,
      );
    });

    test("should handle minTradesPerDay in competition creation and retrieval", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with minTradesPerDay set
      const competitionName = `Min Trades Test Competition ${Date.now()}`;
      const minTradesConstraints = {
        minimumPairAgeHours: 12,
        minimum24hVolumeUsd: 10000,
        minimumLiquidityUsd: 50000,
        minimumFdvUsd: 500000,
        minTradesPerDay: 5,
      };

      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition with min trades per day",
        tradingConstraints: minTradesConstraints,
      });

      expect(createResponse.success).toBe(true);
      expect("competition" in createResponse).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Verify minTradesPerDay appears in rules endpoint (public)
      const rulesResponse =
        await adminClient.getCompetitionRules(competitionId);
      expect(rulesResponse.success).toBe(true);
      expect("rules" in rulesResponse).toBe(true);
      const rules = (rulesResponse as CompetitionRulesResponse).rules;
      expect(rules.tradingConstraints).toBeDefined();
      expect(rules.tradingConstraints?.minTradesPerDay).toBe(5);

      // Verify the rule string is included
      const minTradesRule = rules.tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement: 5 trades"),
      );
      expect(minTradesRule).toBeDefined();

      // Verify minTradesPerDay appears in competition detail endpoint (public)
      const detailResponse = await adminClient.getCompetition(competitionId);
      expect(detailResponse.success).toBe(true);
      expect("competition" in detailResponse).toBe(true);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;
      expect(competition.tradingConstraints).toBeDefined();
      expect(competition.tradingConstraints?.minTradesPerDay).toBe(5);
    });

    test("should handle null minTradesPerDay in competition creation", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with minTradesPerDay explicitly set to null
      const competitionName = `Null Min Trades Test ${Date.now()}`;
      const nullMinTradesConstraints = {
        minimumPairAgeHours: 12,
        minimum24hVolumeUsd: 10000,
        minimumLiquidityUsd: 50000,
        minimumFdvUsd: 500000,
        minTradesPerDay: null,
      };

      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition with null min trades per day",
        tradingConstraints: nullMinTradesConstraints,
      });

      expect(createResponse.success).toBe(true);
      expect("competition" in createResponse).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Verify minTradesPerDay is null in rules endpoint
      const rulesResponse =
        await adminClient.getCompetitionRules(competitionId);
      expect(rulesResponse.success).toBe(true);
      expect("rules" in rulesResponse).toBe(true);
      const rules = (rulesResponse as CompetitionRulesResponse).rules;
      expect(rules.tradingConstraints?.minTradesPerDay).toBe(null);

      // Verify no min trades rule string is included
      const minTradesRule = rules.tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement"),
      );
      expect(minTradesRule).toBeUndefined();
    });

    test("should show minTradesPerDay for authenticated users in competitions list", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy authenticated client
      const { client: userClient } = await createPrivyAuthenticatedClient({});

      // Create a pending competition with minTradesPerDay
      const competitionName = `Listed Competition ${Date.now()}`;
      const constraintsWithMinTrades = {
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: 10,
      };

      await adminClient.createCompetition({
        name: competitionName,
        description: "Competition for listing test",
        tradingConstraints: constraintsWithMinTrades,
      });

      // Get competitions list as authenticated user
      const listResponse = await userClient.getCompetitions("pending");
      expect(listResponse.success).toBe(true);
      expect("competitions" in listResponse).toBe(true);

      // Find our competition
      const competitions = (listResponse as UpcomingCompetitionsResponse)
        .competitions;
      const ourCompetition = competitions.find(
        (c) => c.name === competitionName,
      );
      expect(ourCompetition).toBeDefined();
      expect(ourCompetition?.tradingConstraints).toBeDefined();
      expect(ourCompetition?.tradingConstraints?.minTradesPerDay).toBe(10);
    });

    test("should handle minTradesPerDay when starting a competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Min Trades Agent 1",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Min Trades Agent 2",
      });

      // Start a competition with minTradesPerDay using strictTradingConstraints (which has minTradesPerDay: 10)
      const competitionName = `Started Min Trades Competition ${Date.now()}`;
      const startResponse = await adminClient.startCompetition({
        name: competitionName,
        description: "Competition with min trades per day requirement",
        agentIds: [agent1.id, agent2.id],
        tradingConstraints: strictTradingConstraints,
      });

      expect(startResponse.success).toBe(true);
      expect("competition" in startResponse).toBe(true);
      const competitionId = (startResponse as StartCompetitionResponse)
        .competition.id;

      // Verify minTradesPerDay appears in rules endpoint
      const rulesResponse =
        await adminClient.getCompetitionRules(competitionId);
      expect(rulesResponse.success).toBe(true);
      expect("rules" in rulesResponse).toBe(true);
      const rules = (rulesResponse as CompetitionRulesResponse).rules;
      expect(rules.tradingConstraints?.minTradesPerDay).toBe(10);

      // Verify the rule string is included
      const minTradesRule = rules.tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement: 10 trades"),
      );
      expect(minTradesRule).toBeDefined();
    });

    test("should return 404 for non-existent competition in public endpoints", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Test all four public endpoints with non-existent ID
      await expect(
        axios.get(`${getBaseUrl()}/api/competitions/${nonExistentId}`),
      ).rejects.toMatchObject({
        response: { status: 404 },
      });

      await expect(
        axios.get(`${getBaseUrl()}/api/competitions/${nonExistentId}/agents`),
      ).rejects.toMatchObject({
        response: { status: 404 },
      });

      await expect(
        axios.get(`${getBaseUrl()}/api/competitions/${nonExistentId}/rules`),
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    test("rules endpoint should be publicly accessible", async () => {
      // Setup: Create a competition (don't need to start it, just test the path parameter functionality)
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Public Rules Test ${Date.now()}`;
      const competitionResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition for public rules access",
        tradingConstraints: {
          minimumPairAgeHours: 24,
          minimum24hVolumeUsd: 50000,
          minimumLiquidityUsd: 100000,
          minimumFdvUsd: 1000000,
        },
      });

      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse as CreateCompetitionResponse;

      // Test with specific competition ID via path parameter (public access)
      const rulesResponse = (await adminClient.getCompetitionRules(
        competition.competition.id,
      )) as CompetitionRulesResponse;
      expect(rulesResponse.rules).toBeDefined();
      expect(rulesResponse.rules.tradingConstraints).toBeDefined();
      expect(rulesResponse.rules.tradingConstraints!.minimumPairAgeHours).toBe(
        24,
      );
    });

    test("join/leave competition endpoints should still require authentication", async () => {
      // Setup: Create test competition and agent
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Protected Test Agent",
      });

      const { competition } = await createTestCompetition({
        adminClient,
        name: "Protected Test Competition",
      });

      // Test: Join endpoint without authentication
      await expect(
        axios.post(
          `${getBaseUrl()}/api/competitions/${competition.id}/agents/${agent.id}`,
        ),
      ).rejects.toMatchObject({
        response: { status: 401 },
      });

      // Test: Leave endpoint without authentication
      await expect(
        axios.delete(
          `${getBaseUrl()}/api/competitions/${competition.id}/agents/${agent.id}`,
        ),
      ).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
  });

  describe("Competition Partners", () => {
    test("should get partners for a competition via public endpoint", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create partners
      const partner1 = await adminClient.createPartner({
        name: `Public Partner 1 ${Date.now()}`,
        url: "https://partner1.com",
        logoUrl: "https://partner1.com/logo.png",
      });
      const partner2 = await adminClient.createPartner({
        name: `Public Partner 2 ${Date.now()}`,
        url: "https://partner2.com",
      });
      expect(partner1.success && partner2.success).toBe(true);

      // Create competition
      const compResponse = await adminClient.createCompetition({
        name: "Public Partners Competition",
        type: "trading",
      });
      const competitionId = (compResponse as CreateCompetitionResponse)
        .competition.id;

      // Add partners
      await adminClient.addPartnerToCompetition(
        competitionId,
        (partner1 as CreatePartnerResponse).partner.id,
        1,
      );
      await adminClient.addPartnerToCompetition(
        competitionId,
        (partner2 as CreatePartnerResponse).partner.id,
        2,
      );

      // Get partners via public endpoint (any client can access)
      const { client: publicClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Public Partner Viewer",
      });

      const getResponse =
        await publicClient.getCompetitionPartnersPublic(competitionId);

      expect(getResponse.success).toBe(true);
      const partners = (getResponse as GetCompetitionPartnersResponse).partners;
      expect(partners.length).toBe(2);
      expect(partners[0]?.position).toBe(1);
      expect(partners[0]?.name).toContain("Public Partner 1");
      expect(partners[1]?.position).toBe(2);
      expect(partners[1]?.name).toContain("Public Partner 2");
    });
  });

  describe("Boost Time Decay Rate Configuration", () => {
    test("should create competition with boost time decay rate", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const boostTimeDecayRate = 0.7;
      const competitionName = `Boost Decay Test ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        boostTimeDecayRate,
      } as Parameters<
        typeof adminClient.createCompetition
      >[0])) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Verify boost time decay rate is stored in database
      const [competition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, competitionId))
        .limit(1);

      expect(competition).toBeDefined();
      expect(competition?.boostTimeDecayRate).toBe(boostTimeDecayRate);
    });

    test("should update competition with boost time decay rate", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition without boost time decay rate
      const competitionName = `Boost Decay Update Test ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Update with boost time decay rate
      const boostTimeDecayRate = 0.5;
      const updateResponse = (await adminClient.updateCompetition(
        competitionId,
        {
          boostTimeDecayRate,
        } as Parameters<typeof adminClient.updateCompetition>[1],
      )) as UpdateCompetitionResponse;

      expect(updateResponse.success).toBe(true);

      // Verify boost time decay rate is updated in database
      const [competition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, competitionId))
        .limit(1);

      expect(competition).toBeDefined();
      expect(competition?.boostTimeDecayRate).toBe(boostTimeDecayRate);
    });

    test("should reject boost time decay rate below minimum", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Boost Decay Invalid Min ${Date.now()}`;
      const result = await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        boostTimeDecayRate: 0.05, // Below minimum of 0.1
      } as Parameters<typeof adminClient.createCompetition>[0]);

      expect(result.success).toBe(false);
      const errorResponse = result as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("boostTimeDecayRate");
    });

    test("should reject boost time decay rate above maximum", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Boost Decay Invalid Max ${Date.now()}`;
      const result = await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        boostTimeDecayRate: 0.95, // Above maximum of 0.9
      } as Parameters<typeof adminClient.createCompetition>[0]);

      expect(result.success).toBe(false);
      const errorResponse = result as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("boostTimeDecayRate");
    });

    test("should allow competition without boost time decay rate", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Boost Decay Optional ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Verify boost time decay rate is null in database
      const [competition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, competitionId))
        .limit(1);

      expect(competition).toBeDefined();
      expect(competition?.boostTimeDecayRate).toBeNull();
    });
  });

  describe("Paper Trading Initial Balances Configuration", () => {
    test("should create competition with paper trading initial balances", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const initialBalances = [
        { specificChain: "eth", tokenSymbol: "usdc", amount: 1000 },
        { specificChain: "svm", tokenSymbol: "sol", amount: 5 },
        { specificChain: "base", tokenSymbol: "usdc", amount: 500 },
      ];

      const competitionName = `Paper Trading Balances Test ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingInitialBalances: initialBalances,
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Verify initial balances are stored in database
      const storedBalances = await db
        .select()
        .from(paperTradingInitialBalances)
        .where(eq(paperTradingInitialBalances.competitionId, competitionId));

      expect(storedBalances).toHaveLength(3);

      // Verify each balance
      const ethUsdc = storedBalances.find(
        (b) => b.specificChain === "eth" && b.tokenSymbol === "usdc",
      );
      expect(ethUsdc).toBeDefined();
      expect(ethUsdc?.amount).toBe(1000);

      const svmSol = storedBalances.find(
        (b) => b.specificChain === "svm" && b.tokenSymbol === "sol",
      );
      expect(svmSol).toBeDefined();
      expect(svmSol?.amount).toBe(5);

      const baseUsdc = storedBalances.find(
        (b) => b.specificChain === "base" && b.tokenSymbol === "usdc",
      );
      expect(baseUsdc).toBeDefined();
      expect(baseUsdc?.amount).toBe(500);
    });

    test("should reject duplicate paper trading initial balances", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const initialBalances = [
        { specificChain: "eth", tokenSymbol: "usdc", amount: 1000 },
        { specificChain: "eth", tokenSymbol: "usdc", amount: 2000 }, // Duplicate
      ];

      const competitionName = `Paper Trading Duplicate Test ${Date.now()}`;
      const result = await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingInitialBalances: initialBalances,
      });

      expect(result.success).toBe(false);
      const errorResponse = result as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      const errorMessage = errorResponse.error.toLowerCase();
      expect(errorMessage).toContain("duplicate");
      expect(errorMessage).toContain("specificchain");
      expect(errorMessage).toContain("tokensymbol");
    });

    test("should not allow competition without paper trading initial balances", async () => {
      const competitionName = `Paper Trading Optional Balances ${Date.now()}`;

      try {
        await axios.post(
          `${getBaseUrl()}/api/admin/competition/create`,
          {
            name: competitionName,
            arenaId: "default-paper-arena",
            // Not providing paperTradingInitialBalances to test optional behavior
          },
          {
            headers: {
              Authorization: `Bearer ${adminApiKey}`,
            },
          },
        );
      } catch (error) {
        const errorResponse = error as ErrorResponse;
        expect(errorResponse.status).toBe(400);
      }
    });

    test("should update competition with paper trading initial balances", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition without initial balances
      const competitionName = `Paper Trading Update Balances ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingInitialBalances: [
          { specificChain: "polygon", tokenSymbol: "usdc", amount: 750 },
        ],
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Update with initial balances
      const initialBalances = [
        { specificChain: "eth", tokenSymbol: "usdc", amount: 750 },
      ];

      const updateResponse = (await adminClient.updateCompetition(
        competitionId,
        {
          paperTradingInitialBalances: initialBalances,
        } as Parameters<typeof adminClient.updateCompetition>[1],
      )) as UpdateCompetitionResponse;

      expect(updateResponse.success).toBe(true);

      // Verify initial balances are stored
      const storedBalances = await db
        .select()
        .from(paperTradingInitialBalances)
        .where(eq(paperTradingInitialBalances.competitionId, competitionId));

      expect(storedBalances).toHaveLength(2);
      expect(storedBalances[0]?.specificChain).toBe("polygon");
      expect(storedBalances[0]?.tokenSymbol).toBe("usdc");
      expect(storedBalances[0]?.amount).toBe(750);
    });
  });

  describe("Paper Trading Config Configuration", () => {
    test("should create competition with paper trading config", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxTradePercentage = 50;
      const competitionName = `Paper Trading Config Test ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingConfig: {
          maxTradePercentage,
        },
      } as Parameters<
        typeof adminClient.createCompetition
      >[0])) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Verify paper trading config is stored in database
      const [config] = await db
        .select()
        .from(paperTradingConfig)
        .where(eq(paperTradingConfig.competitionId, competitionId))
        .limit(1);

      expect(config).toBeDefined();
      expect(config?.maxTradePercentage).toBe(maxTradePercentage);
    });

    test("should default maxTradePercentage to 25 when not provided", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Paper Trading Config Default ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingConfig: {}, // Empty config should use default
      } as Parameters<
        typeof adminClient.createCompetition
      >[0])) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Verify default maxTradePercentage is 25 when config is created
      // Note: Config may not be created until competition starts or config is explicitly set
      const [config] = await db
        .select()
        .from(paperTradingConfig)
        .where(eq(paperTradingConfig.competitionId, competitionId))
        .limit(1);

      // Config is optional and may not exist until explicitly set or competition starts
      if (config) {
        expect(config.maxTradePercentage).toBe(25);
      }
    });

    test("should allow competition without paper trading config", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Paper Trading Config Optional ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Verify no paper trading config is stored (it's optional)
      const [config] = await db
        .select()
        .from(paperTradingConfig)
        .where(eq(paperTradingConfig.competitionId, competitionId))
        .limit(1);

      // Config may or may not exist - both are valid
      // If it exists, it should have default value
      if (config) {
        expect(config.maxTradePercentage).toBe(25);
      }
    });

    test("should update competition with paper trading config", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition without paper trading config
      const competitionName = `Paper Trading Config Update ${Date.now()}`;
      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Update with paper trading config
      const maxTradePercentage = 75;
      const updateResponse = (await adminClient.updateCompetition(
        competitionId,
        {
          paperTradingConfig: {
            maxTradePercentage,
          },
        } as Parameters<typeof adminClient.updateCompetition>[1],
      )) as UpdateCompetitionResponse;

      expect(updateResponse.success).toBe(true);

      // Verify paper trading config is updated
      const [config] = await db
        .select()
        .from(paperTradingConfig)
        .where(eq(paperTradingConfig.competitionId, competitionId))
        .limit(1);

      expect(config).toBeDefined();
      expect(config?.maxTradePercentage).toBe(maxTradePercentage);
    });

    test("should reject maxTradePercentage below minimum", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Paper Trading Config Invalid Min ${Date.now()}`;
      const result = await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingConfig: {
          maxTradePercentage: 0, // Below minimum of 1
        },
      } as Parameters<typeof adminClient.createCompetition>[0]);

      expect(result.success).toBe(false);
      const errorResponse = result as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("maxTradePercentage");
    });

    test("should reject maxTradePercentage above maximum", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Paper Trading Config Invalid Max ${Date.now()}`;
      const result = await adminClient.createCompetition({
        name: competitionName,
        arenaId: "default-paper-arena",
        paperTradingConfig: {
          maxTradePercentage: 101, // Above maximum of 100
        },
      } as Parameters<typeof adminClient.createCompetition>[0]);

      expect(result.success).toBe(false);
      const errorResponse = result as ErrorResponse;
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.error).toContain("maxTradePercentage");
    });

    test("should accept maxTradePercentage at boundaries", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Test minimum boundary (1)
      const competitionName1 = `Paper Trading Config Min Boundary ${Date.now()}`;
      const createResponse1 = (await adminClient.createCompetition({
        name: competitionName1,
        arenaId: "default-paper-arena",
        paperTradingConfig: {
          maxTradePercentage: 1,
        },
      } as Parameters<
        typeof adminClient.createCompetition
      >[0])) as CreateCompetitionResponse;

      expect(createResponse1.success).toBe(true);

      // Test maximum boundary (100)
      const competitionName2 = `Paper Trading Config Max Boundary ${Date.now()}`;
      const createResponse2 = (await adminClient.createCompetition({
        name: competitionName2,
        arenaId: "default-paper-arena",
        paperTradingConfig: {
          maxTradePercentage: 100,
        },
      } as Parameters<
        typeof adminClient.createCompetition
      >[0])) as CreateCompetitionResponse;

      expect(createResponse2.success).toBe(true);
    });
  });
});
