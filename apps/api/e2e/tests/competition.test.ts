import axios from "axios";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { agents, competitionAgents } from "@/database/schema/core/defs.js";
import {
  AgentProfileResponse,
  AgentTrophy,
  BlockchainType,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  CreateCompetitionResponse,
  EndCompetitionResponse,
  ErrorResponse,
  LeaderboardResponse,
  StartCompetitionResponse,
  TradeResponse,
  UpcomingCompetitionsResponse,
  UserAgentApiKeyResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  VISION_TOKEN,
  cleanupTestState,
  createSiweAuthenticatedClient,
  createTestClient,
  createTestCompetition,
  looseConstraints,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";
import { wait } from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";

describe("Competition API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);
  });

  test("should start a competition with registered agents", async () => {
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
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id],
    );

    // Verify competition was started
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("active");
    expect(competition.agentIds).toContain(agent1.id);
    expect(competition.agentIds).toContain(agent2.id);
  });

  test("should create a competition without starting it", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition without starting it
    const competitionName = `Pending Competition ${Date.now()}`;
    const competitionResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );

    // Verify competition was created in PENDING state
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("pending");
    expect(competition.startDate).toBeNull();
    expect(competition.endDate).toBeNull();
  });

  test("should start an existing competition with agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Delta",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Echo",
    });

    // Create a competition without starting it
    const competitionName = `Two-Stage Competition ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );

    // Verify competition was created in PENDING state
    const pendingCompetition = createResponse.competition;
    expect(pendingCompetition).toBeDefined();
    expect(pendingCompetition.status).toBe("pending");

    // Now start the existing competition
    const startResponse = await startExistingTestCompetition(
      adminClient,
      pendingCompetition.id,
      [agent1.id, agent2.id],
    );

    // Verify competition was started
    const activeCompetition = startResponse.competition;
    expect(activeCompetition).toBeDefined();
    expect(activeCompetition.id).toBe(pendingCompetition.id);
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
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id],
    );

    const activeCompetition = startResponse.competition;
    expect(activeCompetition.status).toBe("active");

    // Try to start the same competition again
    try {
      await startExistingTestCompetition(adminClient, activeCompetition.id, [
        agent1.id,
        agent2.id,
      ]);

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
      await adminClient.startExistingCompetition(activeCompetition.id, [
        agent1.id,
        agent2.id,
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.success).toBe(false);
      expect(error.error).toContain("active");
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
    const createResponse = (await adminClient.createCompetition(
      competitionName,
      "Test competition - check trading constraints",
      CROSS_CHAIN_TRADING_TYPE.ALLOW,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        ...looseConstraints,
        // This 24 hour volume should block that trade below
        minimum24hVolumeUsd: 100000,
      },
    )) as CreateCompetitionResponse;

    const competitionResponse = await startExistingTestCompetition(
      adminClient,
      createResponse.competition.id,
      [agent.id],
    );
    expect(competitionResponse.success).toBe(true);

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      reason: "testing create comp with trading constraints",
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: VISION_TOKEN, // low 24h volume
      amount: "100",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
    });

    expect(buyTradeResponse.success).toBe(false);
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
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Agent checks competition status
    const statusResponse =
      (await agentClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusResponse.success).toBe(true);
    expect(statusResponse.competition).toBeDefined();
    expect(statusResponse.competition?.name).toBe(competitionName);
    expect(statusResponse.competition?.status).toBe("active");

    // Agent checks leaderboard
    const leaderboardResponse =
      (await agentClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();
    expect(leaderboardResponse.leaderboard).toBeInstanceOf(Array);

    // There should be one agent in the leaderboard
    expect(leaderboardResponse.leaderboard.length).toBe(1);

    // The agent should be in the leaderboard
    const agentInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry) => entry.agentName === "Agent Gamma",
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
    await startTestCompetition(
      adminClient,
      `Exclusive Competition ${Date.now()}`,
      [agentIn.id],
    );

    // Agent in competition checks status - should succeed
    const statusInResponse =
      (await agentInClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusInResponse.success).toBe(true);
    expect(statusInResponse.competition).toBeDefined();
    expect(statusInResponse.participating).toBe(true);

    // Agent not in competition checks status - should show limited competition info
    const statusOutResponse =
      (await agentOutClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusOutResponse.success).toBe(true);
    expect(statusOutResponse.active).toBe(true);
    expect(statusOutResponse.competition).toBeDefined();
    expect(statusOutResponse.competition?.id).toBeDefined();
    expect(statusOutResponse.competition?.name).toBeDefined();
    expect(statusOutResponse.competition?.status).toBeDefined();
    expect(statusOutResponse.message).toBe(
      "Your agent is not participating in this competition",
    );
    expect(statusOutResponse.participating).toBe(false);
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
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Admin checks competition status with full details
    const adminStatusResponse =
      (await adminClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(adminStatusResponse.success).toBe(true);
    expect(adminStatusResponse.active).toBe(true);
    expect(adminStatusResponse.competition).toBeDefined();
    expect(adminStatusResponse.competition?.name).toBe(competitionName);
    expect(adminStatusResponse.competition?.status).toBe("active");
    expect(adminStatusResponse.competition?.description).toBeDefined();
    expect(adminStatusResponse.competition?.externalUrl).toBeDefined();
    expect(adminStatusResponse.competition?.imageUrl).toBeDefined();
    expect(
      adminStatusResponse.competition?.crossChainTradingType,
    ).toBeDefined();
    expect(adminStatusResponse.competition?.startDate).toBeDefined();
    expect(adminStatusResponse.competition?.endDate).toBeDefined();

    // Admin checks leaderboard with no agentId
    const adminLeaderboardResponse =
      (await adminClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(adminLeaderboardResponse.success).toBe(true);
    expect(adminLeaderboardResponse.competition).toBeDefined();
    expect(adminLeaderboardResponse.leaderboard).toBeDefined();
    expect(adminLeaderboardResponse.leaderboard).toBeInstanceOf(Array);

    // There should be one agent in the leaderboard
    expect(adminLeaderboardResponse.leaderboard.length).toBe(1);
    expect(adminLeaderboardResponse.leaderboard[0]?.agentName).toBe(
      "Regular Agent",
    );

    // Admin checks competition rules
    const adminRulesResponse =
      (await adminClient.getRules()) as CompetitionRulesResponse;
    expect(adminRulesResponse.success).toBe(true);
    expect(adminRulesResponse.rules).toBeDefined();
    expect(adminRulesResponse.rules.tradingRules).toBeDefined();
    expect(adminRulesResponse.rules.rateLimits).toBeDefined();
    expect(adminRulesResponse.rules.availableChains).toBeDefined();
    expect(adminRulesResponse.rules.slippageFormula).toBeDefined();
    expect(adminRulesResponse.rules.portfolioSnapshots).toBeDefined();

    // Regular agent checks all the same endpoints to verify they work for participants too
    const agentStatusResponse =
      (await agentClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(agentStatusResponse.success).toBe(true);
    expect(agentStatusResponse.active).toBe(true);

    const agentLeaderboardResponse =
      await agentClient.getCompetitionLeaderboard();
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
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Check leaderboard to verify agent is now active
    const leaderboardResponse =
      (await adminClient.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();

    // Find the agent in the leaderboard
    const agentInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry) => entry.agentId === agent.id,
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
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );

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
    const createResponse1 = (await adminClient.createCompetition(
      comp1Name,
      "Test competition 1",
      CROSS_CHAIN_TRADING_TYPE.ALLOW,
    )) as CreateCompetitionResponse;
    const createResponse2 = (await adminClient.createCompetition(
      comp2Name,
      "Test competition 2",
      CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    )) as CreateCompetitionResponse;
    const createResponse3 = (await adminClient.createCompetition(
      comp3Name,
      "Test competition 3",
      CROSS_CHAIN_TRADING_TYPE.ALLOW,
    )) as CreateCompetitionResponse;

    // Verify all competitions were created and in PENDING state
    expect(createResponse1.competition.status).toBe("pending");
    expect(createResponse2.competition.status).toBe("pending");
    expect(createResponse3.competition.status).toBe("pending");

    // Call the new endpoint to get upcoming competitions
    const upcomingResponse =
      (await agentClient.getUpcomingCompetitions()) as UpcomingCompetitionsResponse;

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
    await startExistingTestCompetition(
      adminClient,
      createResponse1.competition.id,
      [agent.id],
    );

    // Get upcoming competitions again
    const upcomingResponseAfterStart =
      (await agentClient.getUpcomingCompetitions()) as UpcomingCompetitionsResponse;

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
    await adminClient.createCompetition(
      `Upcoming Competition ${Date.now()}`,
      "Test competition 1",
      CROSS_CHAIN_TRADING_TYPE.ALLOW,
    );

    // Call the new endpoint to get competitions sorted by start date ascending
    const ascResponse = (await agentClient.getCompetitions(
      "pending",
      "foo",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;

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
    await adminClient.createCompetition(
      comp1Name,
      "Test competition 1",
      CROSS_CHAIN_TRADING_TYPE.ALLOW,
    );
    await wait(1200);
    await adminClient.createCompetition(
      comp2Name,
      "Test competition 2",
      CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    );
    await wait(1200);
    await adminClient.createCompetition(
      comp3Name,
      "Test competition 3",
      CROSS_CHAIN_TRADING_TYPE.ALLOW,
    );

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
      await adminClient.createCompetition(
        name,
        `Test competition ${i + 1}`,
        CROSS_CHAIN_TRADING_TYPE.ALLOW,
      );
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
    const createResponse = await createTestCompetition(
      adminClient,
      createCompetitionName,
      "Test description with links",
      undefined, // sandboxMode
      externalUrl,
      imageUrl,
    );

    // Verify the fields are in the creation response
    expect(createResponse.success).toBe(true);
    expect(createResponse.competition.externalUrl).toBe(externalUrl);
    expect(createResponse.competition.imageUrl).toBe(imageUrl);

    // 2. Test starting a competition with externalUrl and imageUrl
    const startCompetitionName = `Start with Links Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      startCompetitionName,
      [agent.id],
      undefined, // sandboxMode
      externalUrl,
      imageUrl,
    );

    // Verify the fields are in the start competition response
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition.externalUrl).toBe(externalUrl);
    expect(startResponse.competition.imageUrl).toBe(imageUrl);

    // 3. Verify the fields are in the competition status response for participating agents
    const agentStatusResponse =
      (await agentClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(agentStatusResponse.success).toBe(true);
    expect(agentStatusResponse.active).toBe(true);

    if (agentStatusResponse.success && agentStatusResponse.competition) {
      expect(agentStatusResponse.competition.externalUrl).toBe(externalUrl);
      expect(agentStatusResponse.competition.imageUrl).toBe(imageUrl);
    }

    // 4. Verify the fields are in the competition leaderboard response
    const leaderboardResponse = await agentClient.getCompetitionLeaderboard();
    expect(leaderboardResponse.success).toBe(true);

    if (leaderboardResponse.success && "competition" in leaderboardResponse) {
      expect(leaderboardResponse.competition.externalUrl).toBe(externalUrl);
      expect(leaderboardResponse.competition.imageUrl).toBe(imageUrl);
    }

    // 5. Verify the fields are in the upcoming competitions endpoint for pending competitions
    // First, end the active competition
    if (startResponse.success) {
      await adminClient.endCompetition(startResponse.competition.id);
    }

    // Get upcoming competitions
    const upcomingResponse = await agentClient.getUpcomingCompetitions();

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

    const startExistingResponse = await startExistingTestCompetition(
      adminClient,
      createResponse.competition.id,
      [agent.id],
    );

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
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
      "Test competition for detail endpoint",
    );

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

      // Verify new PnL and 24h change fields are accessible to SIWE users
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
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );

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
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id, agent3.id],
    );

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

  // test cases for SIWE user authentication
  test("SIWE users can access competition details endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a SIWE-authenticated user client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Competition Detail User",
      userEmail: "siwe-competition-detail@example.com",
    });

    // Create a competition
    const competitionName = `SIWE Detail Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
      "Test competition for SIWE user access",
    );

    // Test SIWE user can get competition details by ID
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

    // Test SIWE user gets 404 for non-existent competition
    const notFoundResponse = await siweClient.getCompetition(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(notFoundResponse.success).toBe(false);
    expect((notFoundResponse as ErrorResponse).error).toContain("not found");
  });

  test("SIWE users can access competition agents endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a SIWE-authenticated user client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Competition Agents User",
      userEmail: "siwe-competition-agents@example.com",
    });

    // Register multiple agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "SIWE Test Agent One",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "SIWE Test Agent Two",
    });

    // Create and start a competition with multiple agents
    const competitionName = `SIWE Agents Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for SIWE user agents access",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Test SIWE user can get competition agents
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

      // Verify new PnL and 24h change fields are accessible to SIWE users
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

    // Test SIWE user gets 404 for non-existent competition
    const notFoundResponse = await siweClient.getCompetitionAgents(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(notFoundResponse.success).toBe(false);
    expect((notFoundResponse as ErrorResponse).error).toContain("not found");
  });

  test("SIWE users can access existing competitions endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a SIWE-authenticated user client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Competitions List User",
      userEmail: "siwe-competitions-list@example.com",
    });

    // Create several competitions in different states
    const pendingComp = await createTestCompetition(
      adminClient,
      `SIWE Pending Competition ${Date.now()}`,
    );

    // Register an agent for active competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "SIWE Active Competition Agent",
    });

    const activeComp = await startTestCompetition(
      adminClient,
      `SIWE Active Competition ${Date.now()}`,
      [agent.id],
    );

    // Test SIWE user can get pending competitions
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

    // Test SIWE user can get active competitions
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

    // Test SIWE user can use sorting
    const sortedResponse = await siweClient.getCompetitions(
      "pending",
      "createdAt",
    );
    expect(sortedResponse.success).toBe(true);
    expect(
      (sortedResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();
  });

  test("SIWE users have same access as agent API key users for competition endpoints", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a SIWE-authenticated user client
    const { client: siweClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Access Comparison User",
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
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );

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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id],
    );
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id],
    );
    const competitionId = startResult.competition.id;

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

    // Get the total trade values
    const allTrades = [trades1, trades2, trades3] as TradeResponse[];
    const totalVolume = allTrades.reduce(
      (acc, trade) => acc + (trade.transaction.tradeAmountUsd ?? 0),
      0,
    );
    const { competition } = (await client1.getCompetition(
      competitionId,
    )) as CompetitionDetailResponse;
    const stats = competition.stats;
    expect(stats).toBeDefined();
    expect(stats?.totalTrades).toBe(3);
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      agents.map((a) => a.id),
    );
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [alphaAgent.id, betaAgent.id, gammaAgent.id],
    );
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [charlieAgent.id, alphaAgent.id, betaAgent.id],
    );
    const competitionId = startResult.competition.id;

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Sort Test Client Agent",
    });
    // Force a snapshot directly
    const services = new ServiceRegistry();
    await services.portfolioSnapshotter.takePortfolioSnapshots(competitionId);

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

    // Test sorting by vote count (ascending)
    const voteCountAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "voteCount",
      },
    )) as CompetitionAgentsResponse;
    expect(voteCountAscResponse.success).toBe(true);
    expect(voteCountAscResponse.agents[0]!.voteCount).toBeGreaterThanOrEqual(
      voteCountAscResponse.agents[1]!.voteCount,
    );
    expect(voteCountAscResponse.agents[1]!.voteCount).toBeGreaterThanOrEqual(
      voteCountAscResponse.agents[2]!.voteCount,
    );

    // Test sorting by vote count (descending)
    const voteCountDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-voteCount",
      },
    )) as CompetitionAgentsResponse;
    expect(voteCountDescResponse.success).toBe(true);
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      agents.map((a) => a.id),
    );
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
      "voteCount",
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [...agents.map((a) => a.id), otherAgent.id],
    );
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
    const startResult = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Competition Join User",
      userEmail: "competition-join@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Competition Join Agent",
      "Agent for testing competition joining",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Join Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Competition Leave User",
      userEmail: "competition-leave@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Competition Leave Agent",
      "Agent for testing competition leaving",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create and join competition
    const competitionName = `Leave Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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

    // Create two SIWE-authenticated users
    const { client: user1Client } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "User 1",
      userEmail: "user1@example.com",
    });

    const { client: user2Client } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "User 2",
      userEmail: "user2@example.com",
    });

    // User 2 creates an agent
    const createAgentResponse = await user2Client.createAgent(
      "User 2 Agent",
      "Agent owned by user 2",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent2 = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Ownership Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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
    const { client: dummyUserClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Dummy User for Competition",
      userEmail: "dummy-user@example.com",
    });

    const dummyAgentResponse = await dummyUserClient.createAgent(
      "Dummy Agent",
      "Agent to make competition startable",
    );
    expect(dummyAgentResponse.success).toBe(true);
    const dummyAgent = (dummyAgentResponse as AgentProfileResponse).agent;

    // Create a SIWE-authenticated user who will try to join
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Non-Pending Test User",
      userEmail: "non-pending-test@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Non-Pending Test Agent",
      "Agent for testing non-pending competition join",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Non-Pending Test ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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
    const startResponse = await startExistingTestCompetition(
      adminClient,
      competition.id,
      [], // No agentIds - should use pre-registered dummy agent
    );
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Duplicate Join User",
      userEmail: "duplicate-join@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Duplicate Join Agent",
      "Agent for testing duplicate join prevention",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create competition
    const competitionName = `Duplicate Join Test ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Deleted Agent User",
      userEmail: "deleted-agent@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Deleted Agent",
      "Agent to be deleted for testing",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Admin deletes the agent (deleted agents should not be able to join)
    await adminClient.deleteAgent(agent.id);

    // Create a pending competition
    const competitionName = `Deleted Agent Test ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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

    // Create a SIWE-authenticated user with agent
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Active Leave User",
      userEmail: "active-leave@example.com",
    });

    const createAgentResponse = await userClient.createAgent(
      "Active Leave Agent",
      "Agent for testing active competition leave",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Start competition with the agent
    const competitionName = `Active Leave Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Ended Leave User",
      userEmail: "ended-leave@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Ended Leave Agent",
      "Agent for testing ended competition leave",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Start and end competition
    const competitionName = `Ended Leave Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Non-Existent Competition User",
      userEmail: "non-existent-comp@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
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

    // Create a SIWE-authenticated user
    const { client: userClient } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Not In Competition User",
      userEmail: "not-in-comp@example.com",
    });

    // User creates an agent
    const createAgentResponse = await userClient.createAgent(
      "Not In Competition Agent",
      "Agent for testing leave without join",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create competition (but don't join)
    const competitionName = `Not In Competition Test ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
    );
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

      // Create a SIWE-authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Join Window User",
        userEmail: "join-window@example.com",
      });

      // User creates an agent
      const createAgentResponse = await userClient.createAgent(
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
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition with join window",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        joinEnd.toISOString(),
      );
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

      // Create a SIWE-authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Early Join User",
        userEmail: "early-join@example.com",
      });

      // User creates an agent
      const createAgentResponse = await userClient.createAgent(
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
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition with future join start",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        joinEnd.toISOString(),
      );
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

      // Create a SIWE-authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Late Join User",
        userEmail: "late-join@example.com",
      });

      // User creates an agent
      const createAgentResponse = await userClient.createAgent(
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
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition with past join end",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        joinEnd.toISOString(),
      );
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

      // Create a SIWE-authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Start Only User",
        userEmail: "start-only@example.com",
      });

      // User creates an agent
      const createAgentResponse = await userClient.createAgent(
        "Start Only Agent",
        "Agent for testing start-only join constraint",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with only join start date (no end date)
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const competitionName = `Start Only Test ${Date.now()}`;
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition with only join start date",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        undefined, // joinEndDate (null)
      );
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

      // Create a SIWE-authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "End Only User",
        userEmail: "end-only@example.com",
      });

      // User creates an agent
      const createAgentResponse = await userClient.createAgent(
        "End Only Agent",
        "Agent for testing end-only join constraint",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with only join end date (no start date)
      const now = new Date();
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `End Only Test ${Date.now()}`;
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition with only join end date",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // joinStartDate (null)
        joinEnd.toISOString(),
      );
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

      // Create a SIWE-authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Backward Compat User",
        userEmail: "backward-compat@example.com",
      });

      // User creates an agent
      const createAgentResponse = await userClient.createAgent(
        "Backward Compat Agent",
        "Agent for testing backward compatibility",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with NO join dates (should work like before)
      const competitionName = `Backward Compat Test ${Date.now()}`;
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition with no join date constraints",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // joinStartDate (null)
        undefined, // joinEndDate (null)
      );
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

      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Start Competition User",
        userEmail: "start-competition@example.com",
      });

      const createAgentResponse = await userClient.createAgent(
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
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition for start with join dates",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        joinEnd.toISOString(),
      );

      // Then start the existing competition
      const startResponse = await startExistingTestCompetition(
        adminClient,
        createResponse.competition.id,
        [agent1.id], // Start with one agent
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
      );

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
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition for start existing with join dates",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        joinEnd.toISOString(),
      );

      // Start the existing competition (join dates already set at creation)
      const startResponse = await startExistingTestCompetition(
        adminClient,
        createResponse.competition.id,
        [agent1.id],
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
      );

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
      const createResponse = await createTestCompetition(
        adminClient,
        competitionName,
        "Test competition for response field validation",
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // votingStartDate
        undefined, // votingEndDate
        joinStart.toISOString(),
        joinEnd.toISOString(),
      );

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
      await createTestCompetition(adminClient, "Public Test Competition");

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
      const { competition } = await createTestCompetition(
        adminClient,
        "Public Test Competition Details",
      );

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

      const { competition } = await startTestCompetition(
        adminClient,
        "Public Competition with Agents",
        [agent.id],
      );

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

    test("should return 404 for non-existent competition in public endpoints", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Test all three public endpoints with non-existent ID
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
    });

    test("protected endpoints should still require authentication", async () => {
      const protectedEndpoints = [
        "/api/competitions/leaderboard",
        "/api/competitions/status",
        "/api/competitions/rules",
        "/api/competitions/upcoming",
      ];

      // Test each protected endpoint without authentication
      for (const endpoint of protectedEndpoints) {
        await expect(
          axios.get(`${getBaseUrl()}${endpoint}`),
        ).rejects.toMatchObject({
          response: { status: 401 },
        });
      }
    });

    test("join/leave competition endpoints should still require authentication", async () => {
      // Setup: Create test competition and agent
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Protected Test Agent",
      });

      const { competition } = await createTestCompetition(
        adminClient,
        "Protected Test Competition",
      );

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
      const createCompResult = await adminClient.createCompetition(
        competitionName,
        "Competition for testing trophy ranking logic",
      );
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition(competitionId, [
        agent1.id,
        agent2.id,
        agent3.id,
        agent4.id,
      ]);

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

      console.log("Trophy test results:", {
        agent1: { rank: agent1Trophy?.rank, name: agent1Trophy?.name },
        agent2: { rank: agent2Trophy?.rank, name: agent2Trophy?.name },
        agent3: { rank: agent3Trophy?.rank, name: agent3Trophy?.name },
        agent4: { rank: agent4Trophy?.rank, name: agent4Trophy?.name },
      });
    });

    test("should populate trophies correctly via user-specific endpoints (SIWE)", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create SIWE authenticated user with agents
      const { client: user1Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Trophy User 1",
        userEmail: "trophy-user-1@example.com",
      });

      const { client: user2Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Trophy User 2",
        userEmail: "trophy-user-2@example.com",
      });

      // Create agents for each user
      const agent1Response = await user1Client.createAgent(
        "User 1 Gold Agent",
        "Agent designed to win 1st place for User 1",
      );
      expect(agent1Response.success).toBe(true);
      const agent1 = (agent1Response as AgentProfileResponse).agent;

      const agent2Response = await user2Client.createAgent(
        "User 2 Silver Agent",
        "Agent designed to get 2nd place for User 2",
      );
      expect(agent2Response.success).toBe(true);
      const agent2 = (agent2Response as AgentProfileResponse).agent;

      // Create and start competition
      const competitionName = `User Trophy Test ${Date.now()}`;
      const createCompResult = await adminClient.createCompetition(
        competitionName,
        "Competition for testing user trophy endpoints",
      );
      expect(createCompResult.success).toBe(true);
      const competitionId = (createCompResult as CreateCompetitionResponse)
        .competition.id;

      await adminClient.startExistingCompetition(competitionId, [
        agent1.id,
        agent2.id,
      ]);

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

      console.log("User endpoint trophy test results:", {
        user1AgentTrophy: { rank: user1Trophy?.rank, name: user1Trophy?.name },
        user2AgentTrophy: { rank: user2Trophy?.rank, name: user2Trophy?.name },
        user1SpecificTrophy: {
          rank: user1SpecificTrophy?.rank,
          name: user1SpecificTrophy?.name,
        },
      });
    });

    test("should handle user with no competitions via user endpoints", async () => {
      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "No Trophies User",
        userEmail: "no-trophies-user@example.com",
      });

      // Create agent but don't put them in any competitions
      const agentResponse = await userClient.createAgent(
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
      const createResult = await adminClient.createCompetition(
        competitionName,
        "Test active competition",
      );
      expect(createResult.success).toBe(true);
      if (!createResult.success)
        throw new Error("Failed to create competition");
      const competitionId = createResult.competition.id;

      await adminClient.startExistingCompetition(competitionId, [agent.id]);

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
  });
});
