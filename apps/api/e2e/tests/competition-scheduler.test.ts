import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  CompetitionDetailResponse,
  CreateCompetitionResponse,
} from "@/e2e/utils/api-types.js";
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

describe("Competition End Date Scheduler", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly using the setup endpoint
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

    const createResponse = await adminClient.createCompetition(
      competitionName,
      "Competition that should auto-end",
      undefined, // tradingType
      false, // sandboxMode
      undefined, // externalUrl
      undefined, // imageUrl
      undefined, // type
      endDate.toISOString(), // endDate
      undefined, // votingStartDate
      undefined, // votingEndDate
    );

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    console.log(
      `Created competition ${competition.id} with endDate ${endDate.toISOString()}`,
    );

    // Start the competition
    const startResponse = await adminClient.startExistingCompetition(
      competition.id,
      [agent.id],
    );
    expect(startResponse.success).toBe(true);

    // Verify competition is active
    const activeCompetition = await adminClient.getCompetition(competition.id);
    expect(activeCompetition.success).toBe(true);
    expect(
      (activeCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("active");

    // Wait for the end date to pass plus some buffer time for the scheduler to run
    // The scheduler runs every 5 seconds in test mode
    await wait(12000);

    // Check if competition has been automatically ended
    const endedCompetition = await adminClient.getCompetition(competition.id);
    expect(endedCompetition.success).toBe(true);
    expect(
      (endedCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("ended");
    expect(
      (endedCompetition as CompetitionDetailResponse).competition.endDate,
    ).toBeDefined();

    console.log(
      `Competition ${competition.id} was automatically ended at ${(endedCompetition as CompetitionDetailResponse).competition.endDate}`,
    );
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

    const createResponse = await adminClient.createCompetition(
      competitionName,
      "Competition that should not auto-end yet",
      undefined, // tradingType
      false, // sandboxMode
      undefined, // externalUrl
      undefined, // imageUrl
      undefined, // type
      endDate.toISOString(), // endDate
      undefined, // votingStartDate
      undefined, // votingEndDate
    );

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    // Start the competition
    const startResponse = await adminClient.startExistingCompetition(
      competition.id,
      [agent.id],
    );
    expect(startResponse.success).toBe(true);

    // Verify competition is active
    const activeCompetition = await adminClient.getCompetition(competition.id);
    expect(activeCompetition.success).toBe(true);
    expect(
      (activeCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("active");

    // Wait for a scheduler cycle to run (6 seconds to be safe)
    await wait(6000);

    // Competition should still be active since end date hasn't passed
    const stillActiveCompetition = await adminClient.getCompetition(
      competition.id,
    );
    expect(stillActiveCompetition.success).toBe(true);
    expect(
      (stillActiveCompetition as CompetitionDetailResponse).competition.status,
    ).toBe("active");

    console.log(
      `Competition ${competition.id} correctly remains active before end date`,
    );

    // Clean up by manually ending the competition
    await adminClient.endCompetition(competition.id);
  });
});
