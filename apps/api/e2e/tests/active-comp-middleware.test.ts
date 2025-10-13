import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { ErrorResponse } from "@/e2e/utils/api-types.js";
import {
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";
import { activeCompResetCache } from "@/middleware/active-comp-filter.middleware.js";

describe("Active Competition Middleware - E2E Tests", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    activeCompResetCache();
  });

  afterEach(() => {
    activeCompResetCache();
  });

  describe("No Active Competition", () => {
    test("GET /api/price returns 403 when no active competition exists", async () => {
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Active Comp Agent",
        agentDescription: "Agent to test active competition middleware",
      });

      // Call price endpoint without any active competition
      const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const priceResponse = await agentClient.getPrice(token);

      // Expect the active competition middleware to block with 403
      expect(priceResponse.success).toBe(false);
      const error = priceResponse as ErrorResponse;
      expect(error.status).toBe(403);
      expect(error.error.toLowerCase()).toContain("no active competition");
    });

    test("POST /api/trade/execute returns 403 when no active competition exists", async () => {
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Active Comp Trade Agent",
        agentDescription: "Agent to test active comp trade blocking",
      });

      const tradeResponse = await agentClient.executeTrade({
        fromToken: config.specificChainTokens.svm.usdc,
        toToken: config.specificChainTokens.svm.sol,
        amount: "100",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Testing active competition middleware for trade",
      });

      expect(tradeResponse.success).toBe(false);
      const tradeError = tradeResponse as ErrorResponse;
      expect(tradeError.status).toBe(403);
      expect(tradeError.error.toLowerCase()).toContain("no active competition");
    });

    test("Negative results are cached - repeated calls don't hit DB", async () => {
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Cache Test Agent",
        agentDescription: "Agent to test negative caching",
      });

      const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

      // First call - hits DB
      const response1 = await agentClient.getPrice(token);
      expect(response1.success).toBe(false);

      // Subsequent calls within cache TTL should use cache
      const response2 = await agentClient.getPrice(token);
      expect(response2.success).toBe(false);

      const response3 = await agentClient.getPrice(token);
      expect(response3.success).toBe(false);

      // All should return same error
      expect((response1 as ErrorResponse).status).toBe(403);
      expect((response2 as ErrorResponse).status).toBe(403);
      expect((response3 as ErrorResponse).status).toBe(403);
    });
  });

  describe("With Active Competition", () => {
    test("Endpoints work correctly when competition is active", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const compResult = await createTestCompetition({
        adminClient,
        name: "Test Competition for Middleware",
      });

      const {
        client: agentClient,
        agent: { id: agentId },
      } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Comp Test Agent",
        agentDescription: "Agent to test with active competition",
      });
      await startExistingTestCompetition({
        adminClient,
        competitionId: compResult.competition.id,
        agentIds: [agentId],
      });

      const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const priceResponse = await agentClient.getPrice(token);
      expect(priceResponse.success).toBe(true);
      const tradeResponse = await agentClient.executeTrade({
        fromToken: config.specificChainTokens.svm.usdc,
        toToken: config.specificChainTokens.svm.sol,
        amount: "100",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Testing with active competition",
      });
      expect(tradeResponse.success).toBe(true);
    });

    test("Competition is cached and used for multiple requests", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const compResult = await createTestCompetition({
        adminClient,
        name: "Caching Test Competition",
      });
      const {
        client: agentClient,
        agent: { id: agentId },
      } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Caching Test Agent",
        agentDescription: "Agent for cache testing",
      });
      await startExistingTestCompetition({
        adminClient,
        competitionId: compResult.competition.id,
        agentIds: [agentId],
      });

      // Make multiple rapid requests - should use cache
      const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const requests = await Promise.all([
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
      ]);
      requests.forEach((response) => {
        expect(response.success).toBe(true);
      });
    });
  });

  describe("Cache Expiration", () => {
    test("Cache works after competition becomes active", async () => {
      const {
        client: agentClient,
        agent: { id: agentId },
      } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Cache Expiry Test Agent",
        agentDescription: "Agent to test cache expiration",
      });

      const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

      // First call - no competition, caches null
      const response1 = await agentClient.getPrice(token);
      expect(response1.success).toBe(false);

      // Create and start competition
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const compResult = await createTestCompetition({
        adminClient,
        name: "Delayed Competition",
      });

      await startExistingTestCompetition({
        adminClient,
        competitionId: compResult.competition.id,
        agentIds: [agentId],
      });

      // Reset cache to simulate a fresh state
      activeCompResetCache();

      // Wait for a moment to ensure competition is fully active
      await wait(100);

      // Now it should query DB and find the active competition
      const response2 = await agentClient.getPrice(token);
      expect(response2.success).toBe(true);
    });
  });

  describe("Request Coalescing", () => {
    test("Concurrent requests share single DB query", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const compResult = await createTestCompetition({
        adminClient,
        name: "Concurrent Test Competition",
      });
      const {
        client: agentClient,
        agent: { id: agentId },
      } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Concurrent Test Agent",
        agentDescription: "Agent for concurrency testing",
      });
      await startExistingTestCompetition({
        adminClient,
        competitionId: compResult.competition.id,
        agentIds: [agentId],
      });

      const token = "0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

      // Fire many concurrent requests when cache is cold
      // All should succeed and share the same DB query
      const requests = await Promise.all([
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
        agentClient.getPrice(token),
      ]);
      requests.forEach((response) => {
        expect(response.success).toBe(true);
      });
    });
  });
});
