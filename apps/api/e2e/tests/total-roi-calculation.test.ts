import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import {
  CROSS_CHAIN_TRADING_TYPE,
  GetUserAgentsResponse,
  StartCompetitionResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  getStartingValue,
  registerUserAndAgentAndGetClient,
  wait,
} from "@recallnet/test-utils";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";

// Type definitions for database query results
interface LeaderboardEntry {
  pnl: string;
  starting_value: string;
}

describe("Total ROI Calculation Tests", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should calculate totalRoi correctly for single competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register test agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "ROI Test Agent",
      });

    // Create and start competition
    const competitionName = `ROI Test Competition ${Date.now()}`;
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for ROI calculation",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse.success).toBe(true);

    const competitionId = startResponse.competition.id;
    const startingValue = await getStartingValue(agent.id, competitionId);

    const tradeAmount = 1000;
    // Burn 1000 USDC (we have a known roi this way)
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: tradeAmount.toString(),
      competitionId,
      reason: "ROI test trade 1",
    });

    // End competition to finalize PNL calculation
    await adminClient.endCompetition(startResponse.competition.id);

    // Wait for competition to end and metrics to be processed
    await wait(2000);

    // Get agent metrics to verify totalRoi calculation
    const agentsResponse =
      (await agentClient.getUserAgents()) as GetUserAgentsResponse;
    expect(agentsResponse.success).toBe(true);

    const agentData = agentsResponse.agents.find((a) => a.id === agent.id);
    expect(agentData).toBeDefined();
    expect(agentData?.stats?.totalRoi).toBeDefined();
    // Use 2 decimal places (0.005 tolerance) to handle market volatility
    expect(agentData?.stats?.totalRoi).toBeCloseTo(
      (-1 * tradeAmount) / (startingValue || 0),
      2,
    );

    // double check calculation by checking the database directly
    const leaderboardEntry = await db.execute(
      sql`
      SELECT tcl.pnl, tcl.starting_value
      FROM trading_comps.trading_competitions_leaderboard tcl
      INNER JOIN competitions_leaderboard cl ON tcl.competitions_leaderboard_id = cl.id
      WHERE cl.agent_id = ${agent.id}
    `,
    );

    expect(leaderboardEntry.rows).toHaveLength(1);
    const entry = leaderboardEntry.rows[0] as unknown as LeaderboardEntry;
    const { pnl, starting_value } = entry;

    expect(starting_value).toBeCloseTo(startingValue || Infinity, 2);
    const expectedRoi = Number(pnl) / Number(starting_value);
    expect(agentData?.stats?.totalRoi).toBeCloseTo(expectedRoi, 2);
  });

  test("should calculate totalRoi correctly across multiple competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register test agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi Competition Agent",
      });

    // Create and run first competition
    const competition1Name = `ROI Multi Test 1 ${Date.now()}`;
    const startResponse1 = (await adminClient.startCompetition({
      name: competition1Name,
      description: "First competition for multi-competition ROI test",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse1.success).toBe(true);

    const tradeAmount1 = 500;
    // Execute a trade in first competition
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: tradeAmount1.toString(),
      competitionId: startResponse1.competition.id,
      reason: "Multi competition trade 1",
    });

    // End first competition
    await adminClient.endCompetition(startResponse1.competition.id);
    await wait(1000);

    const startingValue1 = await getStartingValue(
      agent.id,
      startResponse1.competition.id,
    );

    const tradeAmount2 = 1500;
    // Create and run second competition
    const competition2Name = `ROI Multi Test 2 ${Date.now()}`;
    const startResponse2 = (await adminClient.startCompetition({
      name: competition2Name,
      description: "Second competition for multi-competition ROI test",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse2.success).toBe(true);

    // Execute trades in second competition
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: tradeAmount2.toString(),
      competitionId: startResponse2.competition.id,
      reason: "Multi competition trade 2",
    });

    // End second competition
    await adminClient.endCompetition(startResponse2.competition.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const startingValue2 = await getStartingValue(
      agent.id,
      startResponse2.competition.id,
    );

    // Get agent metrics
    // Get agent metrics to verify totalRoi calculation
    const agentsResponse =
      (await agentClient.getUserAgents()) as GetUserAgentsResponse;
    expect(agentsResponse.success).toBe(true);

    const agentData = agentsResponse.agents.find((a) => a.id === agent.id);
    expect(agentData).toBeDefined();
    expect(agentData?.stats?.totalRoi).toBeDefined();

    const totalAmount = tradeAmount1 + tradeAmount2;
    const totStartVal = startingValue1 + startingValue2;
    const expectedRoiStat = (-1 * totalAmount) / totStartVal;
    expect(agentData?.stats?.totalRoi).toBeCloseTo(expectedRoiStat);

    // Verify the calculation by checking the database directly
    const leaderboardEntries = await db.execute(
      sql`
      SELECT tcl.pnl, tcl.starting_value
      FROM trading_comps.trading_competitions_leaderboard tcl
      INNER JOIN competitions_leaderboard cl ON tcl.competitions_leaderboard_id = cl.id
      INNER JOIN competitions c ON cl.competition_id = c.id
      WHERE cl.agent_id = ${agent.id} AND c.status = 'ended'
    `,
    );

    expect(leaderboardEntries.rows).toHaveLength(2);

    // Calculate expected total ROI
    let totalPnl = 0;
    let totalStartingValue = 0;

    for (const row of leaderboardEntries.rows) {
      const entry = row as unknown as LeaderboardEntry;
      totalPnl += Number(entry.pnl);
      totalStartingValue += Number(entry.starting_value);
    }

    const expectedRoi = totalPnl / totalStartingValue;
    expect(agentData?.stats?.totalRoi).toBeCloseTo(expectedRoi, 10);
  });

  test("should only include ended competitions in totalRoi calculation", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register test agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Ended Competition Agent",
      });

    // Create and start first competition (will be ended)
    const competition1Name = `Ended Competition Test ${Date.now()}`;
    const startResponse1 = (await adminClient.startCompetition({
      name: competition1Name,
      description: "Competition that will be ended",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse1.success).toBe(true);

    const tradeAmount = 500;
    // Execute trade in first competition
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: tradeAmount.toString(),
      competitionId: startResponse1.competition.id,
      reason: "Ended competition trade",
    });

    // End first competition
    await adminClient.endCompetition(startResponse1.competition.id);
    await wait(2000);

    // Create and start second competition (will remain active)
    const competition2Name = `Active Competition Test ${Date.now() + 1000}`;
    const startResponse2 = (await adminClient.startCompetition({
      name: competition2Name,
      description: "Competition that will remain active",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse2.success).toBe(true);

    // Execute trade in second competition but don't end it
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1000",
      competitionId: startResponse2.competition.id,
      reason: "Active competition trade",
    });
    await wait(2000);

    // Get agent metrics
    const agentsResponse =
      (await agentClient.getUserAgents()) as GetUserAgentsResponse;
    expect(agentsResponse.success).toBe(true);

    const agentData = agentsResponse.agents.find((a) => a.id === agent.id);
    expect(agentData).toBeDefined();
    expect(agentData?.stats?.totalRoi).toBeDefined();

    const competitionId = startResponse1.competition.id;
    const startingValue = await getStartingValue(agent.id, competitionId);

    const expectedRoiStat = (-1 * tradeAmount) / startingValue;
    expect(agentData?.stats?.totalRoi).toBeCloseTo(expectedRoiStat, 2);
  });

  test("should return undefined totalRoi when agent has no ended competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register test agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Ended Competitions Agent",
      });

    // Create competition but don't end it
    const competitionName = `No Ended Competition Test ${Date.now()}`;
    const startResponse = (await adminClient.startCompetition({
      name: competitionName,
      description: "Competition that won't be ended",
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    expect(startResponse.success).toBe(true);

    // Execute trade but don't end competition
    await agentClient.executeTrade({
      fromToken: config.specificChainTokens.eth.usdc,
      toToken: "0x000000000000000000000000000000000000dead",
      amount: "1000",
      competitionId: startResponse.competition.id,
      reason: "Trade in active competition",
    });
    await wait(2000);

    // Get agent metrics
    const agentsResponse =
      (await agentClient.getUserAgents()) as GetUserAgentsResponse;
    expect(agentsResponse.success).toBe(true);

    const agentData = agentsResponse.agents.find((a) => a.id === agent.id);
    expect(agentData).toBeDefined();

    // Should return undefined when no ended competitions
    // (AgentStats schema uses .optional() which omits fields from JSON responses)
    expect(agentData?.stats?.totalRoi).toBeUndefined();
  });
});
