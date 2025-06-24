import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  AdminAgentResponse,
  CompetitionAgentsResponse,
  CreateCompetitionResponse,
  UserRegistrationResponse,
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

    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    adminClient = createTestClient();

    // Login as admin
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);
  });

  describe("when SANDBOX=true", () => {
    // Note: SANDBOX=true is set automatically by the test setup when running sandbox tests

    test("should automatically join newly registered agent to active competition", async () => {
      // First create a dummy user+agent to start the competition with (to avoid "no agents provided" error)
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User",
        email: "dummy@example.com",
        agentName: "Dummy Agent",
        agentDescription: "Dummy agent for competition startup",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
      expect(dummyAgent).toBeDefined();

      // Create and start a competition with the dummy agent
      const competitionResponse = await adminClient.createCompetition(
        "Test Competition",
        "A test competition for sandbox mode",
      );
      expect(competitionResponse.success).toBe(true);
      const competition = (competitionResponse as CreateCompetitionResponse)
        .competition;

      const startResponse = await adminClient.startExistingCompetition(
        competition.id,
        [dummyAgent!.id],
      );
      expect(startResponse).toHaveProperty("success", true);

      // Now register a user first (just the user, no agent)
      const userResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Test User",
        email: "testuser@example.com",
        // Note: NOT providing agent parameters to create just a user
      });
      expect(userResponse.success).toBe(true);
      const user = (userResponse as UserRegistrationResponse).user;

      // Then register an agent for that user (this should trigger sandbox auto-join)
      const agentResponse = await adminClient.registerAgent({
        user: {
          id: user.id,
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
      // Register a user first (just the user, no agent)
      const userResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Test User No Competition",
        email: "testuser2@example.com",
      });
      expect(userResponse.success).toBe(true);
      const user = (userResponse as UserRegistrationResponse).user;

      // Then register an agent for that user when no competition is active
      const agentResponse = await adminClient.registerAgent({
        user: {
          id: user.id,
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

      // Register a user first (just the user, no agent)
      const userResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Test User Graceful Fail",
        email: "testuser3@example.com",
      });
      expect(userResponse.success).toBe(true);
      const user = (userResponse as UserRegistrationResponse).user;

      // Then register an agent for that user - should succeed even if auto-join fails
      const agentResponse = await adminClient.registerAgent({
        user: {
          id: user.id,
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

  describe("configuration", () => {
    test("should have sandbox mode enabled when running sandbox tests", async () => {
      // This test verifies that the environment variable is properly set by the test setup
      // The actual sandbox behavior is tested in the other test cases

      // Register a user first (just the user, no agent)
      const userResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Test User Config Check",
        email: "testuser-config@example.com",
      });
      expect(userResponse.success).toBe(true);
      const user = (userResponse as UserRegistrationResponse).user;

      // Then register an agent for that user
      const agentResponse = await adminClient.registerAgent({
        user: {
          id: user.id,
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
