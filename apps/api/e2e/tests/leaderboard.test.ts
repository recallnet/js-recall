import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import {
  CROSS_CHAIN_TRADING_TYPE,
  CreateCompetitionResponse,
  GlobalLeaderboardResponse,
  StartCompetitionResponse,
} from "@/e2e/utils/api-types.js";
import {
  createPrivyAuthenticatedClient,
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";

describe("Leaderboard API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
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

    // Verify agent score
    expect(leaderboard.agents[0]?.score).toBe(1582.529098428072);
    expect(leaderboard.agents[1]?.score).toBe(1456.0379920213372);
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

    // Verify agent rank/score
    expect(leaderboard.agents[0]?.score).toBe(1456.0379920213372);
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
    expect(leaderboard.agents[0]?.score).toBe(1648.5496736664295);
    expect(leaderboard.agents[1]?.score).toBe(1425.0675004914583);
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

    // Create competition with proper voting dates
    const competitionName = `Agents Test Competition ${Date.now()}`;
    const now = new Date();
    const votingStartDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const votingEndDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const createResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Test competition for leaderboard votes",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading", // type
      votingStartDate: votingStartDate.toISOString(),
      votingEndDate: votingEndDate.toISOString(),
    });

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    // Start the competition with agents
    await adminClient.startExistingCompetition({
      competitionId: competition.id,
      agentIds: [agent1.id, agent2.id],
    });
    const firstCompetitionId = competition.id;

    // Create 2 users and vote for agent 1 and agent 2, respectively
    const { client: siweClient1 } = await createPrivyAuthenticatedClient({
      userName: "Privy Test User",
      userEmail: "siwe-test@example.com",
    });
    const { client: siweClient2 } = await createPrivyAuthenticatedClient({
      userName: "Privy Test User 2",
      userEmail: "siwe-test2@example.com",
    });
    // Vote for each agent in the first competition
    await siweClient1.castVote(agent1.id, firstCompetitionId);
    await siweClient2.castVote(agent2.id, firstCompetitionId);

    // End competition, create a new one, and vote again
    await adminClient.endCompetition(firstCompetitionId);

    // Create second competition with proper voting dates
    const newCompetitionName = `Agents Test Competition ${Date.now()}`;
    const createResponse2 = await adminClient.createCompetition({
      name: newCompetitionName,
      description: "Second test competition for leaderboard votes",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading", // type
      votingStartDate: votingStartDate.toISOString(),
      votingEndDate: votingEndDate.toISOString(),
    });

    expect(createResponse2.success).toBe(true);
    const competition2 = (createResponse2 as CreateCompetitionResponse)
      .competition;

    // Start the second competition with agents
    await adminClient.startExistingCompetition({
      competitionId: competition2.id,
      agentIds: [agent1.id, agent2.id],
    });
    const secondCompetitionId = competition2.id;

    // Vote for the *same* agent in the second competition
    await siweClient1.castVote(agent1.id, secondCompetitionId);
    await siweClient2.castVote(agent1.id, secondCompetitionId);

    // End second competition
    await adminClient.endCompetition(secondCompetitionId);

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

    // Create first competition with proper voting dates
    const competitionName1 = `Sort Test Competition 1 ${Date.now()}`;
    const now = new Date();
    const votingStartDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const votingEndDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const createResponse1 = await adminClient.createCompetition({
      name: competitionName1,
      description: "Test competition for sorting",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      votingStartDate: votingStartDate.toISOString(),
      votingEndDate: votingEndDate.toISOString(),
    });

    expect(createResponse1.success).toBe(true);
    const competition1 = (createResponse1 as CreateCompetitionResponse)
      .competition;

    // Start the competition with agents
    await adminClient.startExistingCompetition({
      competitionId: competition1.id,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

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
    const { client: voter1 } = await createPrivyAuthenticatedClient({
      userName: "Voter One",
      userEmail: "voter1@example.com",
    });

    const { client: voter2 } = await createPrivyAuthenticatedClient({
      userName: "Voter Two",
      userEmail: "voter2@example.com",
    });

    const { client: voter3 } = await createPrivyAuthenticatedClient({
      userName: "Voter Three",
      userEmail: "voter3@example.com",
    });

    // Vote in first competition before ending it
    // Each voter votes for a different agent to avoid conflicts
    await voter1.castVote(agent1.id, competition1.id);
    await voter2.castVote(agent3.id, competition1.id);
    await voter3.castVote(agent3.id, competition1.id);

    // End first competition
    await adminClient.endCompetition(competition1.id);

    // Wait a moment for competition to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create second competition with proper voting dates (only agent1 and agent2)
    const competitionName2 = `Sort Test Competition 2 ${Date.now()}`;
    const createResponse2 = await adminClient.createCompetition({
      name: competitionName2,
      description: "Second test competition for sorting",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      votingStartDate: votingStartDate.toISOString(),
      votingEndDate: votingEndDate.toISOString(),
    });

    expect(createResponse2.success).toBe(true);
    const competition2 = (createResponse2 as CreateCompetitionResponse)
      .competition;

    // Start the second competition with only agent1 and agent2
    await adminClient.startExistingCompetition({
      competitionId: competition2.id,
      agentIds: [agent1.id, agent2.id],
    });

    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: config.specificChainTokens.eth.usdt,
      amount: "25",
      reason: "Second competition trade",
    });

    // Vote in second competition before ending it
    await voter3.castVote(agent1.id, competition2.id);
    await voter1.castVote(agent2.id, competition2.id);

    await adminClient.endCompetition(competition2.id);

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

    // Test 11: Sort by score ascending
    const scoreAsc = (await agentClient1.getGlobalLeaderboard({
      sort: "score",
    })) as GlobalLeaderboardResponse;
    expect(scoreAsc.success).toBe(true);
    const scoreAscScores = scoreAsc.agents.map((a) => a.score);
    expect(scoreAscScores[0]).toBeLessThan(scoreAscScores[1]!);
    expect(scoreAscScores[1]).toBeLessThan(scoreAscScores[2]!);

    // Test 12: Sort by score descending
    const scoreDesc = (await agentClient1.getGlobalLeaderboard({
      sort: "-score",
    })) as GlobalLeaderboardResponse;
    expect(scoreDesc.success).toBe(true);
    const scoreDescScores = scoreDesc.agents.map((a) => a.score);
    expect(scoreDescScores[0]).toBeGreaterThan(scoreDescScores[1]!);
    expect(scoreDescScores[1]).toBeGreaterThan(scoreDescScores[2]!);
  });
});
