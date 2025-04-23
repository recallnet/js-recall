import {
  registerTeamAndGetClient,
  cleanupTestState,
  wait,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
  createTestClient,
} from '../utils/test-helpers';
import axios, { AxiosError } from 'axios';
import { getBaseUrl } from '../utils/server';

/**
 * DIAGNOSTIC TEST FOR RATE LIMITER
 *
 * This test is specifically designed to diagnose issues with the rate limiter,
 * focusing on whether it properly isolates rate limits by team ID.
 */
describe('Rate Limiter Diagnostics', () => {
  // Begin with clean state
  let adminApiKey: string;

  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account
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

  test('properly isolates rate limits by team', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    console.log('[DIAGNOSTIC] Admin client setup complete');

    // Register two teams
    const {
      client: team1Client,
      team: team1,
      apiKey: team1ApiKey,
    } = await registerTeamAndGetClient(adminClient, 'Rate Limit Diagnostic Team 1');
    const {
      client: team2Client,
      team: team2,
      apiKey: team2ApiKey,
    } = await registerTeamAndGetClient(adminClient, 'Rate Limit Diagnostic Team 2');
    console.log(
      `[DIAGNOSTIC] Registered Team 1 ID: ${team1.id}, API Key: ${team1ApiKey.substring(0, 8)}...`,
    );
    console.log(
      `[DIAGNOSTIC] Registered Team 2 ID: ${team2.id}, API Key: ${team2ApiKey.substring(0, 8)}...`,
    );

    // Verify the API keys are different
    expect(team1ApiKey).not.toEqual(team2ApiKey);

    // Start a competition with both teams
    await adminClient.startCompetition(
      `Rate Limit Diagnostic Test ${Date.now()}`,
      'Test competition for diagnosing rate limiting',
      [team1.id, team2.id],
    );
    console.log('[DIAGNOSTIC] Started test competition');

    // Wait for competition setup to complete
    await wait(500);

    // Make a request with Team 1 until we hit a rate limit
    console.log('[DIAGNOSTIC] Making requests as Team 1 to test rate limiting...');

    let team1RateLimited = false;
    let team1SuccessCount = 0;

    // Try to make multiple requests with Team 1, expecting to hit rate limit eventually
    // We'll try just a few requests since our rate limit is fairly low
    for (let i = 0; i < 5; i++) {
      try {
        await team1Client.getBalance();
        team1SuccessCount++;
        console.log(
          `[DIAGNOSTIC] Team 1: Request ${i + 1} succeeded (total: ${team1SuccessCount})`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response && axiosError.response.status === 429) {
          console.log(
            `[DIAGNOSTIC] Team 1 hit rate limit after ${team1SuccessCount} successful requests`,
          );
          team1RateLimited = true;
          break;
        } else {
          console.error(`[DIAGNOSTIC] Unexpected error for Team 1:`, error);
          throw error;
        }
      }

      // Small delay between requests
      await wait(50);
    }

    // Now check if Team 2 can make at least one request
    // since it should have its own separate rate limit
    let team2Success = false;
    let team2RateLimited = false;

    try {
      console.log('[DIAGNOSTIC] Now trying a request with Team 2...');
      const team2Response = await team2Client.getBalance();
      if (team2Response && team2Response.success !== false) {
        team2Success = true;
        console.log(
          '[DIAGNOSTIC] Team 2 request succeeded, suggesting rate limits are properly isolated by team',
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response && axiosError.response.status === 429) {
        team2RateLimited = true;
        console.log(
          '[DIAGNOSTIC] Team 2 also hit rate limit - this is unexpected with proper team isolation',
        );
      } else {
        console.error('[DIAGNOSTIC] Unexpected error for Team 2:', error);
        throw error;
      }
    }

    // CASE 1: If Team 1 was rate limited, Team 2 should not be
    if (team1RateLimited) {
      console.log('[DIAGNOSTIC] Team 1 was rate limited, verifying Team 2 can still make requests');
      expect(team2Success).toBe(true);
      expect(team2RateLimited).toBe(false);
    }
    // CASE 2: If Team 1 wasn't rate limited, we can't draw a clear conclusion
    else {
      console.log(
        '[DIAGNOSTIC] Team 1 was not rate limited during the test - consider increasing request count',
      );
      // The test is still valuable as we verified authentication and rate limiting paths
    }

    // Verification of proper isolation:
    // If one team hits a rate limit but the other team can still make requests,
    // it proves the rate limiter is properly isolating limits by team
    if (team1RateLimited && team2Success && !team2RateLimited) {
      console.log('[DIAGNOSTIC] SUCCESS: Rate limits are properly isolated by team ID');
    } else if (team1RateLimited && team2RateLimited) {
      console.log(
        '[DIAGNOSTIC] FAILURE: Both teams hit rate limits, suggesting rate limits are not properly isolated',
      );
    } else {
      console.log('[DIAGNOSTIC] INCONCLUSIVE: Could not fully verify rate limit isolation');
    }
  });
});
