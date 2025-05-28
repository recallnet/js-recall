import axios from "axios";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";
import {
  AgentProfileResponse,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  CreateCompetitionResponse,
  CrossChainTradingType,
  EndCompetitionResponse,
  ErrorResponse,
  LeaderboardResponse,
  StartCompetitionResponse,
  UpcomingCompetitionsResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createSiweAuthenticatedClient,
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
    expect(adminStatusResponse.competition?.externalLink).toBeDefined();
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
      CrossChainTradingType.allow,
    )) as CreateCompetitionResponse;
    const createResponse2 = (await adminClient.createCompetition(
      comp2Name,
      "Test competition 2",
      CrossChainTradingType.disallowAll,
    )) as CreateCompetitionResponse;
    const createResponse3 = (await adminClient.createCompetition(
      comp3Name,
      "Test competition 3",
      CrossChainTradingType.allow,
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
      CrossChainTradingType.allow,
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
      CrossChainTradingType.allow,
    );
    await wait(1200);
    await adminClient.createCompetition(
      comp2Name,
      "Test competition 2",
      CrossChainTradingType.disallowAll,
    );
    await wait(1200);
    await adminClient.createCompetition(
      comp3Name,
      "Test competition 3",
      CrossChainTradingType.allow,
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

  test("competitions include externalLink and imageUrl fields", async () => {
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
    const externalLink = "https://example.com/competition-details";
    const imageUrl = "https://example.com/competition-image.jpg";

    // 1. Test creating a competition with externalLink and imageUrl
    const createCompetitionName = `Create with Links Test ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      createCompetitionName,
      "Test description with links",
      externalLink,
      imageUrl,
    );

    // Verify the fields are in the creation response
    expect(createResponse.success).toBe(true);
    expect(createResponse.competition.externalLink).toBe(externalLink);
    expect(createResponse.competition.imageUrl).toBe(imageUrl);

    // 2. Test starting a competition with externalLink and imageUrl
    const startCompetitionName = `Start with Links Test ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      startCompetitionName,
      [agent.id],
      externalLink,
      imageUrl,
    );

    // Verify the fields are in the start competition response
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition.externalLink).toBe(externalLink);
    expect(startResponse.competition.imageUrl).toBe(imageUrl);

    // 3. Verify the fields are in the competition status response for participating agents
    const agentStatusResponse =
      (await agentClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(agentStatusResponse.success).toBe(true);
    expect(agentStatusResponse.active).toBe(true);

    if (agentStatusResponse.success && agentStatusResponse.competition) {
      expect(agentStatusResponse.competition.externalLink).toBe(externalLink);
      expect(agentStatusResponse.competition.imageUrl).toBe(imageUrl);
    }

    // 4. Verify the fields are in the competition leaderboard response
    const leaderboardResponse = await agentClient.getLeaderboard();
    expect(leaderboardResponse.success).toBe(true);

    if (leaderboardResponse.success && "competition" in leaderboardResponse) {
      expect(leaderboardResponse.competition.externalLink).toBe(externalLink);
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
        expect(pendingCompetition.externalLink).toBe(externalLink);
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
    expect(startExistingResponse.competition.externalLink).toBe(externalLink);
    expect(startExistingResponse.competition.imageUrl).toBe(imageUrl);
  });

  // New test cases for GET /competitions/{competitionId}
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
      tradingType: CrossChainTradingType.disallowAll,
      externalLink: "https://example.com",
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
    expect(competitionDetail.externalLink).toBe("https://example.com");
    expect(competitionDetail.imageUrl).toBe("https://example.com/image.png");
    expect(competitionDetail.createdAt).toBeDefined();
    expect(competitionDetail.updatedAt).toBeDefined();
    expect(competitionDetail.startDate).toBeDefined();
    expect(competitionDetail.endDate).toBeNull();
  });

  // New test cases for GET /competitions/{competitionId}/agents
  test("should get competition agents with scores and positions", async () => {
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
      tradingType: CrossChainTradingType.disallowAll,
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
      expect(typeof agent.position).toBe("number");
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

    // Verify agents are ordered by position
    const positions = agentsData.agents.map((a) => a.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
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

    // Verify positions are sequential
    agentsResponse.agents.forEach((agent, index) => {
      expect(agent.position).toBe(index + 1);

      // Verify all required fields are present and have correct types
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.name).toBe("string");
      expect(typeof agent.score).toBe("number");
      expect(typeof agent.position).toBe("number");
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

  // New test cases for SIWE user authentication
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
      tradingType: CrossChainTradingType.disallowAll,
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
      expect(typeof agent.position).toBe("number");
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
    expect(typeof agentData.position).toBe("number");
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
      sort: "name_desc",
    })) as CompetitionAgentsResponse;

    expect(nameDescResponse.success).toBe(true);
    expect(nameDescResponse.agents.length).toBe(3);

    const nameDescOrder = nameDescResponse.agents.map((a) => a.name);
    expect(nameDescOrder[0]).toBe("Charlie Sort Agent");
    expect(nameDescOrder[1]).toBe("Beta Sort Agent");
    expect(nameDescOrder[2]).toBe("Alpha Sort Agent");

    // Test sorting by position (default)
    const positionResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "position",
    })) as CompetitionAgentsResponse;

    expect(positionResponse.success).toBe(true);
    expect(positionResponse.agents.length).toBe(3);

    // Verify positions are in ascending order
    const positions = positionResponse.agents.map((a) => a.position);
    expect(positions).toEqual([1, 2, 3]);
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
});
