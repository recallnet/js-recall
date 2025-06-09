import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import {
  AdminAgentResponse,
  AdminAgentsListResponse,
  AgentProfileResponse,
  ErrorResponse,
  LeaderboardResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";
import { BlockchainType } from "@/types/index.js";

// TODO: need user deactivation test

describe("Agent Deactivation API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
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
    await startTestCompetition(adminClient, competitionName, [agent.id]);

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
    await startTestCompetition(adminClient, competitionName, [agent.id]);

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
    await startTestCompetition(adminClient, competitionName, [agent.id]);

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
    await startTestCompetition(adminClient, competitionName, [
      agent1.id,
      agent2.id,
    ]);

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
    await startTestCompetition(adminClient, competitionName, [
      agent1.id,
      agent2.id,
      agent3.id,
    ]);

    // Make some trades to differentiate portfolio values
    // We'll have Agent 3 (to be deactivated) make some trades to put them on the leaderboard
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Have Agent 3 execute a trade
    await client3.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "100",
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "inactive agents are filtered from leaderboard",
    });

    // Have the other agents make trades too to populate leaderboard
    await client1.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "50",
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "inactive agents are filtered from leaderboard",
    });

    await client2.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "75",
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "inactive agents are filtered from leaderboard",
    });

    // Wait a moment for portfolio values to update
    await wait(1000);

    // Check leaderboard before deactivation
    const leaderboardBefore =
      (await client1.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(leaderboardBefore.success).toBe(true);
    expect(leaderboardBefore.leaderboard).toBeDefined();

    // Verify inactiveAgents array exists but is empty before deactivation
    expect(leaderboardBefore.inactiveAgents).toBeDefined();
    expect(leaderboardBefore.inactiveAgents.length).toBe(0);

    // All three agents should be in the active leaderboard
    const agentIds = leaderboardBefore.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(agentIds).toContain(agent1.id);
    expect(agentIds).toContain(agent2.id);
    expect(agentIds).toContain(agent3.id);

    // Now deactivate agent3
    const reason = "Deactivated for leaderboard test";
    const deactivateResponse = await adminClient.deactivateAgent(
      agent3.id,
      reason,
    );
    expect(deactivateResponse.success).toBe(true);

    // Check leaderboard after deactivation
    const leaderboardAfter =
      (await client1.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(leaderboardAfter.success).toBe(true);
    expect(leaderboardAfter.leaderboard).toBeDefined();
    expect(leaderboardAfter.inactiveAgents).toBeDefined();

    // Verify agent3 is now in the inactiveAgents array, not in the main leaderboard
    // Active leaderboard should only contain agent1 and agent2
    const activeagentIds = leaderboardAfter.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(activeagentIds).toContain(agent1.id);
    expect(activeagentIds).toContain(agent2.id);
    expect(activeagentIds).not.toContain(agent3.id);

    // Verify inactive agent array contains only agent3
    expect(leaderboardAfter.inactiveAgents.length).toBe(1);
    const inactiveAgent = leaderboardAfter.inactiveAgents[0];
    expect(inactiveAgent?.agentId).toBe(agent3.id);
    expect(inactiveAgent?.active).toBe(false);
    // TODO: fix reason
    expect(inactiveAgent?.deactivationReason).toBe(reason);

    // Active agents should have ranks 1 and 2
    const ranks = leaderboardAfter.leaderboard.map((entry) => entry.rank);
    expect(ranks).toContain(1);
    expect(ranks).toContain(2);
    expect(ranks.length).toBe(2); // Only two agents should have ranks

    expect(leaderboardAfter.hasInactiveAgents).toBe(true);

    // Reactivate the agent and verify they show up again
    await adminClient.reactivateAgent(agent3.id);

    // Wait a moment for any cache to update
    await wait(100);

    // Check leaderboard after reactivation
    const leaderboardFinal =
      (await client1.getCompetitionLeaderboard()) as LeaderboardResponse;
    expect(leaderboardFinal.success).toBe(true);
    expect(leaderboardFinal.leaderboard).toBeDefined();
    expect(leaderboardFinal.inactiveAgents).toBeDefined();
    expect(leaderboardFinal.inactiveAgents.length).toBe(0);

    // Verify agent3 is back in the active leaderboard
    const agentIdsFinal = leaderboardFinal.leaderboard.map(
      (entry) => entry.agentId,
    );
    expect(agentIdsFinal).toContain(agent1.id);
    expect(agentIdsFinal).toContain(agent2.id);
    expect(agentIdsFinal).toContain(agent3.id);

    // Find agent3 entry and verify it's now active
    const agent3FinalEntry = leaderboardFinal.leaderboard.find(
      (entry) => entry.agentId === agent3.id,
    );
    expect(agent3FinalEntry).toBeDefined();
    expect(agent3FinalEntry?.active).toBe(true);
    expect(agent3FinalEntry?.deactivationReason).toBeUndefined();
    expect(agent3FinalEntry?.rank).toBeDefined(); // Should have a rank assigned

    // Verify the hasInactiveAgents flag is false
    expect(leaderboardFinal.hasInactiveAgents).toBe(false);
  });
});
