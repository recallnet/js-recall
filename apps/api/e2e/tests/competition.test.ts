import axios from "axios";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { agents, competitionAgents } from "@recallnet/db/schema/core/defs";
import {
  AgentCompetitionsResponse,
  AgentProfileResponse,
  AgentTrophy,
  BlockchainType,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CompetitionJoinResponse,
  CompetitionRulesResponse,
  CompetitionWithAgents,
  CreateCompetitionResponse,
  EndCompetitionResponse,
  EnhancedCompetition,
  ErrorResponse,
  GlobalLeaderboardResponse,
  StartCompetitionResponse,
  TradeResponse,
  UpcomingCompetitionsResponse,
  UserAgentApiKeyResponse,
  UserCompetitionsResponse,
} from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createPerpsTestCompetition,
  createPrivyAuthenticatedClient,
  createTestAgent,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  looseTradingConstraints,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
  strictTradingConstraints,
} from "@recallnet/test-utils";
import { wait } from "@recallnet/test-utils";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { ServiceRegistry } from "@/services/index.js";

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

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      reason: "testing create comp with trading constraints",
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.svm.sol,
      amount: "100",
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
    const rulesResponse =
      (await agentClient.getRules()) as CompetitionRulesResponse;
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
    await adminClient.startCompetition({
      name: competitionName,
      description: "Competition to test active rules endpoint with min trades",
      agentIds: [agent.id],
      tradingConstraints: constraintsWithMinTrades,
    });

    // Agent gets competition rules (authenticated endpoint for active competition)
    const rulesResponse =
      (await agentClient.getRules()) as CompetitionRulesResponse;
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

  test("agents can view competition status and leaderboard", async () => {
    // Setup admin client and register an agent
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Gamma",
      });

    // Admin starts a competition with the agent
    const competitionName = `Viewable Competition ${Date.now()}`;
    await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Agent checks competition status
    const competition = await agentClient.getActiveCompetition();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("active");

    // Agent checks leaderboard
    const leaderboardResponse = await agentClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);
    if (!leaderboardResponse.success) throw new Error("Failed to get agents");

    expect(leaderboardResponse.agents).toBeDefined();
    expect(leaderboardResponse.agents).toBeInstanceOf(Array);

    // There should be one agent in the leaderboard
    expect(leaderboardResponse.agents.length).toBe(1);

    // The agent should be in the leaderboard
    const agentInLeaderboard = leaderboardResponse.agents.find(
      (entry) => entry.name === "Agent Gamma",
    );
    expect(agentInLeaderboard).toBeDefined();
  });

  test("agents receive basic information for competitions they are not part of", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents - one in the competition, one not
    const { client: agentInClient, agent: agentIn } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Inside Agent",
      });
    const { client: agentOutClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Outside Agent",
    });

    // Start a competition with only one agent
    const { competition } = await startTestCompetition({
      adminClient,
      name: `Exclusive Competition ${Date.now()}`,
      agentIds: [agentIn.id],
    });

    // Both agents can check status of the active competition
    const competitionFromAgentIn = await agentInClient.getActiveCompetition();
    expect(competitionFromAgentIn.id).toBe(competition.id);
    expect(competitionFromAgentIn.status).toBe("active");

    const competitionFromAgentOut = await agentOutClient.getActiveCompetition();
    expect(competitionFromAgentOut.id).toBe(competition.id);
    expect(competitionFromAgentOut.status).toBe("active");
  });

  test("admin can access competition status without being a participant", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a regular agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Regular Agent",
      });

    // Start a competition with only the regular agent (admin is not a participant)
    const competitionName = `Admin Access Test Competition ${Date.now()}`;
    await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Admin checks competition status with full details
    const adminCompetition = await adminClient.getActiveCompetition();
    expect(adminCompetition.name).toBe(competitionName);
    expect(adminCompetition.status).toBe("active");
    expect(adminCompetition.description).toBeDefined();
    expect(adminCompetition.externalUrl).toBeDefined();
    expect(adminCompetition.imageUrl).toBeDefined();
    expect(adminCompetition.startDate).toBeDefined();
    expect(adminCompetition.endDate).toBeDefined();

    // Admin checks leaderboard
    const adminLeaderboardResponse = await adminClient.getCompetitionAgents(
      adminCompetition.id,
      { sort: "rank" },
    );
    expect(adminLeaderboardResponse.success).toBe(true);
    if (!adminLeaderboardResponse.success)
      throw new Error("Failed to get agents");

    expect(adminLeaderboardResponse.agents).toBeDefined();
    expect(adminLeaderboardResponse.agents).toBeInstanceOf(Array);

    // There should be one agent in the leaderboard
    expect(adminLeaderboardResponse.agents.length).toBe(1);
    expect(adminLeaderboardResponse.agents[0]?.name).toBe("Regular Agent");

    // Admin checks competition rules
    const adminRulesResponse =
      (await adminClient.getRules()) as CompetitionRulesResponse;
    expect(adminRulesResponse.success).toBe(true);
    expect(adminRulesResponse.rules).toBeDefined();
    expect(adminRulesResponse.rules.tradingRules).toBeDefined();
    expect(adminRulesResponse.rules.rateLimits).toBeDefined();
    expect(adminRulesResponse.rules.availableChains).toBeDefined();
    expect(adminRulesResponse.rules.slippageFormula).toBeDefined();

    // Regular agent checks all the same endpoints to verify they work for participants too
    const agentCompetition = await agentClient.getActiveCompetition();
    expect(agentCompetition.id).toBe(adminCompetition.id);
    expect(agentCompetition.status).toBe("active");

    const agentLeaderboardResponse = await agentClient.getCompetitionAgents(
      agentCompetition.id,
    );
    expect(agentLeaderboardResponse.success).toBe(true);

    // Regular agent checks rules
    const agentRulesResponse = await agentClient.getRules();
    expect(agentRulesResponse.success).toBe(true);
  });

  test("agents are activated when added to a competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new agent - should be inactive by default
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent To Activate",
      });

    // Agent should not be able to access restricted endpoints when inactive
    try {
      await agentClient.getAgentProfile();
      // Should not reach here if properly inactive
      expect(false).toBe(true);
    } catch (error) {
      // Expect error due to inactive status
      expect(error).toBeDefined();
    }

    // Start a competition with the agent
    const competitionName = `Activation Test ${Date.now()}`;
    const { competition } = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Check leaderboard to verify agent is now active
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);
    if (!leaderboardResponse.success) throw new Error("Failed to get agents");

    expect(leaderboardResponse.agents).toBeDefined();

    // Find the agent in the leaderboard
    const agentInLeaderboard = leaderboardResponse.agents.find(
      (entry) => entry.id === agent.id,
    );
    expect(agentInLeaderboard).toBeDefined();
    expect(agentInLeaderboard?.active).toBe(true);

    // Agent should now be able to access endpoints
    const profileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.agent).toBeDefined();
  });

  test("agents remain globally active when competition ends but are marked inactive in that competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Competition End Test",
      });

    // Start a competition with the agent
    const competitionName = `Competition End Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Agent should be able to access endpoints during competition
    const activeProfileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(activeProfileResponse.success).toBe(true);

    // End the competition
    const endResponse = (await adminClient.endCompetition(
      startResponse.competition.id,
    )) as EndCompetitionResponse;
    expect(endResponse.success).toBe(true);

    // Wait a moment for status update to process
    await wait(100);

    const postEndProfileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(postEndProfileResponse.success).toBe(true);

    // Verify through database that agent remains globally active
    const agentRecord = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agent.id))
      .limit(1);

    expect(agentRecord.length).toBe(1);
    expect(agentRecord[0]?.status).toBe("active"); // Should remain globally active

    // Verify agent is marked as inactive in the specific competition
    const competitionAgentRecord = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, startResponse.competition.id),
          eq(competitionAgents.agentId, agent.id),
        ),
      )
      .limit(1);

    expect(competitionAgentRecord.length).toBe(1);
    // With refined status model, agents remain 'active' in completed competitions
    expect(competitionAgentRecord[0]?.status).toBe("active");
    // No deactivation data since agents aren't deactivated when competitions end
    expect(competitionAgentRecord[0]?.deactivationReason).toBeNull();
    expect(competitionAgentRecord[0]?.deactivatedAt).toBeNull();
  });

  test("agents can get list of upcoming competitions", async () => {
    // Setup admin client and register an agent
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming competitions viewer test",
    });

    // Create several competitions in PENDING state
    const comp1Name = `Upcoming Competition 1 ${Date.now()}`;
    const comp2Name = `Upcoming Competition 2 ${Date.now()}`;
    const comp3Name = `Upcoming Competition 3 ${Date.now()}`;

    // Create the competitions
    const createResponse1 = (await adminClient.createCompetition({
      name: comp1Name,
      description: "Test competition 1",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    })) as CreateCompetitionResponse;
    const createResponse2 = (await adminClient.createCompetition({
      name: comp2Name,
      description: "Test competition 2",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as CreateCompetitionResponse;
    const createResponse3 = (await adminClient.createCompetition({
      name: comp3Name,
      description: "Test competition 3",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    })) as CreateCompetitionResponse;

    // Verify all competitions were created and in PENDING state
    expect(createResponse1.competition.status).toBe("pending");
    expect(createResponse2.competition.status).toBe("pending");
    expect(createResponse3.competition.status).toBe("pending");

    // Call the competitions endpoint with pending status
    const upcomingResponse = (await agentClient.getCompetitions(
      "pending",
    )) as UpcomingCompetitionsResponse;

    // Verify the response
    expect(upcomingResponse.success).toBe(true);
    expect(upcomingResponse.competitions).toBeDefined();
    expect(Array.isArray(upcomingResponse.competitions)).toBe(true);
    expect(upcomingResponse.competitions.length).toBe(3);

    // Validate pagination metadata
    expect(upcomingResponse.pagination).toBeDefined();
    expect(upcomingResponse.pagination.total).toBe(3); // total competitions created
    expect(upcomingResponse.pagination.limit).toBe(10); // default limit
    expect(upcomingResponse.pagination.offset).toBe(0); // default offset
    expect(typeof upcomingResponse.pagination.hasMore).toBe("boolean");
    expect(upcomingResponse.pagination.hasMore).toBe(false); // 3 competitions < 10 limit

    // Verify each competition has all expected fields
    upcomingResponse.competitions.forEach((comp) => {
      expect(comp.id).toBeDefined();
      expect(comp.name).toBeDefined();
      expect(comp.status).toBe("pending");
      expect(comp.crossChainTradingType).toBeDefined();
      expect(comp.createdAt).toBeDefined();
      expect(comp.updatedAt).toBeDefined();
    });

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming competitions viewer test agent",
    });

    // Start one of the competitions to verify it disappears from upcoming list
    await startExistingTestCompetition({
      adminClient,
      competitionId: createResponse1.competition.id,
      agentIds: [agent.id],
    });

    // Get upcoming competitions again
    const upcomingResponseAfterStart = (await agentClient.getCompetitions(
      "pending",
    )) as UpcomingCompetitionsResponse;

    expect(upcomingResponseAfterStart.competitions.length).toBe(2);

    // Get active competitions
    const activeResponse = (await agentClient.getCompetitions(
      "active",
    )) as UpcomingCompetitionsResponse;

    expect(activeResponse.competitions.length).toBe(1);
  });

  test("viewing competitions with invalid querystring values returns 400", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming Viewer Agent",
    });

    // Create the competitions
    await adminClient.createCompetition({
      name: `Upcoming Competition ${Date.now()}`,
      description: "Test competition 1",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });

    // Call the new endpoint to get competitions sorted by start date ascending
    const ascResponse = (await agentClient.getCompetitions(
      "pending",
      "foo",
    )) as ErrorResponse;

    expect(ascResponse.success).toBe(false);
    expect(ascResponse.status).toBe(400);
  });

  test("agents can view sorted competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming Viewer Agent",
    });

    // Create several competitions in PENDING state that are at least 1200 ms
    // apart in started date, since we are storing at a 1 second precision.
    const comp1Name = `Upcoming Competition 1 ${Date.now()}`;
    const comp2Name = `Upcoming Competition 2 ${Date.now()}`;
    const comp3Name = `Upcoming Competition 3 ${Date.now()}`;

    // Create the competitions
    await adminClient.createCompetition({
      name: comp1Name,
      description: "Test competition 1",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });
    await wait(1200);
    await adminClient.createCompetition({
      name: comp2Name,
      description: "Test competition 2",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });
    await wait(1200);
    await adminClient.createCompetition({
      name: comp3Name,
      description: "Test competition 3",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });

    // Call the new endpoint to get competitions sorted by start date ascending
    const ascResponse = (await agentClient.getCompetitions(
      "pending",
      "createdAt",
    )) as UpcomingCompetitionsResponse;

    // Verify the response
    expect(ascResponse.success).toBe(true);
    expect(ascResponse.competitions).toBeDefined();
    expect(Array.isArray(ascResponse.competitions)).toBe(true);
    expect(ascResponse.competitions[0]?.name).toBe(comp1Name);
    expect(ascResponse.competitions[1]?.name).toBe(comp2Name);
    expect(ascResponse.competitions[2]?.name).toBe(comp3Name);

    // Call the new endpoint to get competitions sorted by start date descending NOTE: the '-' at the beginning of the sort value
    const descResponse = (await agentClient.getCompetitions(
      "pending",
      "-createdAt",
    )) as UpcomingCompetitionsResponse;

    // Verify the response
    expect(descResponse.success).toBe(true);
    expect(descResponse.competitions).toBeDefined();
    expect(Array.isArray(descResponse.competitions)).toBe(true);
    expect(descResponse.competitions[0]?.name).toBe(comp3Name);
    expect(descResponse.competitions[1]?.name).toBe(comp2Name);
    expect(descResponse.competitions[2]?.name).toBe(comp1Name);
  }, 1000000);

  test("should support pagination for competitions list", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Pagination Test Agent",
    });

    // Create multiple competitions for pagination testing
    const competitionNames: string[] = [];
    for (let i = 0; i < 5; i++) {
      const name = `Pagination Test Competition ${i + 1} ${Date.now()}`;
      competitionNames.push(name);
      await adminClient.createCompetition({
        name: name,
        description: `Test competition ${i + 1}`,
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      });

      await wait(100); // Small delay to ensure different timestamps
    }

    // Test first page with limit 3
    const firstPageResponse = (await agentClient.getCompetitions(
      "pending",
      undefined,
      3,
      0,
    )) as UpcomingCompetitionsResponse;

    expect(firstPageResponse.success).toBe(true);
    expect(firstPageResponse.competitions.length).toBe(3);
    expect(firstPageResponse.pagination.total).toBe(5);
    expect(firstPageResponse.pagination.limit).toBe(3);
    expect(firstPageResponse.pagination.offset).toBe(0);
    expect(firstPageResponse.pagination.hasMore).toBe(true); // 0 + 3 < 5

    // Test second page with limit 3, offset 3
    const secondPageResponse = (await agentClient.getCompetitions(
      "pending",
      undefined,
      3,
      3,
    )) as UpcomingCompetitionsResponse;

    expect(secondPageResponse.success).toBe(true);
    expect(secondPageResponse.competitions.length).toBe(2); // remaining competitions
    expect(secondPageResponse.pagination.total).toBe(5);
    expect(secondPageResponse.pagination.limit).toBe(3);
    expect(secondPageResponse.pagination.offset).toBe(3);
    expect(secondPageResponse.pagination.hasMore).toBe(false); // 3 + 3 > 5

    // Test beyond last page
    const emptyPageResponse = (await agentClient.getCompetitions(
      "pending",
      undefined,
      3,
      6,
    )) as UpcomingCompetitionsResponse;

    expect(emptyPageResponse.success).toBe(true);
    expect(emptyPageResponse.competitions.length).toBe(0);
    expect(emptyPageResponse.pagination.total).toBe(5);
    expect(emptyPageResponse.pagination.limit).toBe(3);
    expect(emptyPageResponse.pagination.offset).toBe(6);
    expect(emptyPageResponse.pagination.hasMore).toBe(false); // 6 + 3 > 5
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
    const agentCompetition = await agentClient.getActiveCompetition();
    expect(agentCompetition.id).toBe(startResponse.competition.id);
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
  test("should get competition agents with scores and ranks", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Two",
    });

    // Create and start a competition with multiple agents
    const competitionName = `Agents Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Get competition agents
    const agentsResponse = await agentClient1.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);

    const agentsData = agentsResponse as CompetitionAgentsResponse;
    expect(agentsData.agents).toHaveLength(2);

    // Verify agent data structure
    for (const agent of agentsData.agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(typeof agent.score).toBe("number");
      expect(typeof agent.rank).toBe("number");
      expect(typeof agent.portfolioValue).toBe("number");
      expect(typeof agent.active).toBe("boolean");
      expect(agent.deactivationReason).toBeNull();

      // Verify new PnL and 24h change fields are accessible to Privy users
      expect(typeof agent.pnl).toBe("number");
      expect(typeof agent.pnlPercent).toBe("number");
      expect(typeof agent.change24h).toBe("number");
      expect(typeof agent.change24hPercent).toBe("number");

      // Values should be finite (not NaN or Infinity)
      expect(Number.isFinite(agent.pnl)).toBe(true);
      expect(Number.isFinite(agent.pnlPercent)).toBe(true);
      expect(Number.isFinite(agent.change24h)).toBe(true);
      expect(Number.isFinite(agent.change24hPercent)).toBe(true);
    }

    // Verify agents are ordered by rank
    const ranks = agentsData.agents.map((a) => a.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("should return 404 for agents of non-existent competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "404 Agents Test Agent",
    });

    // Try to get agents for a non-existent competition
    const response = await agentClient.getCompetitionAgents(
      "00000000-0000-0000-0000-000000000000",
    );

    // Should return error response
    expect(response.success).toBe(false);
    expect((response as ErrorResponse).error).toContain("not found");
  });

  test("should handle competitions with no agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent for testing
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Empty Competition Test Agent",
    });

    // Create a competition without starting it (no agents)
    const competitionName = `Empty Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });

    // Test getting agents for competition with no agents
    const agentsResponse = (await agentClient.getCompetitionAgents(
      createResponse.competition.id,
    )) as CompetitionAgentsResponse;

    // Verify the response
    expect(agentsResponse.success).toBe(true);
    expect(agentsResponse.competitionId).toBe(createResponse.competition.id);
    expect(agentsResponse.agents).toBeDefined();
    expect(Array.isArray(agentsResponse.agents)).toBe(true);
    expect(agentsResponse.agents.length).toBe(0);
  });

  test("should handle agent data completeness and ordering", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with different names for ordering test
    const { client: agentClient, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Charlie",
      });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Alpha",
    });
    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Beta",
    });

    // Start a competition with multiple agents
    const competitionName = `Ordering Test Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

    // Test getting competition agents
    const agentsResponse = (await agentClient.getCompetitionAgents(
      startResponse.competition.id,
    )) as CompetitionAgentsResponse;

    // Verify the response
    expect(agentsResponse.success).toBe(true);
    expect(agentsResponse.agents.length).toBe(3);

    // Verify ranks are sequential
    agentsResponse.agents.forEach((agent, index) => {
      expect(agent.rank).toBe(index + 1);

      // Verify all required fields are present and have correct types
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.name).toBe("string");
      expect(typeof agent.score).toBe("number");
      expect(typeof agent.rank).toBe("number");
      expect(typeof agent.portfolioValue).toBe("number");
      expect(typeof agent.active).toBe("boolean");

      // Verify new PnL and 24h change fields
      expect(typeof agent.pnl).toBe("number");
      expect(typeof agent.pnlPercent).toBe("number");
      expect(typeof agent.change24h).toBe("number");
      expect(typeof agent.change24hPercent).toBe("number");

      // Optional fields should be null or string
      if (agent.description !== null) {
        expect(typeof agent.description).toBe("string");
      }
      if (agent.imageUrl !== null) {
        expect(typeof agent.imageUrl).toBe("string");
      }
      if (agent.deactivationReason !== null) {
        expect(typeof agent.deactivationReason).toBe("string");
      }
    });
  });

  // test cases for Privy user authentication
  test("Privy users can access competition details endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Competition Detail User",
      userEmail: "siwe-competition-detail@example.com",
    });

    // Create a competition
    const competitionName = `Privy Detail Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition for Privy user access",
    });

    // Test Privy user can get competition details by ID
    const detailResponse = await siweClient.getCompetition(
      createResponse.competition.id,
    );

    // Verify the response
    expect(detailResponse.success).toBe(true);
    expect(
      (detailResponse as CompetitionDetailResponse).competition,
    ).toBeDefined();
    expect((detailResponse as CompetitionDetailResponse).competition.id).toBe(
      createResponse.competition.id,
    );
    expect((detailResponse as CompetitionDetailResponse).competition.name).toBe(
      competitionName,
    );
    expect(
      (detailResponse as CompetitionDetailResponse).competition.status,
    ).toBe("pending");

    // Test Privy user gets 404 for non-existent competition
    const notFoundResponse = await siweClient.getCompetition(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(notFoundResponse.success).toBe(false);
    expect((notFoundResponse as ErrorResponse).error).toContain("not found");
  });

  test("Privy users can access competition agents endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Competition Agents User",
      userEmail: "siwe-competition-agents@example.com",
    });

    // Register multiple agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Privy Test Agent One",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Privy Test Agent Two",
    });

    // Create and start a competition with multiple agents
    const competitionName = `Privy Agents Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for Privy user agents access",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Test Privy user can get competition agents
    const agentsResponse = await siweClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);

    const agentsData = agentsResponse as CompetitionAgentsResponse;
    expect(agentsData.agents).toHaveLength(2);

    // Verify agent data structure
    for (const agent of agentsData.agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(typeof agent.score).toBe("number");
      expect(typeof agent.rank).toBe("number");
      expect(typeof agent.portfolioValue).toBe("number");
      expect(typeof agent.active).toBe("boolean");
      expect(agent.deactivationReason).toBeNull();

      // Verify new PnL and 24h change fields are accessible to Privy users
      expect(typeof agent.pnl).toBe("number");
      expect(typeof agent.pnlPercent).toBe("number");
      expect(typeof agent.change24h).toBe("number");
      expect(typeof agent.change24hPercent).toBe("number");

      // Values should be finite (not NaN or Infinity)
      expect(Number.isFinite(agent.pnl)).toBe(true);
      expect(Number.isFinite(agent.pnlPercent)).toBe(true);
      expect(Number.isFinite(agent.change24h)).toBe(true);
      expect(Number.isFinite(agent.change24hPercent)).toBe(true);
    }

    // Test Privy user gets 404 for non-existent competition
    const notFoundResponse = await siweClient.getCompetitionAgents(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(notFoundResponse.success).toBe(false);
    expect((notFoundResponse as ErrorResponse).error).toContain("not found");
  });

  test("Privy users can access existing competitions endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Competitions List User",
      userEmail: "siwe-competitions-list@example.com",
    });

    // Create several competitions in different states
    const pendingComp = await createTestCompetition({
      adminClient,
      name: `Pending Competition ${Date.now()}`,
    });

    // Register an agent for active competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Privy Active Competition Agent",
    });

    const activeComp = await startTestCompetition({
      adminClient,
      name: `Active Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    // Test Privy user can get pending competitions
    const pendingResponse = await siweClient.getCompetitions("pending");
    expect(pendingResponse.success).toBe(true);
    expect(
      (pendingResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();

    // Should find our pending competition
    const foundPending = (
      pendingResponse as UpcomingCompetitionsResponse
    ).competitions.find((comp) => comp.id === pendingComp.competition.id);
    expect(foundPending).toBeDefined();

    // Test Privy user can get active competitions
    const activeResponse = await siweClient.getCompetitions("active");
    expect(activeResponse.success).toBe(true);
    expect(
      (activeResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();

    // Should find our active competition
    const foundActive = (
      activeResponse as UpcomingCompetitionsResponse
    ).competitions.find((comp) => comp.id === activeComp.competition.id);
    expect(foundActive).toBeDefined();

    // Test Privy user can use sorting
    const sortedResponse = await siweClient.getCompetitions(
      "pending",
      "createdAt",
    );
    expect(sortedResponse.success).toBe(true);
    expect(
      (sortedResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();
  });

  test("Privy users have same access as agent API key users for competition endpoints", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Access Comparison User",
      userEmail: "siwe-access-comparison@example.com",
    });

    // Create an agent API key authenticated client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "API Key Access Comparison Agent",
      });

    // Create and start a competition
    const competitionName = `Access Comparison Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const competitionId = startResponse.competition.id;

    // Test both clients can access competition details
    const siweDetailResponse = await siweClient.getCompetition(competitionId);
    const agentDetailResponse = await agentClient.getCompetition(competitionId);

    expect(siweDetailResponse.success).toBe(true);
    expect(agentDetailResponse.success).toBe(true);

    // Both should return the same competition data
    expect(
      (siweDetailResponse as CompetitionDetailResponse).competition.id,
    ).toBe((agentDetailResponse as CompetitionDetailResponse).competition.id);
    expect(
      (siweDetailResponse as CompetitionDetailResponse).competition.name,
    ).toBe((agentDetailResponse as CompetitionDetailResponse).competition.name);

    // Test both clients can access competition agents
    const siweAgentsResponse =
      await siweClient.getCompetitionAgents(competitionId);
    const agentAgentsResponse =
      await agentClient.getCompetitionAgents(competitionId);

    expect(siweAgentsResponse.success).toBe(true);
    expect(agentAgentsResponse.success).toBe(true);

    // Both should return the same agents data
    expect(
      (siweAgentsResponse as CompetitionAgentsResponse).agents.length,
    ).toBe((agentAgentsResponse as CompetitionAgentsResponse).agents.length);

    // Test both clients can access competitions list
    const siweListResponse = await siweClient.getCompetitions("active");
    const agentListResponse = await agentClient.getCompetitions("active");

    expect(siweListResponse.success).toBe(true);
    expect(agentListResponse.success).toBe(true);

    // Both should return the same competitions list
    expect(
      (siweListResponse as UpcomingCompetitionsResponse).competitions.length,
    ).toBe(
      (agentListResponse as UpcomingCompetitionsResponse).competitions.length,
    );
  });

  test("should get competition agents with API key authentication", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { agent, client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Competition Agents Test Agent",
    });

    // Start a competition with our agent
    const competitionName = `Competition Agents Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startResult.competition.id;

    // Get competition agents using agent API key
    const response = (await client.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
    expect(response.competitionId).toBe(competitionId);
    expect(response.agents).toBeDefined();
    expect(Array.isArray(response.agents)).toBe(true);
    expect(response.agents.length).toBe(1);

    const agentData = response.agents[0]!;
    expect(agentData).toBeDefined();
    expect(agentData.id).toBe(agent.id);
    expect(agentData.name).toBe(agent.name);
    expect(typeof agentData.score).toBe("number");
    expect(typeof agentData.rank).toBe("number");
    expect(typeof agentData.portfolioValue).toBe("number");
    expect(typeof agentData.active).toBe("boolean");

    // Verify new PnL and 24h change fields
    expect(typeof agentData.pnl).toBe("number");
    expect(typeof agentData.pnlPercent).toBe("number");
    expect(typeof agentData.change24h).toBe("number");
    expect(typeof agentData.change24hPercent).toBe("number");
  });

  test("should calculate PnL and 24h change fields correctly", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "PnL Test Agent 1",
      });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "PnL Test Agent 2",
    });

    // Start a competition with both agents
    const competitionName = `PnL Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });
    const competitionId = startResult.competition.id;

    // Wait a moment for initial snapshots to be taken
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get competition agents
    const response = (await client1.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
    expect(response.agents).toBeDefined();
    expect(response.agents.length).toBe(2);

    // Verify all agents have PnL and 24h change fields
    for (const agentData of response.agents) {
      expect(agentData).toBeDefined();
      expect(typeof agentData.pnl).toBe("number");
      expect(typeof agentData.pnlPercent).toBe("number");
      expect(typeof agentData.change24h).toBe("number");
      expect(typeof agentData.change24hPercent).toBe("number");

      // For a new competition, PnL should be 0 or very small (since no trading has occurred)
      expect(Math.abs(agentData.pnl)).toBeLessThan(1); // Less than $1 difference
      expect(Math.abs(agentData.pnlPercent)).toBeLessThan(1); // Less than 1% difference

      // 24h change should also be 0 or very small for a new competition
      expect(Math.abs(agentData.change24h)).toBeLessThan(1);
      expect(Math.abs(agentData.change24hPercent)).toBeLessThan(1);

      // Portfolio value should be positive (agents start with initial balances)
      expect(agentData.portfolioValue).toBeGreaterThan(0);
      expect(agentData.score).toBe(agentData.portfolioValue); // Score should equal portfolio value
    }
  });

  test("should calculate stats in competition details", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "PnL Test Agent 1",
      });

    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "PnL Test Agent 2",
      });

    // Start a competition with both agents
    const competitionName = `PnL Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });
    const competitionId = startResult.competition.id;
    await wait(100);
    // Make trades with both clients
    const trades1 = await client1.executeTrade({
      fromToken: config.specificChainTokens.eth.eth,
      toToken: config.specificChainTokens.eth.usdc,
      amount: "0.001",
      reason: "Test trade 1",
    });
    expect(trades1.success).toBe(true);
    const trades2 = await client1.executeTrade({
      fromToken: config.specificChainTokens.eth.eth,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "0.001",
      reason: "Test trade 2",
    });
    expect(trades2.success).toBe(true);
    const trades3 = await client2.executeTrade({
      fromToken: config.specificChainTokens.eth.eth,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "0.001",
      reason: "Test trade 3",
    });
    expect(trades3.success).toBe(true);
    const trades4 = await client2.executeTrade({
      fromToken: config.specificChainTokens.eth.eth,
      toToken: config.specificChainTokens.eth.usdc,
      amount: "0.001",
      reason: "Test trade 4",
    });
    expect(trades4.success).toBe(true);

    // Get the total trade values
    const allTrades = [trades1, trades2, trades3, trades4] as TradeResponse[];
    const totalVolume = allTrades.reduce(
      (acc, trade) => acc + (trade.transaction.tradeAmountUsd ?? 0),
      0,
    );
    const { competition } = (await client1.getCompetition(
      competitionId,
    )) as CompetitionDetailResponse;
    const stats = competition.stats;
    expect(stats).toBeDefined();
    expect(stats?.totalTrades).toBe(4);
    expect(stats?.totalAgents).toBe(2);
    expect(stats?.totalVolume).toBe(totalVolume);
    expect(stats?.uniqueTokens).toBe(3);
  });

  test("should handle edge cases for PnL calculations", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent, client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Edge Case Test Agent",
    });

    // Start a competition
    const competitionName = `Edge Case Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startResult.competition.id;

    // Get competition agents immediately (before snapshots might be taken)
    const response = (await client.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
    expect(response.agents.length).toBe(1);

    const agentData = response.agents[0]!;

    // Even with minimal or no snapshot history, fields should be present and numeric
    expect(typeof agentData.pnl).toBe("number");
    expect(typeof agentData.pnlPercent).toBe("number");
    expect(typeof agentData.change24h).toBe("number");
    expect(typeof agentData.change24hPercent).toBe("number");

    // Values should be finite (not NaN or Infinity)
    expect(Number.isFinite(agentData.pnl)).toBe(true);
    expect(Number.isFinite(agentData.pnlPercent)).toBe(true);
    expect(Number.isFinite(agentData.change24h)).toBe(true);
    expect(Number.isFinite(agentData.change24hPercent)).toBe(true);
  });

  test("should order pending competition leaderboards by global scores based on competition type", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Type Test Agent 1",
      });
    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Type Test Agent 2",
      });
    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Type Test Agent 3",
    });
    const { agent: agent4 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Type Test Agent 4",
    });

    // ===== Step 1: Create and complete a TRADING competition with agents 1 & 2 =====
    const tradingComp1 = await adminClient.createCompetition({
      name: `Trading Type Test ${Date.now()}`,
      description: "Trading competition to establish global scores",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading",
    });
    expect(tradingComp1.success).toBe(true);
    const tradingCompId1 = (tradingComp1 as CreateCompetitionResponse)
      .competition.id;

    // Only agents 1 and 2 compete in trading
    await adminClient.startExistingCompetition({
      competitionId: tradingCompId1,
      agentIds: [agent1.id, agent2.id],
    });
    // Make trades - agent2 wins, agent1 loses
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "100",
      reason: "Agent1 loses trading comp",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "10",
      reason: "Agent2 wins trading comp",
    });

    // Check global leaderboard after first competition
    await adminClient.endCompetition(tradingCompId1);
    const globalAfterTrading =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(globalAfterTrading.success).toBe(true);
    expect(globalAfterTrading.agents.length).toBe(2);
    expect(globalAfterTrading.agents[0]?.id).toBe(agent2.id);
    expect(globalAfterTrading.agents[1]?.id).toBe(agent1.id);

    // ===== Step 2: Create and complete a PERPS competition with agents 3 & 4 agents =====
    const perpsComp = await createPerpsTestCompetition({
      adminClient,
      name: `Perps Type Test ${Date.now()}`,
      description:
        "Perps competition with all agents for type segregation test",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });
    expect(perpsComp.success).toBe(true);
    const perpsCompId = (perpsComp as CreateCompetitionResponse).competition.id;
    await adminClient.startExistingCompetition({
      competitionId: perpsCompId,
      agentIds: [agent3.id, agent4.id],
    });

    // ===== Step 3: Create PENDING competitions of each type =====

    // Create a PENDING trading competition with agent 1 and 3
    const pendingTradingComp = await adminClient.createCompetition({
      name: `Pending Trading Type Test ${Date.now()}`,
      description: "Pending trading competition to test leaderboard ordering",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading",
    });
    expect(pendingTradingComp.success).toBe(true);
    const pendingTradingCompId = (
      pendingTradingComp as CreateCompetitionResponse
    ).competition.id;

    // Create a PENDING perps competition with agent 2 and 4
    const pendingPerpsComp = await createPerpsTestCompetition({
      adminClient,
      name: `Pending Perps Type Test ${Date.now()}`,
      description: "Pending perps competition to test leaderboard ordering",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567",
      },
    });
    expect(pendingPerpsComp.success).toBe(true);
    const pendingPerpsCompId = (pendingPerpsComp as CreateCompetitionResponse)
      .competition.id;

    // Add agents 1 & 3 to trading, and 2 & 4 to perps. Each comp has one agent that
    // has a global rank, and one that doesn't
    await adminClient.addAgentToCompetition(pendingTradingCompId, agent1.id);
    await adminClient.addAgentToCompetition(pendingTradingCompId, agent3.id);
    await adminClient.addAgentToCompetition(pendingPerpsCompId, agent2.id);
    await adminClient.addAgentToCompetition(pendingPerpsCompId, agent4.id);

    // ===== Step 4: Verify pending competitions use type-specific global scores =====

    const pendingTradingAgentsResponse =
      await adminClient.getCompetitionAgents(pendingTradingCompId);
    expect(pendingTradingAgentsResponse.success).toBe(true);
    const pendingTradingAgents = (
      pendingTradingAgentsResponse as CompetitionAgentsResponse
    ).agents;
    const agent1Trading = pendingTradingAgents.find((a) => a.id === agent1.id);
    const agent3Trading = pendingTradingAgents.find((a) => a.id === agent3.id);
    expect(agent1Trading!.rank).toBe(1);
    expect(agent3Trading!.rank).toBe(2);

    const pendingPerpsAgentsResponse =
      await adminClient.getCompetitionAgents(pendingPerpsCompId);
    expect(pendingPerpsAgentsResponse.success).toBe(true);
    const pendingPerpsAgents = (
      pendingPerpsAgentsResponse as CompetitionAgentsResponse
    ).agents;
    const agent2Perps = pendingPerpsAgents.find((a) => a.id === agent2.id);
    const agent4Perps = pendingPerpsAgents.find((a) => a.id === agent4.id);
    expect(agent2Perps!.rank).toBe(1);
    expect(agent4Perps!.rank).toBe(2);
  });

  test("should support pagination for competition agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents for pagination testing
    const agents = [];
    for (let i = 1; i <= 5; i++) {
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `Pagination Test Agent ${i}`,
      });
      agents.push(agent);
    }

    // Start a competition with all agents
    const competitionName = `Pagination Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: agents.map((a) => a.id),
    });
    const competitionId = startResult.competition.id;

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Pagination Test Client Agent",
    });

    // Test pagination with limit=2, offset=0
    const page1Response = (await client.getCompetitionAgents(competitionId, {
      limit: 2,
      offset: 0,
    })) as CompetitionAgentsResponse;

    expect(page1Response.success).toBe(true);
    expect(page1Response.agents.length).toBe(2);
    expect(page1Response.pagination.total).toBe(5);
    expect(page1Response.pagination.limit).toBe(2);
    expect(page1Response.pagination.offset).toBe(0);
    expect(page1Response.pagination.hasMore).toBe(true);

    // Test pagination with limit=2, offset=2
    const page2Response = (await client.getCompetitionAgents(competitionId, {
      limit: 2,
      offset: 2,
    })) as CompetitionAgentsResponse;

    expect(page2Response.success).toBe(true);
    expect(page2Response.agents.length).toBe(2);
    expect(page2Response.pagination.total).toBe(5);
    expect(page2Response.pagination.limit).toBe(2);
    expect(page2Response.pagination.offset).toBe(2);
    expect(page2Response.pagination.hasMore).toBe(true);

    // Test pagination with limit=2, offset=4 (last page)
    const page3Response = (await client.getCompetitionAgents(competitionId, {
      limit: 2,
      offset: 4,
    })) as CompetitionAgentsResponse;

    expect(page3Response.success).toBe(true);
    expect(page3Response.agents.length).toBe(1);
    expect(page3Response.pagination.total).toBe(5);
    expect(page3Response.pagination.limit).toBe(2);
    expect(page3Response.pagination.offset).toBe(4);
    expect(page3Response.pagination.hasMore).toBe(false);

    // Verify no duplicate agents across pages
    const allAgentIds = [
      ...page1Response.agents.map((a) => a.id),
      ...page2Response.agents.map((a) => a.id),
      ...page3Response.agents.map((a) => a.id),
    ];
    const uniqueAgentIds = new Set(allAgentIds);
    expect(uniqueAgentIds.size).toBe(5);
  });

  test("should support filtering competition agents by name", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with specific names for filtering
    const { agent: alphaAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Alpha Filter Agent",
    });
    const { agent: betaAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Beta Filter Agent",
    });
    const { agent: gammaAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Gamma Different Agent",
    });

    // Start a competition with all agents
    const competitionName = `Filter Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [alphaAgent.id, betaAgent.id, gammaAgent.id],
    });
    const competitionId = startResult.competition.id;

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Filter Test Client Agent",
    });

    // Test filtering by "Filter" - should return Alpha and Beta agents
    const filterResponse = (await client.getCompetitionAgents(competitionId, {
      filter: "Filter",
    })) as CompetitionAgentsResponse;

    expect(filterResponse.success).toBe(true);
    expect(filterResponse.agents.length).toBe(2);
    expect(filterResponse.pagination.total).toBe(2);

    const filteredNames = filterResponse.agents.map((a) => a.name);
    expect(filteredNames).toContain("Alpha Filter Agent");
    expect(filteredNames).toContain("Beta Filter Agent");
    expect(filteredNames).not.toContain("Gamma Different Agent");

    // Test filtering by "Alpha" - should return only Alpha agent
    const alphaResponse = (await client.getCompetitionAgents(competitionId, {
      filter: "Alpha",
    })) as CompetitionAgentsResponse;

    expect(alphaResponse.success).toBe(true);
    expect(alphaResponse.agents.length).toBe(1);
    expect(alphaResponse.agents[0]?.name).toBe("Alpha Filter Agent");

    // Test filtering by non-existent term
    const noMatchResponse = (await client.getCompetitionAgents(competitionId, {
      filter: "NonExistent",
    })) as CompetitionAgentsResponse;

    expect(noMatchResponse.success).toBe(true);
    expect(noMatchResponse.agents.length).toBe(0);
    expect(noMatchResponse.pagination.total).toBe(0);
  });

  test("should support sorting competition agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents with names that will test sorting
    const { agent: charlieAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Charlie Sort Agent",
    });

    // Wait to ensure different creation times
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { agent: alphaAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Alpha Sort Agent",
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const { agent: betaAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Beta Sort Agent",
    });

    // Start a competition with all agents
    const competitionName = `Sort Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [charlieAgent.id, alphaAgent.id, betaAgent.id],
    });
    const competitionId = startResult.competition.id;

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Sort Test Client Agent",
    });
    // Force a snapshot directly
    const services = new ServiceRegistry();
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );

    // Test sorting by default (rank)
    const rankDefaultResponse = (await client.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(rankDefaultResponse.success).toBe(true);
    expect(rankDefaultResponse.agents[0]!.rank).toBe(1);
    expect(rankDefaultResponse.agents[1]!.rank).toBe(2);
    expect(rankDefaultResponse.agents[2]!.rank).toBe(3);

    // Test sorting by name (ascending)
    const nameAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "name",
    })) as CompetitionAgentsResponse;

    expect(nameAscResponse.success).toBe(true);
    expect(nameAscResponse.agents.length).toBe(3);

    const nameAscOrder = nameAscResponse.agents.map((a) => a.name);
    expect(nameAscOrder[0]).toBe("Alpha Sort Agent");
    expect(nameAscOrder[1]).toBe("Beta Sort Agent");
    expect(nameAscOrder[2]).toBe("Charlie Sort Agent");

    // Test sorting by name (descending)
    const nameDescResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "-name",
    })) as CompetitionAgentsResponse;

    expect(nameDescResponse.success).toBe(true);
    expect(nameDescResponse.agents.length).toBe(3);

    const nameDescOrder = nameDescResponse.agents.map((a) => a.name);
    expect(nameDescOrder[0]).toBe("Charlie Sort Agent");
    expect(nameDescOrder[1]).toBe("Beta Sort Agent");
    expect(nameDescOrder[2]).toBe("Alpha Sort Agent");

    // Test sorting by rank
    const rankAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "rank",
    })) as CompetitionAgentsResponse;

    expect(rankAscResponse.success).toBe(true);
    expect(rankAscResponse.agents[0]!.rank).toBe(1);
    expect(rankAscResponse.agents[1]!.rank).toBe(2);
    expect(rankAscResponse.agents[2]!.rank).toBe(3);

    // Test sorting by rank (descending)
    const rankDescResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "-rank",
    })) as CompetitionAgentsResponse;
    expect(rankDescResponse.success).toBe(true);
    expect(rankDescResponse.agents[0]!.rank).toBe(3);
    expect(rankDescResponse.agents[1]!.rank).toBe(2);
    expect(rankDescResponse.agents[2]!.rank).toBe(1);

    // Test sorting by score (ascending)
    const scoreAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "score",
    })) as CompetitionAgentsResponse;
    expect(scoreAscResponse.success).toBe(true);
    expect(scoreAscResponse.agents[0]!.score).toBeLessThanOrEqual(
      scoreAscResponse.agents[1]!.score,
    );
    expect(scoreAscResponse.agents[1]!.score).toBeLessThanOrEqual(
      scoreAscResponse.agents[2]!.score,
    );

    // Test sorting by score (descending)
    const scoreDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-score",
      },
    )) as CompetitionAgentsResponse;
    expect(scoreDescResponse.success).toBe(true);
    expect(scoreDescResponse.agents[0]!.score).toBeGreaterThanOrEqual(
      scoreDescResponse.agents[1]!.score,
    );
    expect(scoreDescResponse.agents[1]!.score).toBeGreaterThanOrEqual(
      scoreDescResponse.agents[2]!.score,
    );

    // Test sorting by portfolioValue (ascending)
    const portfolioValueAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "portfolioValue",
      },
    )) as CompetitionAgentsResponse;
    expect(portfolioValueAscResponse.success).toBe(true);
    expect(
      portfolioValueAscResponse.agents[0]!.portfolioValue,
    ).toBeLessThanOrEqual(portfolioValueAscResponse.agents[1]!.portfolioValue);
    expect(
      portfolioValueAscResponse.agents[1]!.portfolioValue,
    ).toBeLessThanOrEqual(portfolioValueAscResponse.agents[2]!.portfolioValue);

    // Test sorting by portfolioValue (descending)
    const portfolioValueDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-portfolioValue",
      },
    )) as CompetitionAgentsResponse;
    expect(portfolioValueDescResponse.success).toBe(true);
    expect(
      portfolioValueDescResponse.agents[0]!.portfolioValue,
    ).toBeGreaterThanOrEqual(
      portfolioValueDescResponse.agents[1]!.portfolioValue,
    );
    expect(
      portfolioValueDescResponse.agents[1]!.portfolioValue,
    ).toBeGreaterThanOrEqual(
      portfolioValueDescResponse.agents[2]!.portfolioValue,
    );

    // Check PnL (ascending)
    const pnlAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "pnl",
    })) as CompetitionAgentsResponse;
    expect(pnlAscResponse.success).toBe(true);
    expect(pnlAscResponse.agents[0]!.pnl).toBeGreaterThanOrEqual(
      pnlAscResponse.agents[1]!.pnl,
    );
    expect(pnlAscResponse.agents[1]!.pnl).toBeGreaterThanOrEqual(
      pnlAscResponse.agents[2]!.pnl,
    );

    // Check PnL (descending)
    const pnlDescResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "-pnl",
    })) as CompetitionAgentsResponse;
    expect(pnlDescResponse.success).toBe(true);
    expect(pnlDescResponse.agents[0]!.pnl).toBeGreaterThanOrEqual(
      pnlDescResponse.agents[1]!.pnl,
    );
    expect(pnlDescResponse.agents[1]!.pnl).toBeGreaterThanOrEqual(
      pnlDescResponse.agents[2]!.pnl,
    );

    // Verify PnL percentage is in ascending order
    const pnlPercentAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "pnlPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(pnlPercentAscResponse.success).toBe(true);
    expect(pnlPercentAscResponse.agents[0]!.pnlPercent).toBeGreaterThanOrEqual(
      pnlPercentAscResponse.agents[1]!.pnlPercent,
    );
    expect(pnlPercentAscResponse.agents[1]!.pnlPercent).toBeGreaterThanOrEqual(
      pnlPercentAscResponse.agents[2]!.pnlPercent,
    );

    // Verify PnL percentage is in descending order
    const pnlPercentDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-pnlPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(pnlPercentDescResponse.success).toBe(true);
    expect(pnlPercentDescResponse.agents[0]!.pnlPercent).toBeLessThanOrEqual(
      pnlPercentDescResponse.agents[1]!.pnlPercent,
    );
    expect(pnlPercentDescResponse.agents[1]!.pnlPercent).toBeLessThanOrEqual(
      pnlPercentDescResponse.agents[2]!.pnlPercent,
    );

    // Verify change24h is in ascending order
    const change24hAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "change24h",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hAscResponse.success).toBe(true);
    expect(change24hAscResponse.agents[0]!.change24h).toBeGreaterThanOrEqual(
      change24hAscResponse.agents[1]!.change24h,
    );
    expect(change24hAscResponse.agents[1]!.change24h).toBeGreaterThanOrEqual(
      change24hAscResponse.agents[2]!.change24h,
    );

    // Verify change24h is in descending order
    const change24hDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-change24h",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hDescResponse.success).toBe(true);
    expect(change24hDescResponse.agents[0]!.change24h).toBeLessThanOrEqual(
      change24hDescResponse.agents[1]!.change24h,
    );
    expect(change24hDescResponse.agents[1]!.change24h).toBeLessThanOrEqual(
      change24hDescResponse.agents[2]!.change24h,
    );

    // Verify change24h percentage is in ascending order
    const change24hPercentAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "change24hPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hPercentAscResponse.success).toBe(true);
    expect(
      change24hPercentAscResponse.agents[0]!.change24hPercent,
    ).toBeGreaterThanOrEqual(
      change24hPercentAscResponse.agents[1]!.change24hPercent,
    );
    expect(
      change24hPercentAscResponse.agents[1]!.change24hPercent,
    ).toBeGreaterThanOrEqual(
      change24hPercentAscResponse.agents[2]!.change24hPercent,
    );

    // Verify change24h percentage is in descending order
    const change24hPercentDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-change24hPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hPercentDescResponse.success).toBe(true);
    expect(
      change24hPercentDescResponse.agents[0]!.change24hPercent,
    ).toBeLessThanOrEqual(
      change24hPercentDescResponse.agents[1]!.change24hPercent,
    );
    expect(
      change24hPercentDescResponse.agents[1]!.change24hPercent,
    ).toBeLessThanOrEqual(
      change24hPercentDescResponse.agents[2]!.change24hPercent,
    );
  });

  test("should handle computed sorting with pagination limits", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register 6 agents to test pagination
    const agents = [];
    for (let i = 1; i <= 6; i++) {
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `Pagination Test Agent ${i}`,
      });
      agents.push(agent);
    }

    // Start a competition with all agents
    const competitionName = `Pagination Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: agents.map((a) => a.id),
    });
    const competitionId = startResult.competition.id;

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Pagination Test Client Agent",
    });

    // Test 1: Database sorting
    const dbSortResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "name", // Database field (no computed fields)
      limit: 3,
      offset: 0,
    })) as CompetitionAgentsResponse;

    expect(dbSortResponse.success).toBe(true);
    expect(dbSortResponse.agents.length).toBe(3);
    expect(dbSortResponse.pagination.limit).toBe(3);
    expect(dbSortResponse.pagination.offset).toBe(0);
    expect(dbSortResponse.pagination.total).toBe(6);
    expect(dbSortResponse.pagination.hasMore).toBe(true);

    // Test 2: Computed sorting
    const computedSortResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "rank", // Computed field
        limit: 3,
        offset: 0,
      },
    )) as CompetitionAgentsResponse;

    expect(computedSortResponse.success).toBe(true);

    expect(computedSortResponse.agents.length).toBe(3);
    expect(computedSortResponse.pagination.limit).toBe(3);
    expect(computedSortResponse.pagination.offset).toBe(0);
    expect(computedSortResponse.pagination.total).toBe(6);
    expect(computedSortResponse.pagination.hasMore).toBe(true);

    // Test 3: Try different computed fields to confirm the bug affects all computed sorting
    const testFields = [
      "score",
      "pnl",
      "pnlPercent",
      "change24h",
      "change24hPercent",
    ];

    for (const field of testFields) {
      const response = (await client.getCompetitionAgents(competitionId, {
        sort: field,
        limit: 2,
        offset: 0,
      })) as CompetitionAgentsResponse;

      expect(response.success).toBe(true);
      expect(response.agents.length).toBe(2);
      expect(response.pagination.limit).toBe(2);
    }

    // Test 4: Demonstrate that offset is also ignored
    const offsetResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "rank",
      limit: 2,
      offset: 3, // Should skip first 3 agents
    })) as CompetitionAgentsResponse;

    expect(offsetResponse.success).toBe(true);
    expect(offsetResponse.agents.length).toBe(2);
    expect(offsetResponse.pagination.offset).toBe(3);
    expect(offsetResponse.pagination.limit).toBe(2);
  });

  test("should combine filtering, sorting, and pagination", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with "Test" in their names
    const agents = [];
    for (let i = 1; i <= 4; i++) {
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `Test Agent ${String.fromCharCode(65 + i)}`, // Test Agent B, C, D, E
      });
      agents.push(agent);
    }

    // Register one agent without "Test" in the name
    const { agent: otherAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Different Agent",
    });

    // Start a competition with all agents
    const competitionName = `Combined Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [...agents.map((a) => a.id), otherAgent.id],
    });
    const competitionId = startResult.competition.id;

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Combined Test Client Agent",
    });

    // Test filtering by "Test", sorting by name, with pagination
    const response = (await client.getCompetitionAgents(competitionId, {
      filter: "Test",
      sort: "name",
      limit: 2,
      offset: 0,
    })) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
    expect(response.agents.length).toBe(2);
    expect(response.pagination.total).toBe(4); // Only "Test" agents
    expect(response.pagination.limit).toBe(2);
    expect(response.pagination.offset).toBe(0);
    expect(response.pagination.hasMore).toBe(true);

    // Verify filtering worked (no "Different Agent")
    const agentNames = response.agents.map((a) => a.name);
    expect(agentNames.every((name) => name.includes("Test"))).toBe(true);

    // Verify sorting worked (alphabetical order)
    expect(agentNames[0]?.localeCompare(agentNames[1] || "")).toBeLessThan(0);

    // Test second page
    const page2Response = (await client.getCompetitionAgents(competitionId, {
      filter: "Test",
      sort: "name",
      limit: 2,
      offset: 2,
    })) as CompetitionAgentsResponse;

    expect(page2Response.success).toBe(true);
    expect(page2Response.agents.length).toBe(2);
    expect(page2Response.pagination.total).toBe(4);
    expect(page2Response.pagination.hasMore).toBe(false);
  });

  test("should validate query parameters for competition agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Validation Test Agent",
    });

    // Start a competition
    const competitionName = `Validation Test Competition ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startResult.competition.id;

    // Test invalid limit (too high)
    try {
      await client.getCompetitionAgents(competitionId, {
        limit: 150, // Max is 100
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test invalid limit (too low)
    try {
      await client.getCompetitionAgents(competitionId, {
        limit: 0, // Min is 1
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test invalid offset (negative)
    try {
      await client.getCompetitionAgents(competitionId, {
        offset: -1, // Min is 0
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test valid parameters should work
    const validResponse = (await client.getCompetitionAgents(competitionId, {
      limit: 50,
      offset: 0,
      sort: "name",
      filter: "Test",
    })) as CompetitionAgentsResponse;

    expect(validResponse.success).toBe(true);
  });

  // test cases for join/leave competition functionality
  test("user can join competition on behalf of their agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Competition Join User",
      userEmail: "competition-join@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Competition Join Agent",
      "Agent for testing competition joining",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Join Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Verify initial state - agent not in competition
    const agentsBefore = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsBefore) {
      const agentInCompetition = agentsBefore.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeUndefined();
    }

    // User joins the competition on behalf of their agent
    const joinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(true);
    if ("message" in joinResponse) {
      expect(joinResponse.message).toBe("Successfully joined competition");
    }

    // Verify agent is now in the competition
    const agentsAfter = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsAfter) {
      const agentInCompetition = agentsAfter.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeDefined();
    }
  });

  test("user can leave pending competition on behalf of their agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Competition Leave User",
      userEmail: "competition-leave@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Competition Leave Agent",
      "Agent for testing competition leaving",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create and join competition
    const competitionName = `Leave Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Join the competition first
    await userClient.joinCompetition(competition.id, agent.id);

    // Verify agent is in competition
    const agentsBefore = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsBefore) {
      const agentInCompetition = agentsBefore.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeDefined();
    }

    // Leave the competition
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(true);
    if ("message" in leaveResponse) {
      expect(leaveResponse.message).toBe("Successfully left competition");
    }

    // Check per-competition status in database
    const competitionAgentRecord = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competition.id),
          eq(competitionAgents.agentId, agent.id),
        ),
      )
      .limit(1);

    expect(competitionAgentRecord.length).toBe(1);
    expect(competitionAgentRecord[0]?.status).toBe("withdrawn");
    expect(competitionAgentRecord[0]?.deactivationReason).toContain(
      "Withdrew from competition",
    );

    // Agent should NOT appear in competition agents API response (only active agents shown)
    const agentsAfter = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsAfter) {
      const agentInCompetition = agentsAfter.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeUndefined(); // Should not appear in active list
    }
  });

  test("user cannot join competition with agent they don't own", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create two Privy-authenticated users
    const { client: user1Client } = await createPrivyAuthenticatedClient({
      userName: "User 1",
      userEmail: "user1@example.com",
    });

    const { client: user2Client } = await createPrivyAuthenticatedClient({
      userName: "User 2",
      userEmail: "user2@example.com",
    });

    // User 2 creates an agent
    const createAgentResponse = await createTestAgent(
      user2Client,
      "User 2 Agent",
      "Agent owned by user 2",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent2 = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Ownership Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // User 1 tries to join with User 2's agent
    const joinResponse = await user1Client.joinCompetition(
      competition.id,
      agent2.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("do not own this agent");
    }
  });

  test("user cannot join non-pending competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a dummy user and agent to make the competition startable
    const { client: dummyUserClient } = await createPrivyAuthenticatedClient({
      userName: "Dummy User for Competition",
      userEmail: "dummy-user@example.com",
    });

    const dummyAgentResponse = await createTestAgent(
      dummyUserClient,
      "Dummy Agent",
      "Agent to make competition startable",
    );
    expect(dummyAgentResponse.success).toBe(true);
    const dummyAgent = (dummyAgentResponse as AgentProfileResponse).agent;

    // Create a Privy-authenticated user who will try to join
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Non-Pending Test User",
      userEmail: "non-pending-test@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Non-Pending Test Agent",
      "Agent for testing non-pending competition join",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Non-Pending Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Dummy user joins the competition (pre-registers)
    const dummyJoinResponse = await dummyUserClient.joinCompetition(
      competition.id,
      dummyAgent.id,
    );
    expect("success" in dummyJoinResponse && dummyJoinResponse.success).toBe(
      true,
    );

    // Start the competition with empty agentIds (will use pre-registered agent)
    const startResponse = await startExistingTestCompetition({
      adminClient,
      competitionId: competition.id,
      agentIds: [], // No agentIds - should use pre-registered dummy agent
    });
    expect(startResponse.success).toBe(true);

    // Now try to join the active competition with a different agent
    const joinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("already started/ended");
    }
  });

  test("user cannot join competition twice with same agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Duplicate Join User",
      userEmail: "duplicate-join@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Duplicate Join Agent",
      "Agent for testing duplicate join prevention",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create competition
    const competitionName = `Duplicate Join Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // First join should succeed
    const firstJoinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in firstJoinResponse && firstJoinResponse.success).toBe(
      true,
    );

    // Second join should fail
    const secondJoinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in secondJoinResponse && secondJoinResponse.success).toBe(
      false,
    );
    if ("error" in secondJoinResponse) {
      expect(secondJoinResponse.error).toContain("already actively registered");
    }
  });

  test("user cannot use deleted agent for competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Deleted Agent User",
      userEmail: "deleted-agent@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Deleted Agent",
      "Agent to be deleted for testing",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Admin deletes the agent (deleted agents should not be able to join)
    await adminClient.deleteAgent(agent.id);

    // Create a pending competition
    const competitionName = `Deleted Agent Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Try to join with deleted agent
    const joinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("not found");
    }
  });

  test("leaving active competition marks agent as left in that competition but keeps them globally active", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user with agent
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Active Leave User",
      userEmail: "active-leave@example.com",
    });

    const createAgentResponse = await createTestAgent(
      userClient,
      "Active Leave Agent",
      "Agent for testing active competition leave",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Start competition with the agent
    const competitionName = `Active Leave Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // User leaves the active competition
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(true);

    // agent should remain globally active
    const agentProfileResponse = await userClient.getUserAgent(agent.id);
    expect(agentProfileResponse.success).toBe(true);
    if ("agent" in agentProfileResponse) {
      // Agent should remain globally active
      expect(agentProfileResponse.agent.status).toBe("active");
    }

    // Verify agent is marked as "withdrawn" in the specific competition
    const competitionAgentRecord = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competition.id),
          eq(competitionAgents.agentId, agent.id),
        ),
      )
      .limit(1);

    expect(competitionAgentRecord.length).toBe(1);
    expect(competitionAgentRecord[0]?.status).toBe("withdrawn");
    expect(competitionAgentRecord[0]?.deactivationReason).toContain(
      "Withdrew from competition",
    );
    expect(competitionAgentRecord[0]?.deactivatedAt).toBeDefined();
  });

  test("user cannot leave ended competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Ended Leave User",
      userEmail: "ended-leave@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Ended Leave Agent",
      "Agent for testing ended competition leave",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Start and end competition
    const competitionName = `Ended Leave Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // End the competition
    await adminClient.endCompetition(competition.id);

    // Try to leave the ended competition
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
    if ("error" in leaveResponse) {
      // When a competition ends, we should get an error about the competition being ended
      expect(leaveResponse.error).toContain(
        "Cannot leave competition that has already ended",
      );
    }
  });

  test("user cannot join/leave non-existent competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Non-Existent Competition User",
      userEmail: "non-existent-comp@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Non-Existent Competition Agent",
      "Agent for testing non-existent competition",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Try to join non-existent competition
    const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";
    const joinResponse = await userClient.joinCompetition(
      fakeCompetitionId,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("not found");
    }

    // Try to leave non-existent competition
    const leaveResponse = await userClient.leaveCompetition(
      fakeCompetitionId,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
    if ("error" in leaveResponse) {
      expect(leaveResponse.error).toContain("not found");
    }
  });

  test("user cannot leave competition agent is not in", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Not In Competition User",
      userEmail: "not-in-comp@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Not In Competition Agent",
      "Agent for testing leave without join",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create competition (but don't join)
    const competitionName = `Not In Competition Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Try to leave competition without joining first
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
    if ("error" in leaveResponse) {
      expect(leaveResponse.error).toContain("not in this competition");
    }
  });

  test("unauthenticated requests to join/leave are rejected", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create an agent (via admin for this test)
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Unauth Test Agent",
    });

    // Create competition
    const competitionName = `Unauth Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Create unauthenticated client
    const unauthClient = createTestClient();

    // Try to join without authentication
    const joinResponse = await unauthClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);

    // Try to leave without authentication
    const leaveResponse = await unauthClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
  });

  test("agent API key authentication also works for join/leave", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user and agent (this gives us agent API key client)
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent API Key Test Agent",
      });

    // Create a pending competition
    const competitionName = `Agent API Key Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Join using agent API key authentication (fallback method)
    const joinResponse = await agentClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(true);
    if ("message" in joinResponse) {
      expect(joinResponse.message).toBe("Successfully joined competition");
    }

    // Verify agent is in the competition
    const agentsAfter = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsAfter) {
      const agentInCompetition = agentsAfter.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeDefined();
    }

    // Leave using agent API key authentication
    const leaveResponse = await agentClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(true);
    if ("message" in leaveResponse) {
      expect(leaveResponse.message).toBe("Successfully left competition");
    }
  });

  test("agent API key cannot be used with different agent ID", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const { client: agent1Client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 API Key Test",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 API Key Test",
    });

    // Create a pending competition
    const competitionName = `API Key Mismatch Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Try to join with agent1's API key but agent2's ID
    const joinResponse = await agent1Client.joinCompetition(
      competition.id,
      agent2.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("does not match agent ID in URL");
    }
  });

  describe("Competition Join Date Constraints", () => {
    test("should allow joining when current time is within join date window", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Join Window User",
        userEmail: "join-window@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Join Window Agent",
        "Agent for testing join window constraints",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with join window (past start, future end)
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `Join Window Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with join window",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Verify join dates are set correctly
      expect(competition.joinStartDate).toBe(joinStart.toISOString());
      expect(competition.joinEndDate).toBe(joinEnd.toISOString());

      // Should be able to join (current time is within window)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should reject joining when current time is before join start date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Early Join User",
        userEmail: "early-join@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Early Join Agent",
        "Agent for testing early join rejection",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with future join start date
      const now = new Date();
      const joinStart = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const joinEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

      const competitionName = `Early Join Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with future join start",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Should NOT be able to join (current time is before join start)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(false);
      if ("error" in joinResponse) {
        expect(joinResponse.error).toContain("Competition joining opens at");
        expect(joinResponse.error).toContain(joinStart.toISOString());
      }
    });

    test("should reject joining when current time is after join end date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Late Join User",
        userEmail: "late-join@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Late Join Agent",
        "Agent for testing late join rejection",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with past join end date
      const now = new Date();
      const joinStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      const joinEnd = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const competitionName = `Late Join Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with past join end",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Should NOT be able to join (current time is after join end)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(false);
      if ("error" in joinResponse) {
        expect(joinResponse.error).toContain("Competition joining closed at");
        expect(joinResponse.error).toContain(joinEnd.toISOString());
      }
    });

    test("should allow joining when only join start date is set and current time is after it", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Start Only User",
        userEmail: "start-only@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Start Only Agent",
        "Agent for testing start-only join constraint",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with only join start date (no end date)
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const competitionName = `Start Only Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with only join start date",
        joinStartDate: joinStart.toISOString(),
      });
      const competition = createResponse.competition;

      // Verify only start date is set
      expect(competition.joinStartDate).toBe(joinStart.toISOString());
      expect(competition.joinEndDate).toBeNull();

      // Should be able to join (current time is after join start, no end restriction)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should allow joining when only join end date is set and current time is before it", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "End Only User",
        userEmail: "end-only@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "End Only Agent",
        "Agent for testing end-only join constraint",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with only join end date (no start date)
      const now = new Date();
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `End Only Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with only join end date",
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Verify only end date is set
      expect(competition.joinStartDate).toBeNull();
      expect(competition.joinEndDate).toBe(joinEnd.toISOString());

      // Should be able to join (no start restriction, current time is before join end)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should maintain backward compatibility when no join dates are set", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Backward Compat User",
        userEmail: "backward-compat@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Backward Compat Agent",
        "Agent for testing backward compatibility",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with NO join dates (should work like before)
      const competitionName = `Backward Compat Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with no join date constraints",
      });
      const competition = createResponse.competition;

      // Verify no join dates are set
      expect(competition.joinStartDate).toBeNull();
      expect(competition.joinEndDate).toBeNull();

      // Should be able to join (no join date restrictions, only status check applies)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should work with admin-created competition via start competition endpoint", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents for the competition
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Agent 1",
      });

      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Start Competition User",
        userEmail: "start-competition@example.com",
      });

      const createAgentResponse = await createTestAgent(
        userClient,
        "Start Competition Agent 2",
        "Agent for testing start competition with join dates",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent2 = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with join dates and then start it
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `Start Competition Join Dates Test ${Date.now()}`;

      // First create the competition with join dates
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for start with join dates",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });

      // Then start the existing competition
      const startResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id], // Start with one agent
      });

      // Verify competition was created with join dates
      expect(startResponse.success).toBe(true);
      expect(startResponse.competition.joinStartDate).toBe(
        joinStart.toISOString(),
      );
      expect(startResponse.competition.joinEndDate).toBe(joinEnd.toISOString());

      // Even though competition is ACTIVE, agent should still be able to join if dates allow
      // (This tests that the date check happens before the status check)
      const joinResponse = await userClient.joinCompetition(
        startResponse.competition.id,
        agent2.id,
      );

      // This should fail because competition is ACTIVE, not because of join dates
      expect("success" in joinResponse && joinResponse.success).toBe(false);
      if ("error" in joinResponse) {
        expect(joinResponse.error).toContain("already started/ended");
      }
    });

    test("should work with start existing competition endpoint (join dates set at creation)", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents for the competition
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Existing Agent 1",
      });

      // Set join dates for creation
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      // Create competition in PENDING state WITH join dates
      const competitionName = `Start Existing Join Dates Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for start existing with join dates",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });

      // Start the existing competition (join dates already set at creation)
      const startResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id],
      });

      // Verify competition was started and retains join dates from creation
      expect(startResponse.success).toBe(true);
      expect(startResponse.competition.joinStartDate).toBe(
        joinStart.toISOString(),
      );
      expect(startResponse.competition.joinEndDate).toBe(joinEnd.toISOString());
      expect(startResponse.competition.status).toBe("active");
    });

    test("should validate join dates are properly included in competition response fields", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with join dates
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `Join Dates Response Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for response field validation",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });

      // Test 1: Create competition response includes join dates
      expect(createResponse.competition.joinStartDate).toBe(
        joinStart.toISOString(),
      );
      expect(createResponse.competition.joinEndDate).toBe(
        joinEnd.toISOString(),
      );

      // Test 2: Get competition details includes join dates
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Response Test Agent",
      });

      const detailResponse = await agentClient.getCompetition(
        createResponse.competition.id,
      );
      expect(detailResponse.success).toBe(true);
      if ("competition" in detailResponse) {
        expect(detailResponse.competition.joinStartDate).toBe(
          joinStart.toISOString(),
        );
        expect(detailResponse.competition.joinEndDate).toBe(
          joinEnd.toISOString(),
        );
      }

      // Test 3: Get competitions list includes join dates
      const listResponse = await agentClient.getCompetitions("pending");
      expect(listResponse.success).toBe(true);
      if ("competitions" in listResponse) {
        const foundCompetition = listResponse.competitions.find(
          (comp) => comp.id === createResponse.competition.id,
        );
        expect(foundCompetition).toBeDefined();
        expect(foundCompetition?.joinStartDate).toBe(joinStart.toISOString());
        expect(foundCompetition?.joinEndDate).toBe(joinEnd.toISOString());
      }
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
          fromToken: config.specificChainTokens.eth.usdc,
          toToken: config.specificChainTokens.eth.eth, // ETH - valuable asset
          amount: "100",
          reason: `Agent 1 winning trade ${i + 1} - buying ETH`,
        });
      }

      // Agent 2: Second best - mixed strategy (some good, some bad)
      await agent2Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth, // Good trade
        amount: "100",
        reason: "Agent 2 good trade - buying ETH",
      });
      await agent2Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Bad trade - burn tokens
        amount: "50",
        reason: "Agent 2 mediocre trade - burning some tokens",
      });

      // Agent 3: Third place - burn moderate amount
      await agent3Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "200",
        reason: "Agent 3 poor trade - burning tokens for 3rd place",
      });

      // Agent 4: Last place - burn most tokens
      await agent4Client.executeTrade({
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "500",
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
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth, // ETH - valuable asset
        amount: "200",
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
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead", // Burn address
        amount: "300",
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
        fromToken: config.specificChainTokens.eth.usdc,
        toToken: config.specificChainTokens.eth.eth,
        amount: "100",
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

  test("should get trades for a competition and for a specific agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Trade Viewer Test Agent",
      });

    // Start a competition
    const competitionName = `Trade Viewer Test Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startResponse.competition.id;

    // Execute a trade
    const tradeResponse = await agentClient.executeTrade({
      reason: "testing get trades endpoint",
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.eth,
      amount: "100",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
    });
    expect(tradeResponse.success).toBe(true);

    // Get competition trades
    const competitionTradesResponse =
      await adminClient.getCompetitionTrades(competitionId);
    expect(competitionTradesResponse.success).toBe(true);
    if (!competitionTradesResponse.success) return; // Type guard
    expect(competitionTradesResponse.trades).toBeDefined();
    expect(competitionTradesResponse.trades.length).toBe(1);
    expect(competitionTradesResponse.trades[0]?.agentId).toBe(agent.id);

    // Get agent trades in competition
    const agentTradesResponse = await adminClient.getAgentTradesInCompetition(
      competitionId,
      agent.id,
    );
    expect(agentTradesResponse.success).toBe(true);
    if (!agentTradesResponse.success) return; // Type guard
    expect(agentTradesResponse.trades).toBeDefined();
    expect(agentTradesResponse.trades.length).toBe(1);
    expect(agentTradesResponse.trades[0]?.agentId).toBe(agent.id);
  });

  describe("Participant Limits", () => {
    test("should create competition with participant limit", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 3;
      const competitionName = `Limited Competition ${Date.now()}`;

      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition with participant limit",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        maxParticipants,
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBe(maxParticipants);
    });

    test("should enforce participant limit during registration", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 2;
      const competitionName = `Limited Registration Test ${Date.now()}`;

      // Create competition with limit
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition with 2 participant limit",
        maxParticipants,
      });

      // Create multiple agents for testing
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Limit Test Agent 1",
        });

      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Limit Test Agent 2",
        });

      const { agent: agent3, client: client3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Limit Test Agent 3",
        });

      const competitionId = createResponse.competition.id;

      // Register first agent - should succeed
      const join1Result = await client1.joinCompetition(
        competitionId,
        agent1.id,
      );
      expect(join1Result.success).toBe(true);

      // Register second agent - should succeed (at limit)
      const join2Result = await client2.joinCompetition(
        competitionId,
        agent2.id,
      );
      expect(join2Result.success).toBe(true);

      // Verify that all client types get correct participant information while competition is in pending status
      // Test 1: Admin client
      const adminDetailResponse =
        await adminClient.getCompetition(competitionId);
      expect(adminDetailResponse.success).toBe(true);
      const adminCompetition = (
        adminDetailResponse as CompetitionDetailResponse
      ).competition;
      expect(adminCompetition.status).toBe("pending");
      expect(adminCompetition.maxParticipants).toBe(maxParticipants); // Max participants limit
      expect(adminCompetition.stats?.totalAgents).toBe(2); // Current registered participants
      expect(adminCompetition.registeredParticipants).toBe(2);

      // Test 2: Agent client (using agent1's client)
      const agentDetailResponse = await client1.getCompetition(competitionId);
      expect(agentDetailResponse.success).toBe(true);
      const agentCompetition = (
        agentDetailResponse as CompetitionDetailResponse
      ).competition;
      expect(agentCompetition.status).toBe("pending");
      expect(agentCompetition.maxParticipants).toBe(maxParticipants); // Max participants limit
      expect(agentCompetition.stats?.totalAgents).toBe(2); // Current registered participants
      expect(agentCompetition.registeredParticipants).toBe(2);

      // Test 3: User client (need to create one)
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Participant Count Test User",
        userEmail: "participant-test@example.com",
      });
      const userDetailResponse = await userClient.getCompetition(competitionId);
      expect(userDetailResponse.success).toBe(true);
      const userCompetition = (userDetailResponse as CompetitionDetailResponse)
        .competition;
      expect(userCompetition.status).toBe("pending");
      expect(userCompetition.maxParticipants).toBe(maxParticipants); // Max participants limit
      expect(userCompetition.stats?.totalAgents).toBe(2); // Current registered participants
      expect(userCompetition.registeredParticipants).toBe(2);

      // Try to register third agent - should fail (over limit)
      const join3Result = (await client3.joinCompetition(
        competitionId,
        agent3.id,
      )) as ErrorResponse;
      expect(join3Result.success).toBe(false);
      expect(join3Result.error).toContain("maximum participant limit");
    });

    test("should return participant count information in API responses", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 5;
      const competitionName = `Count Test Competition ${Date.now()}`;

      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition for testing participant count responses",
        maxParticipants,
      });

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Count Test Agent",
      });

      const competitionId = createResponse.competition.id;

      // Check competition details endpoint
      const detailResponse = (await agentClient.getCompetition(
        competitionId,
      )) as CompetitionDetailResponse;
      expect(detailResponse.success).toBe(true);
      expect(detailResponse.competition.maxParticipants).toBe(maxParticipants);
      expect(detailResponse.competition.registeredParticipants).toBe(0);

      // Check competitions list endpoint
      const listResponse = (await agentClient.getCompetitions(
        "pending",
      )) as UpcomingCompetitionsResponse;
      expect(listResponse.success).toBe(true);

      const competition = listResponse.competitions.find(
        (c) => c.id === competitionId,
      );
      expect(competition).toBeDefined();
      expect(competition!.maxParticipants).toBe(maxParticipants);
      expect(competition!.registeredParticipants).toBe(0);

      // Check competition agents endpoint
      const agentsResponse = (await agentClient.getCompetitionAgents(
        competitionId,
      )) as CompetitionAgentsResponse;
      expect(agentsResponse.success).toBe(true);
      expect(agentsResponse.pagination.total).toBe(0); // current participant count
    });

    test("should handle competition without participant limit", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Unlimited Competition ${Date.now()}`;

      // Test that unlimited competitions work as before
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition without participant limit",
        // maxParticipants not specified - should default to null/unlimited
      });

      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBeNull();
    });

    test("should validate participant limit minimum value", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Invalid Limit Competition ${Date.now()}`;

      // Test that maxParticipants must be >= 1 if specified
      const result = await adminClient.createCompetition({
        name: competitionName,
        description: "Competition with invalid limit",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        maxParticipants: 0,
      });

      expect(result.success).toBe(false);
    });

    test("should work with pending competitions in list view", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 3;
      const competitionName = `Pending Limit Test ${Date.now()}`;

      // Test that pending competitions show participant limits in list view
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Pending competition with participant limit",
        maxParticipants,
      });

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Pending Limit Test Agent",
      });

      const pendingCompetitions = (await agentClient.getCompetitions(
        "pending",
      )) as UpcomingCompetitionsResponse;
      expect(pendingCompetitions.success).toBe(true);

      const ourCompetition = pendingCompetitions.competitions.find(
        (c) => c.id === createResponse.competition.id,
      ) as EnhancedCompetition;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBe(maxParticipants);
      expect(ourCompetition.registeredParticipants).toBe(0);
    });

    test("should fail to register if maximum participant limit is reached", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 1;
      const competitionName = `Single Participant Test ${Date.now()}`;

      // Create competition with very low limit to test edge case
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition allowing only 1 participant",
        maxParticipants,
      });

      // Create two agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Single Slot Agent 1",
        });

      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Single Slot Agent 2",
        });

      const competitionId = createResponse.competition.id;

      // First registration should succeed
      const join1Result = await client1.joinCompetition(
        competitionId,
        agent1.id,
      );
      expect(join1Result.success).toBe(true);

      // Second registration should fail immediately
      const join2Result = (await client2.joinCompetition(
        competitionId,
        agent2.id,
      )) as ErrorResponse;
      expect(join2Result.success).toBe(false);
      expect(join2Result.error).toContain("maximum participant limit");
      expect(join2Result.error).toContain("1");

      // Verify the competition shows correct participant count
      const agentsResponse = (await client1.getCompetitionAgents(
        competitionId,
      )) as CompetitionAgentsResponse;
      expect(agentsResponse.success).toBe(true);
      expect(agentsResponse.pagination.total).toBe(1);
    });

    test("should start a competition if max == registered participants", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Test Agent",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Test Agent",
      });
      const { agent: agent3 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Test Agent",
      });

      // Create competition
      const competitionName = `Start Competition Test ${Date.now()}`;
      const maxParticipants = 2;
      const createResponse = (await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition to start",
        maxParticipants,
      })) as CreateCompetitionResponse;
      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Add 2 the agents to the competition
      const addAgentResponse1 = await adminClient.addAgentToCompetition(
        competitionId,
        agent1.id,
      );
      expect(addAgentResponse1.success).toBe(true);
      const addAgentResponse2 = await adminClient.addAgentToCompetition(
        competitionId,
        agent2.id,
      );
      expect(addAgentResponse2.success).toBe(true);

      // Attempt to add the 3rd agent
      const addAgentResponse3 = (await adminClient.addAgentToCompetition(
        competitionId,
        agent3.id,
      )) as ErrorResponse;
      expect(addAgentResponse3.success).toBe(false);
      expect(addAgentResponse3.error).toBe(
        "Competition has reached maximum participant limit (2)",
      );

      // Start the competition
      const startResponse = await adminClient.startCompetition({
        competitionId,
      });
      expect(startResponse.success).toBe(true);
    });

    test("should return maxParticipants in admin start competition response", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 3;

      // First create agents to start the competition with
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Test Agent 1",
      });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Test Agent 2",
      });

      // Create competition with maxParticipants first
      const competitionName = `Start Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description:
          "Test competition with participant limit for start endpoint",
        maxParticipants,
      });

      // Start the existing competition
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id, agent2.id],
      })) as StartCompetitionResponse;

      expect(startResponse.success).toBe(true);
      expect(startResponse.competition.maxParticipants).toBe(maxParticipants);
    });

    test("should return maxParticipants in admin end competition response", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 5;

      // Create agents and start a competition
      const { agent: agent1, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "End Test Agent 1",
        });

      // Create competition with maxParticipants first
      const competitionName = `End Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for end endpoint",
        maxParticipants,
      });

      // Start the competition
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id],
      })) as StartCompetitionResponse;

      expect(startResponse.success).toBe(true);

      // End the competition (endCompetition just returns success/error, not competition data)
      const endResponse = await adminClient.endCompetition(
        startResponse.competition.id,
      );
      expect(endResponse.success).toBe(true);

      // Verify maxParticipants is still accessible via detail endpoint after ending
      const detailAfterEnd = (await agentClient.getCompetition(
        startResponse.competition.id,
      )) as CompetitionDetailResponse;
      expect(detailAfterEnd.success).toBe(true);
      expect(detailAfterEnd.competition.maxParticipants).toBe(maxParticipants);
      expect(detailAfterEnd.competition.registeredParticipants).toBe(1);
    });

    test("should return maxParticipants and registeredParticipants in user competitions endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 4;

      // Create a Privy authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "User Competition Test",
      });

      // Create an agent for this user via Privy session
      const agentResponse = (await createTestAgent(
        userClient,
        "User Competition Agent",
        "Agent for user competition endpoint test",
      )) as AgentProfileResponse;
      expect(agentResponse.success).toBe(true);
      const agent = agentResponse.agent;

      // Create competition with maxParticipants first
      const competitionName = `User Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for user endpoint",
        maxParticipants,
      });

      // Start the competition with this agent
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      // Get user competitions
      const userCompetitionsResponse = (await userClient.getUserCompetitions({
        limit: 10,
      })) as UserCompetitionsResponse;
      expect(userCompetitionsResponse.success).toBe(true);

      // Find our competition in the results
      const ourCompetition = userCompetitionsResponse.competitions.find(
        (c) => c.id === startResponse.competition.id,
      ) as CompetitionWithAgents;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBe(maxParticipants);
      expect(ourCompetition.registeredParticipants).toBe(1);
    });

    test("should return maxParticipants and registeredParticipants in agent competitions endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 6;

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Competition Test",
        });

      // Create competition with maxParticipants first
      const competitionName = `Agent Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for agent endpoint",
        maxParticipants,
      });
      // Start the competition with this agent
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;

      expect(startResponse.success).toBe(true);

      // Get agent competitions
      const agentCompetitionsResponse = (await agentClient.getAgentCompetitions(
        agent.id,
      )) as AgentCompetitionsResponse;
      expect(agentCompetitionsResponse.success).toBe(true);

      // Find our competition in the results
      const ourCompetition = agentCompetitionsResponse.competitions.find(
        (c) => c.id === startResponse.competition.id,
      ) as EnhancedCompetition;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBe(maxParticipants);
      expect(ourCompetition.registeredParticipants).toBe(1);
    });

    test("should return maxParticipants and registeredParticipants in competitions endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Competitions Test Agent",
      });

      // Create competition
      const competitionName = `Competitions Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for competitions endpoint",
      });

      // Start the competition
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      // Get upcoming competitions
      const competitionsResponse =
        (await adminClient.getCompetitions()) as UpcomingCompetitionsResponse;
      expect(competitionsResponse.success).toBe(true);

      const ourCompetition = competitionsResponse
        .competitions[0] as EnhancedCompetition;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBeNull();
      expect(ourCompetition.registeredParticipants).toBe(1);
    });

    test("should handle null maxParticipants across all endpoints", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Null Limit Test Agent",
        });

      // Create competition without maxParticipants (should be null/unlimited)
      const competitionName = `Null Limit Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition without participant limit",
        // maxParticipants not specified - defaults to null/unlimited
      });
      const competitionId = createResponse.competition.id;
      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBeNull();

      // Test that the same null value appears in other endpoints
      const detailResponse = (await agentClient.getCompetition(
        competitionId,
      )) as CompetitionDetailResponse;
      expect(detailResponse.success).toBe(true);
      expect(detailResponse.competition.maxParticipants).toBeNull();
      expect(detailResponse.competition.registeredParticipants).toBe(0);

      // Test agent competitions endpoint
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);
      const agentCompetitionsResponse = (await agentClient.getAgentCompetitions(
        agent.id,
      )) as AgentCompetitionsResponse;
      expect(agentCompetitionsResponse.success).toBe(true);

      const ourCompetition = agentCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as EnhancedCompetition;
      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBeNull();
      expect(ourCompetition.registeredParticipants).toBe(1);

      // Test user competitions endpoint
      const userCompetitionsResponse = (await agentClient.getUserCompetitions({
        limit: 10,
      })) as UserCompetitionsResponse;
      expect(userCompetitionsResponse.success).toBe(true);

      const ourCompetition2 = userCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as CompetitionWithAgents;
      expect(ourCompetition2).toBeDefined();
      expect(ourCompetition2.maxParticipants).toBeNull();
      expect(ourCompetition2.registeredParticipants).toBe(1);

      const multipleCompetitionsResponse =
        (await agentClient.getCompetitions()) as UpcomingCompetitionsResponse;
      expect(multipleCompetitionsResponse.success).toBe(true);

      const ourCompetition3 = multipleCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as CompetitionWithAgents;
      expect(ourCompetition3).toBeDefined();
      expect(ourCompetition3.maxParticipants).toBeNull();
      expect(ourCompetition3.registeredParticipants).toBe(1);
    });

    test("should handle disqualifying agent in registeredParticipants", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Null Limit Test Agent",
        });

      // Create competition without maxParticipants (should be null/unlimited)
      const competitionName = `Null Limit Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition without participant limit",
        // maxParticipants not specified - defaults to null/unlimited
      });
      const competitionId = createResponse.competition.id;
      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBeNull();

      // Test agent competitions endpoint
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      // Remove the agent from the competition
      const removeResponse = await adminClient.removeAgentFromCompetition(
        competitionId,
        agent.id,
        "Test disqualification",
      );
      expect(removeResponse.success).toBe(true);

      // Test multiple competitions endpoint, but with zero registered participants (by DQ'ing the agent)
      const multipleCompetitionsResponse =
        (await agentClient.getCompetitions()) as UpcomingCompetitionsResponse;
      expect(multipleCompetitionsResponse.success).toBe(true);

      const ourCompetition3 = multipleCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as CompetitionWithAgents;
      expect(ourCompetition3).toBeDefined();
      expect(ourCompetition3.maxParticipants).toBeNull();
      expect(ourCompetition3.registeredParticipants).toBe(0);
    });

    test("inactive agents should have last-place rank and appear at end of list", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create 5 agents for testing
      const agents = await Promise.all([
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Alpha",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Beta",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Gamma",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Delta",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Epsilon",
        }),
      ]);

      // Create and start a competition with all 5 agents
      const agentIds = agents.map((a) => a.agent.id);
      const competitionName = `Inactive Rank Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds,
      });
      const competitionId = competitionResponse.competition.id;
      await wait(100);

      // Deactivate 2 agents (Beta and Delta)
      const betaAgentId = agentIds[1];
      const deltaAgentId = agentIds[3];
      expect(betaAgentId).toBeDefined();
      expect(deltaAgentId).toBeDefined();
      await adminClient.removeAgentFromCompetition(
        competitionId,
        betaAgentId!,
        "Test disqualification - Beta",
      );
      await adminClient.removeAgentFromCompetition(
        competitionId,
        deltaAgentId!,
        "Test disqualification - Delta",
      );

      // Fetch all agents including inactive ones, sorted by rank
      const agentsResponse = (await adminClient.getCompetitionAgents(
        competitionId,
        {
          includeInactive: true,
          sort: "rank",
        },
      )) as CompetitionAgentsResponse;

      expect(agentsResponse.success).toBe(true);
      expect(agentsResponse.agents).toBeDefined();
      expect(agentsResponse.agents.length).toBe(5);

      const fetchedAgents = agentsResponse.agents;
      const totalAgents = agentsResponse.pagination.total;

      // Verify we have 2 inactive and 3 active agents
      const inactiveAgents = fetchedAgents.filter((agent) => !agent.active);
      const activeAgents = fetchedAgents.filter((agent) => agent.active);
      expect(inactiveAgents.length).toBe(2);
      expect(activeAgents.length).toBe(3);

      // Verify agents have correct ranks
      const activeRanks = activeAgents.map((a) => a.rank).sort((a, b) => a - b);
      expect(activeRanks).toEqual([1, 2, 3]);
      for (const inactiveAgent of inactiveAgents) {
        expect(inactiveAgent.rank).toBe(totalAgents);
      }
      const inactiveAgentIds = inactiveAgents.map((a) => a.id).sort();
      expect(inactiveAgentIds).toEqual([betaAgentId, deltaAgentId].sort());
    });
  });

  describe("Participation Rules Enforcement", () => {
    test("should reject blocklisted agent from joining", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Blocked Agent",
        });

      // Create competition with blocklist
      const createResponse = await adminClient.createCompetition({
        name: "Blocklist Test Competition",
        type: "trading",
        blocklist: [agent.id],
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Try to join - should be rejected
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(false);
      expect((joinResponse as ErrorResponse).error).toContain("not permitted");
    });

    test("should reject agent when competition is allowlist-only", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create two agents
      const { agent: allowedAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Allowed Agent",
      });
      const { agent: notAllowedAgent, client: notAllowedClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Not Allowed Agent",
        });

      // Create competition with allowlist-only mode
      const createResponse = await adminClient.createCompetition({
        name: "Allowlist Only Competition",
        type: "trading",
        allowlistOnly: true,
        allowlist: [allowedAgent.id],
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Try to join with non-allowlisted agent - should be rejected
      const joinResponse = await notAllowedClient.joinCompetition(
        competitionId,
        notAllowedAgent.id,
      );

      expect(joinResponse.success).toBe(false);
      expect((joinResponse as ErrorResponse).error).toContain("allowlist-only");
    });

    test("should allow VIP agent to bypass all requirements", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent (with no rank)
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "VIP Agent",
        });

      // Create competition with VIP list, stake requirement, and rank requirement
      const createResponse = await adminClient.createCompetition({
        name: "VIP Bypass Competition",
        type: "trading",
        vips: [agent.id],
        minimumStake: 1000, // VIP should bypass this
        minRecallRank: 10, // VIP should bypass this too
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Join should succeed despite no stake and no rank
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(true);
    });

    test("should allow allowlisted agent to bypass rank requirement", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent (with no rank)
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Allowlisted Agent",
        });

      // Create competition with allowlist and rank requirement (but no stake requirement)
      const createResponse = await adminClient.createCompetition({
        name: "Allowlist Bypass Competition",
        type: "trading",
        allowlist: [agent.id],
        minRecallRank: 10, // Allowlist should bypass this
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Join should succeed despite no rank
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(true);
    });

    test("should reject agent with no rank when rank requirement exists", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "No Rank Agent",
        });

      // Create competition with rank requirement
      const createResponse = await adminClient.createCompetition({
        name: "Rank Requirement Competition",
        type: "trading",
        minRecallRank: 5, // Requires top 5 rank
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Try to join - should be rejected (agent has no rank)
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(false);
      expect((joinResponse as ErrorResponse).error).toContain(
        "has not yet established a rank",
      );
    });

    test("should allow agent to join when competition has no participation rules", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Regular Agent",
        });

      // Create competition with NO participation rules
      const createResponse = await adminClient.createCompetition({
        name: "No Rules Competition",
        type: "trading",
        // No vips, allowlist, blocklist, or minRecallRank
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Join should succeed (backward compatible)
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(true);
    });
  });
});
