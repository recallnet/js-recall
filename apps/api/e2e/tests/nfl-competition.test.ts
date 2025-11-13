import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { BaselinePlay } from "@recallnet/services";
import {
  CreateCompetitionResponse,
  createTestClient,
  getAdminApiKey,
  getBaseUrl,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { ServiceRegistry } from "@/services/index.js";

describe("NFL Play Prediction Competition E2E", () => {
  let adminApiKey: string;
  let services: ServiceRegistry;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    services = new ServiceRegistry();
  });

  test("full NFL competition flow: ingest → predict → resolve → leaderboard", async () => {
    // Step 1: Create a competition
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createCompetitionResponse = await adminClient.createCompetition({
      name: competitionName,
      description: "Test NFL play prediction competition",
      type: "nfl",
    });

    expect(createCompetitionResponse.success).toBe(true);
    const competition = (createCompetitionResponse as CreateCompetitionResponse)
      .competition;
    const competitionId = competition.id;

    // Step 2: Register two agents BEFORE starting competition
    const {
      client: agent1Client,
      agent: agent1,
      apiKey: agent1ApiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User1 ${Date.now()}`,
      userEmail: `user1-${Date.now()}@example.com`,
      agentName: `Agent1 ${Date.now()}`,
    });

    const {
      client: agent2Client,
      agent: agent2,
      apiKey: agent2ApiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName: `User2 ${Date.now()}`,
      userEmail: `user2-${Date.now()}@example.com`,
      agentName: `Agent2 ${Date.now()}`,
    });

    // Step 3: Join competition (must be done before starting)
    const joinResponse1 = await agent1Client.joinCompetition(
      competitionId,
      agent1.id,
    );
    expect(joinResponse1.success).toBe(true);

    const joinResponse2 = await agent2Client.joinCompetition(
      competitionId,
      agent2.id,
    );
    expect(joinResponse2.success).toBe(true);

    // Step 4: Start the competition (NFL competitions don't need balance setup)
    await services.competitionRepository.update({
      id: competitionId,
      status: "active",
      startDate: new Date(),
    });

    // Step 5: Ingest test game data
    const ingestor = services.nflPlaybackIngestorService;

    // Create test game (use realistic globalGameId)
    const testGlobalGameId = 99999 + Math.floor(Math.random() * 1000); // Random ID in valid range
    const games = [
      {
        globalGameId: testGlobalGameId,
        gameKey: `test-${testGlobalGameId}`,
        startTime: new Date().toISOString(),
        homeTeam: "DAL",
        awayTeam: "WAS",
        venue: "Test Stadium",
      },
    ];

    const gameIdMap = await ingestor.ingestGames(games);
    const dbGameId = gameIdMap.get(testGlobalGameId);
    expect(dbGameId).toBeDefined();

    // Link game to competition
    await ingestor.linkGamesToCompetition(competitionId, [dbGameId!]);

    // Create test plays with lock times in the future
    const now = new Date();
    const plays: BaselinePlay[] = [
      {
        providerPlayId: "test-play-1",
        sequence: 1,
        quarterName: "1",
        timeRemainingMinutes: 14,
        timeRemainingSeconds: 45,
        playTime: new Date(now.getTime() + 60000).toISOString(),
        down: 1,
        distance: 10,
        yardLine: 25,
        yardLineTerritory: "DAL",
        yardsToEndZone: 75,
        playType: "Pass",
        team: "DAL",
        opponent: "WAS",
        description: "Test pass play",
        lockMs: 60000, // 60 seconds in future
        actualOutcome: "pass" as const,
      },
      {
        providerPlayId: "test-play-2",
        sequence: 2,
        quarterName: "1",
        timeRemainingMinutes: 14,
        timeRemainingSeconds: 10,
        playTime: new Date(now.getTime() + 120000).toISOString(),
        down: 2,
        distance: 5,
        yardLine: 30,
        yardLineTerritory: "DAL",
        yardsToEndZone: 70,
        playType: "Rush",
        team: "DAL",
        opponent: "WAS",
        description: "Test rush play",
        lockMs: 120000, // 120 seconds in future
        actualOutcome: "run" as const,
      },
    ];

    await ingestor.ingestPlays(dbGameId!, plays, 1.0, now);

    // Step 6: Verify open plays exist

    // Step 5: Verify open plays exist
    const playsResponse = await axios.get(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/plays?state=open`,
      {
        headers: { Authorization: `Bearer ${agent1ApiKey}` },
      },
    );
    expect(playsResponse.status).toBe(200);
    expect(playsResponse.data.success).toBe(true);
    expect(playsResponse.data.data.plays).toHaveLength(2);

    // Step 6: Submit predictions for first play
    // Agent 1: Predict pass
    const prediction1_1 = await axios.post(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
      { prediction: "pass", confidence: 0.8 },
      { headers: { Authorization: `Bearer ${agent1ApiKey}` } },
    );
    expect(prediction1_1.status).toBe(201);
    expect(prediction1_1.data.success).toBe(true);

    // Agent 2: Predict pass
    const prediction2_1 = await axios.post(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
      { prediction: "pass", confidence: 0.6 },
      { headers: { Authorization: `Bearer ${agent2ApiKey}` } },
    );
    expect(prediction2_1.status).toBe(201);

    // Step 7: Resolve first play and score it
    const gamePlaysRepo = services.gamePlaysRepository;
    const scoringService = services.scoringManagerService;
    let dbPlays = await gamePlaysRepo.findByGameId(dbGameId!);
    const firstPlay = dbPlays.find((p) => p.sequence === 1);
    expect(firstPlay).toBeDefined();

    await gamePlaysRepo.resolve(firstPlay!.id, "pass");
    await scoringService.scorePlay(firstPlay!.id);

    // Step 8: Submit predictions for second play
    // Agent 1: Predict run (correct)
    const prediction1_2 = await axios.post(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
      { prediction: "run", confidence: 0.7 },
      { headers: { Authorization: `Bearer ${agent1ApiKey}` } },
    );
    expect(prediction1_2.status).toBe(201);

    // Agent 2: Predict pass (wrong)
    const prediction2_2 = await axios.post(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
      { prediction: "pass", confidence: 0.5 },
      { headers: { Authorization: `Bearer ${agent2ApiKey}` } },
    );
    expect(prediction2_2.status).toBe(201);

    // Step 9: Resolve second play and score it
    dbPlays = await gamePlaysRepo.findByGameId(dbGameId!);
    const secondPlay = dbPlays.find((p) => p.sequence === 2);
    expect(secondPlay).toBeDefined();

    await gamePlaysRepo.resolve(secondPlay!.id, "run");
    await scoringService.scorePlay(secondPlay!.id);

    // Step 10: Check leaderboard
    const leaderboardResponse = await axios.get(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/leaderboard`,
      { headers: { Authorization: `Bearer ${agent1ApiKey}` } },
    );
    expect(leaderboardResponse.status).toBe(200);
    expect(leaderboardResponse.data.success).toBe(true);

    const leaderboard = leaderboardResponse.data.data.leaderboard;
    expect(leaderboard).toHaveLength(2);

    // Agent 1 should be first (2/2 correct = 100%)
    expect(leaderboard[0].agentId).toBe(agent1.id);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].totalPredictions).toBe(2);
    expect(leaderboard[0].correctPredictions).toBe(2);
    expect(leaderboard[0].accuracy).toBe(1.0);

    // Agent 2 should be second (1/2 correct = 50%)
    expect(leaderboard[1].agentId).toBe(agent2.id);
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].totalPredictions).toBe(2);
    expect(leaderboard[1].correctPredictions).toBe(1);
    expect(leaderboard[1].accuracy).toBe(0.5);

    // Verify Brier scores are calculated
    expect(leaderboard[0].brierScore).toBeGreaterThan(0);
    expect(leaderboard[1].brierScore).toBeGreaterThan(0);
  });

  test("predictions are rejected after lock time", async () => {
    // Create competition and game
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionResponse = await adminClient.createCompetition({
      name: `NFL Lock Test ${Date.now()}`,
      type: "nfl",
    });
    const competitionId = (competitionResponse as CreateCompetitionResponse)
      .competition.id;

    // Start the competition
    await services.competitionRepository.update({
      id: competitionId,
      status: "active",
      startDate: new Date(),
    });

    const ingestor = services.nflPlaybackIngestorService;
    const testGlobalGameId = 99999 + Math.floor(Math.random() * 1000);

    const gameIdMap = await ingestor.ingestGames([
      {
        globalGameId: testGlobalGameId,
        gameKey: `lock-test-${testGlobalGameId}`,
        startTime: new Date().toISOString(),
        homeTeam: "DAL",
        awayTeam: "WAS",
      },
    ]);

    const dbGameId = gameIdMap.get(testGlobalGameId)!;
    await ingestor.linkGamesToCompetition(competitionId, [dbGameId]);

    // Create play with lock time in the past
    const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
    await ingestor.ingestPlays(
      dbGameId,
      [
        {
          providerPlayId: "locked-play-1",
          sequence: 1,
          quarterName: "1",
          timeRemainingMinutes: 15,
          timeRemainingSeconds: 0,
          down: 1,
          distance: 10,
          yardLine: 25,
          yardLineTerritory: "DAL",
          yardsToEndZone: 75,
          playType: "Pass",
          team: "DAL",
          opponent: "WAS",
          description: "Test locked play",
          lockMs: 0, // Already locked
          actualOutcome: "pass",
        },
      ],
      1.0,
      pastTime,
    );

    // Register agent
    const {
      client: agentClient,
      agent,
      apiKey: agentApiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    await agentClient.joinCompetition(competitionId, agent.id);

    // Get the play
    const gamePlaysRepo = services.gamePlaysRepository;
    const plays = await gamePlaysRepo.findByGameId(dbGameId);
    const playId = plays[0]?.id;
    expect(playId).toBeDefined();

    // Try to predict - should fail because lock time has passed
    try {
      await axios.post(
        `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
        { prediction: "pass", confidence: 0.8 },
        { headers: { Authorization: `Bearer ${agentApiKey}` } },
      );
      expect.fail("Should have thrown error for locked play");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data.success).toBe(false);
      } else {
        throw error;
      }
    }
  });

  test("predictions require valid confidence values", async () => {
    // Setup
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionResponse = await adminClient.createCompetition({
      name: `NFL Validation Test ${Date.now()}`,
      type: "nfl",
    });
    const competitionId = (competitionResponse as CreateCompetitionResponse)
      .competition.id;

    // Start the competition
    await services.competitionRepository.update({
      id: competitionId,
      status: "active",
      startDate: new Date(),
    });

    const ingestor = services.nflPlaybackIngestorService;
    const testGlobalGameId = 99999 + Math.floor(Math.random() * 1000);

    const gameIdMap = await ingestor.ingestGames([
      {
        globalGameId: testGlobalGameId,
        gameKey: `validation-test-${testGlobalGameId}`,
        startTime: new Date().toISOString(),
        homeTeam: "DAL",
        awayTeam: "WAS",
      },
    ]);

    const dbGameId = gameIdMap.get(testGlobalGameId)!;
    await ingestor.linkGamesToCompetition(competitionId, [dbGameId]);

    await ingestor.ingestPlays(
      dbGameId,
      [
        {
          providerPlayId: "validation-play-1",
          sequence: 1,
          quarterName: "1",
          timeRemainingMinutes: 15,
          timeRemainingSeconds: 0,
          down: 1,
          distance: 10,
          yardLine: 25,
          yardLineTerritory: "DAL",
          yardsToEndZone: 75,
          playType: "Pass",
          team: "DAL",
          opponent: "WAS",
          description: "Test validation play",
          lockMs: 60000,
          actualOutcome: "pass",
        },
      ],
      1.0,
      new Date(),
    );

    const {
      client: agentClient,
      agent,
      apiKey: agentApiKey,
    } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    await agentClient.joinCompetition(competitionId, agent.id);

    const plays = await services.gamePlaysRepository.findByGameId(dbGameId);
    const playId = plays[0]?.id;
    expect(playId).toBeDefined();

    // Test invalid confidence values
    const invalidConfidences = [-0.1, 1.5, 2.0];

    for (const confidence of invalidConfidences) {
      try {
        await axios.post(
          `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
          { prediction: "pass", confidence },
          { headers: { Authorization: `Bearer ${agentApiKey}` } },
        );
        expect.fail("Should have thrown error for invalid confidence");
      } catch (error) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBe(400);
        } else {
          throw error;
        }
      }
    }

    // Test valid confidence
    const validResponse = await axios.post(
      `${getBaseUrl()}/api/nfl/competitions/${competitionId}/games/${testGlobalGameId}/predictions`,
      { prediction: "pass", confidence: 0.75 },
      { headers: { Authorization: `Bearer ${agentApiKey}` } },
    );

    expect(validResponse.status).toBe(201);
  });
});
