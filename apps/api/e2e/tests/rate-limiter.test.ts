import {
  registerTeamAndGetClient,
  startTestCompetition,
  cleanupTestState,
  wait,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
  createTestClient,
} from '../utils/test-helpers';
import axios, { AxiosError } from 'axios';
import { getBaseUrl } from '../utils/server';
import config from '../../src/config';
import { BalancesResponse, ErrorResponse } from '../utils/api-types';

describe('Rate Limiter Middleware', () => {
  // Clean up test state before each test
  let adminApiKey: string;

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

  test('enforces separate rate limits for different teams', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two teams
    const { client: team1Client, team: team1 } = await registerTeamAndGetClient(
      adminClient,
      'Rate Limit Team 1',
    );
    const { client: team2Client, team: team2 } = await registerTeamAndGetClient(
      adminClient,
      'Rate Limit Team 2',
    );

    // Start a competition with both teams
    const competitionName = `Rate Limit Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team1.id, team2.id]);

    // Wait for competition to initialize
    await wait(500);

    console.log(`Starting per-team rate limit test with teams ${team1.id} and ${team2.id}`);

    // Test for the existence of per-team rate limits:
    // 1. If a team is already rate-limited, verify another team can still make requests
    // 2. If not rate-limited, make requests until we hit the limit

    // First, check if team 1 can make a request
    let team1RateLimited = false;
    let team1SuccessfulRequests = 0;

    // Make first request to check if team 1 is already rate limited
    const firstResponse = await team1Client.getBalance();

    if (firstResponse.success === true) {
      console.log('Team 1 first request succeeded');
      team1SuccessfulRequests = 1;
    } else if ((firstResponse as ErrorResponse).status === 429) {
      console.log('Team 1 is already rate limited');
      team1RateLimited = true;
    } else {
      console.error('Unexpected error for team 1:', (firstResponse as ErrorResponse).error);
      throw new Error(`Unexpected error: ${(firstResponse as ErrorResponse).error}`);
    }

    // If team 1 isn't rate limited yet, make more requests until we hit the limit
    if (!team1RateLimited) {
      const limit = 35; // Set slightly higher than the rate limit (30) to ensure we hit it

      console.log(`Team 1 not rate limited yet. Making up to ${limit} requests`);

      for (let i = 1; i < limit; i++) {
        // Start from 1 because we already made one request
        const response = await team1Client.getBalance();

        if (response.success === true) {
          team1SuccessfulRequests++;
          console.log(`Request ${i + 1}/${limit} succeeded (total: ${team1SuccessfulRequests})`);
        } else if ((response as ErrorResponse).status === 429) {
          team1RateLimited = true;
          console.log(
            `Rate limit hit at request ${i + 1} after ${team1SuccessfulRequests} successful requests`,
          );

          // Verify we have additional information about the rate limit
          expect((response as ErrorResponse).error).toContain('Rate limit exceeded');

          // Once we hit the rate limit, we can break out of the loop
          break;
        } else {
          console.error('Unexpected error for team 1:', (response as ErrorResponse).error);
          throw new Error(`Unexpected error: ${(response as ErrorResponse).error}`);
        }

        // Small wait to avoid overwhelming the server
        await wait(50);
      }
    }

    // Verify we either found Team 1 already rate limited, or hit the rate limit during testing
    if (team1RateLimited) {
      console.log(`Team 1 rate limited after ${team1SuccessfulRequests} requests`);
    } else {
      console.log(
        `Failed to trigger rate limit for Team 1 after ${team1SuccessfulRequests} requests`,
      );
      // If we get here, something is wrong with rate limiting
      throw new Error('Failed to trigger rate limit for Team 1');
    }

    // Now verify team 2 can still make requests, confirming rate limits are per-team
    const team2Response = await team2Client.getBalance();

    if (team2Response.success === true) {
      console.log('Team 2 was able to make a request successfully');
    } else {
      console.error('Team 2 request failed:', (team2Response as ErrorResponse).error);

      // Check if the error is a rate limit error
      if ((team2Response as ErrorResponse).status === 429) {
        console.error('Team 2 should not be rate limited at this point');
        fail('Rate limits are not properly isolated per team');
      } else {
        throw new Error(`Unexpected error for team 2: ${(team2Response as ErrorResponse).error}`);
      }
    }

    console.log('Successfully verified per-team rate limiting');
  });

  test('enforces different rate limits for different endpoint types', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Endpoint Rate Limit Team',
    );

    // Start a competition
    const competitionName = `Endpoint Rate Limit Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for competition to initialize
    await wait(500);

    // Need to use price endpoint for testing since it doesn't modify state
    // We'll make requests to account endpoint and then check if price endpoint still works
    console.log(`Testing whether different endpoints have different rate limits`);

    // First check if we're already rate limited for account endpoint
    let rateLimitHit = false;
    let successfulRequests = 0;

    // Make first request
    const firstAccountResponse = await teamClient.request('get', '/api/account/balances');

    if ((firstAccountResponse as BalancesResponse).success === true) {
      successfulRequests++;
      console.log(`First account request succeeded`);
    } else if ((firstAccountResponse as ErrorResponse).status === 429) {
      rateLimitHit = true;
      console.log(`Already rate limited for account endpoint`);
    } else {
      console.error(
        `Unexpected error on first request:`,
        (firstAccountResponse as ErrorResponse).error,
      );
      throw new Error(`Unexpected error: ${(firstAccountResponse as ErrorResponse).error}`);
    }

    // If not already rate limited, make more requests
    if (!rateLimitHit) {
      const accountEndpointLimit = 35; // Set higher than actual limit (30)
      console.log(`Making ${accountEndpointLimit} requests to account endpoint`);

      for (let i = 1; i < accountEndpointLimit; i++) {
        // Start from 1 because we already made one request
        const response = await teamClient.request('get', '/api/account/balances');

        if ((response as BalancesResponse).success === true) {
          successfulRequests++;
          console.log(
            `Account request ${i + 1}/${accountEndpointLimit} succeeded (total: ${successfulRequests})`,
          );
        } else if ((response as ErrorResponse).status === 429) {
          rateLimitHit = true;
          console.log(`Rate limit hit at request ${i + 1}`);
          break;
        } else {
          console.error(`Unexpected error on request ${i + 1}:`, (response as ErrorResponse).error);
          throw new Error(`Unexpected error: ${(response as ErrorResponse).error}`);
        }

        // Small delay to avoid overwhelming the server
        await wait(50);
      }
    }

    // Verify we hit or found the rate limit
    expect(rateLimitHit).toBe(true);
    console.log(`Confirmed account endpoint rate limit after ${successfulRequests} requests`);

    // Now verify the price endpoint still works (300 requests/min limit)
    // This confirms different endpoints have different limits
    console.log('Verifying price endpoint still accessible (has higher limit)');
    const priceResponse = await teamClient.request(
      'get',
      `/api/price?token=${config.specificChainTokens.svm.sol}`,
    );

    if ((priceResponse as BalancesResponse).success === true) {
      console.log('Success: Price endpoint has different rate limit from account endpoint');
    } else if ((priceResponse as ErrorResponse).status === 429) {
      fail('Price endpoint should have a different rate limit from account endpoint');
    } else {
      console.error('Price endpoint request failed:', (priceResponse as ErrorResponse).error);
      throw new Error(`Unexpected error: ${(priceResponse as ErrorResponse).error}`);
    }

    console.log('Successfully verified endpoint-specific rate limiting');
  });

  test('rate limited requests include correct headers', async () => {
    // We need to use direct axios for this test to access the response headers
    // The ApiClient transforms the response and we lose access to headers

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team
    const {
      client: teamClient,
      team,
      apiKey,
    } = await registerTeamAndGetClient(adminClient, 'Headers Rate Limit Team');

    // Start a competition
    const competitionName = `Headers Rate Limit Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for competition to initialize
    await wait(500);

    // Create an axios instance with authentication headers
    const axiosInstance = axios.create({
      baseURL: getBaseUrl(),
    });

    // Add interceptor to add authentication header
    axiosInstance.interceptors.request.use((config) => {
      // Add authentication header
      config.headers = config.headers || {};

      // Add Bearer token authorization
      config.headers['Authorization'] = `Bearer ${apiKey}`;

      return config;
    });

    // Find an endpoint with a small limit to test quickly
    // We'll use /api/account/balances which has a 30 req/min limit
    const limit = 35; // Set higher than the rate limit to ensure we hit it
    console.log(`Testing rate limit headers using /api/account/balances (30 req/min limit)`);

    // Make requests up to the limit
    let hitRateLimit = false;

    for (let i = 0; i < limit; i++) {
      try {
        await axiosInstance.get(`/api/account/balances`);
        console.log(`Headers test: Request ${i + 1}/${limit} succeeded`);
      } catch (error: any) {
        const axiosError = error as AxiosError;
        if (axiosError.response && axiosError.response.status === 429) {
          console.log(`Headers test: Rate limit hit at request ${i + 1}`);
          hitRateLimit = true;

          // Verify status and headers
          expect(axiosError.response.status).toBe(429);

          // Safely check response data
          const responseData = axiosError.response.data as any;
          expect(responseData).toBeTruthy();
          expect(typeof responseData === 'object' && 'error' in responseData).toBe(true);
          expect(
            typeof responseData.error === 'string' &&
              responseData.error.includes('Rate limit exceeded'),
          ).toBe(true);

          // Verify rate limit headers
          expect(axiosError.response.headers['retry-after']).toBeDefined();
          expect(axiosError.response.headers['x-ratelimit-reset']).toBeDefined();

          // Parse header values
          const retryAfter = parseInt(axiosError.response.headers['retry-after'] as string);
          const resetTime = parseInt(axiosError.response.headers['x-ratelimit-reset'] as string);

          // Verify they contain meaningful values
          expect(retryAfter).toBeGreaterThan(0);
          expect(resetTime).toBeGreaterThan(Date.now());

          console.log(
            `Received rate limit response with Retry-After: ${retryAfter}s, Reset: ${new Date(resetTime).toISOString()}`,
          );

          // We've verified the headers, so we can break out
          break;
        } else {
          console.error(`Unexpected error on request ${i + 1}:`, error);
        }
      }

      // Small delay to avoid overwhelming the server
      await wait(50);
    }

    // Ensure we actually hit the rate limit
    expect(hitRateLimit).toBe(true);
    console.log('Successfully verified rate limit headers');
  });

  test('health endpoint is exempt from rate limits', async () => {
    // Create a simple axios instance
    const httpClient = axios.create();

    // The health endpoint should be exempt from rate limiting
    // Make many requests in quick succession
    const requestCount = 50;
    console.log(
      `Making ${requestCount} requests to /health endpoint (should be exempt from rate limits)`,
    );

    const responses: any[] = [];
    for (let i = 0; i < requestCount; i++) {
      try {
        const response = await httpClient.get(`${getBaseUrl()}/health`);
        responses.push(response);
      } catch (error) {
        console.error(`Health endpoint request ${i + 1} failed:`, error);
        responses.push(error);
      }

      // Minimal wait to avoid overwhelming the server
      await wait(10);
    }

    // Verify all requests succeeded
    const successfulResponses = responses.filter(
      (r) => r && typeof r === 'object' && 'status' in r && r.status === 200,
    );
    expect(successfulResponses.length).toBe(requestCount);

    console.log('Successfully verified health endpoint exemption from rate limits');
  });
});
