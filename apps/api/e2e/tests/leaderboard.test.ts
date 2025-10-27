import { beforeEach, describe, expect, test } from "vitest";

import { agentScore } from "@recallnet/db/schema/ranking/defs";
import {
  CROSS_CHAIN_TRADING_TYPE,
  CreateCompetitionResponse,
  GlobalLeaderboardResponse,
  StartCompetitionResponse,
} from "@recallnet/test-utils";
import { connectToDb } from "@recallnet/test-utils";
import {
  createPerpsTestCompetition,
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { config } from "@/config/index.js";

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
      toToken: "0x000000000000000000000000000000000000dead", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1",
      reason: "Test trade",
    });

    await adminClient.endCompetition(startResponse.competition.id);

    // Get global leaderboard
    const leaderboard =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

    const agents = leaderboard.agents;
    expect(agents).toHaveLength(2);

    // Verify agent data structure
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
      toToken: "0x000000000000000000000000000000000000dead", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
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
      toToken: "0x000000000000000000000000000000000000dead", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
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
      toToken: "0x000000000000000000000000000000000000dead", // Effectively make agent 1 lose
      amount: "100",
      reason: "Test trade",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1",
      reason: "Test trade",
    });

    // End second competition
    await adminClient.endCompetition(startResponse2.competition.id);

    // Get global leaderboard
    const leaderboard =
      (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
    expect(leaderboard.success).toBe(true);

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

  test("should get leaderboard by type with correct pagination total", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent One",
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Two",
    });

    // Create/end a trading competition
    const tradingComp = await adminClient.createCompetition({
      name: `Trading Competition ${Date.now()}`,
      description: "Trading competition for type segregation test",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading",
    });
    expect(tradingComp.success).toBe(true);
    const tradingCompId = (tradingComp as CreateCompetitionResponse).competition
      .id;
    await adminClient.startExistingCompetition({
      competitionId: tradingCompId,
      agentIds: [agent1.id, agent2.id],
    });
    await adminClient.endCompetition(tradingCompId);

    // Create/end a perpetual futures competition
    const perpComp = await createPerpsTestCompetition({
      adminClient,
      name: "Test Perps Competition",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567", // Mock server URL
      },
    });
    expect(perpComp.success).toBe(true);
    const perpCompId = (perpComp as CreateCompetitionResponse).competition.id;
    await adminClient.startExistingCompetition({
      competitionId: perpCompId,
      agentIds: [agent1.id, agent2.id],
    });

    // Before ending the perps comp, check that the trading leaderboard has values but perps is empty
    const leaderboard1 = (await adminClient.getGlobalLeaderboard({
      type: "trading",
    })) as GlobalLeaderboardResponse;
    expect(leaderboard1.success).toBe(true);
    expect(leaderboard1.agents.length).toBe(2);
    expect(leaderboard1.pagination.total).toBe(2);
    const leaderboard2 = (await adminClient.getGlobalLeaderboard({
      type: "perpetual_futures",
    })) as GlobalLeaderboardResponse;
    expect(leaderboard2.success).toBe(true);
    expect(leaderboard2.agents.length).toBe(0);
    expect(leaderboard2.pagination.total).toBe(0);
    await adminClient.endCompetition(perpCompId);

    // Final check that both types have values
    const leaderboard3 = (await adminClient.getGlobalLeaderboard({
      type: "trading",
    })) as GlobalLeaderboardResponse;
    expect(leaderboard3.success).toBe(true);
    expect(leaderboard3.agents.length).toBe(2);
    expect(leaderboard3.pagination.total).toBe(2);
    const leaderboard4 = (await adminClient.getGlobalLeaderboard({
      type: "perpetual_futures",
    })) as GlobalLeaderboardResponse;
    expect(leaderboard4.success).toBe(true);
    expect(leaderboard4.agents.length).toBe(2);
    expect(leaderboard4.pagination.total).toBe(2);

    // And there should also be 4 total rows because there are 2 trading and 2 perps competitions
    // We have to validate this via a db query because the API query params technically
    // default to `trading`, so there's no "joined" leaderboard response
    const db = await connectToDb();
    const result = await db.select().from(agentScore);
    expect(result.length).toBe(4);
  });

  test("should segregate agent scores by competition type", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Agent 1 & 2 will participate in both "trading" and "perpetual_futures" types
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi-Type Agent One",
      });
    const { client: agentClient2, agent: agent2 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi-Type Agent Two",
      });
    // Agent 3 & 4 will participate alongside 1 & 2 in "perpetual_futures" competitions
    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perp Agent Three",
    });
    const { agent: agent4 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Perp Agent Four",
    });

    // ===== FIRST ROUND: Create initial competitions =====

    // Create and run a TRADING competition
    const tradingComp1 = await adminClient.createCompetition({
      name: `Trading Competition 1 ${Date.now()}`,
      description: "First trading competition for type segregation test",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading",
    });
    expect(tradingComp1.success).toBe(true);
    const tradingCompId1 = (tradingComp1 as CreateCompetitionResponse)
      .competition.id;
    // Start with agents 1 & 2
    await adminClient.startExistingCompetition({
      competitionId: tradingCompId1,
      agentIds: [agent1.id, agent2.id],
    });
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "100",
      reason: "Test trade - agent1 loses",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "10",
      reason: "Test trade - agent2 wins",
    });

    // Store initial scores for "trading" type
    await adminClient.endCompetition(tradingCompId1);
    const leaderboardAfterTrading1 = (await agentClient1.getGlobalLeaderboard({
      type: "trading",
    })) as GlobalLeaderboardResponse;
    expect(leaderboardAfterTrading1.agents).toHaveLength(2);
    expect(leaderboardAfterTrading1.success).toBe(true);
    const tradingScoresRound1 = new Map<string, number>();
    leaderboardAfterTrading1.agents.forEach((agent) => {
      tradingScoresRound1.set(agent.id, agent.score);
    });

    // Create another competition for "perpetual_futures"
    const simulatedPerpComp1 = await createPerpsTestCompetition({
      adminClient,
      name: "Test Perps Competition",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567", // Mock server URL
      },
    });
    expect(simulatedPerpComp1.success).toBe(true);
    const simulatedPerpCompId1 = (
      simulatedPerpComp1 as CreateCompetitionResponse
    ).competition.id;
    await adminClient.startExistingCompetition({
      competitionId: simulatedPerpCompId1,
      agentIds: [agent1.id, agent2.id, agent3.id, agent4.id],
    });

    // Check that trading scores haven't changed
    await adminClient.endCompetition(simulatedPerpCompId1);
    const tradingLeaderboardAfterPerps =
      (await agentClient1.getGlobalLeaderboard({
        type: "trading",
      })) as GlobalLeaderboardResponse;
    expect(tradingLeaderboardAfterPerps.success).toBe(true);
    expect(tradingLeaderboardAfterPerps.agents).toHaveLength(2); // Only agents 1 & 2 have trading scores
    const agent1TradingScore = tradingLeaderboardAfterPerps.agents.find(
      (a) => a.id === agent1.id,
    )?.score;
    const agent2TradingScore = tradingLeaderboardAfterPerps.agents.find(
      (a) => a.id === agent2.id,
    )?.score;
    expect(agent1TradingScore).toBe(tradingScoresRound1.get(agent1.id));
    expect(agent2TradingScore).toBe(tradingScoresRound1.get(agent2.id));

    // Check perps leaderboard has all 4 agents
    const perpsLeaderboard = (await agentClient1.getGlobalLeaderboard({
      type: "perpetual_futures",
    })) as GlobalLeaderboardResponse;
    expect(perpsLeaderboard.success).toBe(true);
    expect(perpsLeaderboard.agents).toHaveLength(4); // All 4 agents competed in perps

    // ===== SECOND ROUND: Additional competitions to verify segregation =====

    // Create another trading competition
    const tradingComp2 = await adminClient.createCompetition({
      name: `Trading Competition 2 ${Date.now()}`,
      description: "Second trading competition for type segregation test",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      type: "trading",
    });
    expect(tradingComp2.success).toBe(true);
    const tradingCompId2 = (tradingComp2 as CreateCompetitionResponse)
      .competition.id;
    await adminClient.startExistingCompetition({
      competitionId: tradingCompId2,
      agentIds: [agent1.id, agent2.id],
    });
    await agentClient1.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "50",
      reason: "Test trade - agent1 second comp",
    });
    await agentClient2.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "25",
      reason: "Test trade - agent2 second comp",
    });

    // Get leaderboard after second trading competition & verify they're different from round 1
    await adminClient.endCompetition(tradingCompId2);
    const leaderboardAfterTrading2 = (await agentClient1.getGlobalLeaderboard({
      type: "trading",
    })) as GlobalLeaderboardResponse;
    expect(leaderboardAfterTrading2.success).toBe(true);
    expect(leaderboardAfterTrading2.agents).toHaveLength(2);
    const tradingScoresRound2 = new Map<string, number>();
    leaderboardAfterTrading2.agents
      .filter((a) => [agent1.id, agent2.id].includes(a.id))
      .forEach((agent) => {
        tradingScoresRound2.set(agent.id, agent.score);
      });
    expect(tradingScoresRound2.get(agent1.id)).not.toBe(
      tradingScoresRound1.get(agent1.id),
    );
    expect(tradingScoresRound2.get(agent2.id)).not.toBe(
      tradingScoresRound1.get(agent2.id),
    );

    // Create another simulated perp competition
    const simulatedPerpComp2 = await createPerpsTestCompetition({
      adminClient,
      name: "Test Perps Competition",
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        apiUrl: "http://localhost:4567", // Mock server URL
      },
    });
    expect(simulatedPerpComp2.success).toBe(true);
    const simulatedPerpCompId2 = (
      simulatedPerpComp2 as CreateCompetitionResponse
    ).competition.id;
    await adminClient.startExistingCompetition({
      competitionId: simulatedPerpCompId2,
      agentIds: [agent1.id, agent2.id, agent3.id, agent4.id],
    });

    // Verify trading scores haven't changed after second perp competition (type segregation)
    await adminClient.endCompetition(simulatedPerpCompId2);
    const finalTradingLeaderboard = (await agentClient1.getGlobalLeaderboard({
      type: "trading",
    })) as GlobalLeaderboardResponse;
    expect(finalTradingLeaderboard.success).toBe(true);
    expect(finalTradingLeaderboard.agents).toHaveLength(2); // Only agents 1 & 2 have trading scores
    const finalAgent1TradingScore = finalTradingLeaderboard.agents.find(
      (a) => a.id === agent1.id,
    )?.score;
    const finalAgent2TradingScore = finalTradingLeaderboard.agents.find(
      (a) => a.id === agent2.id,
    )?.score;
    expect(finalAgent1TradingScore).toBe(tradingScoresRound2.get(agent1.id));
    expect(finalAgent2TradingScore).toBe(tradingScoresRound2.get(agent2.id));

    // Also verify perps leaderboard still has all 4 agents
    const finalPerpsLeaderboard = (await agentClient1.getGlobalLeaderboard({
      type: "perpetual_futures",
    })) as GlobalLeaderboardResponse;
    expect(finalPerpsLeaderboard.success).toBe(true);
    expect(finalPerpsLeaderboard.agents).toHaveLength(4); // All 4 agents have perps scores
  });
});
