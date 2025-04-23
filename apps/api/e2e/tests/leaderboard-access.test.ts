import {
  createTestClient,
  registerTeamAndGetClient,
  startTestCompetition,
  cleanupTestState,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
} from '../utils/test-helpers';
import axios from 'axios';
import { getBaseUrl } from '../utils/server';
import { ErrorResponse, LeaderboardResponse } from '../utils/api-types';

/**
 * Leaderboard Access Control Tests
 *
 * These tests verify that administrators can always access the leaderboard,
 * while participant access can be controlled via the DISABLE_PARTICIPANT_LEADERBOARD_ACCESS
 * environment variable.
 *
 * This test suite uses server restarts to test different environment configurations.
 */
describe('Leaderboard Access Control', () => {
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

  /**
   * Tests that only admins can access the leaderboard when access control is enabled
   * Participants should be blocked from viewing the leaderboard in this case
   */
  test('participants cannot access leaderboard when toggle is set to true', async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a regular team
    const { client: teamClient, team } = await registerTeamAndGetClient(adminClient, 'Test Team');

    // Start a competition with the team
    const competitionName = `Admin Access Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Verify the admin can still access the leaderboard
    const adminResponse = (await adminClient.getLeaderboard()) as LeaderboardResponse;
    expect(adminResponse.success).toBe(true);
    expect(adminResponse.leaderboard).toBeDefined();
    console.log('Admin successfully accessed leaderboard when toggle is true');

    // Team should not be able to access leaderboard
    try {
      const result = (await teamClient.getLeaderboard()) as ErrorResponse | LeaderboardResponse;
      // If we get here with a success response, the access control is not working as expected
      if (result.success === true) {
        console.log('ERROR: Participant was able to access leaderboard:', result);
        expect(result.success).toBe(false); // Should have failed with access denied
      } else {
        // If we get a success:false response, that's also good - the API blocked access
        console.log(
          'Correctly blocked participant from accessing leaderboard with error:',
          (result as ErrorResponse).error,
        );
        expect(result.success).toBe(false);
      }
    } catch (error) {
      // Expected behavior - request should fail with authorization error
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data.error).toContain('restricted to administrators');
      }
      console.log('Correctly blocked participant from accessing leaderboard');
    }
  });
});
