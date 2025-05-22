import axios from "axios";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/database/db.js";
import { teams } from "@/database/schema/core/defs.js";
import {
  Competition,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  CreateCompetitionResponse,
  CrossChainTradingType,
  EndCompetitionResponse,
  LeaderboardResponse,
  TeamProfileResponse,
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
  registerTeamAndGetClient,
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

  test("should start a competition with registered teams", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams
    const { team: team1 } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Alpha",
    );
    const { team: team2 } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Beta",
    );

    // Start a competition
    const competitionName = `Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [team1.id, team2.id],
    );

    // Verify competition was started
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("active");
    expect(competition.teamIds).toContain(team1.id);
    expect(competition.teamIds).toContain(team2.id);
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

  test("should start an existing competition with teams", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams
    const { team: team1 } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Delta",
    );
    const { team: team2 } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Echo",
    );

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
      [team1.id, team2.id],
    );

    // Verify competition was started
    const activeCompetition = startResponse.competition;
    expect(activeCompetition).toBeDefined();
    expect(activeCompetition.id).toBe(pendingCompetition.id);
    expect(activeCompetition.name).toBe(competitionName);
    expect(activeCompetition.status).toBe("active");
    expect(activeCompetition.startDate).toBeDefined();
    expect(activeCompetition.teamIds).toContain(team1.id);
    expect(activeCompetition.teamIds).toContain(team2.id);
  });

  test("should not allow starting a non-pending competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams
    const { team: team1 } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Foxtrot",
    );
    const { team: team2 } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Golf",
    );

    // Create and start a competition
    const competitionName = `Already Active Competition ${Date.now()}`;
    const startResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [team1.id],
    );

    const activeCompetition = startResponse.competition;
    expect(activeCompetition.status).toBe("active");

    // Try to start the same competition again
    try {
      await startExistingTestCompetition(adminClient, activeCompetition.id, [
        team1.id,
        team2.id,
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
        team1.id,
        team2.id,
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.success).toBe(false);
      expect(error.error).toContain("active");
    }
  });

  test("teams can view competition status and leaderboard", async () => {
    // Setup admin client and register a team
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Team Gamma",
    );

    // Admin starts a competition with the team
    const competitionName = `Viewable Competition ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Team checks competition status
    const statusResponse =
      (await teamClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusResponse.success).toBe(true);
    expect(statusResponse.competition).toBeDefined();
    expect(statusResponse.competition?.name).toBe(competitionName);
    expect(statusResponse.competition?.status).toBe("active");

    // Team checks leaderboard
    const leaderboardResponse =
      (await teamClient.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();
    expect(leaderboardResponse.leaderboard).toBeInstanceOf(Array);

    // There should be one team in the leaderboard
    expect(leaderboardResponse.leaderboard.length).toBe(1);

    // The team should be in the leaderboard
    const teamInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry) => entry.teamName === "Team Gamma",
    );
    expect(teamInLeaderboard).toBeDefined();
  });

  test("teams receive basic information for competitions they are not part of", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams - one in the competition, one not
    const { client: teamInClient, team: teamIn } =
      await registerTeamAndGetClient(adminApiKey, "Inside Team");
    const { client: teamOutClient } = await registerTeamAndGetClient(
      adminApiKey,
      "Outside Team",
    );

    // Start a competition with only one team
    await startTestCompetition(
      adminClient,
      `Exclusive Competition ${Date.now()}`,
      [teamIn.id],
    );

    // Team in competition checks status - should succeed
    const statusInResponse =
      (await teamInClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusInResponse.success).toBe(true);
    expect(statusInResponse.competition).toBeDefined();
    expect(statusInResponse.participating).toBe(true);

    // Team not in competition checks status - should show limited competition info
    const statusOutResponse =
      (await teamOutClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusOutResponse.success).toBe(true);
    expect(statusOutResponse.active).toBe(true);
    expect(statusOutResponse.competition).toBeDefined();
    expect(statusOutResponse.competition?.id).toBeDefined();
    expect(statusOutResponse.competition?.name).toBeDefined();
    expect(statusOutResponse.competition?.status).toBeDefined();
    expect(statusOutResponse.message).toBe(
      "Your team is not participating in this competition",
    );
    expect(statusOutResponse.participating).toBeUndefined();
  });

  test("admin can access competition endpoints without being a participant", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a regular team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Regular Team",
    );

    // Start a competition with only the regular team (admin is not a participant)
    const competitionName = `Admin Access Test Competition ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Admin checks competition status
    const adminStatusResponse =
      (await adminClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(adminStatusResponse.success).toBe(true);
    expect(adminStatusResponse.active).toBe(true);
    expect(adminStatusResponse.competition).toBeDefined();
    expect(adminStatusResponse.competition?.name).toBe(competitionName);
    expect(adminStatusResponse.competition?.status).toBe("active");

    // Admin checks leaderboard
    const adminLeaderboardResponse =
      (await adminClient.getLeaderboard()) as LeaderboardResponse;
    expect(adminLeaderboardResponse.success).toBe(true);
    expect(adminLeaderboardResponse.competition).toBeDefined();
    expect(adminLeaderboardResponse.leaderboard).toBeDefined();
    expect(adminLeaderboardResponse.leaderboard).toBeInstanceOf(Array);

    // There should be one team in the leaderboard
    expect(adminLeaderboardResponse.leaderboard.length).toBe(1);
    expect(adminLeaderboardResponse.leaderboard[0]?.teamName).toBe(
      "Regular Team",
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

    // Regular team checks all the same endpoints to verify they work for participants too
    const teamStatusResponse =
      (await teamClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(teamStatusResponse.success).toBe(true);
    expect(teamStatusResponse.active).toBe(true);

    const teamLeaderboardResponse = await teamClient.getLeaderboard();
    expect(teamLeaderboardResponse.success).toBe(true);

    // Regular team checks rules
    const teamRulesResponse = await teamClient.getRules();
    expect(teamRulesResponse.success).toBe(true);
  });

  test("teams are activated when added to a competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team - should be inactive by default
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Team To Activate",
    );

    // Team should not be able to access restricted endpoints when inactive
    try {
      await teamClient.getProfile();
      // Should not reach here if properly inactive
      expect(false).toBe(true);
    } catch (error) {
      // Expect error due to inactive status
      expect(error).toBeDefined();
    }

    // Start a competition with the team
    const competitionName = `Activation Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Check leaderboard to verify team is now active
    const leaderboardResponse =
      (await adminClient.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();

    // Find the team in the leaderboard
    const teamInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry) => entry.teamId === team.id,
    );
    expect(teamInLeaderboard).toBeDefined();
    expect(teamInLeaderboard?.active).toBe(true);

    // Team should now be able to access endpoints
    const profileResponse =
      (await teamClient.getProfile()) as TeamProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.team).toBeDefined();
  });

  test("teams are deactivated when a competition ends", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Team To Deactivate",
    );

    // Start a competition with the team
    const competitionName = `Deactivation Test ${Date.now()}`;
    const competition = await startTestCompetition(
      adminClient,
      competitionName,
      [team.id],
    );

    // Team should be able to access endpoints while competition is active
    const profileResponse =
      (await teamClient.getProfile()) as TeamProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.team).toBeDefined();

    // End the competition
    const endResponse = (await adminClient.endCompetition(
      competition.competition.id,
    )) as EndCompetitionResponse;
    expect(endResponse.success).toBe(true);
    expect(endResponse.competition.status).toBe("completed");

    // Give a small delay for deactivation to complete
    await wait(500);
    const dbResult = await db.query.teams.findFirst({
      where: eq(teams.id, team.id),
    });

    // Verify team is marked as inactive in the database
    expect(dbResult).toBeDefined();
    expect(dbResult?.active).toBe(false);
    expect(dbResult?.deactivationReason).toContain("Competition");

    // Team should no longer be able to access restricted endpoints
    try {
      await teamClient.getProfile();
      // Should not reach here if properly inactive
      expect(false).toBe(true);
    } catch (error) {
      // Expect error due to inactive status
      expect(error).toBeDefined();
    }
  });

  test("creating competition with cross-chain trading parameter", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Cross-Chain Test Team",
    );

    // Create and start competition with cross-chain trading enabled
    const competitionName = `Cross-Chain Competition ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      teamIds: [team.id],
      tradingType: CrossChainTradingType.allow,
    });

    expect(competitionResponse.success).toBe(true);

    // Check competition status to verify it was created
    const statusResponse = await teamClient.getCompetitionStatus();
    expect(statusResponse.success).toBe(true);

    if (statusResponse.success && statusResponse.competition) {
      expect(statusResponse.competition.name).toBe(competitionName);
    }

    // Check competition rules to verify cross-chain trading is enabled
    const rulesResponse = await teamClient.getRules();
    expect(rulesResponse.success).toBe(true);

    // Verify cross-chain trading setting in rules
    if (rulesResponse.success && rulesResponse.rules) {
      expect(rulesResponse.rules.tradingRules).toBeDefined();

      // Find the cross-chain trading rule
      const crossChainRule = rulesResponse.rules.tradingRules.find(
        (rule: string) => rule.includes("Cross-chain trading"),
      );
      expect(crossChainRule).toBeDefined();
      expect(crossChainRule).toContain("Cross-chain trading type: allow");
    }

    // Create second competition with cross-chain trading disabled
    const secondCompetitionName = `No-Cross-Chain Competition ${Date.now()}`;

    // End the first competition
    if (competitionResponse.success && "competition" in competitionResponse) {
      await adminClient.endCompetition(competitionResponse.competition.id);

      // Start a new competition with cross-chain trading disabled
      const secondCompetitionResponse = await adminClient.startCompetition({
        name: secondCompetitionName,
        teamIds: [team.id],
        tradingType: CrossChainTradingType.disallowAll,
      });

      expect(secondCompetitionResponse.success).toBe(true);

      // Check competition rules to verify cross-chain trading is disabled
      const secondRulesResponse = await teamClient.getRules();
      expect(secondRulesResponse.success).toBe(true);

      // Verify cross-chain trading setting in rules
      if (secondRulesResponse.success && secondRulesResponse.rules) {
        // Find the cross-chain trading rule
        const secondCrossChainRule =
          secondRulesResponse.rules.tradingRules.find((rule: string) =>
            rule.includes("Cross-chain trading"),
          );
        expect(secondCrossChainRule).toBeDefined();
        expect(secondCrossChainRule).toContain(
          "Cross-chain trading type: disallowAll",
        );
      }
    }
  });

  test("competition responses include crosschaintradingtype property", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team
    const { team } = await registerTeamAndGetClient(
      adminApiKey,
      "Response Fields Test Team",
    );

    // 1. Test creating a competition with allowCrossChainTrading=true
    const createCompetitionName = `Create Fields Test ${Date.now()}`;
    const createResponse = await adminClient.createCompetition(
      createCompetitionName,
      "Test description",
      CrossChainTradingType.allow,
    );

    expect(createResponse.success).toBe(true);
    if (createResponse.success && "competition" in createResponse) {
      expect(createResponse.competition).toBeDefined();
      expect(createResponse.competition.crossChainTradingType).toBe(
        CrossChainTradingType.allow,
      );
    }

    // 2. Test starting a competition with allowCrossChainTrading=false
    const startCompetitionName = `Start Fields Test ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: startCompetitionName,
      teamIds: [team.id],
      tradingType: CrossChainTradingType.disallowAll,
    });

    expect(startResponse.success).toBe(true);
    if (startResponse.success && "competition" in startResponse) {
      expect(startResponse.competition).toBeDefined();
      expect(startResponse.competition.crossChainTradingType).toBe(
        CrossChainTradingType.disallowAll,
      );

      // 3. Test ending a competition and check field is preserved
      const endResponse = await adminClient.endCompetition(
        startResponse.competition.id,
      );

      expect(endResponse.success).toBe(true);
      if (endResponse.success && "competition" in endResponse) {
        const competition = endResponse.competition as Competition;
        expect(competition).toBeDefined();
        expect(competition.crossChainTradingType).toBe(
          CrossChainTradingType.disallowAll,
        );
      }
    }

    // 4. Verify competition status endpoint also includes the property
    const statusResponse = await adminClient.getCompetitionStatus();

    if (statusResponse.success && statusResponse.competition) {
      expect(statusResponse.competition.crossChainTradingType).toBeDefined();
    }

    // 5. Get performance reports - use helper function because the API client doesn't have this method directly
    if (startResponse.success && "competition" in startResponse) {
      const reportsUrl = `/api/admin/reports/performance?competitionId=${startResponse.competition.id}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reportsResponse = await adminClient.request<any>("get", reportsUrl);

      if (reportsResponse.success && "competition" in reportsResponse) {
        const competition = reportsResponse.competition as Competition;
        expect(competition.crossChainTradingType).toBeDefined();
      }
    }
  });

  test("teams can view upcoming competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team
    const { client: teamClient } = await registerTeamAndGetClient(
      adminApiKey,
      "Upcoming Viewer Team",
    );

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
      (await teamClient.getUpcomingCompetitions()) as UpcomingCompetitionsResponse;
console.log("\n\n\n\n");
console.log("upcoming response: ", upcomingResponse);
console.log("\n\n\n\n");
    // Verify the response
    expect(upcomingResponse.success).toBe(true);
    expect(upcomingResponse.competitions).toBeDefined();
    expect(Array.isArray(upcomingResponse.competitions)).toBe(true);

    // At least our 3 competitions should be there (there might be others from previous tests)
    expect(upcomingResponse.competitions.length).toBeGreaterThanOrEqual(3);

    // Verify our competitions are in the response
    const foundComp1 = upcomingResponse.competitions.some(
      (comp) => comp.name === comp1Name && comp.status === "pending",
    );
    const foundComp2 = upcomingResponse.competitions.some(
      (comp) => comp.name === comp2Name && comp.status === "pending",
    );
    const foundComp3 = upcomingResponse.competitions.some(
      (comp) => comp.name === comp3Name && comp.status === "pending",
    );

    expect(foundComp1).toBe(true);
    expect(foundComp2).toBe(true);
    expect(foundComp3).toBe(true);

    // Verify each competition has all expected fields
    upcomingResponse.competitions.forEach((comp) => {
      expect(comp.id).toBeDefined();
      expect(comp.name).toBeDefined();
      expect(comp.status).toBe("pending");
      expect(comp.crossChainTradingType).toBeDefined();
      expect(comp.createdAt).toBeDefined();
      expect(comp.updatedAt).toBeDefined();
    });

    // Register a team
    const { team } = await registerTeamAndGetClient(
      adminApiKey,
      "Upcoming competitions viewer test",
    );

    // Start one of the competitions to verify it disappears from upcoming list
    await startExistingTestCompetition(
      adminClient,
      createResponse1.competition.id,
      [team.id],
    );

    // Get upcoming competitions again
    const upcomingResponseAfterStart =
      (await teamClient.getUpcomingCompetitions()) as UpcomingCompetitionsResponse;

    // Verify the started competition is no longer in the list
    const foundComp1AfterStart = upcomingResponseAfterStart.competitions.some(
      (comp) => comp.id === createResponse1.competition.id,
    );

    expect(foundComp1AfterStart).toBe(false);

    // But the other two should still be there
    const foundComp2AfterStart = upcomingResponseAfterStart.competitions.some(
      (comp) => comp.id === createResponse2.competition.id,
    );
    const foundComp3AfterStart = upcomingResponseAfterStart.competitions.some(
      (comp) => comp.id === createResponse3.competition.id,
    );

    expect(foundComp2AfterStart).toBe(true);
    expect(foundComp3AfterStart).toBe(true);
  });

  test("competitions include externalLink and imageUrl fields", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Link and Image Test Team",
    );

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
      [team.id],
      externalLink,
      imageUrl,
    );

    // Verify the fields are in the start competition response
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition.externalLink).toBe(externalLink);
    expect(startResponse.competition.imageUrl).toBe(imageUrl);

    // 3. Verify the fields are in the competition status response for participating teams
    const teamStatusResponse =
      (await teamClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(teamStatusResponse.success).toBe(true);
    expect(teamStatusResponse.active).toBe(true);

    if (teamStatusResponse.success && teamStatusResponse.competition) {
      expect(teamStatusResponse.competition.externalLink).toBe(externalLink);
      expect(teamStatusResponse.competition.imageUrl).toBe(imageUrl);
    }

    // 4. Verify the fields are in the competition leaderboard response
    const leaderboardResponse = await teamClient.getLeaderboard();
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
    const upcomingResponse = await teamClient.getUpcomingCompetitions();

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
      [team.id],
    );

    // Verify the original fields are in the response
    expect(startExistingResponse.success).toBe(true);
    expect(startExistingResponse.competition.externalLink).toBe(externalLink);
    expect(startExistingResponse.competition.imageUrl).toBe(imageUrl);
  });
});
