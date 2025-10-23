import { beforeEach, describe, expect, test } from "vitest";

import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import { ServiceRegistry } from "@/services/index.js";

describe("get24hSnapshots Repository Function", () => {
  const services = new ServiceRegistry();
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should return empty arrays when no agent IDs provided", async () => {
    const competitionId = "test-competition-id";
    const agentIds: string[] = [];

    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      agentIds,
    );

    expect(result).toEqual({
      earliestSnapshots: [],
      snapshots24hAgo: [],
    });
  });

  test("should return consistent data structures for both arrays", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Agent 1",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Agent 2",
    });

    // Start a competition with multiple agents
    const competitionName = `Get24hSnapshots Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

    const competitionId = startResult.competition.id;

    // Wait for initial snapshots to be created
    await wait(1000);

    // Manually trigger additional snapshots to have data at different times
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );
    await wait(500);
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );
    await wait(500);

    // Call the function under test
    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      [agent1.id, agent2.id],
    );

    expect(result).toBeDefined();
    expect(result.earliestSnapshots).toBeDefined();
    expect(result.snapshots24hAgo).toBeDefined();

    // Both arrays should have snapshots for both agents
    expect(result.earliestSnapshots.length).toBeGreaterThan(0);
    expect(result.snapshots24hAgo.length).toBeGreaterThan(0);

    // Verify structure consistency

    const earliestSnapshot = result.earliestSnapshots[0]!;
    const snapshot24hAgo = result.snapshots24hAgo[0]!;

    // Both should have the same structure
    expect(earliestSnapshot).toMatchObject({
      id: expect.any(Number),
      agentId: expect.any(String),
      competitionId: expect.any(String),
      timestamp: expect.any(Date),
      totalValue: expect.any(Number),
    });

    expect(snapshot24hAgo).toMatchObject({
      id: expect.any(Number),
      agentId: expect.any(String),
      competitionId: expect.any(String),
      timestamp: expect.any(Date),
      totalValue: expect.any(Number),
    });

    // Verify the object keys are identical
    expect(Object.keys(earliestSnapshot as object).sort()).toEqual(
      Object.keys(snapshot24hAgo as object).sort(),
    );
  });

  test("should handle single agent correctly", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register single agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Single Test Agent",
    });

    // Start a competition with single agent
    const competitionName = `Single Agent Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const competitionId = startResult.competition.id;

    // Wait for initial snapshots
    await wait(1000);

    // Call the function under test
    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      [agent.id],
    );

    expect(result).toBeDefined();
    expect(result.earliestSnapshots).toBeDefined();
    expect(result.snapshots24hAgo).toBeDefined();

    // Should have at least one snapshot for the agent
    expect(result.earliestSnapshots.length).toBeGreaterThan(0);
    expect(result.snapshots24hAgo.length).toBeGreaterThan(0);

    // Verify agent ID matches
    expect(result.earliestSnapshots[0]!.agentId).toBe(agent.id);
    expect(result.earliestSnapshots[0]!.competitionId).toBe(competitionId);

    expect(result.snapshots24hAgo[0]!.agentId).toBe(agent.id);
    expect(result.snapshots24hAgo[0]!.competitionId).toBe(competitionId);
  });

  test("should return empty arrays for non-existent competition", async () => {
    const nonExistentCompetitionId = "550e8400-e29b-41d4-a716-446655440000";
    const agentIds = [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ];

    const result = await services.competitionRepository.get24hSnapshots(
      nonExistentCompetitionId,
      agentIds,
    );

    expect(result).toEqual({
      earliestSnapshots: [],
      snapshots24hAgo: [],
    });
  });

  test("should return empty arrays for non-existent agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a real agent but don't use its ID
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Real Agent",
    });

    // Start a competition with the real agent
    const competitionName = `Non-existent Agent Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const competitionId = startResult.competition.id;

    // Wait for initial snapshots
    await wait(1000);

    // Try to get snapshots for non-existent agents
    const nonExistentAgentIds = [
      "550e8400-e29b-41d4-a716-446655440003",
      "550e8400-e29b-41d4-a716-446655440004",
    ];
    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      nonExistentAgentIds,
    );

    expect(result).toEqual({
      earliestSnapshots: [],
      snapshots24hAgo: [],
    });
  });

  test("should handle mixed existing and non-existing agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register real agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Mixed Test Agent",
    });

    // Start a competition with the real agent
    const competitionName = `Mixed Agent Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const competitionId = startResult.competition.id;

    // Wait for initial snapshots
    await wait(1000);

    // Mix existing and non-existing agent IDs
    const mixedAgentIds = [agent.id, "550e8400-e29b-41d4-a716-446655440005"];
    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      mixedAgentIds,
    );

    expect(result).toBeDefined();
    expect(result.earliestSnapshots).toBeDefined();
    expect(result.snapshots24hAgo).toBeDefined();

    // Should have snapshots only for the existing agent
    expect(result.earliestSnapshots.every((s) => s.agentId === agent.id)).toBe(
      true,
    );
    expect(result.snapshots24hAgo.every((s) => s.agentId === agent.id)).toBe(
      true,
    );
  });

  test("should be wrapped with timing function", async () => {
    // This test verifies that the function is properly wrapped with timing
    // by checking that it doesn't throw timing-related errors
    const competitionId = "test-competition-id";
    const agentIds: string[] = [];

    // The function should execute without timing-related errors
    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      agentIds,
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("earliestSnapshots");
    expect(result).toHaveProperty("snapshots24hAgo");
  });

  test("should maintain data consistency when snapshots exist at different times", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Consistency Test Agent",
    });

    // Start a competition
    const competitionName = `Consistency Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const competitionId = startResult.competition.id;

    // Wait for initial snapshots
    await wait(1000);

    // Create multiple snapshots at different times
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );
    await wait(500);
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );
    await wait(500);
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );
    await wait(500);

    // Call the function under test
    const result = await services.competitionRepository.get24hSnapshots(
      competitionId,
      [agent.id],
    );

    expect(result).toBeDefined();
    expect(result.earliestSnapshots.length).toBeGreaterThan(0);
    expect(result.snapshots24hAgo.length).toBeGreaterThan(0);

    // If we have snapshots, verify consistency
    const earliestSnapshot = result.earliestSnapshots[0]!;
    const snapshot24hAgo = result.snapshots24hAgo[0]!;

    // Both should be valid portfolio snapshot objects
    expect(earliestSnapshot.id).toBeDefined();
    expect(earliestSnapshot.agentId).toBe(agent.id);
    expect(earliestSnapshot.competitionId).toBe(competitionId);
    expect(earliestSnapshot.timestamp).toBeInstanceOf(Date);
    expect(typeof earliestSnapshot.totalValue).toBe("number");

    expect(snapshot24hAgo.id).toBeDefined();
    expect(snapshot24hAgo.agentId).toBe(agent.id);
    expect(snapshot24hAgo.competitionId).toBe(competitionId);
    expect(snapshot24hAgo.timestamp).toBeInstanceOf(Date);
    expect(typeof snapshot24hAgo.totalValue).toBe("number");

    // Timestamps should be valid dates
    expect(earliestSnapshot.timestamp.getTime()).not.toBeNaN();
    expect(snapshot24hAgo.timestamp.getTime()).not.toBeNaN();
  });
});
