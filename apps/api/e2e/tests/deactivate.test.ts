import {
  registerTeamAndGetClient,
  cleanupTestState,
  startTestCompetition,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
  createTestClient,
  wait,
} from '../utils/test-helpers';
import axios from 'axios';
import { getBaseUrl } from '../utils/server';
import { BlockchainType } from '../../src/types';
import config from '../../src/config';
import {
  AdminTeamResponse,
  AdminTeamsListResponse,
  ErrorResponse,
  LeaderboardResponse,
  TeamProfileResponse,
} from '../utils/api-types';

describe('Team Deactivation API', () => {
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

  test('admin can deactivate a team', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team
    const { team } = await registerTeamAndGetClient(adminClient, 'Team to Deactivate');

    const competitionName = `Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(adminClient, competitionName, [team.id]);

    // Deactivate the team
    const reason = 'Violated competition rules by using external API';
    const deactivateResponse = (await adminClient.deactivateTeam(
      team.id,
      reason,
    )) as AdminTeamResponse;

    // Verify deactivation response
    expect(deactivateResponse.success).toBe(true);
    expect(deactivateResponse.team).toBeDefined();
    expect(deactivateResponse.team.id).toBe(team.id);
    expect(deactivateResponse.team.name).toBe('Team to Deactivate');
    expect(deactivateResponse.team.active).toBe(false);
    expect(deactivateResponse.team.deactivationReason).toBe(reason);
    expect(deactivateResponse.team.deactivationDate).toBeDefined();

    // List all teams to verify the deactivation status is persisted
    const teamsResponse = (await adminClient.listAllTeams()) as AdminTeamsListResponse;
    const deactivatedTeam = teamsResponse.teams.find((t: any) => t.id === team.id);
    expect(deactivatedTeam).toBeDefined();
    expect(deactivatedTeam?.active).toBe(false);
  });

  test('deactivated team cannot access API endpoints', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team and get the client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'To Be Blocked',
    );

    // Start a competition with the team
    const competitionName = `Deactivation Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Verify team can access API before deactivation
    const profileResponse = await teamClient.getProfile();
    expect(profileResponse.success).toBe(true);

    // Deactivate the team
    const reason = 'Testing deactivation blocking';
    const deactivateResponse = await adminClient.deactivateTeam(team.id, reason);
    expect(deactivateResponse.success).toBe(true);

    // Attempt to get profile - should fail with deactivation message
    try {
      await teamClient.getProfile();
      // Should not reach here - access should be blocked
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect error with deactivation message
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data).toBeDefined();
        expect(error.response.data.error).toContain('deactivated');
        expect(error.response.data.error).toContain(reason);
      }
    }

    // Attempt to execute a trade - should also fail with deactivation message
    try {
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      await teamClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: '100',
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason,
      });
      // Should not reach here - trade should be blocked
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect error with deactivation message
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data).toBeDefined();
        expect(error.response.data.error).toContain('deactivated');
      }
    }
  });

  test('admin can reactivate a deactivated team', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team and get the client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'To Be Reactivated',
    );

    // Start a competition with the team
    const competitionName = `Reactivation Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Deactivate the team
    const reason = 'Temporary deactivation for testing';
    const deactivateResponse = await adminClient.deactivateTeam(team.id, reason);
    expect(deactivateResponse.success).toBe(true);

    // Verify team is blocked from API
    try {
      await teamClient.getProfile();
      expect(false).toBe(true); // Should not succeed
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Reactivate the team
    const reactivateResponse = (await adminClient.reactivateTeam(team.id)) as AdminTeamResponse;
    expect(reactivateResponse.success).toBe(true);
    expect(reactivateResponse.team).toBeDefined();
    expect(reactivateResponse.team.id).toBe(team.id);
    expect(reactivateResponse.team.active).toBe(true);

    // Wait a moment for any cache to update
    await wait(100);

    // Verify team can access API after reactivation
    const profileResponse = (await teamClient.getProfile()) as TeamProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.team.id).toBe(team.id);
  });

  test('non-admin cannot deactivate a team', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two teams
    const { client: teamClient1, team: team1 } = await registerTeamAndGetClient(
      adminClient,
      'Team One',
    );
    const { team: team2 } = await registerTeamAndGetClient(adminClient, 'Team Two');

    // Start a competition with both teams
    const competitionName = `Non-Admin Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team1.id, team2.id]);

    // Team One tries to deactivate Team Two (should fail)
    const deactivateResponse = (await teamClient1.deactivateTeam(
      team2.id,
      'Unauthorized deactivation attempt',
    )) as ErrorResponse;

    // Verify the operation failed due to lack of admin rights
    expect(deactivateResponse.success).toBe(false);
    expect(deactivateResponse.error).toBeDefined();

    // Verify Team Two wasn't actually deactivated
    const teamsResponse = (await adminClient.listAllTeams()) as AdminTeamsListResponse;
    const teamTwoInfo = teamsResponse.teams.find((t: any) => t.id === team2.id);
    expect(teamTwoInfo).toBeDefined();
    expect(teamTwoInfo?.active).not.toBe(false);
  });

  test('inactive teams are filtered from leaderboard', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register three teams for the competition
    const { client: teamClient1, team: team1 } = await registerTeamAndGetClient(
      adminClient,
      'Active Team 1',
    );
    const { client: teamClient2, team: team2 } = await registerTeamAndGetClient(
      adminClient,
      'Active Team 2',
    );
    const { client: teamClient3, team: team3 } = await registerTeamAndGetClient(
      adminClient,
      'Inactive Team',
    );

    // Create competition with all three teams
    const competitionName = `Leaderboard Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team1.id, team2.id, team3.id]);

    // Make some trades to differentiate portfolio values
    // We'll have team3 (to be deactivated) make some trades to put them on the leaderboard
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Have Team 3 execute a trade
    await teamClient3.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: '100',
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: 'inactive teams are filtered from leaderboard',
    });

    // Have the other teams make trades too to populate leaderboard
    await teamClient1.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: '50',
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: 'inactive teams are filtered from leaderboard',
    });

    await teamClient2.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: '75',
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: 'inactive teams are filtered from leaderboard',
    });

    // Wait a moment for portfolio values to update
    await wait(1000);

    // Check leaderboard before deactivation
    const leaderboardBefore = (await teamClient1.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardBefore.success).toBe(true);
    expect(leaderboardBefore.leaderboard).toBeDefined();

    // All three teams should be in the leaderboard
    const teamIds = leaderboardBefore.leaderboard.map((entry: any) => entry.teamId);
    expect(teamIds).toContain(team1.id);
    expect(teamIds).toContain(team2.id);
    expect(teamIds).toContain(team3.id);

    // Now deactivate team3
    const reason = 'Deactivated for leaderboard test';
    const deactivateResponse = await adminClient.deactivateTeam(team3.id, reason);
    expect(deactivateResponse.success).toBe(true);

    // Check leaderboard after deactivation
    const leaderboardAfter = (await teamClient1.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardAfter.success).toBe(true);
    expect(leaderboardAfter.leaderboard).toBeDefined();

    // Verify team3 is still in the leaderboard but marked as inactive
    const teamIdsAfter = leaderboardAfter.leaderboard.map((entry: any) => entry.teamId);
    expect(teamIdsAfter).toContain(team1.id);
    expect(teamIdsAfter).toContain(team2.id);
    expect(teamIdsAfter).toContain(team3.id);

    // Find team3 entry and verify it's marked as inactive
    const team3Entry = leaderboardAfter.leaderboard.find((entry: any) => entry.teamId === team3.id);
    expect(team3Entry).toBeDefined();
    expect(team3Entry?.active).toBe(false);
    expect(team3Entry?.deactivationReason).toBe(reason);

    expect(leaderboardAfter.hasInactiveTeams).toBe(true);

    // All teams should still have ranks
    const ranks = leaderboardAfter.leaderboard.map((entry: any) => entry.rank);
    expect(ranks.length).toBe(3); // All three teams still have ranks

    // Reactivate the team and verify they show up again
    await adminClient.reactivateTeam(team3.id);

    // Wait a moment for any cache to update
    await wait(100);

    // Check leaderboard after reactivation
    const leaderboardFinal = (await teamClient1.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardFinal.success).toBe(true);
    expect(leaderboardFinal.leaderboard).toBeDefined();

    // Verify team3 is back in the leaderboard and active
    const teamIdsFinal = leaderboardFinal.leaderboard.map((entry: any) => entry.teamId);
    expect(teamIdsFinal).toContain(team1.id);
    expect(teamIdsFinal).toContain(team2.id);
    expect(teamIdsFinal).toContain(team3.id);

    // Find team3 entry and verify it's now active
    const team3FinalEntry = leaderboardFinal.leaderboard.find(
      (entry: any) => entry.teamId === team3.id,
    );
    expect(team3FinalEntry).toBeDefined();
    expect(team3FinalEntry?.active).toBe(true);
    expect(team3FinalEntry?.deactivationReason).toBeNull();

    // Verify the hasInactiveTeams flag is false
    expect(leaderboardFinal.hasInactiveTeams).toBe(false);
  });
});
