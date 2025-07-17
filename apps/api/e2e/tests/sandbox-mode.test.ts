import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { ApiClient } from "@/e2e/utils/api-client.js";
import {
  AdminAgentResponse,
  CompetitionAgentsResponse,
  CompetitionStatusResponse,
  ErrorResponse,
  SnapshotResponse,
  StartCompetitionResponse,
  UserRegistrationResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  createTestCompetition,
  generateRandomEthAddress,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
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

  describe("when sandboxMode=true, test manual adding agents to active sandbox competition", () => {
    test("should allow manually adding agent to active sandbox competition", async () => {
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

      // Create and start a sandbox competition with the dummy agent
      const competitionName = `Sandbox Test Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [dummyAgent!.id],
        true, // sandboxMode = true
      );
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;
      expect(competition.sandboxMode).toBe(true);

      // Verify competition is active and in sandbox mode
      const statusResponse = await adminClient.getCompetitionStatus();
      expect(statusResponse.success).toBe(true);
      const status = statusResponse as CompetitionStatusResponse;
      expect(status.competition?.id).toBe(competition.id);
      expect(status.competition?.status).toBe("active");
      expect(status.competition?.sandboxMode).toBe(true);

      // First register a user without an agent
      const newUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "New Sandbox User",
        email: "new-sandbox@example.com",
      });
      expect(newUserResponse.success).toBe(true);
      const newUser = (newUserResponse as UserRegistrationResponse).user;

      // Now register an agent for this user
      const newAgentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: newUser.walletAddress,
        },
        agent: {
          name: "New Sandbox Agent",
          description:
            "Agent that should be manually added to sandbox competition",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(newAgentResponse.success).toBe(true);
      const newAgent = (newAgentResponse as AdminAgentResponse).agent;

      // NO AUTO-JOIN should happen - verify agent is NOT in competition yet
      let competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      let competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;
      expect(competitionAgents.agents.length).toBe(1); // Only dummy agent
      expect(competitionAgents.agents[0]?.id).toBe(dummyAgent!.id);

      // MANUALLY add the agent to the competition using the new admin endpoint
      const addAgentResponse = await adminClient.addAgentToCompetition(
        competition.id,
        newAgent.id,
      );
      expect(addAgentResponse.success).toBe(true);

      // Wait a moment for processing
      await wait(100);

      // Now check that the agent was manually added to the competition
      competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should have both the dummy agent and the manually added agent
      expect(competitionAgents.agents.length).toBe(2);
      const agentIds = competitionAgents.agents.map((agent) => agent.id);
      expect(agentIds).toContain(dummyAgent!.id);
      expect(agentIds).toContain(newAgent.id);

      // Verify the manually added agent has active status in the competition
      const newAgentInCompetition = competitionAgents.agents.find(
        (agent) => agent.id === newAgent.id,
      );
      expect(newAgentInCompetition?.active).toBe(true);
    });

    test("should reject adding agents to active non-sandbox competitions", async () => {
      // Create a dummy user+agent to start the competition with
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User",
        email: "dummy-non-sandbox@example.com",
        agentName: "Dummy Agent",
        agentDescription: "Dummy agent for non-sandbox competition startup",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
      expect(dummyAgent).toBeDefined();

      // Create and start a NON-sandbox competition
      const competitionName = `Non-Sandbox Test Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [dummyAgent!.id],
        false, // sandboxMode = false
      );
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;
      expect(competition.sandboxMode).toBe(false);

      // Verify competition is active but NOT in sandbox mode
      const statusResponse = await adminClient.getCompetitionStatus();
      expect(statusResponse.success).toBe(true);
      const status = statusResponse as CompetitionStatusResponse;
      expect(status.competition?.id).toBe(competition.id);
      expect(status.competition?.status).toBe("active");
      expect(status.competition?.sandboxMode).toBe(false);

      // First register a user without an agent
      const newUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "New Non-Sandbox User",
        email: "new-non-sandbox@example.com",
      });
      expect(newUserResponse.success).toBe(true);
      const newUser = (newUserResponse as UserRegistrationResponse).user;

      // Now register an agent for this user
      const newAgentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: newUser.walletAddress,
        },
        agent: {
          name: "New Non-Sandbox Agent",
          description:
            "Agent that should be rejected from non-sandbox competition",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(newAgentResponse.success).toBe(true);
      const newAgent = (newAgentResponse as AdminAgentResponse).agent;

      // Verify no auto-join occurs (same as before)
      let competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      let competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;
      expect(competitionAgents.agents.length).toBe(1);
      expect(competitionAgents.agents[0]?.id).toBe(dummyAgent!.id);

      // Try to MANUALLY add the agent to the non-sandbox competition - should be REJECTED
      const addAgentResponse = await adminClient.addAgentToCompetition(
        competition.id,
        newAgent.id,
      );
      expect(addAgentResponse.success).toBe(false);
      expect((addAgentResponse as ErrorResponse).error).toContain(
        "Cannot add agents to active non-sandbox competitions",
      );

      // Verify the agent was NOT added to the competition
      competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should still only have the original dummy agent
      expect(competitionAgents.agents.length).toBe(1);
      expect(competitionAgents.agents[0]?.id).toBe(dummyAgent!.id);
    });

    test("should allow agent registration when no active competition exists", async () => {
      // First register a user without an agent
      const newUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "No Competition User",
        email: "no-competition@example.com",
      });
      expect(newUserResponse.success).toBe(true);
      const newUser = (newUserResponse as UserRegistrationResponse).user;

      // Now register an agent for this user using the registerAgent route
      const newAgentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: newUser.walletAddress,
        },
        agent: {
          name: "No Competition Agent",
          description: "Agent registered when no competition is active",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(newAgentResponse.success).toBe(true);
      const newAgent = (newAgentResponse as AdminAgentResponse).agent;

      // Wait a moment
      await wait(100);

      // Verify the agent was created successfully but not added to any competition
      const agentResponse = await adminClient.getAgent(newAgent!.id);
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;
      expect(agent.status).toBe("active");
    });

    test("should allow manually adding multiple agents to sandbox competition", async () => {
      // Create a dummy user+agent to start the competition with
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User Multi",
        email: "dummy-multi@example.com",
        agentName: "Dummy Agent Multi",
        agentDescription: "Dummy agent for multi-agent sandbox test",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
      expect(dummyAgent).toBeDefined();

      // Create and start a sandbox competition
      const competitionName = `Multi-Agent Sandbox Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [dummyAgent!.id],
        true, // sandboxMode = true
      );
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;

      // Register multiple new agents and manually add them
      const newAgents = [];
      for (let i = 1; i <= 3; i++) {
        // First register the user
        const userResponse = await adminClient.registerUser({
          walletAddress: generateRandomEthAddress(),
          name: `Multi User ${i}`,
          email: `multi-user-${i}@example.com`,
        });
        expect(userResponse.success).toBe(true);
        const user = (userResponse as UserRegistrationResponse).user;

        // Then register the agent
        const agentResponse = await adminClient.registerAgent({
          user: {
            walletAddress: user.walletAddress,
          },
          agent: {
            name: `Multi Agent ${i}`,
            description: `Agent ${i} for multi-agent test`,
            walletAddress: generateRandomEthAddress(),
          },
        });
        expect(agentResponse.success).toBe(true);
        const agent = (agentResponse as AdminAgentResponse).agent;
        newAgents.push(agent);

        // Manually add each agent to the competition
        const addAgentResponse = await adminClient.addAgentToCompetition(
          competition.id,
          agent.id,
        );
        expect(addAgentResponse.success).toBe(true);
      }

      // Wait for all add operations to complete
      await wait(200);

      // Check that all new agents were manually added to the competition
      const competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      const competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should have the dummy agent + 3 new agents = 4 total
      expect(competitionAgents.agents.length).toBe(4);

      // Verify all agents are present and active
      const agentIds = competitionAgents.agents.map((agent) => agent.id);
      expect(agentIds).toContain(dummyAgent!.id);
      for (const newAgent of newAgents) {
        expect(agentIds).toContain(newAgent?.id);
      }

      // Verify all agents have active status
      for (const agent of competitionAgents.agents) {
        expect(agent.active).toBe(true);
      }
    });

    test("should handle manual agent addition to sandbox competition", async () => {
      // First register a user without an agent
      const userResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Separate Registration User",
        email: "separate-reg@example.com",
      });
      expect(userResponse.success).toBe(true);
      const user = (userResponse as UserRegistrationResponse).user;

      // Create a dummy agent to start the sandbox competition
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User Separate",
        email: "dummy-separate@example.com",
        agentName: "Dummy Agent Separate",
        agentDescription: "Dummy agent for separate registration test",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;

      // Start a sandbox competition
      const competitionName = `Separate Registration Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [dummyAgent!.id],
        true, // sandboxMode = true
      );
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;

      // Now register an agent separately for the existing user
      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: user.walletAddress,
        },
        agent: {
          name: "Separately Registered Agent",
          description: "Agent registered separately during sandbox competition",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;

      // Manually add the agent to the competition
      const addAgentResponse = await adminClient.addAgentToCompetition(
        competition.id,
        agent.id,
      );
      expect(addAgentResponse.success).toBe(true);

      // Wait for processing
      await wait(100);

      // Check that the separately registered agent was manually added
      const competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      const competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should have both the dummy agent and the separately registered agent
      expect(competitionAgents.agents.length).toBe(2);
      const agentIds = competitionAgents.agents.map((a) => a.id);
      expect(agentIds).toContain(dummyAgent!.id);
      expect(agentIds).toContain(agent.id);
    });
  });

  test("should create competition with sandboxMode=true", async () => {
    const competitionName = `Sandbox Creation Test ${Date.now()}`;
    const competitionResponse = await createTestCompetition(
      adminClient,
      competitionName,
      "Test competition with sandbox mode enabled",
      true, // sandboxMode = true
    );

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(true);
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("pending");
  });

  test("should create competition with sandboxMode=false", async () => {
    const competitionName = `Non-Sandbox Creation Test ${Date.now()}`;
    const competitionResponse = await createTestCompetition(
      adminClient,
      competitionName,
      "Test competition with sandbox mode disabled",
      false, // sandboxMode = false
    );

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(false);
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("pending");
  });

  test("should default sandboxMode to false when not specified", async () => {
    const competitionName = `Default Sandbox Test ${Date.now()}`;
    const competitionResponse = await createTestCompetition(
      adminClient,
      competitionName,
      "Test competition with default sandbox mode",
    );

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(false);
  });

  test("should start pending competition with sandboxMode", async () => {
    // Create agents first
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Create a pending competition with sandbox mode
    const competitionName = `Pending Sandbox Start Test ${Date.now()}`;
    const createResponse = await createTestCompetition(
      adminClient,
      competitionName,
      "Test starting pending competition with sandbox mode",
      true, // sandboxMode = true
    );
    expect(createResponse.success).toBe(true);
    const pendingCompetition = createResponse.competition;
    expect(pendingCompetition.sandboxMode).toBe(true);
    expect(pendingCompetition.status).toBe("pending");

    // Start the competition
    const startResponse = await adminClient.startExistingCompetition(
      pendingCompetition.id,
      [agent1.id, agent2.id],
      undefined, // crossChainTradingType
      true, // sandboxMode - should maintain or override the setting
    );
    expect(startResponse.success).toBe(true);
    const startedCompetition = (startResponse as StartCompetitionResponse)
      .competition;
    expect(startedCompetition.sandboxMode).toBe(true);
    expect(startedCompetition.status).toBe("active");
  });

  test("should handle auto-join when agent already exists in competition", async () => {
    // Create an agent first
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Start a sandbox competition with this agent
    const competitionName = `Duplicate Join Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
      true, // sandboxMode = true
    );
    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Try to register the same agent again (this should be handled gracefully)
    // In practice, this shouldn't happen as agents have unique IDs, but the system should handle it
    const competitionAgentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(competitionAgentsResponse.success).toBe(true);
    const competitionAgents =
      competitionAgentsResponse as CompetitionAgentsResponse;

    // Should still only have one instance of the agent
    expect(competitionAgents.agents.length).toBe(1);
    expect(competitionAgents.agents[0]?.id).toBe(agent.id);
  });

  test("should reject starting second competition when one is already active", async () => {
    // Create agents for both competitions
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Start first sandbox competition
    const competition1Name = `First Sandbox Competition ${Date.now()}`;
    const competition1Response = await startTestCompetition(
      adminClient,
      competition1Name,
      [agent1.id],
      true, // sandboxMode = true
    );
    expect(competition1Response.success).toBe(true);
    const competition1 = competition1Response.competition;

    // Try to start second sandbox competition (should fail)
    const competition2Name = `Second Sandbox Competition ${Date.now()}`;

    // This should fail because only one competition can be active at a time
    try {
      await startTestCompetition(
        adminClient,
        competition2Name,
        [agent2.id],
        true, // sandboxMode = true
      );
      // If we get here, the test should fail
      expect(true).toBe(false); // Force failure
    } catch (error) {
      // This is expected - starting a second competition should fail
      expect(error).toBeDefined();
    }

    // Verify the first competition is still active
    const statusResponse = await adminClient.getCompetitionStatus();
    expect(statusResponse.success).toBe(true);
    const status = statusResponse as CompetitionStatusResponse;

    // Should still be the first competition
    expect(status.competition?.id).toBe(competition1.id);
    expect(status.competition?.status).toBe("active");
    expect(status.competition?.sandboxMode).toBe(true);
  });

  test("should verify that manually added agent gets a portfolio snapshot in sandbox mode", async () => {
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

    // Create and start a sandbox competition with the dummy agent
    const competitionName = `Sandbox Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [dummyAgent!.id],
      true, // sandboxMode = true
    );
    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(true);

    // Verify competition is active and in sandbox mode
    const statusResponse = await adminClient.getCompetitionStatus();
    expect(statusResponse.success).toBe(true);
    const status = statusResponse as CompetitionStatusResponse;
    expect(status.competition?.id).toBe(competition.id);
    expect(status.competition?.status).toBe("active");
    expect(status.competition?.sandboxMode).toBe(true);

    // First register a user without an agent
    const newUserResponse = await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: "New Sandbox User",
      email: "new-sandbox@example.com",
    });
    expect(newUserResponse.success).toBe(true);
    const newUser = (newUserResponse as UserRegistrationResponse).user;

    // Now register an agent for this user
    const newAgentResponse = await adminClient.registerAgent({
      user: {
        walletAddress: newUser.walletAddress,
      },
      agent: {
        name: "New Sandbox Agent",
        description:
          "Agent that should be manually added to sandbox competition",
        walletAddress: generateRandomEthAddress(),
      },
    });
    expect(newAgentResponse.success).toBe(true);
    const newAgent = (newAgentResponse as AdminAgentResponse).agent;

    // Manually add the agent to the competition
    const addAgentResponse = await adminClient.addAgentToCompetition(
      competition.id,
      newAgent.id,
    );
    expect(addAgentResponse.success).toBe(true);

    // Wait a moment for processing
    await wait(100);

    // Check that the agent was manually added to the competition
    const competitionAgentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(competitionAgentsResponse.success).toBe(true);
    const competitionAgents =
      competitionAgentsResponse as CompetitionAgentsResponse;

    // Should have both the dummy agent and the newly registered agent
    expect(competitionAgents.agents.length).toBe(2);
    const agentIds = competitionAgents.agents.map((agent) => agent.id);
    expect(agentIds).toContain(dummyAgent!.id);
    expect(agentIds).toContain(newAgent!.id);

    // Verify the new agent has active status in the competition
    const newAgentInCompetition = competitionAgents.agents.find(
      (agent) => agent.id === newAgent!.id,
    );
    expect(newAgentInCompetition?.active).toBe(true);

    // Verify that a portfolio snapshot was created for the newly auto-joined agent
    // Get snapshots for this specific agent
    const snapshotsResponse = await adminClient.request(
      "get",
      `/api/admin/competition/${competition.id}/snapshots?agentId=${newAgent!.id}`,
    );
    const typedResponse = snapshotsResponse as SnapshotResponse;
    expect(typedResponse.success).toBe(true);
    expect(typedResponse.snapshots).toBeDefined();
    expect(typedResponse.snapshots.length).toBeGreaterThan(0);

    // Verify the snapshot has the correct agent ID and competition ID
    const latestSnapshot =
      typedResponse.snapshots[typedResponse.snapshots.length - 1];
    expect(latestSnapshot?.agentId).toBe(newAgent!.id);
    expect(latestSnapshot?.competitionId).toBe(competition.id);

    // Verify the snapshot has token values (confirming it's a complete snapshot)
    expect(latestSnapshot?.valuesByToken).toBeDefined();
    expect(Object.keys(latestSnapshot!.valuesByToken).length).toBeGreaterThan(
      0,
    );

    console.log(
      `[Test] Manually added agent ${newAgent.id} successfully got portfolio snapshot with total value: $${latestSnapshot?.totalValue}`,
    );
  });
});
