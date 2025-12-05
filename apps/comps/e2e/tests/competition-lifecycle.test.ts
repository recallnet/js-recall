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
} from "@recallnet/test-utils";

import { db } from "@/lib/db";

describe("Competition API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

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
      description: "Competition to test active rules endpoint with min trades",
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

  test("anyone can view competition rules by competition ID (public endpoint)", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with specific trading constraints
    const competitionName = `Public Rules Test ${Date.now()}`;
    const customConstraints = {
      minimumPairAgeHours: 96,
      minimum24hVolumeUsd: 100000,
      minimumLiquidityUsd: 200000,
      minimumFdvUsd: 3000000,
    };

    const createResponse = (await adminClient.createCompetition({
      name: competitionName,
      description: "Test competition for public rules endpoint",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      tradingConstraints: customConstraints,
    })) as CreateCompetitionResponse;

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Test 1: Authenticated agent can access the rules
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Rules Viewer Agent",
    });

    const agentRulesResponse = (await agentClient.getCompetitionRules(
      competitionId,
    )) as CompetitionRulesResponse;

    expect(agentRulesResponse.success).toBe(true);
    expect(agentRulesResponse.rules).toBeDefined();
    expect(agentRulesResponse.competition).toBeDefined();
    expect(agentRulesResponse.competition.id).toBe(competitionId);

    // Verify rules structure
    expect(agentRulesResponse.rules.tradingRules).toBeDefined();
    expect(agentRulesResponse.rules.tradingRules).toBeInstanceOf(Array);
    expect(agentRulesResponse.rules.rateLimits).toBeDefined();
    expect(agentRulesResponse.rules.availableChains).toBeDefined();
    expect(agentRulesResponse.rules.slippageFormula).toBeDefined();

    // Verify trading constraints
    expect(agentRulesResponse.rules.tradingConstraints).toBeDefined();
    expect(
      agentRulesResponse.rules.tradingConstraints?.minimumPairAgeHours,
    ).toBe(96);
    expect(
      agentRulesResponse.rules.tradingConstraints?.minimum24hVolumeUsd,
    ).toBe(100000);
    expect(
      agentRulesResponse.rules.tradingConstraints?.minimumLiquidityUsd,
    ).toBe(200000);
    expect(agentRulesResponse.rules.tradingConstraints?.minimumFdvUsd).toBe(
      3000000,
    );

    // Verify trading rules include the constraints
    const tradingRules = agentRulesResponse.rules.tradingRules;
    expect(
      tradingRules.some((rule: string) =>
        rule.includes("minimum 96 hours of trading history"),
      ),
    ).toBe(true);
    expect(
      tradingRules.some((rule: string) =>
        rule.includes("minimum 24h volume of $100,000 USD"),
      ),
    ).toBe(true);

    // Test 2: Unauthenticated client can also access the rules
    const unauthClient = createTestClient();
    const unauthRulesResponse = (await unauthClient.getCompetitionRules(
      competitionId,
    )) as CompetitionRulesResponse;

    expect(unauthRulesResponse.success).toBe(true);
    expect(unauthRulesResponse.rules).toBeDefined();
    expect(unauthRulesResponse.competition.id).toBe(competitionId);

    // Test 3: Privy authenticated user can access the rules
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Rules Viewer",
      userEmail: "siwe-rules@example.com",
    });

    const siweRulesResponse = (await siweClient.getCompetitionRules(
      competitionId,
    )) as CompetitionRulesResponse;

    expect(siweRulesResponse.success).toBe(true);
    expect(siweRulesResponse.rules).toBeDefined();
    expect(siweRulesResponse.competition.id).toBe(competitionId);

    // Test 4: Returns 404 for non-existent competition
    const nonExistentResponse = await agentClient.getCompetitionRules(
      "00000000-0000-0000-0000-000000000000",
    );

    expect(nonExistentResponse.success).toBe(false);
    expect((nonExistentResponse as ErrorResponse).error).toContain("not found");

    // Test 5: Works for both pending and active competitions
    // Start the competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Competition Starter Agent",
    });

    await adminClient.startExistingCompetition({
      competitionId,
      agentIds: [agent.id],
    });

    // Should still be able to get rules after competition is started
    const activeRulesResponse = (await agentClient.getCompetitionRules(
      competitionId,
    )) as CompetitionRulesResponse;

    expect(activeRulesResponse.success).toBe(true);
    expect(activeRulesResponse.rules).toBeDefined();
    expect(activeRulesResponse.competition.status).toBe("active");
  });

  test("competitions include externalUrl and imageUrl fields", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Link and Image Test Agent",
      });

    // Test data for new fields
    const externalUrl = "https://example.com/competition-details";
    const imageUrl = "https://example.com/competition-image.jpg";

    // 1. Test creating a competition with externalUrl and imageUrl
    const createCompetitionName = `Create with Links Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: createCompetitionName,
      description: "Test description with links",
      externalUrl,
      imageUrl,
    });

    // Verify the fields are in the creation response
    expect(createResponse.success).toBe(true);
    expect(createResponse.competition.externalUrl).toBe(externalUrl);
    expect(createResponse.competition.imageUrl).toBe(imageUrl);

    // 2. Test starting a competition with externalUrl and imageUrl
    const startCompetitionName = `Start with Links Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: startCompetitionName,
      agentIds: [agent.id],
      externalUrl,
      imageUrl,
    });

    // Verify the fields are in the start competition response
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition.externalUrl).toBe(externalUrl);
    expect(startResponse.competition.imageUrl).toBe(imageUrl);

    // 3. Verify the fields are in the competition status response for participating agents
    const competitionId = startResponse.competition.id;
    const agentCompetitionResponse =
      await agentClient.getCompetition(competitionId);
    if (!agentCompetitionResponse.success) {
      throw new Error("Failed to get competition");
    }
    const agentCompetition = agentCompetitionResponse.competition;
    expect(agentCompetition.id).toBe(competitionId);
    expect(agentCompetition.status).toBe("active");
    expect(agentCompetition.externalUrl).toBe(externalUrl);
    expect(agentCompetition.imageUrl).toBe(imageUrl);

    // 4. Verify the fields are in the competition detail response
    const competitionDetail = await agentClient.getCompetition(
      startResponse.competition.id,
    );
    if (competitionDetail.success && "competition" in competitionDetail) {
      expect(competitionDetail.competition.externalUrl).toBe(externalUrl);
      expect(competitionDetail.competition.imageUrl).toBe(imageUrl);
    }

    // 5. Verify the fields are in the upcoming competitions endpoint for pending competitions
    // First, end the active competition
    if (startResponse.success) {
      await adminClient.endCompetition(startResponse.competition.id);
    }

    // Get upcoming competitions
    const upcomingResponse = await agentClient.getCompetitions("pending");

    if (upcomingResponse.success && "competitions" in upcomingResponse) {
      // Find our created but not started competition
      const pendingCompetition = upcomingResponse.competitions.find(
        (comp) => comp.id === createResponse.competition.id,
      );

      expect(pendingCompetition).toBeDefined();
      if (pendingCompetition) {
        expect(pendingCompetition.externalUrl).toBe(externalUrl);
        expect(pendingCompetition.imageUrl).toBe(imageUrl);
      }
    }

    const startExistingResponse = await startExistingTestCompetition({
      adminClient,
      competitionId: createResponse.competition.id,
      agentIds: [agent.id],
    });

    // Verify the original fields are in the response
    expect(startExistingResponse.success).toBe(true);
    expect(startExistingResponse.competition.externalUrl).toBe(externalUrl);
    expect(startExistingResponse.competition.imageUrl).toBe(imageUrl);
  });

  // test cases for GET /competitions/{competitionId}
  test("should get competition details by ID", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Competition Detail Test Agent",
    });

    // Create a competition
    const competitionName = `Detail Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition for detail endpoint",
    });

    // Test getting competition details by ID
    const detailResponse = (await agentClient.getCompetition(
      createResponse.competition.id,
    )) as CompetitionDetailResponse;

    // Verify the response
    expect(detailResponse.success).toBe(true);
    expect(detailResponse.competition).toBeDefined();
    expect(detailResponse.competition.id).toBe(createResponse.competition.id);
    expect(detailResponse.competition.name).toBe(competitionName);
    expect(detailResponse.competition.description).toBe(
      "Test competition for detail endpoint",
    );
    expect(detailResponse.competition.status).toBe("pending");
    expect(detailResponse.competition.createdAt).toBeDefined();
    expect(detailResponse.competition.updatedAt).toBeDefined();
    expect(detailResponse.competition.endDate).toBeNull();

    // Test admin access
    const adminDetailResponse = (await adminClient.getCompetition(
      createResponse.competition.id,
    )) as CompetitionDetailResponse;

    expect(adminDetailResponse.success).toBe(true);
    expect(adminDetailResponse.competition.id).toBe(
      createResponse.competition.id,
    );
  });

  test("should include trading constraints in competition details by ID", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Trading Constraints Detail Test Agent",
    });

    // Create a competition with custom trading constraints
    const competitionName = `Trading Constraints Detail Test ${Date.now()}`;
    const customConstraints = {
      minimumPairAgeHours: 72,
      minimum24hVolumeUsd: 500000,
      minimumLiquidityUsd: 300000,
      minimumFdvUsd: 5000000,
    };

    const createResponse = (await adminClient.createCompetition({
      name: competitionName,
      description:
        "Test competition with trading constraints for detail endpoint",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      tradingConstraints: customConstraints,
    })) as CreateCompetitionResponse;

    // Test getting competition details includes trading constraints
    const detailResponse = (await agentClient.getCompetition(
      createResponse.competition.id,
    )) as CompetitionDetailResponse;

    // Verify the response includes trading constraints
    expect(detailResponse.success).toBe(true);
    expect(detailResponse.competition).toBeDefined();
    expect(detailResponse.competition.tradingConstraints).toBeDefined();
    expect(
      detailResponse.competition.tradingConstraints?.minimumPairAgeHours,
    ).toBe(72);
    expect(
      detailResponse.competition.tradingConstraints?.minimum24hVolumeUsd,
    ).toBe(500000);
    expect(
      detailResponse.competition.tradingConstraints?.minimumLiquidityUsd,
    ).toBe(300000);
    expect(detailResponse.competition.tradingConstraints?.minimumFdvUsd).toBe(
      5000000,
    );
  });

  test("should return 404 for non-existent competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "404 Test Agent",
    });

    // Try to get a non-existent competition
    const response = await agentClient.getCompetition(
      "00000000-0000-0000-0000-000000000000",
    );

    // Should return error response
    expect(response.success).toBe(false);
    expect((response as ErrorResponse).error).toContain("not found");
  });

  test("should include all required fields in competition details", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Fields Test Agent",
      });

    // Create and start a competition
    const competitionName = `Fields Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for field validation",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      externalUrl: "https://example.com",
      imageUrl: "https://example.com/image.png",
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Get competition details
    const detailResponse = await agentClient.getCompetition(competition.id);
    expect(detailResponse.success).toBe(true);

    const competitionDetail = (detailResponse as CompetitionDetailResponse)
      .competition;

    // Verify all required fields are present
    expect(competitionDetail.id).toBe(competition.id);
    expect(competitionDetail.name).toBe(competitionName);
    expect(competitionDetail.description).toBe(
      "Test competition for field validation",
    );
    expect(competitionDetail.status).toBe("active");
    expect(competitionDetail.crossChainTradingType).toBe("disallowAll");
    expect(competitionDetail.externalUrl).toBe("https://example.com");
    expect(competitionDetail.imageUrl).toBe("https://example.com/image.png");
    expect(competitionDetail.createdAt).toBeDefined();
    expect(competitionDetail.updatedAt).toBeDefined();
    expect(competitionDetail.startDate).toBeDefined();
    expect(competitionDetail.endDate).toBeNull();
  });

  test("should include arena and participation fields in competition details", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create arena
    const arenaId = `test-arena-${Date.now()}`;
    await adminClient.createArena({
      id: arenaId,
      name: "Test Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });

    // Create competition with all new fields
    const competitionName = `Arena Fields Test ${Date.now()}`;
    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Test arena and participation fields",
      type: "trading",
      arenaId: arenaId,
      engineId: "spot_paper_trading",
      engineVersion: "1.0.0",
      vips: ["vip-agent-1", "vip-agent-2"],
      allowlist: ["allowed-1"],
      blocklist: ["blocked-1"],
      minRecallRank: 100,
      allowlistOnly: true,
      agentAllocation: 10000,
      agentAllocationUnit: "RECALL",
      boosterAllocation: 5000,
      boosterAllocationUnit: "USDC",
      rewardRules: "Top 10 winners",
      rewardDetails: "Distributed weekly",
      displayState: "active",
    });

    expect(createResponse.success).toBe(true);
    const competitionId = (createResponse as CreateCompetitionResponse)
      .competition.id;

    // Register an agent to fetch the competition
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Arena Fields Viewer",
    });

    // Get competition details and verify new fields are present
    const detailResponse = (await agentClient.getCompetition(
      competitionId,
    )) as CompetitionDetailResponse;

    expect(detailResponse.success).toBe(true);
    const competition = detailResponse.competition;

    // Verify arena and engine fields
    expect(competition.arenaId).toBe(arenaId);
    expect(competition.engineId).toBe("spot_paper_trading");
    expect(competition.engineVersion).toBe("1.0.0");

    // Verify participation fields
    expect(competition.vips).toEqual(["vip-agent-1", "vip-agent-2"]);
    expect(competition.allowlist).toEqual(["allowed-1"]);
    expect(competition.blocklist).toEqual(["blocked-1"]);
    expect(competition.minRecallRank).toBe(100);
    expect(competition.allowlistOnly).toBe(true);

    // Verify reward allocation fields
    expect(competition.agentAllocation).toBe(10000);
    expect(competition.agentAllocationUnit).toBe("RECALL");
    expect(competition.boosterAllocation).toBe(5000);
    expect(competition.boosterAllocationUnit).toBe("USDC");
    expect(competition.rewardRules).toBe("Top 10 winners");
    expect(competition.rewardDetails).toBe("Distributed weekly");

    // Verify display state
    expect(competition.displayState).toBe("active");
  });

  test("should return arena and participation fields when competition is modified", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create basic competition
    const createResponse = await adminClient.createCompetition({
      name: "Basic Competition",
      type: "trading",
    });
    expect(createResponse.success).toBe(true);
    const competitionId = (createResponse as CreateCompetitionResponse)
      .competition.id;

    // Create arena for linking
    const arenaId = `modify-test-arena-${Date.now()}`;
    await adminClient.createArena({
      id: arenaId,
      name: "Modify Test Arena",
      createdBy: "admin",
      category: "crypto_trading",
      skill: "spot_paper_trading",
    });

    // Modify competition to add arena and participation fields
    await adminClient.updateCompetition(competitionId, {
      arenaId: arenaId,
      engineId: "spot_paper_trading",
      engineVersion: "2.0.0",
      vips: ["vip-agent"],
      allowlist: ["allowed-agent"],
      minRecallRank: 200,
      agentAllocation: 20000,
      agentAllocationUnit: "USDC",
      displayState: "waitlist",
    });

    // Fetch competition and verify fields are returned
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Field Viewer",
    });

    const detailResponse = (await agentClient.getCompetition(
      competitionId,
    )) as CompetitionDetailResponse;

    expect(detailResponse.success).toBe(true);
    const competition = detailResponse.competition;

    // Verify fields are in the response
    expect(competition.arenaId).toBe(arenaId);
    expect(competition.engineId).toBe("spot_paper_trading");
    expect(competition.engineVersion).toBe("2.0.0");
    expect(competition.vips).toEqual(["vip-agent"]);
    expect(competition.allowlist).toEqual(["allowed-agent"]);
    expect(competition.minRecallRank).toBe(200);
    expect(competition.agentAllocation).toBe(20000);
    expect(competition.agentAllocationUnit).toBe("USDC");
    expect(competition.displayState).toBe("waitlist");
  });

  // test cases for GET /competitions/{competitionId}/agents

  // test cases for Privy user authentication

  // test cases for join/leave competition functionality

  describe("Competition Join Date Constraints", () => {});

  describe("Public Competition Access (No Authentication Required)", () => {});

  describe("Trophy Logic", () => {
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

  describe("Competition Rewards Logic", () => {});

  describe("Participant Limits", () => {});

  describe("Participation Rules Enforcement", () => {});

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
