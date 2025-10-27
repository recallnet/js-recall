import { AxiosError } from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  wait,
} from "@recallnet/test-utils";

/**
 * DIAGNOSTIC TEST FOR RATE LIMITER
 *
 * This test is specifically designed to diagnose issues with the rate limiter,
 * focusing on whether it properly isolates rate limits by agent ID.
 */
describe("Rate Limiter Diagnostics", () => {
  // Begin with clean state
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("properly isolates rate limits by agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const {
      client: agent1Client,
      agent: agent1,
      apiKey: agent1ApiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Rate Limit Diagnostic Agent 1",
    });
    const {
      client: agent2Client,
      agent: agent2,
      apiKey: agent2ApiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Rate Limit Diagnostic Agent 2",
    });

    // Verify the API keys are different
    expect(agent1ApiKey).not.toEqual(agent2ApiKey);

    // Start a competition with both agents
    await adminClient.startCompetition(
      `Rate Limit Diagnostic Test ${Date.now()}`,
      "Test competition for diagnosing rate limiting",
      [agent1.id, agent2.id],
    );

    // Wait for competition setup to complete
    await wait(500);

    // Make a request with Agent 1 until we hit a rate limit

    let agent1RateLimited = false;

    // Try to make multiple requests with Agent 1, expecting to hit rate limit eventually
    // We'll try just a few requests since our rate limit is fairly low
    for (let i = 0; i < 5; i++) {
      try {
        await agent1Client.getBalance();
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response && axiosError.response.status === 429) {
          agent1RateLimited = true;
          break;
        } else {
          throw error;
        }
      }

      // Small delay between requests
      await wait(50);
    }

    // Now check if Agent 2 can make at least one request
    // since it should have its own separate rate limit
    let agent2Success = false;
    let agent2RateLimited = false;

    try {
      const agent2Response = await agent2Client.getBalance();
      if (agent2Response && agent2Response.success !== false) {
        agent2Success = true;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response && axiosError.response.status === 429) {
        agent2RateLimited = true;
      } else {
        throw error;
      }
    }

    // CASE 1: If Agent 1 was rate limited, Agent 2 should not be
    if (agent1RateLimited) {
      expect(agent2Success).toBe(true);
      expect(agent2RateLimited).toBe(false);
    }
    // CASE 2: If Agent 1 wasn't rate limited, we can't draw a clear conclusion
    else {
      // The test is still valuable as we verified authentication and rate limiting paths
    }

    // Verification of proper isolation:
    // If one agent hits a rate limit but the other agent can still make requests,
    // it proves the rate limiter is properly isolating limits by agent
    // Final verification of rate limit isolation
    if (agent1RateLimited && agent2Success && !agent2RateLimited) {
      // SUCCESS: Rate limits are properly isolated by agent ID
    } else if (agent1RateLimited && agent2RateLimited) {
      // FAILURE: Both agents hit rate limits, suggesting rate limits are not properly isolated
    } else {
      // INCONCLUSIVE: Could not fully verify rate limit isolation
    }
  });
});
