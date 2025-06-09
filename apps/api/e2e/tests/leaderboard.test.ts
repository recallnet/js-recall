import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import {
  CROSS_CHAIN_TRADING_TYPE,
  GlobalLeaderboardResponse,
  StartCompetitionResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createSiweAuthenticatedClient,
  createTestClient,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

describe("Leaderboard API", () => {
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

  test("should get global leaderboard with scores and ranks", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

    const { agent: agent2, client: agentClient2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Two",
      });

    // Create and start a competition with multiple agents
    const competitionName = `Agents Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });
    expect(startResponse.success).toBe(true);

    // Make some trades
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "1",
      reason: "Test trade",
    });

    // Get global leaderboard
    const leaderboard =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    expect(leaderboard.stats.activeAgents).toBe(2);
    expect(leaderboard.stats.totalTrades).toBe(2);
    expect(leaderboard.stats.totalVolume).toBeDefined();
    expect(leaderboard.stats.totalCompetitions).toBe(1);
    expect(leaderboard.stats.totalVotes).toBe(0);

    const agents = leaderboard.agents;
    expect(agents).toHaveLength(2);

    // Verify agent data structure
    for (const agent of leaderboard.agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.score).toBeDefined();
      expect(agent.numCompetitions).toBe(1);
      expect(agent.rank).toBeDefined();
      expect(agent.voteCount).toBeDefined();
    }

    // Verify agents are ordered by rank
    const ranks = leaderboard.agents.map((a) => a.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("should use query params to filter leaderboard", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

    const { agent: agent2, client: agentClient2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Two",
      });

    // Create and start a competition with multiple agents
    const competitionName = `Agents Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });
    expect(startResponse.success).toBe(true);

    // Make some trades
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "1",
      reason: "Test trade",
    });

    // Get global leaderboard
    const leaderboard = (await agentClient1.getGlobalLeaderboard({
      limit: 1,
      offset: 1,
    })) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    // Total stats shouldn't change; these represent all competitions, regardless of the query params
    expect(leaderboard.stats.activeAgents).toBe(2);
    expect(leaderboard.stats.totalTrades).toBe(2);
    expect(leaderboard.stats.totalVolume).toBeDefined();
    expect(leaderboard.stats.totalCompetitions).toBe(1);

    // Verify agents
    const agents = leaderboard.agents;
    expect(agents).toHaveLength(1);

    // Agent 1 is in second place, so their rank should be 2 and the only agent in the leaderboard after offset
    // TODO: sending to the zero address doesn't guarantee the order we want: https://github.com/recallnet/js-recall/issues/481
    for (const agent of leaderboard.agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.score).toBeDefined();
      expect(agent.numCompetitions).toBe(1);
      expect(agent.rank).toBeDefined();
    }

    // Verify agents are ordered by rank
    const ranks = leaderboard.agents.map((a) => a.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("should get multiple competitions in leaderboard", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

    const { agent: agent2, client: agentClient2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Two",
      });

    // Create and start a competition with multiple agents
    const competitionName = `Agents Test Competition ${Date.now()}`;
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;

    // Make some trades
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "1",
      reason: "Test trade",
    });
    // End existing competition
    await adminClient.endCompetition(startResponse.competition.id);

    // Start a new competition
    const newCompetitionName = `Agents Test Competition ${Date.now()}`;
    await adminClient.startCompetition({
      name: newCompetitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });

    // Make some trades
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "1",
      reason: "Test trade",
    });

    // Get global leaderboard
    const leaderboard =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    // Verify stats
    expect(leaderboard.stats.activeAgents).toBe(2);
    expect(leaderboard.stats.totalTrades).toBe(4);
    expect(leaderboard.stats.totalVolume).toBeDefined();
    expect(leaderboard.stats.totalCompetitions).toBe(2);

    // Verify agents (agent 2 is in first place, agent 1 is in second place)
    // TODO: sending to the zero address doesn't guarantee the order we want: https://github.com/recallnet/js-recall/issues/481
    expect(leaderboard.agents).toHaveLength(2);
    expect(leaderboard.agents[0]?.numCompetitions).toBe(2);
    expect(leaderboard.agents[1]?.numCompetitions).toBe(2);
  });

  test("should get leaderboard votes per agent and total votes", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent One",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Two",
    });

    // Create and start a competition with multiple agents
    const competitionName = `Agents Test Competition ${Date.now()}`;
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    const firstCompetitionId = startResponse.competition.id;

    // Create 2 users and vote for agent 1 and agent 2, respectively
    const { client: siweClient1 } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Test User",
      userEmail: "siwe-test@example.com",
    });
    const { client: siweClient2 } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "SIWE Test User 2",
      userEmail: "siwe-test2@example.com",
    });
    // Vote for each agent in the first competition
    await siweClient1.castVote(agent1.id, firstCompetitionId);
    await siweClient2.castVote(agent2.id, firstCompetitionId);

    // End competition, create a new one, and vote again
    await adminClient.endCompetition(firstCompetitionId);
    const newCompetitionName = `Agents Test Competition ${Date.now()}`;
    const newCompetitionId = (await adminClient.startCompetition({
      name: newCompetitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    const secondCompetitionId = newCompetitionId.competition.id;

    // Vote for the *same* agent in the second competition
    await siweClient1.castVote(agent1.id, secondCompetitionId);
    await siweClient2.castVote(agent1.id, secondCompetitionId);

    // Verify votes are counted correctly
    const leaderboard =
      (await siweClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);
    expect(leaderboard.stats.totalVotes).toBe(4);
    const agents = leaderboard.agents.sort((a, b) => b.voteCount - a.voteCount);
    expect(agents[0]?.voteCount).toBe(3);
    expect(agents[1]?.voteCount).toBe(1);
  });
});
