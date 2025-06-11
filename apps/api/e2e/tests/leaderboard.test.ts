import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import { updateAgentRank } from "@/database/repositories/agentrank-repository.js";
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
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
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

    await adminClient.endCompetition(startResponse.competition.id);

    // Inject fake agent rank data because we don't have the update logic yet
    await updateAgentRank(
      {
        agentId: agent1.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1200,
      },
      startResponse.competition.id,
    );

    await updateAgentRank(
      {
        agentId: agent2.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1500,
      },
      startResponse.competition.id,
    );

    // Get global leaderboard
    const leaderboard =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    expect(leaderboard.stats.activeAgents).toBe(0);
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

    // Verify agent score
    expect(leaderboard.agents[0]?.score).toBe(1500);
    expect(leaderboard.agents[1]?.score).toBe(1200);
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
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for agents endpoint",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
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

    await adminClient.endCompetition(startResponse.competition.id);

    // Inject fake agent rank data because we don't have the update logic yet
    // Agent 1 loses, so it has lower score
    await updateAgentRank(
      {
        agentId: agent1.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1200,
      },
      startResponse.competition.id,
    );

    await updateAgentRank(
      {
        agentId: agent2.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1500,
      },
      startResponse.competition.id,
    );

    // Get global leaderboard
    const leaderboard = (await agentClient1.getGlobalLeaderboard({
      limit: 1,
      offset: 1,
    })) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    // Total stats shouldn't change; these represent all competitions, regardless of the query params
    expect(leaderboard.stats.activeAgents).toBe(0);
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

    // Verify agent rank/score
    expect(leaderboard.agents[0]?.score).toBe(1200);
    expect(leaderboard.agents[0]?.rank).toBe(2);

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
    const startResponse2 = (await adminClient.startCompetition({
      name: newCompetitionName,
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

    // End second competition
    await adminClient.endCompetition(startResponse2.competition.id);

    // Inject fake agent rank data because we don't have the update logic yet
    // Agent 1 loses, so it has lower score
    await updateAgentRank(
      {
        agentId: agent1.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1200,
      },
      startResponse.competition.id,
    );

    await updateAgentRank(
      {
        agentId: agent2.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1500,
      },
      startResponse.competition.id,
    );

    // Get global leaderboard
    const leaderboard =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    // Verify stats
    expect(leaderboard.stats.activeAgents).toBe(0);
    expect(leaderboard.stats.totalTrades).toBe(4);
    expect(leaderboard.stats.totalVolume).toBeDefined();
    expect(leaderboard.stats.totalCompetitions).toBe(2);

    // Verify agents (agent 2 is in first place, agent 1 is in second place)
    // TODO: sending to the zero address doesn't guarantee the order we want: https://github.com/recallnet/js-recall/issues/481
    expect(leaderboard.agents).toHaveLength(2);
    expect(leaderboard.agents[0]?.numCompetitions).toBe(2);
    expect(leaderboard.agents[1]?.numCompetitions).toBe(2);
    expect(leaderboard.agents[0]?.score).toBe(1500);
    expect(leaderboard.agents[1]?.score).toBe(1200);
    expect(leaderboard.agents[0]?.rank).toBe(1);
    expect(leaderboard.agents[1]?.rank).toBe(2);
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

    // End second competition
    await adminClient.endCompetition(secondCompetitionId);

    // Inject fake agent rank data because we don't have the update logic yet
    await updateAgentRank(
      {
        agentId: agent1.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1500,
      },
      startResponse.competition.id,
    );

    await updateAgentRank(
      {
        agentId: agent2.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1500,
      },
      startResponse.competition.id,
    );

    // Verify votes are counted correctly
    const leaderboard =
      (await siweClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);
    expect(leaderboard.stats.totalVotes).toBe(4);
    const agents = leaderboard.agents.sort((a, b) => b.voteCount - a.voteCount);
    expect(agents[0]?.voteCount).toBe(3);
    expect(agents[1]?.voteCount).toBe(1);
  });

  test("should sort global leaderboard by different fields", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with distinct names for testing
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Alpha Agent", // Name starts with A
      });

    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Beta Agent", // Name starts with B
      });

    const { client: agentClient3, agent: agent3 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Charlie Agent", // Name starts with C
      });

    // Create first competition
    const competitionName1 = `Sort Test Competition 1 ${Date.now()}`;
    const startResponse1 = (await adminClient.startCompetition({
      name: competitionName1,
      description: "Test competition for sorting",
      agentIds: [agent1.id, agent2.id, agent3.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse1.success).toBe(true);

    // Make different trades to create score differences
    // Agent 1: Best performance (profitable trade)
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "100",
      reason: "Profitable trade",
    });

    // Agent 2: Medium performance (smaller trade)
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "50",
      reason: "Medium trade",
    });

    // Agent 3: Poor performance (bad trade)
    await agentClient3.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x0000000000000000000000000000000000000000", // Losing trade
      amount: "10",
      reason: "Bad trade",
    });

    // Create users for voting before ending competitions
    const { client: voter1 } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Voter One",
      userEmail: "voter1@example.com",
    });

    const { client: voter2 } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Voter Two",
      userEmail: "voter2@example.com",
    });

    const { client: voter3 } = await createSiweAuthenticatedClient({
      adminApiKey,
      userName: "Voter Three",
      userEmail: "voter3@example.com",
    });

    // Vote in first competition before ending it
    // Each voter votes for a different agent to avoid conflicts
    await voter1.castVote(agent1.id, startResponse1.competition.id);
    await voter2.castVote(agent3.id, startResponse1.competition.id);
    await voter3.castVote(agent3.id, startResponse1.competition.id);

    // End first competition
    await adminClient.endCompetition(startResponse1.competition.id);

    // Wait a moment for competition to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create second competition (only agent1 and agent2)
    const competitionName2 = `Sort Test Competition 2 ${Date.now()}`;
    const startResponse2 = (await adminClient.startCompetition({
      name: competitionName2,
      description: "Second test competition for sorting",
      agentIds: [agent1.id, agent2.id], // Only 2 agents
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;

    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "25",
      reason: "Second competition trade",
    });

    // Vote in second competition before ending it
    await voter3.castVote(agent1.id, startResponse2.competition.id);
    await voter1.castVote(agent2.id, startResponse2.competition.id);

    await adminClient.endCompetition(startResponse2.competition.id);

    // Inject fake agent rank data because we don't have the update logic yet
    await updateAgentRank(
      {
        agentId: agent1.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1500,
      },
      startResponse2.competition.id,
    );

    await updateAgentRank(
      {
        agentId: agent2.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1400,
      },
      startResponse2.competition.id,
    );

    await updateAgentRank(
      {
        agentId: agent3.id,
        mu: 30.1,
        sigma: 7.9,
        ordinal: 1300,
      },
      startResponse2.competition.id,
    );

    // Test 1: Default sorting (by rank ascending)
    const defaultSort =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(defaultSort.success).toBe(true);
    const defaultRanks = defaultSort.agents.map((a) => a.rank);
    expect(defaultRanks).toEqual([1, 2, 3]); // Should be sorted by rank ascending

    // Test 2: Sort by rank descending
    const rankDesc = (await agentClient1.getGlobalLeaderboard({
      sort: "-rank",
    })) as GlobalLeaderboardResponse;
    expect(rankDesc.success).toBe(true);
    const rankDescRanks = rankDesc.agents.map((a) => a.rank);
    expect(rankDescRanks).toEqual([3, 2, 1]); // Should be sorted by rank descending

    // Test 3: Sort by name ascending (Alpha, Beta, Charlie)
    const nameAsc = (await agentClient1.getGlobalLeaderboard({
      sort: "name",
    })) as GlobalLeaderboardResponse;
    expect(nameAsc.success).toBe(true);
    const nameAscNames = nameAsc.agents.map((a) => a.name);
    expect(nameAscNames[0]).toBe("Alpha Agent");
    expect(nameAscNames[1]).toBe("Beta Agent");
    expect(nameAscNames[2]).toBe("Charlie Agent");

    // Test 4: Sort by name descending (Charlie, Beta, Alpha)
    const nameDesc = (await agentClient1.getGlobalLeaderboard({
      sort: "-name",
    })) as GlobalLeaderboardResponse;
    expect(nameDesc.success).toBe(true);
    const nameDescNames = nameDesc.agents.map((a) => a.name);
    expect(nameDescNames[0]).toBe("Charlie Agent");
    expect(nameDescNames[1]).toBe("Beta Agent");
    expect(nameDescNames[2]).toBe("Alpha Agent");

    // Test 5: Sort by competitions ascending
    const compsAsc = (await agentClient1.getGlobalLeaderboard({
      sort: "competitions",
    })) as GlobalLeaderboardResponse;
    expect(compsAsc.success).toBe(true);
    // Agent3 (1 competition) should be first, agent1 and agent2 (2 competitions each) should follow
    const compsAscCounts = compsAsc.agents.map((a) => a.numCompetitions);
    expect(compsAscCounts).toEqual([1, 2, 2]); // 1 competition first, then 2 competitions

    // Test 6: Sort by competitions descending
    const compsDesc = (await agentClient1.getGlobalLeaderboard({
      sort: "-competitions",
    })) as GlobalLeaderboardResponse;
    expect(compsDesc.success).toBe(true);
    const compsDescCounts = compsDesc.agents.map((a) => a.numCompetitions);
    expect(compsDescCounts).toEqual([2, 2, 1]); // 2 competitions first, then 1 competition

    // Test 7: Sort by votes ascending
    const votesAsc = (await agentClient1.getGlobalLeaderboard({
      sort: "votes",
    })) as GlobalLeaderboardResponse;
    expect(votesAsc.success).toBe(true);
    const votesAscCounts = votesAsc.agents.map((a) => a.voteCount);
    expect(votesAscCounts).toEqual([1, 2, 2]); // Beta(1), Alpha(2), Charlie(2) - sorted by vote count ascending

    // Test 8: Sort by votes descending
    const votesDesc = (await agentClient1.getGlobalLeaderboard({
      sort: "-votes",
    })) as GlobalLeaderboardResponse;
    expect(votesDesc.success).toBe(true);
    const votesDescCounts = votesDesc.agents.map((a) => a.voteCount);
    expect(votesDescCounts).toEqual([2, 2, 1]); // Alpha(2) and Charlie(2), then Beta(1) - sorted by vote count descending

    // Test 9: Invalid sort field should fall back to default (rank)
    const invalidSort = (await agentClient1.getGlobalLeaderboard({
      sort: "invalid-field",
    })) as GlobalLeaderboardResponse;
    expect(invalidSort.success).toBe(true);
    const invalidSortRanks = invalidSort.agents.map((a) => a.rank);
    expect(invalidSortRanks).toEqual([1, 2, 3]); // Should fall back to rank ascending

    // Test 10: Empty sort parameter should use default
    const emptySort = (await agentClient1.getGlobalLeaderboard({
      sort: "",
    })) as GlobalLeaderboardResponse;
    expect(emptySort.success).toBe(true);
    const emptySortRanks = emptySort.agents.map((a) => a.rank);
    expect(emptySortRanks).toEqual([1, 2, 3]); // Should use default rank ascending
  });
});
