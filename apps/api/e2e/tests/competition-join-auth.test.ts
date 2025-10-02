import { beforeEach, describe, expect, test } from "vitest";

import { CompetitionJoinResponse, ErrorResponse } from "@/e2e/utils/api-types.js";
import {
  createPrivyAuthenticatedClient,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

describe("Competition Join Authentication", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("agent API key attempt to join should be rejected with 401", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user and agent (returns an agent API key authenticated client)
    const { agent, client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Join Auth Test Agent",
    });

    // Create a pending competition
    const createResponse = await createTestCompetition({
      adminClient,
      name: `Join Auth Test ${Date.now()}`,
    });
    const competition = createResponse.competition;

    // Attempt to join using agent API key (should be rejected)
    const joinResponse = await agentClient.joinCompetition(competition.id, agent.id);
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    const error = joinResponse as ErrorResponse;
    expect(error.status).toBe(401);
  });

  test("user Privy authentication can join successfully", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user and agent to get user's privyId
    const { agent, user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Join Auth Privy Agent",
    });

    // Create a pending competition
    const createResponse = await createTestCompetition({
      adminClient,
      name: `Join Auth Success ${Date.now()}`,
    });
    const competition = createResponse.competition;

    // Create a Privy-authenticated client for the agent's owner and join
    const { client: privyUserClient } = await createPrivyAuthenticatedClient({
      privyId: user.privyId,
    });

    const joinResponse = (await privyUserClient.joinCompetition(
      competition.id,
      agent.id,
    )) as CompetitionJoinResponse;
    expect(joinResponse.success).toBe(true);
  });
});
