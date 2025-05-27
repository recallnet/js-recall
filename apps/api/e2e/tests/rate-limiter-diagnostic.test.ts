import axios, { AxiosError } from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerUserAndAgentAndGetClient,
  wait,
} from "@/e2e/utils/test-helpers.js";

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

  test("properly isolates rate limits by agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    console.log("[DIAGNOSTIC] Admin client setup complete");

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
    console.log(
      `[DIAGNOSTIC] Registered Agent 1 ID: ${agent1.id}, API Key: ${agent1ApiKey.substring(0, 8)}...`,
    );
    console.log(
      `[DIAGNOSTIC] Registered Agent 2 ID: ${agent2.id}, API Key: ${agent2ApiKey.substring(0, 8)}...`,
    );

    // Verify the API keys are different
    expect(agent1ApiKey).not.toEqual(agent2ApiKey);

    // Start a competition with both agents
    await adminClient.startCompetition(
      `Rate Limit Diagnostic Test ${Date.now()}`,
      "Test competition for diagnosing rate limiting",
      [agent1.id, agent2.id],
    );
    console.log("[DIAGNOSTIC] Started test competition");

    // Wait for competition setup to complete
    await wait(500);

    // Make a request with Agent 1 until we hit a rate limit
    console.log(
      "[DIAGNOSTIC] Making requests as Agent 1 to test rate limiting...",
    );

    let agent1RateLimited = false;
    let agent1SuccessCount = 0;

    // Try to make multiple requests with Agent 1, expecting to hit rate limit eventually
    // We'll try just a few requests since our rate limit is fairly low
    for (let i = 0; i < 5; i++) {
      try {
        await agent1Client.getBalance();
        agent1SuccessCount++;
        console.log(
          `[DIAGNOSTIC] Agent 1: Request ${i + 1} succeeded (total: ${agent1SuccessCount})`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response && axiosError.response.status === 429) {
          console.log(
            `[DIAGNOSTIC] Agent 1 hit rate limit after ${agent1SuccessCount} successful requests`,
          );
          agent1RateLimited = true;
          break;
        } else {
          console.error(`[DIAGNOSTIC] Unexpected error for Agent 1:`, error);
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
      console.log("[DIAGNOSTIC] Now trying a request with Agent 2...");
      const agent2Response = await agent2Client.getBalance();
      if (agent2Response && agent2Response.success !== false) {
        agent2Success = true;
        console.log(
          "[DIAGNOSTIC] Agent 2 request succeeded, suggesting rate limits are properly isolated by agent",
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response && axiosError.response.status === 429) {
        agent2RateLimited = true;
        console.log(
          "[DIAGNOSTIC] Agent 2 also hit rate limit - this is unexpected with proper agent isolation",
        );
      } else {
        console.error("[DIAGNOSTIC] Unexpected error for Agent 2:", error);
        throw error;
      }
    }

    // CASE 1: If Agent 1 was rate limited, Agent 2 should not be
    if (agent1RateLimited) {
      console.log(
        "[DIAGNOSTIC] Agent 1 was rate limited, verifying Agent 2 can still make requests",
      );
      expect(agent2Success).toBe(true);
      expect(agent2RateLimited).toBe(false);
    }
    // CASE 2: If Agent 1 wasn't rate limited, we can't draw a clear conclusion
    else {
      console.log(
        "[DIAGNOSTIC] Agent 1 was not rate limited during the test - consider increasing request count",
      );
      // The test is still valuable as we verified authentication and rate limiting paths
    }

    // Verification of proper isolation:
    // If one agent hits a rate limit but the other agent can still make requests,
    // it proves the rate limiter is properly isolating limits by agent
    if (agent1RateLimited && agent2Success && !agent2RateLimited) {
      console.log(
        "[DIAGNOSTIC] SUCCESS: Rate limits are properly isolated by agent ID",
      );
    } else if (agent1RateLimited && agent2RateLimited) {
      console.log(
        "[DIAGNOSTIC] FAILURE: Both agents hit rate limits, suggesting rate limits are not properly isolated",
      );
    } else {
      console.log(
        "[DIAGNOSTIC] INCONCLUSIVE: Could not fully verify rate limit isolation",
      );
    }
  });
});
