import { beforeEach, describe, expect, test } from "vitest";

import { getWaitlistedAgents } from "@/database/repositories/competition-repository.js";
import {
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

describe("Competition Waitlist Functionality", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("should add agents as active when under capacity", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with maxParticipants
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: `Test Capacity ${Date.now()}`,
      maxParticipants: 2,
    });
    const competitionId = competitionResponse.competition.id;

    // Register first agent
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

    const joinResponse1 = await client1.joinCompetition(
      competitionId,
      agent1.id,
    );
    expect(joinResponse1.success).toBe(true);

    // Get competition agents and verify agent1 is active
    const competitionAgents =
      await adminClient.getCompetitionAgents(competitionId);
    expect(
      "agents" in competitionAgents && competitionAgents.agents,
    ).toBeTruthy();
    if ("agents" in competitionAgents) {
      expect(competitionAgents.agents).toHaveLength(1);
      expect(competitionAgents.agents[0]?.id).toBe(agent1.id);
    }
  });

  test("should add agents as waitlisted when at capacity", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with maxParticipants
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: `Test Waitlist ${Date.now()}`,
      maxParticipants: 2,
    });
    const competitionId = competitionResponse.competition.id;

    // Register and join first two agents (active)
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Agent One",
      });
    await client1.joinCompetition(competitionId, agent1.id);

    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Agent Two",
      });
    await client2.joinCompetition(competitionId, agent2.id);

    // Register and join third agent (should be waitlisted)
    const { agent: agent3, client: client3 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Waitlisted Agent",
      });

    // This should succeed even though at capacity (agent gets waitlisted)
    const joinResponse3 = await client3.joinCompetition(
      competitionId,
      agent3.id,
    );
    expect(joinResponse3.success).toBe(true);

    // Get active agents
    const competitionAgents =
      await adminClient.getCompetitionAgents(competitionId);
    if ("agents" in competitionAgents) {
      expect(competitionAgents.agents).toHaveLength(2);
      expect(competitionAgents.agents.map((a) => a.id)).toContain(agent1.id);
      expect(competitionAgents.agents.map((a) => a.id)).toContain(agent2.id);
    }

    // Check waitlisted agents
    const waitlistedAgents = await getWaitlistedAgents(competitionId);
    expect(waitlistedAgents).toHaveLength(1);
    expect(waitlistedAgents[0]).toBe(agent3.id);
  });

  test("should promote waitlisted agents when limit increases", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with maxParticipants
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: `Test Promotion ${Date.now()}`,
      maxParticipants: 1,
    });
    const competitionId = competitionResponse.competition.id;

    // Join first agent (active)
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Initially Active",
      });
    await client1.joinCompetition(competitionId, agent1.id);

    // Join second agent (waitlisted)
    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Initially Waitlisted",
      });
    await client2.joinCompetition(competitionId, agent2.id);

    // Join third agent (also waitlisted)
    const { agent: agent3, client: client3 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Also Waitlisted",
      });
    await client3.joinCompetition(competitionId, agent3.id);

    // Verify initial state
    const waitlistedBefore = await getWaitlistedAgents(competitionId);
    expect(waitlistedBefore).toHaveLength(2);
    expect(waitlistedBefore).toContain(agent2.id);
    expect(waitlistedBefore).toContain(agent3.id);

    // Update competition limit to 3
    const updateResponse = await adminClient.updateCompetition(competitionId, {
      maxParticipants: 3,
    });
    expect(updateResponse.success).toBe(true);

    // Check that waitlisted agents were promoted
    const waitlistedAfter = await getWaitlistedAgents(competitionId);
    expect(waitlistedAfter).toHaveLength(0);

    // All agents should now be active
    const competitionAgents =
      await adminClient.getCompetitionAgents(competitionId);
    if ("agents" in competitionAgents) {
      expect(competitionAgents.agents).toHaveLength(3);
      const activeAgentIds = competitionAgents.agents.map((a) => a.id);
      expect(activeAgentIds).toContain(agent1.id);
      expect(activeAgentIds).toContain(agent2.id);
      expect(activeAgentIds).toContain(agent3.id);
    }
  });

  test("should promote agents in order of registration (oldest first)", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with maxParticipants
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: `Test Order ${Date.now()}`,
      maxParticipants: 1,
    });
    const competitionId = competitionResponse.competition.id;

    // Join agents in order
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Agent",
      });
    await client1.joinCompetition(competitionId, agent1.id);

    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "First Waitlisted",
      });
    await client2.joinCompetition(competitionId, agent2.id);

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { agent: agent3, client: client3 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Second Waitlisted",
      });
    await client3.joinCompetition(competitionId, agent3.id);

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { agent: agent4, client: client4 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Third Waitlisted",
      });
    await client4.joinCompetition(competitionId, agent4.id);

    // Check initial waitlist order
    const waitlistedBefore = await getWaitlistedAgents(competitionId);
    expect(waitlistedBefore).toEqual([agent2.id, agent3.id, agent4.id]);

    // Increase limit to 2 (should promote agent2 only)
    await adminClient.updateCompetition(competitionId, {
      maxParticipants: 2,
    });

    const waitlistedAfter1 = await getWaitlistedAgents(competitionId);
    expect(waitlistedAfter1).toEqual([agent3.id, agent4.id]);

    // Increase limit to 3 (should promote agent3 only)
    await adminClient.updateCompetition(competitionId, {
      maxParticipants: 3,
    });

    const waitlistedAfter2 = await getWaitlistedAgents(competitionId);
    expect(waitlistedAfter2).toEqual([agent4.id]);

    // Increase limit to 4 (should promote agent4)
    await adminClient.updateCompetition(competitionId, {
      maxParticipants: 4,
    });

    const waitlistedAfter3 = await getWaitlistedAgents(competitionId);
    expect(waitlistedAfter3).toHaveLength(0);

    // All agents should now be active
    const competitionAgents =
      await adminClient.getCompetitionAgents(competitionId);
    if ("agents" in competitionAgents) {
      expect(competitionAgents.agents).toHaveLength(4);
    }
  });

  test("should retrieve waitlisted agents via API endpoint", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with maxParticipants
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: `Test API Endpoint ${Date.now()}`,
      maxParticipants: 1,
    });
    const competitionId = competitionResponse.competition.id;

    // Join first agent (active)
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active via API",
      });
    await client1.joinCompetition(competitionId, agent1.id);

    // Join second agent (waitlisted)
    const { agent: agent2, client: client2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Waitlisted via API",
      });
    await client2.joinCompetition(competitionId, agent2.id);

    // Call the waitlist API endpoint
    const response = (await adminClient.request(
      "get",
      `/api/competitions/${competitionId}/agents/waitlist`,
    )) as {
      success: boolean;
      competitionId: string;
      totalWaitlisted: number;
      waitlistedAgents: Array<{
        id: string;
        name: string;
        status: string;
      }>;
    };

    expect(response.success).toBe(true);
    expect(response.competitionId).toBe(competitionId);
    expect(response.totalWaitlisted).toBe(1);
    expect(response.waitlistedAgents).toHaveLength(1);
    expect(response.waitlistedAgents[0]?.id).toBe(agent2.id);
    expect(response.waitlistedAgents[0]?.name).toBe("Waitlisted via API");
    expect(response.waitlistedAgents[0]?.status).toBe("registered");
  });

  test("should handle partial promotions correctly", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: `Test Partial ${Date.now()}`,
      maxParticipants: 1,
    });
    const competitionId = competitionResponse.competition.id;

    // Add 4 agents (1 active, 3 waitlisted)
    const agents = [];
    for (let i = 0; i < 4; i++) {
      const { agent, client } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `Agent ${i + 1}`,
      });
      await client.joinCompetition(competitionId, agent.id);
      agents.push(agent);
    }

    // Increase limit to 2 (should promote 1 agent)
    await adminClient.updateCompetition(competitionId, {
      maxParticipants: 2,
    });

    const activeAgents = await adminClient.getCompetitionAgents(competitionId);
    const waitlistedAgents = await getWaitlistedAgents(competitionId);

    if ("agents" in activeAgents) {
      expect(activeAgents.agents).toHaveLength(2);
      expect(waitlistedAgents).toHaveLength(2);

      // Agents 1 and 2 should be active, 3 and 4 waitlisted
      const activeIds = activeAgents.agents.map((a) => a.id);
      expect(activeIds).toContain(agents[0]!.id);
      expect(activeIds).toContain(agents[1]!.id);
      expect(waitlistedAgents).toContain(agents[2]!.id);
      expect(waitlistedAgents).toContain(agents[3]!.id);
    }
  });
});
