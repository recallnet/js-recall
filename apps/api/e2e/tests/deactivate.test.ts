import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { BlockchainType } from "@recallnet/services/types";
import {
  AdminAgentResponse,
  AdminAgentsListResponse,
  AgentProfileResponse,
  ErrorResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import config from "@/config/index.js";

// TODO: need user deactivation test

describe("Agent Deactivation API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("admin can deactivate an agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent to Deactivate",
    });

    const competitionName = `Test Competition ${Date.now()}`;
    await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Deactivate the agent
    const reason = "Violated competition rules by using external API";
    const deactivateResponse = (await adminClient.deactivateAgent(
      agent.id,
      reason,
    )) as AdminAgentResponse;

    // Verify deactivation response
    expect(deactivateResponse.success).toBe(true);
    expect(deactivateResponse.agent).toBeDefined();
    expect(deactivateResponse.agent.id).toBe(agent.id);
    expect(deactivateResponse.agent.name).toBe("Agent to Deactivate");
    expect(deactivateResponse.agent.status).not.toBe("active");
    expect(deactivateResponse.agent.deactivationReason).toBe(reason);
    expect(deactivateResponse.agent.deactivationDate).toBeDefined();

    // List all agents to verify the deactivation status is persisted
    const agentsResponse =
      (await adminClient.listAgents()) as AdminAgentsListResponse;
    const deactivatedAgent = agentsResponse.agents.find(
      (a) => a.id === agent.id,
    );
    expect(deactivatedAgent).toBeDefined();
    expect(deactivatedAgent?.status).not.toBe("active");
  });

  test("deactivated agent cannot access API endpoints", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a agent and get the client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "To Be Blocked",
    });

    // Start a competition with the agent
    const competitionName = `Deactivation Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competitionResponse.competition.id;

    // Verify agent can access API before deactivation
    const profileResponse = await client.getAgentProfile();
    expect(profileResponse.success).toBe(true);

    // Deactivate the agent
    const reason = "Testing deactivation blocking";
    const deactivateResponse = await adminClient.deactivateAgent(
      agent.id,
      reason,
    );
    expect(deactivateResponse.success).toBe(true);

    // Attempt to get profile - should fail with deactivation message
    try {
      await client.getAgentProfile();
      // Should not reach here - access should be blocked
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect error with deactivation message
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data).toBeDefined();
        expect(error.response.data.error).toContain("deactivated");
        expect(error.response.data.error).toContain(reason);
      }
    }

    // Attempt to execute a trade - should also fail with deactivation message
    try {
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      await client.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: "100",
        competitionId,
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason,
      });
      // Should not reach here - trade should be blocked
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect error with deactivation message
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(403);
        expect(error.response.data).toBeDefined();
        expect(error.response.data.error).toContain("deactivated");
      }
    }
  });

  test("admin can reactivate a deactivated agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a agent and get the client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "To Be Reactivated",
    });

    // Start a competition with the agent
    const competitionName = `Reactivation Test ${Date.now()}`;
    await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Deactivate the agent
    const reason = "Temporary deactivation for testing";
    const deactivateResponse = await adminClient.deactivateAgent(
      agent.id,
      reason,
    );
    expect(deactivateResponse.success).toBe(true);

    // Verify agent is blocked from API
    try {
      await client.getAgentProfile();
      expect(false).toBe(true); // Should not succeed
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Reactivate the agent
    const reactivateResponse = (await adminClient.reactivateAgent(
      agent.id,
    )) as AdminAgentResponse;
    expect(reactivateResponse.success).toBe(true);
    expect(reactivateResponse.agent).toBeDefined();
    expect(reactivateResponse.agent.id).toBe(agent.id);
    expect(reactivateResponse.agent.status).toBe("active");

    // Wait a moment for any cache to update
    await wait(100);

    // Verify agent can access API after reactivation
    const profileResponse =
      (await client.getAgentProfile()) as AgentProfileResponse;
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.agent.id).toBe(agent.id);
    expect(profileResponse.agent.status).toBe("active");
  });

  test("non-admin cannot deactivate a agent", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents
    const { client: client1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Two",
    });

    // Start a competition with both agents
    const competitionName = `Non-Admin Test ${Date.now()}`;
    await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });

    // Agent One tries to deactivate Agent Two (should fail)
    const deactivateResponse = (await client1.deactivateAgent(
      agent2.id,
      "Unauthorized deactivation attempt",
    )) as ErrorResponse;

    // Verify the operation failed due to lack of admin rights
    expect(deactivateResponse.success).toBe(false);
    expect(deactivateResponse.error).toBeDefined();

    // Verify Agent Two wasn't actually deactivated
    const agentsResponse =
      (await adminClient.listAgents()) as AdminAgentsListResponse;
    const agentTwoInfo = agentsResponse.agents.find((a) => a.id === agent2.id);
    expect(agentTwoInfo).toBeDefined();
    expect(agentTwoInfo?.status).not.toBe(false);
  });

  test("inactive agents are filtered from leaderboard", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register three agents for the competition
    const { client: client1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Agent 1",
      });
    const { client: client2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Active Agent 2",
      });
    const { client: client3, agent: agent3 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Inactive Agent",
      });

    // Create competition with all three agents
    const competitionName = `Leaderboard Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });
    const competition = startResult.competition;
    const competitionId = competition.id;

    // Make some trades to differentiate portfolio values
    // We'll have Agent 3 (to be deactivated) make some trades to put them on the leaderboard
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Have Agent 3 execute a trade
    await client3.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "100",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "inactive agents are filtered from leaderboard",
    });

    // Have the other agents make trades too to populate leaderboard
    await client1.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "50",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "inactive agents are filtered from leaderboard",
    });

    await client2.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "75",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "inactive agents are filtered from leaderboard",
    });

    // Wait a moment for portfolio values to update
    await wait(1000);

    // Check leaderboard before deactivation
    const leaderboardBefore = await client1.getCompetitionAgents(
      competitionId,
      { sort: "rank" },
    );
    expect(leaderboardBefore.success).toBe(true);
    if (!leaderboardBefore.success) throw new Error("Failed to get agents");

    expect(leaderboardBefore.agents).toBeDefined();

    // Verify all agents are active before deactivation
    const inactiveAgentsBefore = leaderboardBefore.agents.filter(
      (a) => !a.active,
    );
    expect(inactiveAgentsBefore.length).toBe(0);

    // All three agents should be in the active leaderboard
    const agentIds = leaderboardBefore.agents.map((entry) => entry.id);
    expect(agentIds).toContain(agent1.id);
    expect(agentIds).toContain(agent2.id);
    expect(agentIds).toContain(agent3.id);

    // Now deactivate agent3
    const reason = "Deactivated for leaderboard test";
    const deactivateResponse = await adminClient.removeAgentFromCompetition(
      competitionId,
      agent3.id,
      reason,
    );
    expect(deactivateResponse.success).toBe(true);

    // Check leaderboard after deactivation (include inactive agents)
    const leaderboardAfter = await client1.getCompetitionAgents(competitionId, {
      sort: "rank",
      includeInactive: true,
    });
    expect(leaderboardAfter.success).toBe(true);
    if (!leaderboardAfter.success) throw new Error("Failed to get agents");

    expect(leaderboardAfter.agents).toBeDefined();
    const inactiveAgentsAfter = leaderboardAfter.agents.filter(
      (a) => !a.active,
    );
    expect(inactiveAgentsAfter.length).toBeGreaterThan(0);

    // Verify agent3 is now in the inactive agents, not in the active list
    // Active leaderboard should only contain agent1 and agent2
    const activeAgentsAfter = leaderboardAfter.agents.filter((a) => a.active);
    const activeAgentIds = activeAgentsAfter.map((entry) => entry.id);
    expect(activeAgentIds).toContain(agent1.id);
    expect(activeAgentIds).toContain(agent2.id);
    expect(activeAgentIds).not.toContain(agent3.id);

    // Verify inactive agent array contains only agent3
    expect(inactiveAgentsAfter.length).toBe(1);
    const inactiveAgent = inactiveAgentsAfter[0];
    expect(inactiveAgent?.id).toBe(agent3.id);
    expect(inactiveAgent?.active).toBe(false);

    expect(inactiveAgent?.deactivationReason).includes(reason);

    // Active agents should have ranks 1 and 2
    const ranks = activeAgentsAfter.map((entry) => entry.rank);
    expect(ranks).toContain(1);
    expect(ranks).toContain(2);
    expect(ranks.length).toBe(2); // Only two agents should have ranks

    // Reactivate the agent and verify they show up again
    await adminClient.reactivateAgentInCompetition(competitionId, agent3.id);

    // Wait a moment for any cache to update
    await wait(100);

    // Check leaderboard after reactivation
    const leaderboardFinal = await client1.getCompetitionAgents(competitionId, {
      sort: "rank",
    });
    expect(leaderboardFinal.success).toBe(true);
    if (!leaderboardFinal.success) throw new Error("Failed to get agents");

    expect(leaderboardFinal.agents).toBeDefined();
    const inactiveAgentsFinal = leaderboardFinal.agents.filter(
      (a) => !a.active,
    );
    expect(inactiveAgentsFinal).toBeDefined();
    expect(inactiveAgentsFinal.length).toBe(0);

    // Verify agent3 is back in the active leaderboard
    const agentIdsFinal = leaderboardFinal.agents.map((entry) => entry.id);
    expect(agentIdsFinal).toContain(agent1.id);
    expect(agentIdsFinal).toContain(agent2.id);
    expect(agentIdsFinal).toContain(agent3.id);

    // Find agent3 entry and verify it's now active
    const agent3FinalEntry = leaderboardFinal.agents.find(
      (entry) => entry.id === agent3.id,
    );
    expect(agent3FinalEntry).toBeDefined();
    expect(agent3FinalEntry?.active).toBe(true);
    expect(agent3FinalEntry?.deactivationReason).toBeNull();
    expect(agent3FinalEntry?.rank).toBeDefined(); // Should have a rank assigned
  });

  test("disqualified agents rankings are immediately consistent", async () => {
    // This test specifically validates the fix for the GitHub issue #812
    // where disqualified agents would cause ranking inconsistencies

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents for the competition
    const { client: client1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Top Performer",
      });
    const { client: client2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Second Place",
      });

    // Create competition with both agents
    const competitionName = `Ranking Consistency Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id],
    });
    const competition = startResult.competition;
    const competitionId = competition.id;

    // Make trades to establish different portfolio values
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const competitionId2 = competition.id;

    // Agent1: Keep high portfolio value (no trades - maintains starting balance)
    // Agent2: Burn tokens to guarantee lower portfolio value and rank 2
    await client2.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: "0x000000000000000000000000000000000000dead", // Burn address
      amount: "100",
      competitionId: competitionId2,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Burn tokens to ensure second place ranking",
    });

    // Wait for trades to process
    await wait(1000);

    // Get initial competition agents to verify rankings
    const initialAgentsResponse =
      await client1.getCompetitionAgents(competitionId);
    expect(initialAgentsResponse.success).toBe(true);

    if ("agents" in initialAgentsResponse) {
      expect(initialAgentsResponse.agents.length).toBe(2);

      // Find each agent's position
      const agent1Data = initialAgentsResponse.agents.find(
        (a) => a.id === agent1.id,
      );
      const agent2Data = initialAgentsResponse.agents.find(
        (a) => a.id === agent2.id,
      );

      expect(agent1Data).toBeDefined();
      expect(agent2Data).toBeDefined();

      // Verify initial rankings (agent1 should be rank 1 with higher portfolio, agent2 should be rank 2 after burning tokens)
      expect(agent1Data?.rank).toBe(1);
      expect(agent2Data?.rank).toBe(2);
    }

    // Now remove the top performing agent (agent1)
    const removeReason = "Disqualified for ranking consistency test";
    const removeResponse = await adminClient.removeAgentFromCompetition(
      competitionId,
      agent1.id,
      removeReason,
    );
    expect(removeResponse.success).toBe(true);

    // Immediately check the competition agents again (this is the critical test)
    // Before our fix, agent2 would still show position 2 even though they're the only agent
    // After our fix, agent2 should show position 1
    const afterRemovalResponse =
      await client2.getCompetitionAgents(competitionId);
    expect(afterRemovalResponse.success).toBe(true);

    if ("agents" in afterRemovalResponse) {
      // Should only have 1 agent now (agent2)
      expect(afterRemovalResponse.agents.length).toBe(1);

      const remainingAgent = afterRemovalResponse.agents[0];
      expect(remainingAgent?.id).toBe(agent2.id);

      // This is the key assertion - the remaining agent should have rank 1, not rank 2
      // This validates that our fix properly filters disqualified agents from ranking calculations
      expect(remainingAgent?.rank).toBe(1);

      // Agent should still be marked as active
      expect(remainingAgent?.active).toBe(true);

      // Verify the removed agent is not in the response at all
      const removedAgentData = afterRemovalResponse.agents.find(
        (a) => a.id === agent1.id,
      );
      expect(removedAgentData).toBeUndefined();
    }

    // Double-check via the pagination metadata
    if ("pagination" in afterRemovalResponse) {
      expect(afterRemovalResponse.pagination.total).toBe(1);
    }

    // ADDITIONAL TEST: Verify the agents endpoint also shows correct rankings immediately
    // This ensures our fix works across all ranking-related APIs
    const leaderboardResponse = await client2.getCompetitionAgents(
      competitionId,
      { sort: "rank", includeInactive: true },
    );
    expect(leaderboardResponse.success).toBe(true);

    if ("agents" in leaderboardResponse) {
      const activeAgentsCheck = leaderboardResponse.agents.filter(
        (a) => a.active,
      );
      // Should only have 1 agent in active leaderboard
      expect(activeAgentsCheck.length).toBe(1);

      const leaderboardAgent = activeAgentsCheck[0];
      expect(leaderboardAgent?.id).toBe(agent2.id);

      // Critical assertion: leaderboard should also show rank 1 immediately
      expect(leaderboardAgent?.rank).toBe(1);
      expect(leaderboardAgent?.active).toBe(true);

      // Should have 1 inactive agent (the removed agent1)
      const inactiveAgentsCheck = leaderboardResponse.agents.filter(
        (a) => !a.active,
      );
      expect(inactiveAgentsCheck.length).toBe(1);

      // Verify the removed agent appears in inactive agents array
      const inactiveAgent = inactiveAgentsCheck[0];
      expect(inactiveAgent?.id).toBe(agent1.id);
      expect(inactiveAgent?.active).toBe(false);
      expect(inactiveAgent?.deactivationReason).toContain(removeReason);
    }
  });
});
