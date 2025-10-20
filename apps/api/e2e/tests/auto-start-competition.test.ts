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

import { ServiceRegistry } from "@/services/index.js";

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

    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionStartDateChecks();

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
    const balances = (await agentClient.getBalance()) as BalancesResponse;
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

    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionStartDateChecks();

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

    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionStartDateChecks();

    // Competition should still be pending since no agents are registered
    const stillPending = await adminClient.getCompetition(competition.id);
    expect(stillPending.success).toBe(true);
    expect((stillPending as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
  });

  test("should not start competitions when another is already active", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Create and start an active competition
    const { agent: activeAgent, client: activeAgentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Comp Agent",
      });

    const activeCompCreate = await adminClient.createCompetition({
      name: `Active Competition ${Date.now()}`,
      description: "Active competition",
      sandboxMode: false,
    });
    expect(activeCompCreate.success).toBe(true);
    const activeCompId = (activeCompCreate as CreateCompetitionResponse)
      .competition.id;

    // Join the agent and start it
    const joinActive = await activeAgentClient.joinCompetition(
      activeCompId,
      activeAgent.id,
    );
    expect(joinActive.success).toBe(true);

    const startActive = await adminClient.startExistingCompetition({
      competitionId: activeCompId,
      agentIds: [activeAgent.id],
    });
    expect(startActive.success).toBe(true);

    // Now create another competition that is eligible to start
    const { agent: pendingAgent, client: pendingAgentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Pending Start Agent",
      });

    const startNow = new Date(Date.now() + 2000);
    const pendingCreate = await adminClient.createCompetition({
      name: `Queued Competition ${Date.now()}`,
      description: "Should not start due to existing active comp",
      sandboxMode: false,
      startDate: startNow.toISOString(),
    });

    const pendingComp = (pendingCreate as CreateCompetitionResponse)
      .competition;
    const joinPending = await pendingAgentClient.joinCompetition(
      pendingComp.id,
      pendingAgent.id,
    );
    expect(joinPending.success).toBe(true);

    // Wait and attempt auto-start processing
    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionStartDateChecks();

    // The queued competition should still be pending
    const queued = await adminClient.getCompetition(pendingComp.id);
    expect(queued.success).toBe(true);
    expect((queued as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
  });

  test("should not start competitions when there are multiple competitions ready to start", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    const startDate = new Date(Date.now()).toISOString();

    // Create two competitions
    const { agent: activeAgent, client: activeAgentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Competition Agent 1",
      });

    const pendingComp1Create = await adminClient.createCompetition({
      name: `Active Competition ${startDate}`,
      description: "Competition 1",
      sandboxMode: false,
      startDate,
    });
    expect(pendingComp1Create.success).toBe(true);
    const pendingComp1Id = (pendingComp1Create as CreateCompetitionResponse)
      .competition.id;
    const joinActive = await activeAgentClient.joinCompetition(
      pendingComp1Id,
      activeAgent.id,
    );
    expect(joinActive.success).toBe(true);

    // Now create another competition with the same start date
    const pendingComp2Create = await adminClient.createCompetition({
      name: `Queued Competition ${Date.now()}`,
      description: "Should not start due to existing active comp",
      sandboxMode: false,
      startDate,
    });
    const pendingComp2 = (pendingComp2Create as CreateCompetitionResponse)
      .competition;
    const pendingComp2Id = pendingComp2.id;
    const joinPending2 = await activeAgentClient.joinCompetition(
      pendingComp2Id,
      activeAgent.id,
    );
    expect(joinPending2.success).toBe(true);

    // Attempt auto-start processing
    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionStartDateChecks();

    // Both pending competitions should still be pending because we avoid starting multiple competitions
    const queued1 = await adminClient.getCompetition(pendingComp1Id);
    expect(queued1.success).toBe(true);
    expect((queued1 as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
    const queued2 = await adminClient.getCompetition(pendingComp2Id);
    expect(queued2.success).toBe(true);
    expect((queued2 as CompetitionDetailResponse).competition.status).toBe(
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
    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionStartDateChecks();

    // Competition should still be pending
    const result = await adminClient.getCompetition(sandboxComp.id);
    expect(result.success).toBe(true);
    expect((result as CompetitionDetailResponse).competition.status).toBe(
      "pending",
    );
  });
});
