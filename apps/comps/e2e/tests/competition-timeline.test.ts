import { beforeEach, describe, expect, test } from "vitest";

import {
  CompetitionAgentsResponse,
  StartCompetitionResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@recallnet/test-utils";

import { portfolioSnapshotterService } from "@/lib/services";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

describe("Competition Timeline API", () => {
  let adminApiKey: string;
  let rpcClient: Awaited<ReturnType<typeof createTestRpcClient>>;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
    // Create RPC client for timeline queries (public access, no auth needed)
    rpcClient = await createTestRpcClient();
  });

  test("should get competition timeline", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Timeline Test Agent 1",
      });

    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Timeline Test Agent 2",
      });

    // Start a competition
    const competitionName = `Timeline Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

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
      competitionId: competition.id,
      reason: "Timeline test trade 1",
    });

    await agentClient2.executeTrade({
      fromToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      toToken: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
      amount: "100",
      competitionId: competition.id,
      reason: "Timeline test trade 2",
    });

    // Force a snapshot directly
    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

    // Get competition timeline
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competition.id,
    });

    // Verify the response
    expect(Array.isArray(timeline)).toBe(true);

    // Each entry should have the expected fields
    if (timeline.length > 0) {
      const firstAgent = timeline[0];
      if (firstAgent) {
        expect(firstAgent).toHaveProperty("agentId");
        expect(firstAgent).toHaveProperty("agentName");
        expect(firstAgent).toHaveProperty("timeline");
        expect(Array.isArray(firstAgent.timeline)).toBe(true);

        if (firstAgent.timeline.length > 0) {
          const firstTimelineEntry = firstAgent.timeline[0];
          if (firstTimelineEntry) {
            expect(firstTimelineEntry).toHaveProperty("timestamp");
            expect(firstTimelineEntry).toHaveProperty("totalValue");
          }
        }
      }
    }
  });

  test("should return 404 for non-existent competition timeline", async () => {
    // Try to get timeline for a non-existent competition
    await expect(
      rpcClient.competitions.getTimeline({
        competitionId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/not found/i);
  });

  test("should allow unauthenticated access to timeline endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Public Timeline Test Agent 1",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Public Timeline Test Agent 2",
    });

    // Start a competition
    const competitionName = `Public Timeline Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

    // Test: RPC call without authentication (rpcClient has no Privy token)
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competitionResponse.competition.id,
    });

    expect(Array.isArray(timeline)).toBe(true);
  });

  test("should return one snapshot after start of competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Empty Timeline Test Agent",
    });

    // Create and start a competition
    const competitionName = `Empty Timeline Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition with no trades",
      agentIds: [agent1.id],
      tradingType: "allow",
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Get competition timeline immediately (no trades executed)
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competition.id,
    });

    // Should return array with 1 snapshot (initial)
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBe(1);
  });

  test("should accept bucket query parameter", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Bucket Test Agent",
    });

    // Create and start a competition
    const competitionName = `Bucket Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition with bucket parameter",
      agentIds: [agent1.id],
      tradingType: "allow",
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Get competition timeline with custom bucket
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competition.id,
      bucket: 60, // 1 hour bucket
    });

    // Should return success response
    expect(Array.isArray(timeline)).toBe(true);
  });

  test("should not include non-active competition agents in the timeline", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Timeline Test Agent 1",
      });

    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Timeline Test Agent 2",
      });

    // Start a competition
    const competitionName = `Timeline Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

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
      competitionId: competition.id,
      reason: "Timeline test trade 1",
    });

    await agentClient2.executeTrade({
      fromToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      toToken: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
      amount: "100",
      competitionId: competition.id,
      reason: "Timeline test trade 2",
    });

    // Force a snapshot directly
    await portfolioSnapshotterService.takePortfolioSnapshots(competition.id);

    // Disqualify agent 2
    await adminClient.removeAgentFromCompetition(
      competition.id,
      agent2.id,
      "Agent dq'd from competition",
    );
    // Validate the agent 2 status is disqualified
    const agent2Status = (await adminClient.getCompetitionAgents(
      competition.id,
    )) as CompetitionAgentsResponse;
    expect(agent2Status.success).toBe(true);
    expect(agent2Status.agents.length).toBe(1);
    expect(agent2Status.agents[0]?.id).toBe(agent1.id);

    // Get competition timeline
    const timeline = await rpcClient.competitions.getTimeline({
      competitionId: competition.id,
    });

    // Should return only 1 agent ID since agent 2 is disqualified
    const agentIds = new Set(timeline.map((agent) => agent.agentId));
    expect(agentIds.size).toBe(1);
    expect(agentIds.has(agent1.id)).toBe(true);
  });
});
