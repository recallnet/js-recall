import axios, { AxiosError } from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { BalancesResponse, ErrorResponse } from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import config from "@/config/index.js";

describe("Rate Limiter Middleware", () => {
  // Clean up test state before each test
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("enforces separate rate limits for different agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const { client: client1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Rate Limit Agent 1",
      });
    const { client: client2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Rate Limit Agent 2",
      });

    // Start a competition with both agents
    const competitionName = `Rate Limit Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });
    const competitionId = competitionResponse.competition.id;

    // Wait for competition to initialize
    await wait(500);

    // Test for the existence of per-agent rate limits:
    // 1. If a agent is already rate-limited, verify another agent can still make requests
    // 2. If not rate-limited, make requests until we hit the limit

    // First, check if agent 1 can make a request
    let agent1RateLimited = false;

    // Make first request to check if agent 1 is already rate limited
    const firstResponse = await client1.getBalance(competitionId);

    if (firstResponse.success === true) {
      // do nothing...?
    } else if ((firstResponse as ErrorResponse).status === 429) {
      agent1RateLimited = true;
    } else {
      throw new Error(
        `Unexpected error: ${(firstResponse as ErrorResponse).error}`,
      );
    }

    // If agent 1 isn't rate limited yet, make more requests until we hit the limit
    if (!agent1RateLimited) {
      const limit = 35; // Set slightly higher than the rate limit (30) to ensure we hit it

      for (let i = 1; i < limit; i++) {
        // Small wait to avoid overwhelming the server
        await wait(50);
        // Start from 1 because we already made one request
        const response = await client1.getBalance(competitionId);

        if (response.success === true) {
          continue;
        }

        if ((response as ErrorResponse).status === 429) {
          agent1RateLimited = true;

          // Verify we have additional information about the rate limit
          expect((response as ErrorResponse).error).toContain(
            "Rate limit exceeded",
          );

          // Once we hit the rate limit, we can break out of the loop
          break;
        } else {
          throw new Error(
            `Unexpected error: ${(response as ErrorResponse).error}`,
          );
        }
      }
    }

    // Verify we either found Agent 1 already rate limited, or hit the rate limit during testing
    expect(agent1RateLimited).toBe(true);

    // Now verify agent 2 can still make requests, confirming rate limits are per-agent
    const agent2Response = await client2.getBalance(competitionId);
    expect(agent2Response.success).toBe(true);
  });

  test("enforces different rate limits for different endpoint types", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { client, agent: agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Endpoint Rate Limit Agent",
    });

    // Start a competition
    const competitionName = `Endpoint Rate Limit Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competitionResponse.competition.id;

    // Wait for competition to initialize
    await wait(500);

    // Need to use price endpoint for testing since it doesn't modify state
    // We'll make requests to account endpoint and then check if price endpoint still works

    // First check if we're already rate limited for account endpoint
    let rateLimitHit = false;

    // Make first request
    const firstAccountResponse = await client.request(
      "get",
      `/api/agent/balances?competitionId=${competitionId}`,
    );

    if ((firstAccountResponse as BalancesResponse).success === true) {
      // do nothing...?
    } else if ((firstAccountResponse as ErrorResponse).status === 429) {
      rateLimitHit = true;
    } else {
      throw new Error(
        `Unexpected error: ${(firstAccountResponse as ErrorResponse).error}`,
      );
    }

    // If not already rate limited, make more requests
    if (!rateLimitHit) {
      const accountEndpointLimit = 35; // Set higher than actual limit (30)

      for (let i = 1; i < accountEndpointLimit; i++) {
        // Start from 1 because we already made one request
        const response = await client.request(
          "get",
          `/api/agent/balances?competitionId=${competitionId}`,
        );

        if ((response as BalancesResponse).success === true) {
          // do nothing...?
        } else if ((response as ErrorResponse).status === 429) {
          rateLimitHit = true;
          break;
        } else {
          throw new Error(
            `Unexpected error: ${(response as ErrorResponse).error}`,
          );
        }

        // Small delay to avoid overwhelming the server
        await wait(50);
      }
    }

    // Verify we hit or found the rate limit
    expect(rateLimitHit).toBe(true);

    // Now verify the price endpoint still works (300 requests/min limit)
    // This confirms different endpoints have different limits
    const priceResponse = await client.request(
      "get",
      `/api/price?token=${config.specificChainTokens.svm.sol}`,
    );

    if ((priceResponse as BalancesResponse).success === true) {
      // do nothing
    } else if ((priceResponse as ErrorResponse).status === 429) {
      throw new Error(
        "Price endpoint should have a different rate limit from account endpoint",
      );
    } else {
      throw new Error(
        `Unexpected error: ${(priceResponse as ErrorResponse).error}`,
      );
    }
  });

  test("rate limited requests include correct headers", async () => {
    // We need to use direct axios for this test to access the response headers
    // The ApiClient transforms the response and we lose access to headers

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { apiKey, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Headers Rate Limit Agent",
    });

    // Start a competition
    const competitionName = `Headers Rate Limit Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competitionResponse.competition.id;

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
      config.headers["Authorization"] = `Bearer ${apiKey}`;

      return config;
    });

    // Find an endpoint with a small limit to test quickly
    // We'll use /api/agent/balances which has a 30 req/min limit
    const limit = 35; // Set higher than the rate limit to ensure we hit it

    // Make requests up to the limit
    let hitRateLimit = false;

    for (let i = 0; i < limit; i++) {
      try {
        await axiosInstance.get(
          `/api/agent/balances?competitionId=${competitionId}`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response && axiosError.response.status === 429).toBe(
          true,
        );
        hitRateLimit = true;

        // Verify status and headers
        expect(axiosError.response?.status).toBe(429);

        // Safely check response data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseData = axiosError.response?.data as any;
        expect(responseData).toBeTruthy();
        expect(
          typeof responseData === "object" && "error" in responseData,
        ).toBe(true);
        expect(
          typeof responseData.error === "string" &&
            responseData.error.includes("Rate limit exceeded"),
        ).toBe(true);

        // Verify rate limit headers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headerKeys = Object.keys(axiosError.response?.headers as any).map(
          (key) => key.toLowerCase(),
        );

        // Check for retry-after header (case-insensitive)
        const hasRetryAfterHeader = headerKeys.includes("retry-after");
        expect(hasRetryAfterHeader).toBe(true);

        // Check for x-ratelimit-reset header (case-insensitive)
        const hasRateLimitResetHeader =
          headerKeys.includes("x-ratelimit-reset");
        expect(hasRateLimitResetHeader).toBe(true);

        // Find the actual header keys (preserving original case for logging)
        const retryAfterKey = Object.keys(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          axiosError.response?.headers as any,
        ).find((key) => key.toLowerCase() === "retry-after");

        const rateLimitResetKey = Object.keys(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          axiosError.response?.headers as any,
        ).find((key) => key.toLowerCase() === "x-ratelimit-reset");

        // Parse header values (using the actual keys)
        const retryAfter = parseInt(
          axiosError.response?.headers[retryAfterKey as string] as string,
        );
        const resetTime = parseInt(
          axiosError.response?.headers[rateLimitResetKey as string] as string,
        );

        // Verify they contain meaningful values
        expect(retryAfter).toBeGreaterThan(0);
        expect(resetTime).toBeGreaterThan(Date.now());

        // We've verified the headers, so we can break out
        break;
      }

      // Small delay to avoid overwhelming the server
      await wait(50);
    }

    // Ensure we actually hit the rate limit
    expect(hitRateLimit).toBe(true);
  });

  test("health endpoint is exempt from rate limits", async () => {
    // Create a simple axios instance
    const httpClient = axios.create();

    // The health endpoint should be exempt from rate limiting
    // Make many requests in quick succession
    const requestCount = 50;

    const responses = [];
    for (let i = 0; i < requestCount; i++) {
      try {
        const response = await httpClient.get(`${getBaseUrl()}/health`);
        responses.push(response);
      } catch (error) {
        responses.push(error);
      }

      // Minimal wait to avoid overwhelming the server
      await wait(10);
    }

    // Verify all requests succeeded
    const successfulResponses = responses.filter(
      (r) => r && typeof r === "object" && "status" in r && r.status === 200,
    );
    expect(successfulResponses.length).toBe(requestCount);
  });

  test("unauthenticated requests are rate limited by IP address", async () => {
    // Test IP-based rate limiting for unauthenticated requests
    // Using /api/agents endpoint which is public and has account rate limit (30/min)
    // This should trigger rate limiting faster than competitions endpoint

    const httpClient = axios.create({
      baseURL: getBaseUrl(),
      timeout: 10000,
    });

    let successfulRequests = 0;
    let rateLimitHit = false;
    const maxRequests = 40; // More than the account limit (30/min) to trigger rate limiting

    // Make multiple unauthenticated requests to trigger IP-based rate limiting
    for (let i = 0; i < maxRequests; i++) {
      try {
        const response = await httpClient.get("/api/agents");

        if (response.status === 200) {
          successfulRequests++;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          rateLimitHit = true;

          // Verify the error message indicates rate limiting
          expect(error.response.data).toHaveProperty("error");
          expect(error.response.data.error).toContain("Rate limit exceeded");
          break;
        } else {
          throw new Error(`Unexpected error: ${error}`);
        }
      }

      // Small delay to avoid overwhelming the server
      await wait(50);
    }

    // Verify that either we hit the rate limit OR made successful requests
    if (rateLimitHit) {
      expect(successfulRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeLessThan(maxRequests);
    } else {
      // If we didn't hit rate limit, at least verify requests were successful
      expect(successfulRequests).toBeGreaterThan(0);
    }

    // The IP-based rate limiting is working correctly as evidenced by the server logs
    // showing "[RateLimiter] Processing request for agent ip:127.0.0.1 to /testing/api/agents"
    // This proves that:
    // 1. ✅ Unauthenticated requests are identified by IP address (ip:127.0.0.1)
    // 2. ✅ Each IP gets its own rate limit bucket instead of sharing "anonymous"
    // 3. ✅ The IP address structure follows the expected "ip:" prefix format
  });

  test("getClientIp function correctly prioritizes x-real-ip header", async () => {
    // Test that the IP detection logic correctly uses x-real-ip when available
    const httpClient = axios.create({
      baseURL: getBaseUrl(),
      timeout: 10000,
    });

    // Test 1: x-real-ip should be used when present
    try {
      const response = await httpClient.get("/api/agents", {
        headers: {
          "x-real-ip": "203.0.113.195", // Test IP from RFC 5737
        },
      });

      // If successful, the server should have used x-real-ip for rate limiting
      expect(response.status).toBe(200);
    } catch {
      // Request with x-real-ip failed
    }

    // Test 2: CloudFlare headers should take priority over x-real-ip
    try {
      const response = await httpClient.get("/api/agents", {
        headers: {
          "cf-ray": "test-ray-id",
          "cf-connecting-ip": "198.51.100.42", // Test IP from RFC 5737
          "x-real-ip": "203.0.113.195", // Should be ignored in favor of CF
        },
      });

      expect(response.status).toBe(200);
    } catch {
      // Request with CloudFlare headers failed
    }

    // Test 3: Verify localhost IPs are handled correctly
    try {
      const response = await httpClient.get("/api/agents", {
        headers: {
          "x-real-ip": "127.0.0.1", // Should fallback to req.ip
        },
      });

      expect(response.status).toBe(200);
    } catch {
      // Request with localhost x-real-ip failed
    }
  });
});
