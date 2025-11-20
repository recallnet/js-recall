import { beforeEach, describe, expect, test } from "vitest";

import {
  CreateCompetitionResponse,
  NflTestClient,
  createNflPlayPredictionTestCompetition,
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { ServiceRegistry } from "@/services/index.js";

describe("NFL Game Winner Prediction Competition E2E", () => {
  let adminApiKey: string;
  let services: ServiceRegistry;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    services = new ServiceRegistry();
  });

  test("full NFL game winner prediction flow with time-weighted Brier scoring", async () => {
    // Step 1: Ingest game first (before creating competition)
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    // Ingest initial game state (snapshot 0 - pre-game)
    const dbGameId =
      await services.sportsService.nflLiveIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    // Step 2: Create competition with the game ID
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createCompetitionResponse =
      await createNflPlayPredictionTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test NFL game winner prediction competition",
        gameIds: [dbGameId],
      });

    expect(createCompetitionResponse.success).toBe(true);
    const competition = (createCompetitionResponse as CreateCompetitionResponse)
      .competition;
    const competitionId = competition.id;

    // Step 3: Register two agents BEFORE starting competition
    const { agent: agent1, apiKey: agent1ApiKey } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: `User1 ${Date.now()}`,
        userEmail: `user1-${Date.now()}@example.com`,
        agentName: `Agent1 ${Date.now()}`,
      });
    const { agent: agent2, apiKey: agent2ApiKey } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: `User2 ${Date.now()}`,
        userEmail: `user2-${Date.now()}@example.com`,
        agentName: `Agent2 ${Date.now()}`,
      });

    // Create NFL test clients
    const nflClient1 = new NflTestClient(agent1ApiKey);
    const nflClient2 = new NflTestClient(agent2ApiKey);

    // Register agents in competition
    const addAgentToCompetitionResponse1 =
      await adminClient.addAgentToCompetition(competitionId, agent1.id);
    expect(addAgentToCompetitionResponse1.success).toBe(true);
    const addAgentToCompetitionResponse2 =
      await adminClient.addAgentToCompetition(competitionId, agent2.id);
    expect(addAgentToCompetitionResponse2.success).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Start competition
    const startCompetitionResponse = await adminClient.startCompetition({
      competitionId,
    });
    expect(startCompetitionResponse.success).toBe(true);

    // Step 4: Get competition rules (test simplest endpoint first)
    const rulesResponse = await nflClient1.getRules(competitionId);
    if (!rulesResponse.success) {
      console.error("Get rules failed:", rulesResponse);
    }
    expect(rulesResponse.success).toBe(true);
    expect(rulesResponse.data.predictionType).toBe("game_winner");
    expect(rulesResponse.data.scoringMethod).toBe("time_weighted_brier");

    // Step 5: Get games and verify structure
    const gamesResponse = await nflClient1.getGames(competitionId);
    if (!gamesResponse.success) {
      console.error("Get games failed:", gamesResponse);
    }
    expect(gamesResponse.success).toBe(true);
    expect(gamesResponse.data.games).toHaveLength(1);
    const game = gamesResponse.data.games[0];
    expect(game.homeTeam).toBe("CHI");
    expect(game.awayTeam).toBe("MIN");
    expect(game.status).toBe("scheduled");

    // Step 6: Agent 1 makes pre-game prediction (CHI to win with 0.7 confidence)
    const prediction1Response = await nflClient1.predictGameWinner(
      competitionId,
      dbGameId,
      "CHI",
      0.7,
      "foobar",
    );
    expect(prediction1Response.success).toBe(true);
    expect(prediction1Response.data.predictedWinner).toBe("CHI");
    expect(prediction1Response.data.confidence).toBe(0.7);

    // Step 7: Agent 2 makes pre-game prediction (MIN to win with 0.6 confidence)
    const prediction2Response = await nflClient2.predictGameWinner(
      competitionId,
      dbGameId,
      "MIN",
      0.6,
      "foobar",
    );
    expect(prediction2Response.success).toBe(true);

    // Step 8: Advance mock server to start the game (snapshot 1)
    await nflClient1.advanceMockServer(globalGameId);
    await services.sportsService.nflLiveIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    // Verify game is now in progress
    const gameInfoResponse = await nflClient1.getGameInfo(
      competitionId,
      dbGameId,
    );
    expect(gameInfoResponse.data.game.status).toBe("in_progress");

    // Step 9: Agent 1 updates prediction during game (changes to MIN with 0.8 confidence)
    const updatedPrediction1 = await nflClient1.predictGameWinner(
      competitionId,
      dbGameId,
      "MIN",
      0.8,
      "foobar",
    );
    expect(updatedPrediction1.success).toBe(true);

    // Step 10: Verify prediction history
    const predictionsResponse = await nflClient1.getGamePredictions(
      competitionId,
      dbGameId,
      agent1.id,
    );
    expect(predictionsResponse.data.predictions).toHaveLength(2); // Two predictions from agent1

    // Step 11: Advance mock server multiple times to progress through game
    await nflClient1.advanceMockServer(globalGameId); // Snapshot 2
    await services.sportsService.nflLiveIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    await nflClient1.advanceMockServer(globalGameId); // Snapshot 3
    await services.sportsService.nflLiveIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    // Step 12: Advance to final snapshot (game progresses)
    await nflClient1.advanceMockServer(globalGameId); // Snapshot 4
    await nflClient1.advanceMockServer(globalGameId); // Snapshot 5
    await services.sportsService.nflLiveIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    // Step 13: Manually finalize game for testing
    // (In production, this would happen when SportsDataIO reports IsOver=true)
    // For this test, MIN wins
    const gameEndTime = new Date();
    await services.sportsService.gamesRepository.finalizeGame(
      dbGameId,
      gameEndTime,
      "MIN",
    );

    // Verify game is now final
    const finalGame =
      await services.sportsService.gamesRepository.findById(dbGameId);
    expect(finalGame).toBeDefined();
    expect(finalGame!.status).toBe("final");
    expect(finalGame!.winner).toBe("MIN");

    // Step 14: Score the game
    const scoredCount =
      await services.sportsService.gameScoringService.scoreGame(dbGameId);
    expect(scoredCount).toBe(2); // Both agents scored

    // Step 15: Verify leaderboard
    const leaderboardResponse = await nflClient1.getLeaderboard(competitionId);
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.data.leaderboard).toHaveLength(2);

    // Find agent entries
    const agent1Entry = leaderboardResponse.data.leaderboard.find(
      (e: { agentId: string }) => e.agentId === agent1.id,
    );
    const agent2Entry = leaderboardResponse.data.leaderboard.find(
      (e: { agentId: string }) => e.agentId === agent2.id,
    );

    expect(agent1Entry).toBeDefined();
    expect(agent2Entry).toBeDefined();

    // Agent 2 should have better score (predicted MIN from start, which won)
    // Agent 1 first predicted CHI (wrong), then updated to MIN (correct)
    // With time-weighted Brier, Agent 2's consistent correct prediction should score better
    expect(agent2Entry.averageBrierScore).toBeGreaterThan(
      agent1Entry.averageBrierScore,
    );
    expect(agent2Entry.rank).toBe(1);
    expect(agent1Entry.rank).toBe(2);

    // Step 15: Verify game-specific leaderboard
    const gameLeaderboardResponse = await nflClient1.getLeaderboard(
      competitionId,
      dbGameId,
    );
    expect(gameLeaderboardResponse.success).toBe(true);
    expect(gameLeaderboardResponse.data.leaderboard).toHaveLength(2);

    // Step 16: Verify cannot predict after game ends
    try {
      await nflClient1.predictGameWinner(
        competitionId,
        dbGameId,
        "CHI",
        0.9,
        "foobar",
      );
      expect.fail("Should not allow prediction after game ends");
    } catch (error) {
      // Expected error
      expect(error).toBeDefined();
    }
  });
});
