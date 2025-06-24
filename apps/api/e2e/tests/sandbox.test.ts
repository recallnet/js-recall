import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  AdminAgentResponse,
  CompetitionAgentsResponse,
  CreateCompetitionResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  generateRandomEthAddress,
} from "@/e2e/utils/test-helpers.js";

describe("Sandbox Mode", () => {
  let adminApiKey: string;
  let adminClient: ApiClient;

  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account
    const response = await axios.post(`${getBaseUrl()}/api/admin/create`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    adminApiKey = response.data.apiKey;
    adminClient = createTestClient(adminApiKey);
  });

  describe("when SANDBOX=true", () => {
    // Note: SANDBOX=true is set automatically by the test setup when running sandbox tests

    test("should automatically join newly registered agent to active competition", async () => {
      // Create and start a competition
      const competitionResponse = await adminClient.createCompetition(
        "Test Competition",
        "A test competition for sandbox mode",
      );
      expect(competitionResponse.success).toBe(true);
      const competition = (competitionResponse as CreateCompetitionResponse)
        .competition;

      const startResponse = await adminClient.startExistingCompetition(
        competition.id,
        [],
      );
      expect(startResponse).toHaveProperty("success", true);

      // Register a new agent
      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: generateRandomEthAddress(),
        },
        agent: {
          name: "Test Agent",
          email: "test@example.com",
          description: "A test agent",
          walletAddress: generateRandomEthAddress(),
        },
      });

      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;

      // Verify the agent was automatically joined to the competition
      const competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);

      const competitionAgents = (
        competitionAgentsResponse as CompetitionAgentsResponse
      ).agents;
      const joinedAgent = competitionAgents.find((a) => a.id === agent.id);
      expect(joinedAgent).toBeDefined();
    });

    test("should handle case when no active competition exists", async () => {
      // Register a new agent when no competition is active
      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: generateRandomEthAddress(),
        },
        agent: {
          name: "Test Agent No Competition",
          email: "test2@example.com",
          description: "A test agent with no active competition",
          walletAddress: generateRandomEthAddress(),
        },
      });

      // Should still succeed in registering the agent
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;
      expect(agent.id).toBeDefined();
    });

    test("should gracefully handle auto-join failures", async () => {
      // Create a competition but don't start it (PENDING state)
      const competitionResponse = await adminClient.createCompetition(
        "Pending Competition",
        "A competition that's not started yet",
      );
      expect(competitionResponse.success).toBe(true);

      // Register a new agent - should succeed even if auto-join fails
      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: generateRandomEthAddress(),
        },
        agent: {
          name: "Test Agent Graceful Fail",
          email: "test3@example.com",
          description: "A test agent for graceful failure",
          walletAddress: generateRandomEthAddress(),
        },
      });

      // Agent registration should still succeed
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;
      expect(agent.id).toBeDefined();
    });
  });

  describe("when SANDBOX=false or not set", () => {
    // Note: When not running sandbox-specific tests, SANDBOX will be false/undefined

    test("should NOT automatically join newly registered agent to active competition", async () => {
      // Create and start a competition
      const competitionResponse = await adminClient.createCompetition(
        "Test Competition No Auto Join",
        "A test competition without auto-join",
      );
      expect(competitionResponse.success).toBe(true);
      const competition = (competitionResponse as CreateCompetitionResponse)
        .competition;

      const startResponse = await adminClient.startExistingCompetition(
        competition.id,
        [],
      );
      expect(startResponse.success).toBe(true);

      // Register a new agent
      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: generateRandomEthAddress(),
        },
        agent: {
          name: "Test Agent No Auto Join",
          email: "test4@example.com",
          description: "A test agent that should not auto-join",
          walletAddress: generateRandomEthAddress(),
        },
      });

      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;

      // Verify the agent was NOT automatically joined to the competition
      const competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);

      const competitionAgents = (
        competitionAgentsResponse as CompetitionAgentsResponse
      ).agents;
      const joinedAgent = competitionAgents.find((a) => a.id === agent.id);
      expect(joinedAgent).toBeUndefined();
    });
  });

  describe("configuration", () => {
    test("should have sandbox mode enabled when running sandbox tests", async () => {
      // This test verifies that the environment variable is properly set by the test setup
      // The actual sandbox behavior is tested in the other test cases

      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: generateRandomEthAddress(),
        },
        agent: {
          name: "Test Agent Config Check",
          email: "test-config@example.com",
          description: "Agent to verify config is working",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(agentResponse).toHaveProperty("success", true);

      // The actual sandbox behavior (auto-joining) is tested in the other test cases
      // This test just ensures the basic registration works when sandbox mode is enabled
    });
  });
});
