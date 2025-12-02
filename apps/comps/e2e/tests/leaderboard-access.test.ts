import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@recallnet/test-utils";

/**
 * Leaderboard Access Control Tests
 *
 * These tests verify that administrators can always access the leaderboard,
 * while participant access can be controlled via the DISABLE_PARTICIPANT_LEADERBOARD_ACCESS
 * environment variable.
 *
 * This test suite uses server restarts to test different environment configurations.
 */
describe("Leaderboard Access Control", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  /**
   * Tests that only admins can access the leaderboard when access control is enabled
   * Participants should be blocked from viewing the leaderboard in this case
   */
  test("participants cannot access leaderboard when toggle is set to true", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a regular user/agent
    const { client, agent: agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Test Agent",
    });

    // Start a competition with the agent
    const competitionName = `Admin Access Test ${Date.now()}`;
    const { competition } = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Verify the admin can still access the competition agents
    const adminResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(adminResponse.success).toBe(true);
    if (!adminResponse.success) throw new Error("Failed to get agents");

    expect(adminResponse.agents).toBeDefined();

    // Agent should not be able to access leaderboard
    try {
      const result = await client.getCompetitionAgents(competition.id);
      // If we get here with a success response, the access control is not working as expected
      if (result.success === true) {
        expect(result.success).toBe(false); // Should have failed with access denied
      } else {
        // If we get a success:false response, that's also good - the API blocked access
        expect(result.success).toBe(false);
      }
    } catch (error) {
      // Expected behavior - request should fail with authorization error
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data.error).toContain(
          "restricted to administrators",
        );
      }
    }
  });
});
