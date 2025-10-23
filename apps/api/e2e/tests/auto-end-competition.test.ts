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

import { ServiceRegistry } from "@/services/index.js";

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

    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionEndDateChecks();

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
    const services = new ServiceRegistry();
    await services.competitionService.processCompetitionEndDateChecks();

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
});
