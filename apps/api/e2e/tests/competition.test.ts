import {
  createTestClient,
  registerTeamAndGetClient,
  startTestCompetition,
  createTestCompetition,
  startExistingTestCompetition,
  cleanupTestState,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
} from '../utils/test-helpers';
import axios from 'axios';
import { getBaseUrl } from '../utils/server';
import { getPool } from '../utils/db-manager';
import {
  ApiResponse,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  LeaderboardResponse,
  TeamProfileResponse,
  EndCompetitionResponse,
} from '../utils/api-types';
import { wait } from '../utils/test-helpers';

describe('Competition API', () => {
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

  test('should start a competition with registered teams', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams
    const { team: team1 } = await registerTeamAndGetClient(adminClient, 'Team Alpha');
    const { team: team2 } = await registerTeamAndGetClient(adminClient, 'Team Beta');

    // Start a competition
    const competitionName = `Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(adminClient, competitionName, [
      team1.id,
      team2.id,
    ]);

    // Verify competition was started
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe('ACTIVE');
    expect(competition.teamIds).toContain(team1.id);
    expect(competition.teamIds).toContain(team2.id);
  });

  test('should create a competition without starting it', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition without starting it
    const competitionName = `Pending Competition ${Date.now()}`;
    const competitionResponse = await createTestCompetition(adminClient, competitionName);

    // Verify competition was created in PENDING state
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe('PENDING');
    expect(competition.startDate).toBeNull();
    expect(competition.endDate).toBeNull();
  });

  test('should start an existing competition with teams', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams
    const { team: team1 } = await registerTeamAndGetClient(adminClient, 'Team Delta');
    const { team: team2 } = await registerTeamAndGetClient(adminClient, 'Team Echo');

    // Create a competition without starting it
    const competitionName = `Two-Stage Competition ${Date.now()}`;
    const createResponse = await createTestCompetition(adminClient, competitionName);

    // Verify competition was created in PENDING state
    const pendingCompetition = createResponse.competition;
    expect(pendingCompetition).toBeDefined();
    expect(pendingCompetition.status).toBe('PENDING');

    // Now start the existing competition
    const startResponse = await startExistingTestCompetition(adminClient, pendingCompetition.id, [
      team1.id,
      team2.id,
    ]);

    // Verify competition was started
    const activeCompetition = startResponse.competition;
    expect(activeCompetition).toBeDefined();
    expect(activeCompetition.id).toBe(pendingCompetition.id);
    expect(activeCompetition.name).toBe(competitionName);
    expect(activeCompetition.status).toBe('ACTIVE');
    expect(activeCompetition.startDate).toBeDefined();
    expect(activeCompetition.teamIds).toContain(team1.id);
    expect(activeCompetition.teamIds).toContain(team2.id);
  });

  test('should not allow starting a non-pending competition', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams
    const { team: team1 } = await registerTeamAndGetClient(adminClient, 'Team Foxtrot');
    const { team: team2 } = await registerTeamAndGetClient(adminClient, 'Team Golf');

    // Create and start a competition
    const competitionName = `Already Active Competition ${Date.now()}`;
    const startResponse = await startTestCompetition(adminClient, competitionName, [team1.id]);

    const activeCompetition = startResponse.competition;
    expect(activeCompetition.status).toBe('ACTIVE');

    // Try to start the same competition again
    try {
      await startExistingTestCompetition(adminClient, activeCompetition.id, [team1.id, team2.id]);

      // Should not reach this line
      expect(false).toBe(true);
    } catch (error) {
      // Expect an error because the competition is already active
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('Failed to start existing competition');
    }

    // Verify through direct API call to see the actual error
    try {
      await adminClient.startExistingCompetition(activeCompetition.id, [team1.id, team2.id]);
    } catch (error: any) {
      expect(error.success).toBe(false);
      expect(error.error).toContain('ACTIVE');
    }
  });

  test('teams can view competition status and leaderboard', async () => {
    // Setup admin client and register a team
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client: teamClient, team } = await registerTeamAndGetClient(adminClient, 'Team Gamma');

    // Admin starts a competition with the team
    const competitionName = `Viewable Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(adminClient, competitionName, [team.id]);
    const competitionId = competitionResponse.competition.id;

    // Team checks competition status
    const statusResponse = (await teamClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(statusResponse.success).toBe(true);
    expect(statusResponse.competition).toBeDefined();
    expect(statusResponse.competition?.name).toBe(competitionName);
    expect(statusResponse.competition?.status).toBe('ACTIVE');

    // Team checks leaderboard
    const leaderboardResponse = (await teamClient.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();
    expect(leaderboardResponse.leaderboard).toBeInstanceOf(Array);

    // There should be one team in the leaderboard
    expect(leaderboardResponse.leaderboard.length).toBe(1);

    // The team should be in the leaderboard
    const teamInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry: any) => entry.teamName === 'Team Gamma',
    );
    expect(teamInLeaderboard).toBeDefined();
  });

  test('teams receive basic information for competitions they are not part of', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register teams - one in the competition, one not
    const { client: teamInClient, team: teamIn } = await registerTeamAndGetClient(
      adminClient,
      'Inside Team',
    );
    const { client: teamOutClient } = await registerTeamAndGetClient(adminClient, 'Outside Team');

    // Start a competition with only one team
    await startTestCompetition(adminClient, `Exclusive Competition ${Date.now()}`, [teamIn.id]);

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
    expect(statusOutResponse.message).toBe('Your team is not participating in this competition');
    expect(statusOutResponse.participating).toBeUndefined();
  });

  test('admin can access competition endpoints without being a participant', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a regular team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Regular Team',
    );

    // Start a competition with only the regular team (admin is not a participant)
    const competitionName = `Admin Access Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(adminClient, competitionName, [team.id]);

    // Admin checks competition status
    const adminStatusResponse =
      (await adminClient.getCompetitionStatus()) as CompetitionStatusResponse;
    expect(adminStatusResponse.success).toBe(true);
    expect(adminStatusResponse.active).toBe(true);
    expect(adminStatusResponse.competition).toBeDefined();
    expect(adminStatusResponse.competition?.name).toBe(competitionName);
    expect(adminStatusResponse.competition?.status).toBe('ACTIVE');

    // Admin checks leaderboard
    const adminLeaderboardResponse = (await adminClient.getLeaderboard()) as LeaderboardResponse;
    expect(adminLeaderboardResponse.success).toBe(true);
    expect(adminLeaderboardResponse.competition).toBeDefined();
    expect(adminLeaderboardResponse.leaderboard).toBeDefined();
    expect(adminLeaderboardResponse.leaderboard).toBeInstanceOf(Array);

    // There should be one team in the leaderboard
    expect(adminLeaderboardResponse.leaderboard.length).toBe(1);
    expect(adminLeaderboardResponse.leaderboard[0].teamName).toBe('Regular Team');

    // Admin checks competition rules
    const adminRulesResponse = (await adminClient.getRules()) as CompetitionRulesResponse;
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

  test('teams are activated when added to a competition', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team - should be inactive by default
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Team To Activate',
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
    const leaderboardResponse = (await adminClient.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();

    // Find the team in the leaderboard
    const teamInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry: any) => entry.teamId === team.id,
    );
    expect(teamInLeaderboard).toBeDefined();
    expect(teamInLeaderboard?.active).toBe(true);

    // Team should now be able to access endpoints
    const profileResponse = (await teamClient.getProfile()) as TeamProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.team).toBeDefined();
  });

  test('teams are deactivated when a competition ends', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Team To Deactivate',
    );

    // Start a competition with the team
    const competitionName = `Deactivation Test ${Date.now()}`;
    const competition = await startTestCompetition(adminClient, competitionName, [team.id]);

    // Team should be able to access endpoints while competition is active
    const profileResponse = (await teamClient.getProfile()) as TeamProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.team).toBeDefined();

    // End the competition
    const endResponse = (await adminClient.endCompetition(
      competition.competition.id,
    )) as EndCompetitionResponse;
    expect(endResponse.success).toBe(true);
    expect(endResponse.competition.status).toBe('COMPLETED');

    // Give a small delay for deactivation to complete
    await wait(500);
    // Directly check the database to verify the team is deactivated
    const pool = getPool();
    const dbResult = await pool.query(
      'SELECT active, deactivation_reason FROM teams WHERE id = $1',
      [team.id],
    );

    // Verify team is marked as inactive in the database
    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].active).toBe(false);
    expect(dbResult.rows[0].deactivation_reason).toContain('Competition');

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
});
