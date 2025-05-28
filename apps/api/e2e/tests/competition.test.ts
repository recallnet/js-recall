import axios from "axios";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";
import {
  AgentProfileResponse,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  CreateCompetitionResponse,
  EndCompetitionResponse,
  LeaderboardResponse,
  UpcomingCompetitionsResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  createTestCompetition,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";
import { wait } from "@/e2e/utils/test-helpers.js";

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
      (await agentClient.getLeaderboard()) as LeaderboardResponse;
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
      (await adminClient.getLeaderboard()) as LeaderboardResponse;
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

    const agentLeaderboardResponse = await agentClient.getLeaderboard();
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
      (await adminClient.getLeaderboard()) as LeaderboardResponse;
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

  test("agents are deactivated when a competition ends", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent To Deactivate",
      });

    // Start a competition with the agent
    const competitionName = `Deactivation Test ${Date.now()}`;
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

    // Wait a moment for deactivation to process
    await wait(100);

    // Agent should now be deactivated and unable to access endpoints
    try {
      await agentClient.getAgentProfile();
      // Should not reach here if properly deactivated
      expect(false).toBe(true);
    } catch (error) {
      // Expect error due to inactive status
      expect(error).toBeDefined();
    }

    // Verify through database that agent is deactivated
    const agentRecord = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agent.id))
      .limit(1);

    expect(agentRecord.length).toBe(1);
    expect(agentRecord[0]?.status).toBe("inactive");
    expect(agentRecord[0]?.deactivationReason).toMatch(/Competition .+ ended/);
    expect(agentRecord[0]?.deactivationDate).toBeDefined();
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
    const leaderboardResponse = await agentClient.getLeaderboard();
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
});
