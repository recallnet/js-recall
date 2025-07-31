import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  CompetitionPerformanceResponse,
  ErrorResponse,
  StartCompetitionResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";
import ServiceRegistry from "@/services/index.js";

describe("Competition Performance API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);
  });

  test("should get competition performance timeline", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Performance Test Agent 1",
      });

    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Performance Test Agent 2",
      });

    // Start a competition
    const competitionName = `Performance Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id],
    );

    // Verify competition was started
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("active");

    // Execute some trades to create portfolio snapshots
    await agentClient1.executeTrade({
      fromToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      toToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
      amount: "100",
      reason: "Performance test trade 1",
    });

    await agentClient2.executeTrade({
      fromToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      toToken: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
      amount: "100",
      reason: "Performance test trade 2",
    });

    // Force a snapshot directly
    const services = new ServiceRegistry();
    await services.portfolioSnapshotter.takePortfolioSnapshots(competition.id);

    // Get competition performance timeline
    const performanceResponse = (await agentClient1.getCompetitionPerformance(
      competition.id,
    )) as CompetitionPerformanceResponse;

    console.log(performanceResponse);

    // Verify the response
    expect(performanceResponse.success).toBe(true);
    expect(Array.isArray(performanceResponse.performance)).toBe(true);

    // Each entry should have the expected fields
    if (performanceResponse.performance.length > 0) {
      const firstAgent = performanceResponse.performance[0];
      if (firstAgent) {
        expect(firstAgent).toHaveProperty("agentId");
        expect(firstAgent).toHaveProperty("agentName");
        expect(firstAgent).toHaveProperty("timeline");
        expect(Array.isArray(firstAgent.timeline)).toBe(true);

        if (firstAgent.timeline.length > 0) {
          const firstTimelineEntry = firstAgent.timeline[0];
          if (firstTimelineEntry) {
            expect(firstTimelineEntry).toHaveProperty("date");
            expect(firstTimelineEntry).toHaveProperty("totalValue");
          }
        }
      }
    }
  });

  test("should return 404 for non-existent competition performance", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "404 Performance Test Agent",
    });

    // Try to get performance for a non-existent competition
    const response = await agentClient.getCompetitionPerformance(
      "00000000-0000-0000-0000-000000000000",
    );

    // Should return error response
    expect(response.success).toBe(false);
    expect((response as ErrorResponse).error).toContain("not found");
  });

  test("should allow unauthenticated access to performance endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Public Performance Test Agent 1",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Public Performance Test Agent 2",
    });

    // Start a competition
    const competitionName = `Public Performance Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent1.id, agent2.id],
    );

    // Test: Direct axios call without authentication
    const response = await axios.get(
      `${getBaseUrl()}/api/competitions/${competitionResponse.competition.id}/performance`,
    );

    expect(response.status).toBe(200);
  });

  test("should return one snapshot after start of competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Empty Performance Test Agent",
    });

    // Create and start a competition
    const competitionName = `Empty Performance Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition with no trades",
      agentIds: [agent1.id],
      tradingType: "allow",
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Get competition performance timeline immediately (no trades executed)
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Performance Viewer Agent",
    });

    const performanceResponse = (await agentClient.getCompetitionPerformance(
      competition.id,
    )) as CompetitionPerformanceResponse;

    // Should return empty array
    expect(performanceResponse.success).toBe(true);
    expect(Array.isArray(performanceResponse.performance)).toBe(true);
    expect(performanceResponse.performance.length).toBe(1);
  });
});
