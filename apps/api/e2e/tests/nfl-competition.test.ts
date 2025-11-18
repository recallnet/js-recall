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

describe("NFL Play Prediction Competition E2E", () => {
  let adminApiKey: string;
  let services: ServiceRegistry;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    services = new ServiceRegistry();
  });

  test("full NFL competition flow with mock SportsDataIO server", async () => {
    // Step 1: Create a competition
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const competitionName = `NFL Test Competition ${Date.now()}`;
    const createCompetitionResponse =
      await createNflPlayPredictionTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test NFL play prediction competition",
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

    // Create NFL test clients
    const nflClient1 = new NflTestClient(agent1ApiKey);
    const nflClient2 = new NflTestClient(agent2ApiKey);

    // Step 3: Ingest game using live ingestor with mock server
    const globalGameId = 19068;

    // Reset mock server to snapshot 0
    await nflClient1.resetMockServer(globalGameId);

    // Ingest initial game state (snapshot 0 - pre-game)
    const dbGameId =
      await services.nflLiveIngestorService.ingestGamePlayByPlay(globalGameId);

    // Link game to competition
    await services.competitionGamesRepository.create({
      competitionId,
      gameId: dbGameId,
    });

    // Step 4: Join competition (must be done before starting)
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

    // Step 5: Start the competition
    await services.competitionRepository.update({
      id: competitionId,
      status: "active",
      startDate: new Date(),
    });

    // Step 6: Advance mock server to snapshot 1 (after kickoff, creates open play for sequence 2)
    await nflClient1.advanceMockServer(globalGameId);
    await services.nflLiveIngestorService.ingestGamePlayByPlay(globalGameId);

    // Step 7: Verify open play exists (sequence 2 - first offensive play)
    const playsData = await nflClient1.getOpenPlays(competitionId);
    expect(playsData.success).toBe(true);
    expect(playsData.data.plays.length).toBeGreaterThan(0);

    // Step 8: Submit predictions for sequence 2 (rush play)
    // Agent 1: Predict rush (correct)
    const prediction1_1 = await nflClient1.submitPrediction(
      competitionId,
      globalGameId,
      "run",
      0.8,
    );
    expect(prediction1_1.success).toBe(true);

    // Agent 2: Predict rush (correct)
    const prediction2_1 = await nflClient2.submitPrediction(
      competitionId,
      globalGameId,
      "run",
      0.6,
    );
    expect(prediction2_1.success).toBe(true);

    // Step 9: Advance to snapshot 2 (resolves sequence 2 as Rush, creates open play for sequence 3)
    await nflClient1.advanceMockServer(globalGameId);
    await services.nflLiveIngestorService.ingestGamePlayByPlay(globalGameId);

    // Score the resolved play
    const gamePlaysRepo = services.gamePlaysRepository;
    const scoringService = services.scoringManagerService;
    let dbPlays = await gamePlaysRepo.findByGameId(dbGameId);
    const play2 = dbPlays.find((p) => p.sequence === 2);
    if (play2 && play2.actualOutcome) {
      await scoringService.scorePlay(play2.id);
    }

    // Step 10: Submit predictions for sequence 3 (pass completion)
    // Agent 1: Predict pass (correct)
    const prediction1_2 = await nflClient1.submitPrediction(
      competitionId,
      globalGameId,
      "pass",
      0.7,
    );
    expect(prediction1_2.success).toBe(true);

    // Agent 2: Predict run (wrong)
    const prediction2_2 = await nflClient2.submitPrediction(
      competitionId,
      globalGameId,
      "run",
      0.5,
    );
    expect(prediction2_2.success).toBe(true);

    // Step 11: Advance to snapshot 3 (resolves sequence 3 as PassCompleted)
    await nflClient1.advanceMockServer(globalGameId);
    await services.nflLiveIngestorService.ingestGamePlayByPlay(globalGameId);

    // Score the resolved play
    dbPlays = await gamePlaysRepo.findByGameId(dbGameId);
    const play3 = dbPlays.find((p) => p.sequence === 3);
    if (play3 && play3.actualOutcome) {
      await scoringService.scorePlay(play3.id);
    }

    // Step 12: Check leaderboard
    const leaderboardData = await nflClient1.getLeaderboard(competitionId);
    expect(leaderboardData.success).toBe(true);

    const leaderboard = leaderboardData.data.leaderboard;
    expect(leaderboard).toHaveLength(2);

    // Agent 1 should be first (both correct)
    expect(leaderboard[0].agentId).toBe(agent1.id);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].totalPredictions).toBe(2);
    expect(leaderboard[0].correctPredictions).toBe(2);
    expect(leaderboard[0].accuracy).toBe(1.0);

    // Agent 2 should be second (1 correct, 1 wrong)
    expect(leaderboard[1].agentId).toBe(agent2.id);
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].totalPredictions).toBe(2);
    expect(leaderboard[1].correctPredictions).toBe(1);
    expect(leaderboard[1].accuracy).toBe(0.5);

    // Verify Brier scores are calculated
    expect(leaderboard[0].brierScore).toBeGreaterThan(0);
    expect(leaderboard[1].brierScore).toBeGreaterThan(0);
  });
});
