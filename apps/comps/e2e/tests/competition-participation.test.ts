import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { agents, competitionAgents } from "@recallnet/db/schema/core/defs";
import { specificChainTokens } from "@recallnet/services/lib";
import {
  AgentCompetitionsResponse,
  AgentProfileResponse,
  BlockchainType,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CompetitionWithAgents,
  CreateCompetitionResponse,
  EndCompetitionResponse,
  EnhancedCompetition,
  ErrorResponse,
  StartCompetitionResponse,
  UpcomingCompetitionsResponse,
  UserCompetitionsResponse,
} from "@recallnet/test-utils";
import {
  createPrivyAuthenticatedClient,
  createTestAgent,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
} from "@recallnet/test-utils";
import { wait } from "@recallnet/test-utils";

import { db } from "@/lib/db";

describe("Competition API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("agents are activated when added to a competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new agent - should be inactive by default
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent To Activate",
      });

    // Agent should not be able to access restricted endpoints when inactive
    try {
      await agentClient.getAgentProfile();
      // Should not reach here if properly inactive
      expect(false).toBe(true);
    } catch (error) {
      // Expect error due to inactive status
      expect(error).toBeDefined();
    }

    // Start a competition with the agent
    const competitionName = `Activation Test ${Date.now()}`;
    const { competition } = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Check leaderboard to verify agent is now active
    const leaderboardResponse = await adminClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);
    if (!leaderboardResponse.success) throw new Error("Failed to get agents");

    expect(leaderboardResponse.agents).toBeDefined();

    // Find the agent in the leaderboard
    const agentInLeaderboard = leaderboardResponse.agents.find(
      (entry) => entry.id === agent.id,
    );
    expect(agentInLeaderboard).toBeDefined();
    expect(agentInLeaderboard?.active).toBe(true);

    // Agent should now be able to access endpoints
    const profileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.agent).toBeDefined();
  });

  test("agents remain globally active when competition ends but are marked inactive in that competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Competition End Test",
      });

    // Start a competition with the agent
    const competitionName = `Competition End Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Agent should be able to access endpoints during competition
    const activeProfileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(activeProfileResponse.success).toBe(true);

    // End the competition
    const endResponse = (await adminClient.endCompetition(
      startResponse.competition.id,
    )) as EndCompetitionResponse;
    expect(endResponse.success).toBe(true);

    // Wait a moment for status update to process
    await wait(100);

    const postEndProfileResponse =
      (await agentClient.getAgentProfile()) as AgentProfileResponse;
    expect(postEndProfileResponse.success).toBe(true);

    // Verify through database that agent remains globally active
    const agentRecord = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agent.id))
      .limit(1);

    expect(agentRecord.length).toBe(1);
    expect(agentRecord[0]?.status).toBe("active"); // Should remain globally active

    // Verify agent is marked as inactive in the specific competition
    const competitionAgentRecord = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, startResponse.competition.id),
          eq(competitionAgents.agentId, agent.id),
        ),
      )
      .limit(1);

    expect(competitionAgentRecord.length).toBe(1);
    // With refined status model, agents remain 'active' in completed competitions
    expect(competitionAgentRecord[0]?.status).toBe("active");
    // No deactivation data since agents aren't deactivated when competitions end
    expect(competitionAgentRecord[0]?.deactivationReason).toBeNull();
    expect(competitionAgentRecord[0]?.deactivatedAt).toBeNull();
  });

  // test cases for GET /competitions/{competitionId}

  // test cases for GET /competitions/{competitionId}/agents

  // test cases for Privy user authentication

  // test cases for join/leave competition functionality
  test("user can join competition on behalf of their agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Competition Join User",
      userEmail: "competition-join@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Competition Join Agent",
      "Agent for testing competition joining",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Join Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Verify initial state - agent not in competition
    const agentsBefore = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsBefore) {
      const agentInCompetition = agentsBefore.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeUndefined();
    }

    // User joins the competition on behalf of their agent
    const joinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(true);
    if ("message" in joinResponse) {
      expect(joinResponse.message).toBe("Successfully joined competition");
    }

    // Verify agent is now in the competition
    const agentsAfter = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsAfter) {
      const agentInCompetition = agentsAfter.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeDefined();
    }
  });

  test("user can leave pending competition on behalf of their agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Competition Leave User",
      userEmail: "competition-leave@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Competition Leave Agent",
      "Agent for testing competition leaving",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create and join competition
    const competitionName = `Leave Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Join the competition first
    await userClient.joinCompetition(competition.id, agent.id);

    // Verify agent is in competition
    const agentsBefore = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsBefore) {
      const agentInCompetition = agentsBefore.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeDefined();
    }

    // Leave the competition
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(true);
    if ("message" in leaveResponse) {
      expect(leaveResponse.message).toBe("Successfully left competition");
    }

    // Check per-competition status in database
    const competitionAgentRecord = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competition.id),
          eq(competitionAgents.agentId, agent.id),
        ),
      )
      .limit(1);

    expect(competitionAgentRecord.length).toBe(1);
    expect(competitionAgentRecord[0]?.status).toBe("withdrawn");
    expect(competitionAgentRecord[0]?.deactivationReason).toContain(
      "Withdrew from competition",
    );

    // Agent should NOT appear in competition agents API response (only active agents shown)
    const agentsAfter = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsAfter) {
      const agentInCompetition = agentsAfter.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeUndefined(); // Should not appear in active list
    }
  });

  test("user cannot join competition with agent they don't own", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create two Privy-authenticated users
    const { client: user1Client } = await createPrivyAuthenticatedClient({
      userName: "User 1",
      userEmail: "user1@example.com",
    });

    const { client: user2Client } = await createPrivyAuthenticatedClient({
      userName: "User 2",
      userEmail: "user2@example.com",
    });

    // User 2 creates an agent
    const createAgentResponse = await createTestAgent(
      user2Client,
      "User 2 Agent",
      "Agent owned by user 2",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent2 = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Ownership Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // User 1 tries to join with User 2's agent
    const joinResponse = await user1Client.joinCompetition(
      competition.id,
      agent2.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("do not own this agent");
    }
  });

  test("user cannot join non-pending competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a dummy user and agent to make the competition startable
    const { client: dummyUserClient } = await createPrivyAuthenticatedClient({
      userName: "Dummy User for Competition",
      userEmail: "dummy-user@example.com",
    });

    const dummyAgentResponse = await createTestAgent(
      dummyUserClient,
      "Dummy Agent",
      "Agent to make competition startable",
    );
    expect(dummyAgentResponse.success).toBe(true);
    const dummyAgent = (dummyAgentResponse as AgentProfileResponse).agent;

    // Create a Privy-authenticated user who will try to join
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Non-Pending Test User",
      userEmail: "non-pending-test@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Non-Pending Test Agent",
      "Agent for testing non-pending competition join",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create a pending competition
    const competitionName = `Non-Pending Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Dummy user joins the competition (pre-registers)
    const dummyJoinResponse = await dummyUserClient.joinCompetition(
      competition.id,
      dummyAgent.id,
    );
    expect("success" in dummyJoinResponse && dummyJoinResponse.success).toBe(
      true,
    );

    // Start the competition with empty agentIds (will use pre-registered agent)
    const startResponse = await startExistingTestCompetition({
      adminClient,
      competitionId: competition.id,
      agentIds: [], // No agentIds - should use pre-registered dummy agent
    });
    expect(startResponse.success).toBe(true);

    // Now try to join the active competition with a different agent
    const joinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("already started/ended");
    }
  });

  test("user cannot join competition twice with same agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Duplicate Join User",
      userEmail: "duplicate-join@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Duplicate Join Agent",
      "Agent for testing duplicate join prevention",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create competition
    const competitionName = `Duplicate Join Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // First join should succeed
    const firstJoinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in firstJoinResponse && firstJoinResponse.success).toBe(
      true,
    );

    // Second join should fail
    const secondJoinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in secondJoinResponse && secondJoinResponse.success).toBe(
      false,
    );
    if ("error" in secondJoinResponse) {
      expect(secondJoinResponse.error).toContain("already actively registered");
    }
  });

  test("user cannot use deleted agent for competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Deleted Agent User",
      userEmail: "deleted-agent@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Deleted Agent",
      "Agent to be deleted for testing",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Admin deletes the agent (deleted agents should not be able to join)
    await adminClient.deleteAgent(agent.id);

    // Create a pending competition
    const competitionName = `Deleted Agent Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Try to join with deleted agent
    const joinResponse = await userClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("not found");
    }
  });

  test("leaving active competition marks agent as left in that competition but keeps them globally active", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user with agent
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Active Leave User",
      userEmail: "active-leave@example.com",
    });

    const createAgentResponse = await createTestAgent(
      userClient,
      "Active Leave Agent",
      "Agent for testing active competition leave",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Start competition with the agent
    const competitionName = `Active Leave Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // User leaves the active competition
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(true);

    // agent should remain globally active
    const agentProfileResponse = await userClient.getUserAgent(agent.id);
    expect(agentProfileResponse.success).toBe(true);
    if ("agent" in agentProfileResponse) {
      // Agent should remain globally active
      expect(agentProfileResponse.agent.status).toBe("active");
    }

    // Verify agent is marked as "withdrawn" in the specific competition
    const competitionAgentRecord = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competition.id),
          eq(competitionAgents.agentId, agent.id),
        ),
      )
      .limit(1);

    expect(competitionAgentRecord.length).toBe(1);
    expect(competitionAgentRecord[0]?.status).toBe("withdrawn");
    expect(competitionAgentRecord[0]?.deactivationReason).toContain(
      "Withdrew from competition",
    );
    expect(competitionAgentRecord[0]?.deactivatedAt).toBeDefined();
  });

  test("user cannot leave ended competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Ended Leave User",
      userEmail: "ended-leave@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Ended Leave Agent",
      "Agent for testing ended competition leave",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Start and end competition
    const competitionName = `Ended Leave Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competition = startResponse.competition;

    // End the competition
    await adminClient.endCompetition(competition.id);

    // Try to leave the ended competition
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
    if ("error" in leaveResponse) {
      // When a competition ends, we should get an error about the competition being ended
      expect(leaveResponse.error).toContain(
        "Cannot leave competition that has already ended",
      );
    }
  });

  test("user cannot join/leave non-existent competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Non-Existent Competition User",
      userEmail: "non-existent-comp@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Non-Existent Competition Agent",
      "Agent for testing non-existent competition",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Try to join non-existent competition
    const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";
    const joinResponse = await userClient.joinCompetition(
      fakeCompetitionId,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("not found");
    }

    // Try to leave non-existent competition
    const leaveResponse = await userClient.leaveCompetition(
      fakeCompetitionId,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
    if ("error" in leaveResponse) {
      expect(leaveResponse.error).toContain("not found");
    }
  });

  test("user cannot leave competition agent is not in", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user
    const { client: userClient } = await createPrivyAuthenticatedClient({
      userName: "Not In Competition User",
      userEmail: "not-in-comp@example.com",
    });

    // User creates an agent
    const createAgentResponse = await createTestAgent(
      userClient,
      "Not In Competition Agent",
      "Agent for testing leave without join",
    );
    expect(createAgentResponse.success).toBe(true);
    const agent = (createAgentResponse as AgentProfileResponse).agent;

    // Create competition (but don't join)
    const competitionName = `Not In Competition Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Try to leave competition without joining first
    const leaveResponse = await userClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
    if ("error" in leaveResponse) {
      expect(leaveResponse.error).toContain("not in this competition");
    }
  });

  test("unauthenticated requests to join/leave are rejected", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create an agent (via admin for this test)
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Unauth Test Agent",
    });

    // Create competition
    const competitionName = `Unauth Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Create unauthenticated client
    const unauthClient = createTestClient();

    // Try to join without authentication
    const joinResponse = await unauthClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);

    // Try to leave without authentication
    const leaveResponse = await unauthClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(false);
  });

  test("agent API key authentication also works for join/leave", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user and agent (this gives us agent API key client)
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent API Key Test Agent",
      });

    // Create a pending competition
    const competitionName = `Agent API Key Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Join using agent API key authentication (fallback method)
    const joinResponse = await agentClient.joinCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(true);
    if ("message" in joinResponse) {
      expect(joinResponse.message).toBe("Successfully joined competition");
    }

    // Verify agent is in the competition
    const agentsAfter = await adminClient.getCompetitionAgents(competition.id);
    if ("agents" in agentsAfter) {
      const agentInCompetition = agentsAfter.agents.find(
        (a) => a.id === agent.id,
      );
      expect(agentInCompetition).toBeDefined();
    }

    // Leave using agent API key authentication
    const leaveResponse = await agentClient.leaveCompetition(
      competition.id,
      agent.id,
    );
    expect("success" in leaveResponse && leaveResponse.success).toBe(true);
    if ("message" in leaveResponse) {
      expect(leaveResponse.message).toBe("Successfully left competition");
    }
  });

  test("agent API key cannot be used with different agent ID", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const { client: agent1Client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1 API Key Test",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2 API Key Test",
    });

    // Create a pending competition
    const competitionName = `API Key Mismatch Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });
    const competition = createResponse.competition;

    // Try to join with agent1's API key but agent2's ID
    const joinResponse = await agent1Client.joinCompetition(
      competition.id,
      agent2.id,
    );
    expect("success" in joinResponse && joinResponse.success).toBe(false);
    if ("error" in joinResponse) {
      expect(joinResponse.error).toContain("does not match agent ID in URL");
    }
  });

  describe("Competition Join Date Constraints", () => {
    test("should allow joining when current time is within join date window", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Join Window User",
        userEmail: "join-window@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Join Window Agent",
        "Agent for testing join window constraints",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with join window (past start, future end)
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `Join Window Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with join window",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Verify join dates are set correctly
      expect(competition.joinStartDate).toBe(joinStart.toISOString());
      expect(competition.joinEndDate).toBe(joinEnd.toISOString());

      // Should be able to join (current time is within window)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should reject joining when current time is before join start date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Early Join User",
        userEmail: "early-join@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Early Join Agent",
        "Agent for testing early join rejection",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with future join start date
      const now = new Date();
      const joinStart = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const joinEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

      const competitionName = `Early Join Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with future join start",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Should NOT be able to join (current time is before join start)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(false);
      if ("error" in joinResponse) {
        expect(joinResponse.error).toContain("Competition joining opens at");
        expect(joinResponse.error).toContain(joinStart.toISOString());
      }
    });

    test("should reject joining when current time is after join end date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Late Join User",
        userEmail: "late-join@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Late Join Agent",
        "Agent for testing late join rejection",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with past join end date
      const now = new Date();
      const joinStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      const joinEnd = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const competitionName = `Late Join Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with past join end",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Should NOT be able to join (current time is after join end)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(false);
      if ("error" in joinResponse) {
        expect(joinResponse.error).toContain("Competition joining closed at");
        expect(joinResponse.error).toContain(joinEnd.toISOString());
      }
    });

    test("should allow joining when only join start date is set and current time is after it", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Start Only User",
        userEmail: "start-only@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Start Only Agent",
        "Agent for testing start-only join constraint",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with only join start date (no end date)
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const competitionName = `Start Only Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with only join start date",
        joinStartDate: joinStart.toISOString(),
      });
      const competition = createResponse.competition;

      // Verify only start date is set
      expect(competition.joinStartDate).toBe(joinStart.toISOString());
      expect(competition.joinEndDate).toBeNull();

      // Should be able to join (current time is after join start, no end restriction)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should allow joining when only join end date is set and current time is before it", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "End Only User",
        userEmail: "end-only@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "End Only Agent",
        "Agent for testing end-only join constraint",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with only join end date (no start date)
      const now = new Date();
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `End Only Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with only join end date",
        joinEndDate: joinEnd.toISOString(),
      });
      const competition = createResponse.competition;

      // Verify only end date is set
      expect(competition.joinStartDate).toBeNull();
      expect(competition.joinEndDate).toBe(joinEnd.toISOString());

      // Should be able to join (no start restriction, current time is before join end)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should maintain backward compatibility when no join dates are set", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy-authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Backward Compat User",
        userEmail: "backward-compat@example.com",
      });

      // User creates an agent
      const createAgentResponse = await createTestAgent(
        userClient,
        "Backward Compat Agent",
        "Agent for testing backward compatibility",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with NO join dates (should work like before)
      const competitionName = `Backward Compat Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with no join date constraints",
      });
      const competition = createResponse.competition;

      // Verify no join dates are set
      expect(competition.joinStartDate).toBeNull();
      expect(competition.joinEndDate).toBeNull();

      // Should be able to join (no join date restrictions, only status check applies)
      const joinResponse = await userClient.joinCompetition(
        competition.id,
        agent.id,
      );
      expect("success" in joinResponse && joinResponse.success).toBe(true);
      if ("message" in joinResponse) {
        expect(joinResponse.message).toBe("Successfully joined competition");
      }
    });

    test("should work with admin-created competition via start competition endpoint", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents for the competition
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Agent 1",
      });

      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Start Competition User",
        userEmail: "start-competition@example.com",
      });

      const createAgentResponse = await createTestAgent(
        userClient,
        "Start Competition Agent 2",
        "Agent for testing start competition with join dates",
      );
      expect(createAgentResponse.success).toBe(true);
      const agent2 = (createAgentResponse as AgentProfileResponse).agent;

      // Create competition with join dates and then start it
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `Start Competition Join Dates Test ${Date.now()}`;

      // First create the competition with join dates
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for start with join dates",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });

      // Then start the existing competition
      const startResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id], // Start with one agent
      });

      // Verify competition was created with join dates
      expect(startResponse.success).toBe(true);
      expect(startResponse.competition.joinStartDate).toBe(
        joinStart.toISOString(),
      );
      expect(startResponse.competition.joinEndDate).toBe(joinEnd.toISOString());

      // Even though competition is ACTIVE, agent should still be able to join if dates allow
      // (This tests that the date check happens before the status check)
      const joinResponse = await userClient.joinCompetition(
        startResponse.competition.id,
        agent2.id,
      );

      // This should fail because competition is ACTIVE, not because of join dates
      expect("success" in joinResponse && joinResponse.success).toBe(false);
      if ("error" in joinResponse) {
        expect(joinResponse.error).toContain("already started/ended");
      }
    });

    test("should work with start existing competition endpoint (join dates set at creation)", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents for the competition
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Existing Agent 1",
      });

      // Set join dates for creation
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      // Create competition in PENDING state WITH join dates
      const competitionName = `Start Existing Join Dates Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for start existing with join dates",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });

      // Start the existing competition (join dates already set at creation)
      const startResponse = await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id],
      });

      // Verify competition was started and retains join dates from creation
      expect(startResponse.success).toBe(true);
      expect(startResponse.competition.joinStartDate).toBe(
        joinStart.toISOString(),
      );
      expect(startResponse.competition.joinEndDate).toBe(joinEnd.toISOString());
      expect(startResponse.competition.status).toBe("active");
    });

    test("should validate join dates are properly included in competition response fields", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with join dates
      const now = new Date();
      const joinStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const joinEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const competitionName = `Join Dates Response Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for response field validation",
        joinStartDate: joinStart.toISOString(),
        joinEndDate: joinEnd.toISOString(),
      });

      // Test 1: Create competition response includes join dates
      expect(createResponse.competition.joinStartDate).toBe(
        joinStart.toISOString(),
      );
      expect(createResponse.competition.joinEndDate).toBe(
        joinEnd.toISOString(),
      );

      // Test 2: Get competition details includes join dates
      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Response Test Agent",
      });

      const detailResponse = await agentClient.getCompetition(
        createResponse.competition.id,
      );
      expect(detailResponse.success).toBe(true);
      if ("competition" in detailResponse) {
        expect(detailResponse.competition.joinStartDate).toBe(
          joinStart.toISOString(),
        );
        expect(detailResponse.competition.joinEndDate).toBe(
          joinEnd.toISOString(),
        );
      }

      // Test 3: Get competitions list includes join dates
      const listResponse = await agentClient.getCompetitions("pending");
      expect(listResponse.success).toBe(true);
      if ("competitions" in listResponse) {
        const foundCompetition = listResponse.competitions.find(
          (comp) => comp.id === createResponse.competition.id,
        );
        expect(foundCompetition).toBeDefined();
        expect(foundCompetition?.joinStartDate).toBe(joinStart.toISOString());
        expect(foundCompetition?.joinEndDate).toBe(joinEnd.toISOString());
      }
    });
  });

  describe("Public Competition Access (No Authentication Required)", () => {});

  describe("Trophy Logic", () => {});

  describe("Competition Rewards Logic", () => {});

  test("should get trades for a competition and for a specific agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Trade Viewer Test Agent",
      });

    // Start a competition
    const competitionName = `Trade Viewer Test Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startResponse.competition.id;

    // Execute a trade
    const tradeResponse = await agentClient.executeTrade({
      reason: "testing get trades endpoint",
      fromToken: specificChainTokens.eth.usdc,
      toToken: specificChainTokens.eth.eth,
      amount: "100",
      competitionId,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
    });
    expect(tradeResponse.success).toBe(true);

    // Get competition trades
    const competitionTradesResponse =
      await adminClient.getCompetitionTrades(competitionId);
    expect(competitionTradesResponse.success).toBe(true);
    if (!competitionTradesResponse.success) return; // Type guard
    expect(competitionTradesResponse.trades).toBeDefined();
    expect(competitionTradesResponse.trades.length).toBe(1);
    expect(competitionTradesResponse.trades[0]?.agentId).toBe(agent.id);

    // Get agent trades in competition
    const agentTradesResponse = await adminClient.getAgentTradesInCompetition(
      competitionId,
      agent.id,
    );
    expect(agentTradesResponse.success).toBe(true);
    if (!agentTradesResponse.success) return; // Type guard
    expect(agentTradesResponse.trades).toBeDefined();
    expect(agentTradesResponse.trades.length).toBe(1);
    expect(agentTradesResponse.trades[0]?.agentId).toBe(agent.id);
  });

  describe("Participant Limits", () => {
    test("should create competition with participant limit", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 3;
      const competitionName = `Limited Competition ${Date.now()}`;

      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition with participant limit",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        maxParticipants,
      })) as CreateCompetitionResponse;

      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBe(maxParticipants);
    });

    test("should enforce participant limit during registration", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 2;
      const competitionName = `Limited Registration Test ${Date.now()}`;

      // Create competition with limit
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition with 2 participant limit",
        maxParticipants,
      });

      // Create multiple agents for testing
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Limit Test Agent 1",
        });

      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Limit Test Agent 2",
        });

      const { agent: agent3, client: client3 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Limit Test Agent 3",
        });

      const competitionId = createResponse.competition.id;

      // Register first agent - should succeed
      const join1Result = await client1.joinCompetition(
        competitionId,
        agent1.id,
      );
      expect(join1Result.success).toBe(true);

      // Register second agent - should succeed (at limit)
      const join2Result = await client2.joinCompetition(
        competitionId,
        agent2.id,
      );
      expect(join2Result.success).toBe(true);

      // Verify that all client types get correct participant information while competition is in pending status
      // Test 1: Admin client
      const adminDetailResponse =
        await adminClient.getCompetition(competitionId);
      expect(adminDetailResponse.success).toBe(true);
      const adminCompetition = (
        adminDetailResponse as CompetitionDetailResponse
      ).competition;
      expect(adminCompetition.status).toBe("pending");
      expect(adminCompetition.maxParticipants).toBe(maxParticipants); // Max participants limit
      expect(adminCompetition.stats?.totalAgents).toBe(2); // Current registered participants
      expect(adminCompetition.registeredParticipants).toBe(2);

      // Test 2: Agent client (using agent1's client)
      const agentDetailResponse = await client1.getCompetition(competitionId);
      expect(agentDetailResponse.success).toBe(true);
      const agentCompetition = (
        agentDetailResponse as CompetitionDetailResponse
      ).competition;
      expect(agentCompetition.status).toBe("pending");
      expect(agentCompetition.maxParticipants).toBe(maxParticipants); // Max participants limit
      expect(agentCompetition.stats?.totalAgents).toBe(2); // Current registered participants
      expect(agentCompetition.registeredParticipants).toBe(2);

      // Test 3: User client (need to create one)
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "Participant Count Test User",
        userEmail: "participant-test@example.com",
      });
      const userDetailResponse = await userClient.getCompetition(competitionId);
      expect(userDetailResponse.success).toBe(true);
      const userCompetition = (userDetailResponse as CompetitionDetailResponse)
        .competition;
      expect(userCompetition.status).toBe("pending");
      expect(userCompetition.maxParticipants).toBe(maxParticipants); // Max participants limit
      expect(userCompetition.stats?.totalAgents).toBe(2); // Current registered participants
      expect(userCompetition.registeredParticipants).toBe(2);

      // Try to register third agent - should fail (over limit)
      const join3Result = (await client3.joinCompetition(
        competitionId,
        agent3.id,
      )) as ErrorResponse;
      expect(join3Result.success).toBe(false);
      expect(join3Result.error).toContain("maximum participant limit");
    });

    test("should return participant count information in API responses", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 5;
      const competitionName = `Count Test Competition ${Date.now()}`;

      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition for testing participant count responses",
        maxParticipants,
      });

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Count Test Agent",
      });

      const competitionId = createResponse.competition.id;

      // Check competition details endpoint
      const detailResponse = (await agentClient.getCompetition(
        competitionId,
      )) as CompetitionDetailResponse;
      expect(detailResponse.success).toBe(true);
      expect(detailResponse.competition.maxParticipants).toBe(maxParticipants);
      expect(detailResponse.competition.registeredParticipants).toBe(0);

      // Check competitions list endpoint
      const listResponse = (await agentClient.getCompetitions(
        "pending",
      )) as UpcomingCompetitionsResponse;
      expect(listResponse.success).toBe(true);

      const competition = listResponse.competitions.find(
        (c) => c.id === competitionId,
      );
      expect(competition).toBeDefined();
      expect(competition!.maxParticipants).toBe(maxParticipants);
      expect(competition!.registeredParticipants).toBe(0);

      // Check competition agents endpoint
      const agentsResponse = (await agentClient.getCompetitionAgents(
        competitionId,
      )) as CompetitionAgentsResponse;
      expect(agentsResponse.success).toBe(true);
      expect(agentsResponse.pagination.total).toBe(0); // current participant count
    });

    test("should handle competition without participant limit", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Unlimited Competition ${Date.now()}`;

      // Test that unlimited competitions work as before
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition without participant limit",
        // maxParticipants not specified - should default to null/unlimited
      });

      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBeNull();
    });

    test("should validate participant limit minimum value", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Invalid Limit Competition ${Date.now()}`;

      // Test that maxParticipants must be >= 1 if specified
      const result = await adminClient.createCompetition({
        name: competitionName,
        description: "Competition with invalid limit",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        maxParticipants: 0,
      });

      expect(result.success).toBe(false);
    });

    test("should work with pending competitions in list view", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 3;
      const competitionName = `Pending Limit Test ${Date.now()}`;

      // Test that pending competitions show participant limits in list view
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Pending competition with participant limit",
        maxParticipants,
      });

      const { client: agentClient } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Pending Limit Test Agent",
      });

      const pendingCompetitions = (await agentClient.getCompetitions(
        "pending",
      )) as UpcomingCompetitionsResponse;
      expect(pendingCompetitions.success).toBe(true);

      const ourCompetition = pendingCompetitions.competitions.find(
        (c) => c.id === createResponse.competition.id,
      ) as EnhancedCompetition;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBe(maxParticipants);
      expect(ourCompetition.registeredParticipants).toBe(0);
    });

    test("should fail to register if maximum participant limit is reached", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 1;
      const competitionName = `Single Participant Test ${Date.now()}`;

      // Create competition with very low limit to test edge case
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Competition allowing only 1 participant",
        maxParticipants,
      });

      // Create two agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Single Slot Agent 1",
        });

      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Single Slot Agent 2",
        });

      const competitionId = createResponse.competition.id;

      // First registration should succeed
      const join1Result = await client1.joinCompetition(
        competitionId,
        agent1.id,
      );
      expect(join1Result.success).toBe(true);

      // Second registration should fail immediately
      const join2Result = (await client2.joinCompetition(
        competitionId,
        agent2.id,
      )) as ErrorResponse;
      expect(join2Result.success).toBe(false);
      expect(join2Result.error).toContain("maximum participant limit");
      expect(join2Result.error).toContain("1");

      // Verify the competition shows correct participant count
      const agentsResponse = (await client1.getCompetitionAgents(
        competitionId,
      )) as CompetitionAgentsResponse;
      expect(agentsResponse.success).toBe(true);
      expect(agentsResponse.pagination.total).toBe(1);
    });

    test("should start a competition if max == registered participants", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Test Agent",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Test Agent",
      });
      const { agent: agent3 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Competition Test Agent",
      });

      // Create competition
      const competitionName = `Start Competition Test ${Date.now()}`;
      const maxParticipants = 2;
      const createResponse = (await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition to start",
        maxParticipants,
      })) as CreateCompetitionResponse;
      expect(createResponse.success).toBe(true);
      const competitionId = createResponse.competition.id;

      // Add 2 the agents to the competition
      const addAgentResponse1 = await adminClient.addAgentToCompetition(
        competitionId,
        agent1.id,
      );
      expect(addAgentResponse1.success).toBe(true);
      const addAgentResponse2 = await adminClient.addAgentToCompetition(
        competitionId,
        agent2.id,
      );
      expect(addAgentResponse2.success).toBe(true);

      // Attempt to add the 3rd agent
      const addAgentResponse3 = (await adminClient.addAgentToCompetition(
        competitionId,
        agent3.id,
      )) as ErrorResponse;
      expect(addAgentResponse3.success).toBe(false);
      expect(addAgentResponse3.error).toBe(
        "Competition has reached maximum participant limit (2)",
      );

      // Start the competition
      const startResponse = await adminClient.startCompetition({
        competitionId,
      });
      expect(startResponse.success).toBe(true);
    });

    test("should return maxParticipants in admin start competition response", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 3;

      // First create agents to start the competition with
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Test Agent 1",
      });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Start Test Agent 2",
      });

      // Create competition with maxParticipants first
      const competitionName = `Start Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description:
          "Test competition with participant limit for start endpoint",
        maxParticipants,
      });

      // Start the existing competition
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id, agent2.id],
      })) as StartCompetitionResponse;

      expect(startResponse.success).toBe(true);
      expect(startResponse.competition.maxParticipants).toBe(maxParticipants);
    });

    test("should return maxParticipants in admin end competition response", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 5;

      // Create agents and start a competition
      const { agent: agent1, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "End Test Agent 1",
        });

      // Create competition with maxParticipants first
      const competitionName = `End Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for end endpoint",
        maxParticipants,
      });

      // Start the competition
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent1.id],
      })) as StartCompetitionResponse;

      expect(startResponse.success).toBe(true);

      // End the competition (endCompetition just returns success/error, not competition data)
      const endResponse = await adminClient.endCompetition(
        startResponse.competition.id,
      );
      expect(endResponse.success).toBe(true);

      // Verify maxParticipants is still accessible via detail endpoint after ending
      const detailAfterEnd = (await agentClient.getCompetition(
        startResponse.competition.id,
      )) as CompetitionDetailResponse;
      expect(detailAfterEnd.success).toBe(true);
      expect(detailAfterEnd.competition.maxParticipants).toBe(maxParticipants);
      expect(detailAfterEnd.competition.registeredParticipants).toBe(1);
    });

    test("should return maxParticipants and registeredParticipants in user competitions endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 4;

      // Create a Privy authenticated user
      const { client: userClient } = await createPrivyAuthenticatedClient({
        userName: "User Competition Test",
      });

      // Create an agent for this user via Privy session
      const agentResponse = (await createTestAgent(
        userClient,
        "User Competition Agent",
        "Agent for user competition endpoint test",
      )) as AgentProfileResponse;
      expect(agentResponse.success).toBe(true);
      const agent = agentResponse.agent;

      // Create competition with maxParticipants first
      const competitionName = `User Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for user endpoint",
        maxParticipants,
      });

      // Start the competition with this agent
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      // Get user competitions
      const userCompetitionsResponse = (await userClient.getUserCompetitions({
        limit: 10,
      })) as UserCompetitionsResponse;
      expect(userCompetitionsResponse.success).toBe(true);

      // Find our competition in the results
      const ourCompetition = userCompetitionsResponse.competitions.find(
        (c) => c.id === startResponse.competition.id,
      ) as CompetitionWithAgents;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBe(maxParticipants);
      expect(ourCompetition.registeredParticipants).toBe(1);
    });

    test("should return maxParticipants and registeredParticipants in agent competitions endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const maxParticipants = 6;

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Competition Test",
        });

      // Create competition with maxParticipants first
      const competitionName = `Agent Competition Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for agent endpoint",
        maxParticipants,
      });
      // Start the competition with this agent
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;

      expect(startResponse.success).toBe(true);

      // Get agent competitions
      const agentCompetitionsResponse = (await agentClient.getAgentCompetitions(
        agent.id,
      )) as AgentCompetitionsResponse;
      expect(agentCompetitionsResponse.success).toBe(true);

      // Find our competition in the results
      const ourCompetition = agentCompetitionsResponse.competitions.find(
        (c) => c.id === startResponse.competition.id,
      ) as EnhancedCompetition;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBe(maxParticipants);
      expect(ourCompetition.registeredParticipants).toBe(1);
    });

    test("should return maxParticipants and registeredParticipants in competitions endpoint", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Competitions Test Agent",
      });

      // Create competition
      const competitionName = `Competitions Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for competitions endpoint",
      });

      // Start the competition
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      // Get upcoming competitions
      const competitionsResponse =
        (await adminClient.getCompetitions()) as UpcomingCompetitionsResponse;
      expect(competitionsResponse.success).toBe(true);

      const ourCompetition = competitionsResponse
        .competitions[0] as EnhancedCompetition;

      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBeNull();
      expect(ourCompetition.registeredParticipants).toBe(1);
    });

    test("should handle null maxParticipants across all endpoints", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Null Limit Test Agent",
        });

      // Create competition without maxParticipants (should be null/unlimited)
      const competitionName = `Null Limit Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition without participant limit",
        // maxParticipants not specified - defaults to null/unlimited
      });
      const competitionId = createResponse.competition.id;
      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBeNull();

      // Test that the same null value appears in other endpoints
      const detailResponse = (await agentClient.getCompetition(
        competitionId,
      )) as CompetitionDetailResponse;
      expect(detailResponse.success).toBe(true);
      expect(detailResponse.competition.maxParticipants).toBeNull();
      expect(detailResponse.competition.registeredParticipants).toBe(0);

      // Test agent competitions endpoint
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);
      const agentCompetitionsResponse = (await agentClient.getAgentCompetitions(
        agent.id,
      )) as AgentCompetitionsResponse;
      expect(agentCompetitionsResponse.success).toBe(true);

      const ourCompetition = agentCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as EnhancedCompetition;
      expect(ourCompetition).toBeDefined();
      expect(ourCompetition.maxParticipants).toBeNull();
      expect(ourCompetition.registeredParticipants).toBe(1);

      // Test user competitions endpoint
      const userCompetitionsResponse = (await agentClient.getUserCompetitions({
        limit: 10,
      })) as UserCompetitionsResponse;
      expect(userCompetitionsResponse.success).toBe(true);

      const ourCompetition2 = userCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as CompetitionWithAgents;
      expect(ourCompetition2).toBeDefined();
      expect(ourCompetition2.maxParticipants).toBeNull();
      expect(ourCompetition2.registeredParticipants).toBe(1);

      const multipleCompetitionsResponse =
        (await agentClient.getCompetitions()) as UpcomingCompetitionsResponse;
      expect(multipleCompetitionsResponse.success).toBe(true);

      const ourCompetition3 = multipleCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as CompetitionWithAgents;
      expect(ourCompetition3).toBeDefined();
      expect(ourCompetition3.maxParticipants).toBeNull();
      expect(ourCompetition3.registeredParticipants).toBe(1);
    });

    test("should handle disqualifying agent in registeredParticipants", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Null Limit Test Agent",
        });

      // Create competition without maxParticipants (should be null/unlimited)
      const competitionName = `Null Limit Test ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition without participant limit",
        // maxParticipants not specified - defaults to null/unlimited
      });
      const competitionId = createResponse.competition.id;
      expect(createResponse.success).toBe(true);
      expect(createResponse.competition.maxParticipants).toBeNull();

      // Test agent competitions endpoint
      const startResponse = (await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse.competition.id,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      // Remove the agent from the competition
      const removeResponse = await adminClient.removeAgentFromCompetition(
        competitionId,
        agent.id,
        "Test disqualification",
      );
      expect(removeResponse.success).toBe(true);

      // Test multiple competitions endpoint, but with zero registered participants (by DQ'ing the agent)
      const multipleCompetitionsResponse =
        (await agentClient.getCompetitions()) as UpcomingCompetitionsResponse;
      expect(multipleCompetitionsResponse.success).toBe(true);

      const ourCompetition3 = multipleCompetitionsResponse.competitions.find(
        (c) => c.id === competitionId,
      ) as CompetitionWithAgents;
      expect(ourCompetition3).toBeDefined();
      expect(ourCompetition3.maxParticipants).toBeNull();
      expect(ourCompetition3.registeredParticipants).toBe(0);
    });

    test("inactive agents should have last-place rank and appear at end of list", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create 5 agents for testing
      const agents = await Promise.all([
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Alpha",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Beta",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Gamma",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Delta",
        }),
        registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Epsilon",
        }),
      ]);

      // Create and start a competition with all 5 agents
      const agentIds = agents.map((a) => a.agent.id);
      const competitionName = `Inactive Rank Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds,
      });
      const competitionId = competitionResponse.competition.id;
      await wait(100);

      // Deactivate 2 agents (Beta and Delta)
      const betaAgentId = agentIds[1];
      const deltaAgentId = agentIds[3];
      expect(betaAgentId).toBeDefined();
      expect(deltaAgentId).toBeDefined();
      await adminClient.removeAgentFromCompetition(
        competitionId,
        betaAgentId!,
        "Test disqualification - Beta",
      );
      await adminClient.removeAgentFromCompetition(
        competitionId,
        deltaAgentId!,
        "Test disqualification - Delta",
      );

      // Fetch all agents including inactive ones, sorted by rank
      const agentsResponse = (await adminClient.getCompetitionAgents(
        competitionId,
        {
          includeInactive: true,
          sort: "rank",
        },
      )) as CompetitionAgentsResponse;

      expect(agentsResponse.success).toBe(true);
      expect(agentsResponse.agents).toBeDefined();
      expect(agentsResponse.agents.length).toBe(5);

      const fetchedAgents = agentsResponse.agents;
      const totalAgents = agentsResponse.pagination.total;

      // Verify we have 2 inactive and 3 active agents
      const inactiveAgents = fetchedAgents.filter((agent) => !agent.active);
      const activeAgents = fetchedAgents.filter((agent) => agent.active);
      expect(inactiveAgents.length).toBe(2);
      expect(activeAgents.length).toBe(3);

      // Verify agents have correct ranks
      const activeRanks = activeAgents.map((a) => a.rank).sort((a, b) => a - b);
      expect(activeRanks).toEqual([1, 2, 3]);
      for (const inactiveAgent of inactiveAgents) {
        expect(inactiveAgent.rank).toBe(totalAgents);
      }
      const inactiveAgentIds = inactiveAgents.map((a) => a.id).sort();
      expect(inactiveAgentIds).toEqual([betaAgentId, deltaAgentId].sort());
    });
  });

  describe("Participation Rules Enforcement", () => {
    test("should reject blocklisted agent from joining", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Blocked Agent",
        });

      // Create competition with blocklist
      const createResponse = await adminClient.createCompetition({
        name: "Blocklist Test Competition",
        type: "trading",
        blocklist: [agent.id],
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Try to join - should be rejected
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(false);
      expect((joinResponse as ErrorResponse).error).toContain("not permitted");
    });

    test("should reject agent when competition is allowlist-only", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create two agents
      const { agent: allowedAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Allowed Agent",
      });
      const { agent: notAllowedAgent, client: notAllowedClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Not Allowed Agent",
        });

      // Create competition with allowlist-only mode
      const createResponse = await adminClient.createCompetition({
        name: "Allowlist Only Competition",
        type: "trading",
        allowlistOnly: true,
        allowlist: [allowedAgent.id],
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Try to join with non-allowlisted agent - should be rejected
      const joinResponse = await notAllowedClient.joinCompetition(
        competitionId,
        notAllowedAgent.id,
      );

      expect(joinResponse.success).toBe(false);
      expect((joinResponse as ErrorResponse).error).toContain("allowlist-only");
    });

    test("should allow VIP agent to bypass all requirements", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent (with no rank)
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "VIP Agent",
        });

      // Create competition with VIP list, stake requirement, and rank requirement
      const createResponse = await adminClient.createCompetition({
        name: "VIP Bypass Competition",
        type: "trading",
        vips: [agent.id],
        minimumStake: 1000, // VIP should bypass this
        minRecallRank: 10, // VIP should bypass this too
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Join should succeed despite no stake and no rank
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(true);
    });

    test("should allow allowlisted agent to bypass rank requirement", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent (with no rank)
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Allowlisted Agent",
        });

      // Create competition with allowlist and rank requirement (but no stake requirement)
      const createResponse = await adminClient.createCompetition({
        name: "Allowlist Bypass Competition",
        type: "trading",
        allowlist: [agent.id],
        minRecallRank: 10, // Allowlist should bypass this
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Join should succeed despite no rank
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(true);
    });

    test("should reject agent with no rank when rank requirement exists", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "No Rank Agent",
        });

      // Create competition with rank requirement
      const createResponse = await adminClient.createCompetition({
        name: "Rank Requirement Competition",
        type: "trading",
        minRecallRank: 5, // Requires top 5 rank
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Try to join - should be rejected (agent has no rank)
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(false);
      expect((joinResponse as ErrorResponse).error).toContain(
        "has not yet established a rank",
      );
    });

    test("should allow agent to join when competition has no participation rules", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create agent
      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Regular Agent",
        });

      // Create competition with NO participation rules
      const createResponse = await adminClient.createCompetition({
        name: "No Rules Competition",
        type: "trading",
        // No vips, allowlist, blocklist, or minRecallRank
      });
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Join should succeed (backward compatible)
      const joinResponse = await agentClient.joinCompetition(
        competitionId,
        agent.id,
      );

      expect(joinResponse.success).toBe(true);
    });
  });

  describe("Competition Partners", () => {});

  describe("Rewards Ineligibility", () => {});

  describe("Boost Time Decay Rate Configuration", () => {});

  describe("Paper Trading Initial Balances Configuration", () => {});

  describe("Paper Trading Config Configuration", () => {});
});
