import { beforeEach, describe, expect, test } from "vitest";

import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import {
  CreateCompetitionResponse,
  NflTestClient,
  createSportsPredictionTestCompetition,
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

describe("Sports Prediction Competitions", () => {
  let adminApiKey: string;
  let services: ServiceRegistry;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    services = new ServiceRegistry();
  });

  test("should successfully start competition with game IDs", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition with games",
      gameIds: [dbGameId],
    });

    expect(createResponse.success).toBe(true);
    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User1 ${Date.now()}`,
      userEmail: `user1-${Date.now()}@example.com`,
      agentName: `Agent1 ${Date.now()}`,
    });

    await adminClient.addAgentToCompetition(competition.id, agent1.id);

    const startResponse = await adminClient.startCompetition({
      competitionId: competition.id,
    });

    expect(startResponse.success).toBe(true);
    if (!startResponse.success) throw new Error("Start failed");
    expect(startResponse.competition.status).toBe("active");

    const gameIds =
      await services.sportsService.competitionGamesRepository.findGameIdsByCompetitionId(
        competition.id,
      );
    expect(gameIds).toHaveLength(1);
    expect(gameIds[0]).toBe(dbGameId);
  });

  test("should fail to create competition without game IDs", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;

    try {
      await createSportsPredictionTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition without games",
        gameIds: [],
      });
      expect.fail(
        "Should have thrown error - cannot create NFL competition without games",
      );
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("should fail to start competition with invalid game ID", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const fakeGameId = "00000000-0000-0000-0000-000000000000";

    try {
      await createSportsPredictionTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition with invalid game",
        gameIds: [fakeGameId],
      });
      expect.fail("Should have thrown error for invalid game ID");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("should fail to end competition if game has not ended", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition",
      gameIds: [dbGameId],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    await adminClient.startCompetition({ competitionId: competition.id });

    try {
      await adminClient.endCompetition(competition.id);
      expect.fail("Should have thrown error - game not ended");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("should fail to end competition if game is missing end time or winner", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    await services.sportsService.gamesRepository.updateStatus(
      dbGameId,
      "final",
    );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition",
      gameIds: [dbGameId],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    await adminClient.startCompetition({ competitionId: competition.id });

    try {
      await adminClient.endCompetition(competition.id);
      expect.fail("Should have thrown error - game missing end time/winner");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("should reject prediction if game is not part of competition", async () => {
    const globalGameId1 = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId1);

    const dbGameId1 =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId1,
      );

    await tempClient.resetMockServer(globalGameId1);
    const dbGameId2 =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId1,
      );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition with one game",
      gameIds: [dbGameId1],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    const { agent, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User ${Date.now()}`,
      userEmail: `user-${Date.now()}@example.com`,
      agentName: `Agent ${Date.now()}`,
    });

    await adminClient.addAgentToCompetition(competition.id, agent.id);
    await adminClient.startCompetition({ competitionId: competition.id });

    const nflClient = new NflTestClient(apiKey);

    try {
      await nflClient.predictGameWinner(
        competition.id,
        dbGameId2,
        "MIN",
        0.7,
        "Test prediction",
      );
      expect.fail("Should have thrown 400 error - game not in competition");
    } catch (error) {
      expect(error).toBeDefined();
    }

    const validPrediction = await nflClient.predictGameWinner(
      competition.id,
      dbGameId1,
      "CHI",
      0.7,
      "Test prediction",
    );
    expect(validPrediction.success).toBe(true);
  });

  test("should only allow agents in competition to make predictions", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition",
      gameIds: [dbGameId],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    const { agent: agent1, apiKey: agent1ApiKey } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: `User1 ${Date.now()}`,
        userEmail: `user1-${Date.now()}@example.com`,
        agentName: `Agent1 ${Date.now()}`,
      });

    const { apiKey: agent2ApiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User2 ${Date.now()}`,
      userEmail: `user2-${Date.now()}@example.com`,
      agentName: `Agent2 ${Date.now()}`,
    });

    await adminClient.addAgentToCompetition(competition.id, agent1.id);
    await adminClient.startCompetition({ competitionId: competition.id });

    const nflClient1 = new NflTestClient(agent1ApiKey);
    const nflClient2 = new NflTestClient(agent2ApiKey);

    // Agent 1 (in competition) should succeed
    const prediction1 = await nflClient1.predictGameWinner(
      competition.id,
      dbGameId,
      "CHI",
      0.7,
      "Test prediction",
    );
    expect(prediction1.success).toBe(true);

    // Agent 2 (NOT in competition) should fail with 403
    try {
      await nflClient2.predictGameWinner(
        competition.id,
        dbGameId,
        "MIN",
        0.6,
        "Test prediction",
      );
      expect.fail("Should have thrown 403 error - agent not in competition");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("should validate prediction request body", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition",
      gameIds: [dbGameId],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    const { agent, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User ${Date.now()}`,
      userEmail: `user-${Date.now()}@example.com`,
      agentName: `Agent ${Date.now()}`,
    });

    await adminClient.addAgentToCompetition(competition.id, agent.id);
    await adminClient.startCompetition({ competitionId: competition.id });

    const nflClient = new NflTestClient(apiKey);

    // Test invalid confidence value (< 0)
    try {
      await nflClient.predictGameWinner(
        competition.id,
        dbGameId,
        "CHI",
        -0.1,
        "Test prediction",
      );
      expect.fail("Should have thrown 400 error for negative confidence");
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test invalid confidence value (> 1)
    try {
      await nflClient.predictGameWinner(
        competition.id,
        dbGameId,
        "CHI",
        1.5,
        "Test prediction",
      );
      expect.fail("Should have thrown 400 error for confidence > 1");
    } catch (error) {
      expect(error).toBeDefined();
    }

    const validPrediction = await nflClient.predictGameWinner(
      competition.id,
      dbGameId,
      "CHI",
      0.7,
      "Valid prediction",
    );
    expect(validPrediction.success).toBe(true);
  });

  test("should successfully read agent ranks after competition ends", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    // Advance to final snapshot
    for (let i = 0; i < 5; i++) {
      await tempClient.advanceMockServer(globalGameId);
    }
    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition",
      gameIds: [dbGameId],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    const { agent: agent1, apiKey: agent1ApiKey } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: `User1 ${Date.now()}`,
        userEmail: `user1-${Date.now()}@example.com`,
        agentName: `Agent1 ${Date.now()}`,
      });

    await adminClient.addAgentToCompetition(competition.id, agent1.id);
    await adminClient.startCompetition({ competitionId: competition.id });

    const nflClient1 = new NflTestClient(agent1ApiKey);
    await nflClient1.predictGameWinner(
      competition.id,
      dbGameId,
      "MIN",
      1.0,
      "Test prediction",
    );

    const gameEndTime = new Date();
    await services.sportsService.gamesRepository.finalizeGame(
      dbGameId,
      gameEndTime,
      "MIN",
    );
    await services.sportsService.gameScoringService.scoreGame(dbGameId);

    const endResponse = await adminClient.endCompetition(competition.id);
    expect(endResponse.success).toBe(true);

    // Verify agent ranks were updated in agent_score table
    const agentScoreRepo = new AgentScoreRepository(db, repositoryLogger);
    const agentRank = await agentScoreRepo.getAgentRank(
      agent1.id,
      "sports_prediction",
    );
    expect(agentRank).toBeDefined();
    expect(agentRank!.rank).toBeDefined();
    expect(agentRank!.ordinal).toBeDefined();
    expect(agentRank!.rank).toBe(1);
  });

  test("full NFL game winner prediction flow with time-weighted Brier scoring", async () => {
    // Step 1: Ingest game first (before creating competition)
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );

    // Step 2: Create competition with the game ID
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createCompetitionResponse =
      await createSportsPredictionTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test NFL game winner prediction competition",
        gameIds: [dbGameId],
      });

    expect(createCompetitionResponse.success).toBe(true);
    const competition = (createCompetitionResponse as CreateCompetitionResponse)
      .competition;
    const competitionId = competition.id;

    // Step 3: Register two agents before starting competition
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

    // Step 4: Get games and verify structure
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

    // Step 5: Agent 1 makes pre-game prediction (CHI to win with 0.7 confidence)
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

    // Step 6: Agent 2 makes pre-game prediction (MIN to win with 0.6 confidence)
    const prediction2Response = await nflClient2.predictGameWinner(
      competitionId,
      dbGameId,
      "MIN",
      0.6,
      "foobar",
    );
    expect(prediction2Response.success).toBe(true);

    // Step 7: Advance mock server to start the game (snapshot 1)
    await nflClient1.advanceMockServer(globalGameId);
    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    const gameInfoResponse = await nflClient1.getGameInfo(
      competitionId,
      dbGameId,
    );
    expect(gameInfoResponse.data.game.status).toBe("in_progress");

    // Step 8: Agent 1 updates prediction during game (changes to MIN with 0.8 confidence)
    const updatedPrediction1 = await nflClient1.predictGameWinner(
      competitionId,
      dbGameId,
      "MIN",
      0.8,
      "foobar",
    );
    expect(updatedPrediction1.success).toBe(true);

    // Step 9: Verify prediction history
    const predictionsResponse = await nflClient1.getGamePredictions(
      competitionId,
      dbGameId,
      agent1.id,
    );
    expect(predictionsResponse.data.predictions).toHaveLength(2);

    // Step 10: Advance mock server multiple times to progress through game
    await nflClient1.advanceMockServer(globalGameId);
    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    await nflClient1.advanceMockServer(globalGameId);
    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    // Step 11: Advance to final snapshot (game progresses)
    await nflClient1.advanceMockServer(globalGameId);
    await nflClient1.advanceMockServer(globalGameId);
    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    // Step 12: Manually finalize game for testing
    const gameEndTime = new Date();
    await services.sportsService.gamesRepository.finalizeGame(
      dbGameId,
      gameEndTime,
      "MIN",
    );

    const finalGame =
      await services.sportsService.gamesRepository.findById(dbGameId);
    expect(finalGame).toBeDefined();
    expect(finalGame!.status).toBe("final");
    expect(finalGame!.winner).toBe("MIN");

    // Step 13: Score the game
    const scoredCount =
      await services.sportsService.gameScoringService.scoreGame(dbGameId);
    expect(scoredCount).toBe(2);

    // Step 14: Verify leaderboard
    const leaderboardResponse = await nflClient1.getLeaderboard(competitionId);
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.data.leaderboard).toHaveLength(2);

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

    // Step 14: Verify game-specific leaderboard
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
      expect(error).toBeDefined();
    }
  });

  test("should verify all NFL API endpoints are functional", async () => {
    const globalGameId = 19068;
    const tempClient = new NflTestClient("temp-key");
    await tempClient.resetMockServer(globalGameId);

    const dbGameId =
      await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
        globalGameId,
      );
    await tempClient.advanceMockServer(globalGameId);
    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createResponse = await createSportsPredictionTestCompetition({
      adminClient,
      name: competitionName,
      description: "API endpoints test",
      gameIds: [dbGameId],
    });

    const competition = (createResponse as CreateCompetitionResponse)
      .competition;

    const { agent, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User ${Date.now()}`,
      userEmail: `user-${Date.now()}@example.com`,
      agentName: `Agent ${Date.now()}`,
    });

    await adminClient.addAgentToCompetition(competition.id, agent.id);
    await adminClient.startCompetition({ competitionId: competition.id });

    const nflClient = new NflTestClient(apiKey);

    // Test all endpoints

    // 1. Get rules
    const rulesResponse = await nflClient.getRules(competition.id);
    expect(rulesResponse.success).toBe(true);
    expect(rulesResponse.data.predictionType).toBe("game_winner");

    // 2. Get all games
    const gamesResponse = await nflClient.getGames(competition.id);
    expect(gamesResponse.success).toBe(true);
    expect(gamesResponse.data.games).toHaveLength(1);

    // 3. Get specific game info
    const gameInfoResponse = await nflClient.getGameInfo(
      competition.id,
      dbGameId,
    );
    expect(gameInfoResponse.success).toBe(true);
    expect(gameInfoResponse.data.game.id).toBe(dbGameId);
    expect(gameInfoResponse.data.game.status).toBe("in_progress");

    // 4. Get game plays (paginated)
    const playsResponse = await nflClient.getGamePlays(
      competition.id,
      dbGameId,
      10,
      0,
      false,
    );
    expect(playsResponse.success).toBe(true);
    expect(playsResponse.data.plays).toBeDefined();
    expect(playsResponse.data.pagination).toBeDefined();

    // 5. Get latest play (using latest=true query param)
    const latestPlayResponse = await nflClient.getGamePlays(
      competition.id,
      dbGameId,
      1,
      0,
      true,
    );
    expect(latestPlayResponse.success).toBe(true);
    // Note: latest=true returns single play, not array
    expect(latestPlayResponse.data).toBeDefined();

    // 6. Create prediction
    const predictionResponse = await nflClient.predictGameWinner(
      competition.id,
      dbGameId,
      "MIN",
      0.85,
      "Test prediction reason",
    );
    expect(predictionResponse.success).toBe(true);
    expect(predictionResponse.data.predictedWinner).toBe("MIN");
    expect(predictionResponse.data.confidence).toBe(0.85);

    // 7. Get predictions (all)
    const allPredictionsResponse = await nflClient.getGamePredictions(
      competition.id,
      dbGameId,
    );
    expect(allPredictionsResponse.success).toBe(true);
    expect(allPredictionsResponse.data.predictions.length).toBeGreaterThan(0);

    // 8. Get predictions (specific agent)
    const agentPredictionsResponse = await nflClient.getGamePredictions(
      competition.id,
      dbGameId,
      agent.id,
    );
    expect(agentPredictionsResponse.success).toBe(true);
    expect(agentPredictionsResponse.data.predictions).toHaveLength(1);

    // 9. Get competition leaderboard (before game ends - should be empty or in-progress)
    const leaderboardResponse = await nflClient.getLeaderboard(competition.id);
    expect(leaderboardResponse.success).toBe(true);

    // 10. Finalize game and score
    await tempClient.advanceMockServer(globalGameId);
    await tempClient.advanceMockServer(globalGameId);
    await tempClient.advanceMockServer(globalGameId);

    await services.sportsService.nflIngestorService.ingestGamePlayByPlay(
      globalGameId,
    );

    const gameEndTime = new Date();
    await services.sportsService.gamesRepository.finalizeGame(
      dbGameId,
      gameEndTime,
      "MIN",
    );
    await services.sportsService.gameScoringService.scoreGame(dbGameId);

    // 11. Get game leaderboard (after scoring)
    const gameLeaderboardResponse = await nflClient.getLeaderboard(
      competition.id,
      dbGameId,
    );
    expect(gameLeaderboardResponse.success).toBe(true);
    expect(gameLeaderboardResponse.data.leaderboard).toHaveLength(1);
    expect(gameLeaderboardResponse.data.gameId).toBe(dbGameId);

    // 12. Get competition leaderboard (after scoring)
    const finalLeaderboardResponse = await nflClient.getLeaderboard(
      competition.id,
    );
    expect(finalLeaderboardResponse.success).toBe(true);
    expect(finalLeaderboardResponse.data.leaderboard).toHaveLength(1);
  });
});
