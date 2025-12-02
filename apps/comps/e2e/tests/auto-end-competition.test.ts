import { beforeEach, describe, expect, test } from "vitest";

import {
  CompetitionDetailResponse,
  CreateCompetitionResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  wait,
} from "@recallnet/test-utils";

import { competitionService } from "@/lib/services";

describe("Competition End Date Processing", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should automatically end competition when end date is reached", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Register an agent for the competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Agent for Auto End",
    });

    // Create a competition with an end date 3 seconds in the future
    const competitionName = `Auto End Competition ${Date.now()}`;
    const endDate = new Date(Date.now() + 5000); // 5 seconds from now

    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Competition that should auto-end",
      sandboxMode: false,
      endDate: endDate.toISOString(),
    });

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    // Start the competition
    const startResponse = await adminClient.startExistingCompetition({
      competitionId: competition.id,
      agentIds: [agent.id],
    });
    expect(startResponse.success).toBe(true);

    // Verify competition is active
    const activeCompetition = await adminClient.getCompetition(competition.id);
    expect(activeCompetition.success).toBe(true);
    expect(
      (activeCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("active");

    // This is simulating a cron execution of auto-end-competitions script.
    await wait(7000);

    await competitionService.processCompetitionEndDateChecks();

    // Check if competition has been automatically ended
    const endedCompetition = await adminClient.getCompetition(competition.id);
    expect(endedCompetition.success).toBe(true);
    expect(
      (endedCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("ended");
    expect(
      (endedCompetition as CompetitionDetailResponse).competition.endDate,
    ).toBeDefined();
  });

  test("should not end competitions before end date", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Register an agent for the competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Agent for Future End",
    });

    // Create a competition with an end date 30 seconds in the future
    const endDate = new Date(Date.now() + 30000); // 30 seconds from now
    const competitionName = `Future End Competition ${Date.now()}`;

    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Competition that should not auto-end yet",
      sandboxMode: false,
      endDate: endDate.toISOString(),
    });

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    // Start the competition
    const startResponse = await adminClient.startExistingCompetition({
      competitionId: competition.id,
      agentIds: [agent.id],
    });
    expect(startResponse.success).toBe(true);

    // Verify competition is active
    const activeCompetition = await adminClient.getCompetition(competition.id);
    expect(activeCompetition.success).toBe(true);
    expect(
      (activeCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("active");

    // This is simulating a cron execution of auto-end-competitions script.
    await competitionService.processCompetitionEndDateChecks();

    // Competition should still be active since end date hasn't passed
    const stillActiveCompetition = await adminClient.getCompetition(
      competition.id,
    );
    expect(stillActiveCompetition.success).toBe(true);
    expect(
      (stillActiveCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("active");

    // Clean up by manually ending the competition
    await adminClient.endCompetition(competition.id);
  });

  test("should auto-end multiple concurrent competitions", async () => {
    const adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);

    // Create 3 agents for the competitions
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Concurrent End Agent 1",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Concurrent End Agent 2",
    });
    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Concurrent End Agent 3",
    });

    // Create 3 competitions with staggered end times (all in the past after waiting)
    const now = Date.now();
    const comp1End = new Date(now + 3000); // 3 seconds from now
    const comp2End = new Date(now + 3500); // 3.5 seconds from now
    const comp3End = new Date(now + 4000); // 4 seconds from now

    const comp1Create = await adminClient.createCompetition({
      name: `Concurrent End Comp 1 ${now}`,
      description: "First concurrent competition",
      sandboxMode: false,
      endDate: comp1End.toISOString(),
    });
    expect(comp1Create.success).toBe(true);
    const comp1 = (comp1Create as CreateCompetitionResponse).competition;

    const comp2Create = await adminClient.createCompetition({
      name: `Concurrent End Comp 2 ${now}`,
      description: "Second concurrent competition",
      sandboxMode: false,
      endDate: comp2End.toISOString(),
    });
    expect(comp2Create.success).toBe(true);
    const comp2 = (comp2Create as CreateCompetitionResponse).competition;

    const comp3Create = await adminClient.createCompetition({
      name: `Concurrent End Comp 3 ${now}`,
      description: "Third concurrent competition",
      sandboxMode: false,
      endDate: comp3End.toISOString(),
    });
    expect(comp3Create.success).toBe(true);
    const comp3 = (comp3Create as CreateCompetitionResponse).competition;

    // Start all 3 competitions
    await adminClient.startExistingCompetition({
      competitionId: comp1.id,
      agentIds: [agent1.id],
    });
    await adminClient.startExistingCompetition({
      competitionId: comp2.id,
      agentIds: [agent2.id],
    });
    await adminClient.startExistingCompetition({
      competitionId: comp3.id,
      agentIds: [agent3.id],
    });

    // Wait for all end times to pass
    await wait(5000);

    // Process auto-end
    await competitionService.processCompetitionEndDateChecks();

    // All 3 competitions should now be ended
    const comp1Updated = await adminClient.getCompetition(comp1.id);
    expect(comp1Updated.success).toBe(true);
    expect((comp1Updated as CompetitionDetailResponse).competition.status).toBe(
      "ended",
    );

    const comp2Updated = await adminClient.getCompetition(comp2.id);
    expect(comp2Updated.success).toBe(true);
    expect((comp2Updated as CompetitionDetailResponse).competition.status).toBe(
      "ended",
    );

    const comp3Updated = await adminClient.getCompetition(comp3.id);
    expect(comp3Updated.success).toBe(true);
    expect((comp3Updated as CompetitionDetailResponse).competition.status).toBe(
      "ended",
    );
  });
});
