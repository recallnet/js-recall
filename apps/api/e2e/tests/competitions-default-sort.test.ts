import { beforeEach, describe, expect, test } from "vitest";

import {
  Competition,
  UpcomingCompetitionsResponse,
} from "@/e2e/utils/api-types.js";
import {
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";

/**
 * E2E tests for competitions default sorting
 * Verifies that when no sort param is provided, competitions are ordered by:
 * - Primary: startDate DESC
 * - Secondary: createdAt DESC (for rows with NULL startDate)
 */
describe("Competitions default sorting", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("pending competitions default to createdAt DESC when startDate is NULL", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create three pending competitions with slight delays to ensure createdAt ordering
    const c1 = await createTestCompetition({
      adminClient,
      name: `Pending A ${Date.now()}`,
    });
    await wait(10);
    const c2 = await createTestCompetition({
      adminClient,
      name: `Pending B ${Date.now()}`,
    });
    await wait(10);
    const c3 = await createTestCompetition({
      adminClient,
      name: `Pending C ${Date.now()}`,
    });

    // Fetch pending competitions without explicit sort
    const list = (await adminClient.getCompetitions(
      "pending",
    )) as UpcomingCompetitionsResponse;

    expect(list.success).toBe(true);
    const comps = list.competitions as Competition[];

    // Find indices of our competitions
    const idx1 = comps.findIndex((c) => c.id === c1.competition.id);
    const idx2 = comps.findIndex((c) => c.id === c2.competition.id);
    const idx3 = comps.findIndex((c) => c.id === c3.competition.id);

    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx3).toBeGreaterThanOrEqual(0);

    // Default order should be newest first by createdAt since startDate is null
    // c3 created last -> smallest index
    expect(idx3).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx1);
  });

  test("ended competitions default to startDate DESC", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create an agent to join competitions so we can start them
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Sorting Agent",
    });

    // Create two competitions and start them in sequence to create distinct startDate values
    const p1 = await createTestCompetition({
      adminClient,
      name: `Ended A ${Date.now()}`,
    });
    await wait(10);
    const p2 = await createTestCompetition({
      adminClient,
      name: `Ended B ${Date.now()}`,
    });

    // Start and end first competition
    const s1 = await startExistingTestCompetition({
      adminClient,
      competitionId: p1.competition.id,
      agentIds: [agent.id],
    });
    await adminClient.endCompetition(s1.competition.id);

    await wait(20); // ensure later startDate for the second

    // Start and end second competition
    const s2 = await startExistingTestCompetition({
      adminClient,
      competitionId: p2.competition.id,
      agentIds: [agent.id],
    });
    await adminClient.endCompetition(s2.competition.id);

    const list = (await adminClient.getCompetitions(
      "ended",
    )) as UpcomingCompetitionsResponse;

    expect(list.success).toBe(true);
    const comps = list.competitions as Competition[];

    const idxS1 = comps.findIndex((c) => c.id === s1.competition.id);
    const idxS2 = comps.findIndex((c) => c.id === s2.competition.id);

    expect(idxS1).toBeGreaterThanOrEqual(0);
    expect(idxS2).toBeGreaterThanOrEqual(0);

    // Default order should be newest first by startDate (s2 should come before s1)
    expect(idxS2).toBeLessThan(idxS1);
  });

  test("explicit sort param still applies (createdAt ASC for pending)", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create two pending competitions
    const a1 = await createTestCompetition({
      adminClient,
      name: `Explicit A ${Date.now()}`,
    });
    await wait(10);
    const a2 = await createTestCompetition({
      adminClient,
      name: `Explicit B ${Date.now()}`,
    });

    // Explicitly sort by createdAt ascending
    const list = (await adminClient.getCompetitions(
      "pending",
      "createdAt",
    )) as UpcomingCompetitionsResponse;

    expect(list.success).toBe(true);
    const comps = list.competitions as Competition[];

    const idxA1 = comps.findIndex((c) => c.id === a1.competition.id);
    const idxA2 = comps.findIndex((c) => c.id === a2.competition.id);

    // Ascending order by createdAt means older (a1) should come before newer (a2)
    expect(idxA1).toBeLessThan(idxA2);
  });
});
