import { beforeEach, describe, expect, test } from "vitest";

import {
  BalancesResponse,
  CompetitionDetailResponse,
  CreateCompetitionResponse,
  SnapshotResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  wait,
} from "@recallnet/test-utils";

import { competitionService } from "@/lib/services";

describe("Competition Start Date Processing", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("should automatically start competition when start date is reached", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Register agent and join the competition pre-start
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Auto Start Agent",
      });

    // Create a competition with a start date a few seconds in the future
    const competitionName = `Auto Start Competition ${Date.now()}`;
    const startDate = new Date(Date.now() + 4000); // 4 seconds from now

    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Competition that should auto-start",
      sandboxMode: false,
      startDate: startDate.toISOString(),
    });

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    // Pre-register agent by joining the pending competition
    const joinResponse = await agentClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect(joinResponse.success).toBe(true);

    // Wait beyond the start time (simulate cron delay)
    await wait(6000);

    await competitionService.processCompetitionStartDateChecks();

    // Verify competition is active now
    const updatedCompetition = await adminClient.getCompetition(competition.id);
    expect(updatedCompetition.success).toBe(true);
    const comp = (updatedCompetition as CompetitionDetailResponse).competition;
    expect(comp.status).toBe("active");
    expect(comp.startDate).toBeDefined();

    // Verify an initial portfolio snapshot was taken
    const snapshotsResponse = (await adminClient.request(
      "get",
      `/api/admin/competition/${competition.id}/snapshots`,
    )) as SnapshotResponse;
    expect(snapshotsResponse.success).toBe(true);
    expect(snapshotsResponse.snapshots.length).toBeGreaterThan(0);

    // Verify balances were initialized/reset for the agent
    const balances = (await agentClient.getBalance(
      competition.id,
    )) as BalancesResponse;
    expect(balances.success).toBe(true);
    expect(balances.balances.length).toBeGreaterThan(0);
  });

  test("should not start competitions before start date", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Create a competition with a start date shortly in the future
    const startDate = new Date(Date.now() + 10000); // 10 seconds from now
    const competitionName = `Pending Start Competition ${Date.now()}`;

    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Competition that should not auto-start yet",
      sandboxMode: false,
      startDate: startDate.toISOString(),
    });

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    await competitionService.processCompetitionStartDateChecks();

    // Competition should still be pending
    const stillPending = await adminClient.getCompetition(competition.id);
    expect(stillPending.success).toBe(true);
    expect((stillPending as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
  });

  test("should not start competitions without agents", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Create a competition with a start date shortly in the future but WITHOUT agents
    const startDate = new Date(Date.now());
    const competitionName = `Pending Start Competition`;
    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Competition that should not auto-start yet",
      sandboxMode: false,
      startDate: startDate.toISOString(),
    });
    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    await competitionService.processCompetitionStartDateChecks();

    // Competition should still be pending since no agents are registered
    const stillPending = await adminClient.getCompetition(competition.id);
    expect(stillPending.success).toBe(true);
    expect((stillPending as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
  });

  test("should skip sandbox mode competitions during auto-start", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Create a sandbox competition eligible for start
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Sandbox Agent",
      });

    const startSoon = new Date(Date.now() + 2000);

    const sandboxCreate = await adminClient.createCompetition({
      name: `Sandbox Competition ${Date.now()}`,
      description: "Sandbox should not auto-start",
      sandboxMode: true,
      startDate: startSoon.toISOString(),
    });

    const sandboxComp = (sandboxCreate as CreateCompetitionResponse)
      .competition;

    const joinSandbox = await agentClient.joinCompetition(
      sandboxComp.id,
      agent.id,
    );
    expect(joinSandbox.success).toBe(true);

    // Wait and process
    await competitionService.processCompetitionStartDateChecks();

    // Competition should still be pending
    const result = await adminClient.getCompetition(sandboxComp.id);
    expect(result.success).toBe(true);
    expect((result as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
  });

  test("should auto-start multiple concurrent competitions", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Create 3 agents for the competitions
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Concurrent Agent 1",
      });
    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Concurrent Agent 2",
      });
    const { agent: agent3, client: client3 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Concurrent Agent 3",
      });

    // Create 3 competitions with staggered start times (all in the past)
    const now = Date.now();
    const comp1Start = new Date(now - 5000); // 5 seconds ago
    const comp2Start = new Date(now - 3000); // 3 seconds ago
    const comp3Start = new Date(now - 1000); // 1 second ago

    const comp1Create = await adminClient.createCompetition({
      name: `Concurrent Comp 1 ${now}`,
      description: "First concurrent competition",
      sandboxMode: false,
      startDate: comp1Start.toISOString(),
    });
    expect(comp1Create.success).toBe(true);
    const comp1 = (comp1Create as CreateCompetitionResponse).competition;

    const comp2Create = await adminClient.createCompetition({
      name: `Concurrent Comp 2 ${now}`,
      description: "Second concurrent competition",
      sandboxMode: false,
      startDate: comp2Start.toISOString(),
    });
    expect(comp2Create.success).toBe(true);
    const comp2 = (comp2Create as CreateCompetitionResponse).competition;

    const comp3Create = await adminClient.createCompetition({
      name: `Concurrent Comp 3 ${now}`,
      description: "Third concurrent competition",
      sandboxMode: false,
      startDate: comp3Start.toISOString(),
    });
    expect(comp3Create.success).toBe(true);
    const comp3 = (comp3Create as CreateCompetitionResponse).competition;

    // Join each competition with an agent
    await client1.joinCompetition(comp1.id, agent1.id);
    await client2.joinCompetition(comp2.id, agent2.id);
    await client3.joinCompetition(comp3.id, agent3.id);

    // Wait to ensure all data is persisted
    await wait(2000);

    // Process auto-start
    await competitionService.processCompetitionStartDateChecks();

    // All 3 competitions should now be active
    const comp1Updated = await adminClient.getCompetition(comp1.id);
    expect(comp1Updated.success).toBe(true);
    expect((comp1Updated as CompetitionDetailResponse).competition.status).toBe(
      "active",
    );

    const comp2Updated = await adminClient.getCompetition(comp2.id);
    expect(comp2Updated.success).toBe(true);
    expect((comp2Updated as CompetitionDetailResponse).competition.status).toBe(
      "active",
    );

    const comp3Updated = await adminClient.getCompetition(comp3.id);
    expect(comp3Updated.success).toBe(true);
    expect((comp3Updated as CompetitionDetailResponse).competition.status).toBe(
      "active",
    );

    // Verify balances were initialized for all competitions
    const balances1 = (await client1.getBalance(comp1.id)) as BalancesResponse;
    expect(balances1.success).toBe(true);
    expect(balances1.balances.length).toBeGreaterThan(0);

    const balances2 = (await client2.getBalance(comp2.id)) as BalancesResponse;
    expect(balances2.success).toBe(true);
    expect(balances2.balances.length).toBeGreaterThan(0);

    const balances3 = (await client3.getBalance(comp3.id)) as BalancesResponse;
    expect(balances3.success).toBe(true);
    expect(balances3.balances.length).toBeGreaterThan(0);
  });
});
