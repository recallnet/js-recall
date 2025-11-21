import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import type {
  SelectGame,
  SelectGamePrediction,
} from "@recallnet/db/schema/sports/types";

import { GameScoringService } from "../game-scoring.service.js";
import type {
  SportsDataIONflProvider,
  SportsDataIOPlayByPlay,
  SportsDataIOScheduleGame,
} from "../providers/sportsdataio.provider.js";
import { NflIngestorService } from "../sports-nfl-ingestor.service.js";

describe("NflIngestorService", () => {
  let service: NflIngestorService;
  let mockGamesRepo: MockProxy<GamesRepository>;
  let mockGamePlaysRepo: MockProxy<GamePlaysRepository>;
  let mockGamePredictionsRepo: MockProxy<GamePredictionsRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockCompetitionGamesRepo: MockProxy<CompetitionGamesRepository>;
  let mockProvider: MockProxy<SportsDataIONflProvider>;
  let mockGameScoringService: MockProxy<GameScoringService>;
  let mockLogger: MockProxy<Logger>;

  // Helper to create enriched competition mock matching buildFullCompetitionQuery return type
  const createMockCompetition = () => {
    const competitionId = randomUUID();
    return {
      // Core competition fields
      id: competitionId,
      competitionId,
      name: "Test NFL Competition",
      type: "sports_prediction" as const,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: "Test NFL Competition",
      startDate: new Date(),
      endDate: null,
      arenaId: "default-nfl-game-prediction-arena",
      engineId: null,
      engineVersion: null,
      agentAllocation: null,
      agentAllocationUnit: null,
      boosterAllocation: null,
      boosterAllocationUnit: null,
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
      minimumStake: null,
      vips: null,
      blocklist: null,
      allowlist: null,
      allowlistOnly: false,
      minRecallRank: null,
      rewardsIneligible: null,
      displayState: null,
      rewardRules: null,
      rewardDetails: null,
      crossChainTradingType: "allow" as const,
      minimumPairAgeHours: null,
      minimum24hVolumeUsd: null,
      minimumLiquidityUsd: null,
      minimumFdvUsd: null,
      minTradesPerDay: null,
      rewards: undefined,
      rewardsTge: undefined,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGamesRepo = mock<GamesRepository>();
    mockGamePlaysRepo = mock<GamePlaysRepository>();
    mockGamePredictionsRepo = mock<GamePredictionsRepository>();
    // Add the new method to the mock with proper typing
    mockGamePredictionsRepo.findPregamePredictions =
      vi.fn() as typeof mockGamePredictionsRepo.findPregamePredictions;
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockCompetitionGamesRepo = mock<CompetitionGamesRepository>();
    mockProvider = mock<SportsDataIONflProvider>();
    mockGameScoringService = mock<GameScoringService>();
    mockLogger = mock<Logger>();

    service = new NflIngestorService(
      mockGamesRepo,
      mockGamePlaysRepo,
      mockGamePredictionsRepo,
      mockCompetitionRepo,
      mockCompetitionGamesRepo,
      mockGameScoringService,
      mockProvider,
      mockLogger,
    );
  });

  describe("discoverActiveGames", () => {
    it("should find in-progress games from active NFL competitions", async () => {
      const competition = createMockCompetition();

      const game: SelectGame = {
        id: randomUUID(),
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: null,
        status: "in_progress",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [competition],
        total: 1,
      });
      mockCompetitionGamesRepo.findGameIdsByCompetitionId.mockResolvedValue([
        game.id,
      ]);
      mockGamesRepo.findByIds.mockResolvedValue([game]);

      const result = await service.discoverActiveGames();

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(game.id);
      expect(result[0]!.status).toBe("in_progress");
    });

    it("should return empty array when no active NFL competitions", async () => {
      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [],
        total: 0,
      });

      const result = await service.discoverActiveGames();

      expect(result).toEqual([]);
    });

    it("should filter out non-in-progress games", async () => {
      const competition = createMockCompetition();

      const scheduledGame: SelectGame = {
        id: randomUUID(),
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: null,
        status: "scheduled",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [competition],
        total: 1,
      });
      mockCompetitionGamesRepo.findGameIdsByCompetitionId.mockResolvedValue([
        scheduledGame.id,
      ]);
      mockGamesRepo.findByIds.mockResolvedValue([scheduledGame]);

      const result = await service.discoverActiveGames();

      expect(result).toEqual([]);
    });
  });

  describe("ingestGamePlayByPlay", () => {
    it("should ingest game data", async () => {
      const mockData: SportsDataIOPlayByPlay = {
        Score: {
          GlobalGameID: 19068,
          GameKey: "202510106",
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          Date: "2025-09-08T19:15:00",
          GameEndDateTime: null,
          HomeTeam: "CHI",
          AwayTeam: "MIN",
          AwayScore: null,
          HomeScore: null,
          HasStarted: false,
          IsInProgress: false,
          IsOver: false,
          Status: "Scheduled",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
          },
          Quarter: null,
          TimeRemaining: null,
          Possession: null,
          Down: null,
          Distance: null,
          YardLine: null,
          YardLineTerritory: null,
          DownAndDistance: null,
        },
        Quarters: [],
        Plays: [],
      };

      const mockGame: SelectGame = {
        id: randomUUID(),
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "scheduled",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProvider.getPlayByPlay.mockResolvedValue(mockData);
      mockGamesRepo.findByProviderGameId.mockResolvedValue(undefined);
      mockGamesRepo.upsert.mockResolvedValue(mockGame);

      const result = await service.ingestGamePlayByPlay(19068);

      expect(result).toBe(mockGame.id);
      expect(mockProvider.getPlayByPlay).toHaveBeenCalledWith(19068);
      expect(mockGamesRepo.upsert).toHaveBeenCalled();
    });
  });

  describe("syncSchedule", () => {
    it("should sync schedule for a season", async () => {
      const mockSchedule: SportsDataIOScheduleGame[] = [
        {
          GameKey: "202510106",
          GlobalGameID: 19068,
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          Date: "2025-09-08T19:15:00",
          AwayTeam: "MIN",
          HomeTeam: "CHI",
          Channel: null,
          PointSpread: 1.5,
          OverUnder: 43.5,
          StadiumID: 1,
          Canceled: false,
          Status: "Scheduled",
          IsClosed: null,
          DateTimeUTC: "2025-09-08T19:15:00Z",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
            Country: "USA",
            Capacity: 61500,
            PlayingSurface: "Grass",
            GeoLat: 41.862,
            GeoLong: -87.617,
            Type: "Outdoor",
          },
        },
        {
          GameKey: "BYE",
          GlobalGameID: 0,
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          Date: "2025-09-08T19:15:00",
          AwayTeam: "BYE",
          HomeTeam: "DAL",
          Channel: null,
          PointSpread: null,
          OverUnder: null,
          StadiumID: 0,
          Canceled: false,
          Status: "Scheduled",
          IsClosed: null,
          DateTimeUTC: "2025-09-08T19:15:00Z",
          StadiumDetails: {
            StadiumID: 0,
            Name: "",
            City: "",
            State: "",
            Country: "",
            Capacity: 0,
            PlayingSurface: "",
            GeoLat: 0,
            GeoLong: 0,
            Type: "",
          },
        },
      ];

      mockProvider.getSchedule.mockResolvedValue(mockSchedule);
      const mockUpsertedGame: SelectGame = {
        id: randomUUID(),
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date("2025-09-08T19:15:00Z"),
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: 1.5,
        overUnder: 43.5,
        venue: "Soldier Field",
        status: "scheduled",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGamesRepo.upsert.mockResolvedValue(mockUpsertedGame);

      const result = await service.syncSchedule("2025");

      expect(result.syncedCount).toBe(1); // BYE week filtered out
      expect(result.totalGames).toBe(1);
      expect(result.errorCount).toBe(0);
    });
  });

  describe("finalizeGame", () => {
    it("should finalize game and trigger scoring", async () => {
      const gameId = randomUUID();
      const endTime = new Date();

      const mockFinalizedGame: SelectGame = {
        id: gameId,
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date("2025-09-08T19:15:00Z"),
        endTime,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "final",
        winner: "MIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGamesRepo.finalizeGame.mockResolvedValue(mockFinalizedGame);
      mockGameScoringService.scoreGame.mockResolvedValue(5);

      const result = await service.finalizeGame(gameId, endTime, "MIN");

      expect(result).toBe(5);
      expect(mockGamesRepo.finalizeGame).toHaveBeenCalledWith(
        gameId,
        endTime,
        "MIN",
      );
      expect(mockGameScoringService.scoreGame).toHaveBeenCalledWith(gameId);
    });
  });

  describe("ingestActiveGames", () => {
    it("should ingest all active games", async () => {
      const game: SelectGame = {
        id: randomUUID(),
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: null,
        status: "in_progress",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const competition = createMockCompetition();

      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [competition],
        total: 1,
      });
      mockCompetitionGamesRepo.findGameIdsByCompetitionId.mockResolvedValue([
        game.id,
      ]);
      mockGamesRepo.findByIds.mockResolvedValue([game]);

      const mockPlayByPlayData: SportsDataIOPlayByPlay = {
        Score: {
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          GlobalGameID: 19068,
          GameKey: "202510106",
          Date: "2025-09-08T19:15:00",
          GameEndDateTime: null,
          HomeTeam: "CHI",
          AwayTeam: "MIN",
          AwayScore: 14,
          HomeScore: 7,
          HasStarted: true,
          IsInProgress: true,
          IsOver: false,
          Status: "InProgress",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
          },
          Quarter: "2",
          TimeRemaining: "5:30",
          Possession: "MIN",
          Down: 2,
          Distance: "7",
          YardLine: 45,
          YardLineTerritory: "CHI",
          DownAndDistance: "2nd and 7",
        },
        Quarters: [],
        Plays: [],
      };

      mockProvider.getPlayByPlay.mockResolvedValue(mockPlayByPlayData);
      mockGamesRepo.findByProviderGameId.mockResolvedValue(game);
      mockGamesRepo.upsert.mockResolvedValue(game);

      const result = await service.ingestActiveGames();

      expect(result).toBe(1);
      expect(mockProvider.getPlayByPlay).toHaveBeenCalledWith(19068);
    });

    it("should return 0 when no active games found", async () => {
      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [],
        total: 0,
      });

      const result = await service.ingestActiveGames();

      expect(result).toBe(0);
    });

    it("should continue on error for individual games", async () => {
      const game1: SelectGame = {
        id: randomUUID(),
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: null,
        status: "in_progress",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const game2: SelectGame = {
        id: randomUUID(),
        providerGameId: 19069,
        season: 2025,
        week: 1,
        startTime: new Date(),
        endTime: null,
        homeTeam: "GB",
        awayTeam: "DET",
        spread: null,
        overUnder: null,
        venue: null,
        status: "in_progress",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const competition = createMockCompetition();

      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [competition],
        total: 1,
      });
      mockCompetitionGamesRepo.findGameIdsByCompetitionId.mockResolvedValue([
        game1.id,
        game2.id,
      ]);
      mockGamesRepo.findByIds.mockResolvedValue([game1, game2]);

      // First game fails, second succeeds
      mockProvider.getPlayByPlay
        .mockRejectedValueOnce(new Error("API error"))
        .mockResolvedValueOnce({
          Score: {
            SeasonType: 1,
            Season: 2025,
            Week: 1,
            GlobalGameID: 19069,
            GameKey: "202510107",
            Date: "2025-09-08T19:15:00",
            GameEndDateTime: null,
            HomeTeam: "DET",
            AwayTeam: "GB",
            AwayScore: 0,
            HomeScore: 0,
            HasStarted: true,
            IsInProgress: true,
            IsOver: false,
            Status: "InProgress",
            StadiumDetails: {
              StadiumID: 2,
              Name: "Ford Field",
              City: "Detroit",
              State: "MI",
            },
            Quarter: null,
            TimeRemaining: null,
            Possession: null,
            Down: null,
            Distance: null,
            YardLine: null,
            YardLineTerritory: null,
            DownAndDistance: null,
          },
          Quarters: [],
          Plays: [],
        });

      mockGamesRepo.findByProviderGameId.mockResolvedValue(undefined);
      mockGamesRepo.upsert.mockResolvedValue(game2);

      const result = await service.ingestActiveGames();

      // Should process second game despite first failing
      expect(result).toBe(1);
    });
  });

  describe("Pre-game Prediction Snapshots", () => {
    it("should snapshot pre-game predictions when game starts", async () => {
      const gameId = randomUUID();
      const competitionId = randomUUID();
      const agent1Id = randomUUID();
      const agent2Id = randomUUID();
      const gameStartTime = new Date("2025-09-08T19:15:00Z");

      const existingGame: SelectGame = {
        id: gameId,
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: gameStartTime,
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "scheduled",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Pre-game predictions
      const preGamePredictions: SelectGamePrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN",
          confidence: "0.85",
          reason: "Strong offensive line",
          createdAt: new Date("2025-09-08T18:00:00Z"), // 1 hour before
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "CHI",
          confidence: "0.65",
          reason: "Home field advantage",
          createdAt: new Date("2025-09-08T19:00:00Z"), // 15 min before (more recent)
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent2Id,
          predictedWinner: "MIN",
          confidence: "0.90",
          reason: "Better defense",
          createdAt: new Date("2025-09-08T18:30:00Z"),
        },
      ];

      mockGamesRepo.findByProviderGameId.mockResolvedValue(existingGame);
      mockGamePredictionsRepo.findPregamePredictions.mockResolvedValue(
        preGamePredictions,
      );
      mockGamePredictionsRepo.create.mockResolvedValue(
        {} as SelectGamePrediction,
      );

      const updatedGame: SelectGame = {
        ...existingGame,
        status: "in_progress",
      };
      mockGamesRepo.upsert.mockResolvedValue(updatedGame);

      const mockPlayByPlayData: SportsDataIOPlayByPlay = {
        Score: {
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          GlobalGameID: 19068,
          GameKey: "202510106",
          Date: "2025-09-08T19:15:00",
          GameEndDateTime: null,
          HomeTeam: "CHI",
          AwayTeam: "MIN",
          AwayScore: 0,
          HomeScore: 0,
          HasStarted: true,
          IsInProgress: true,
          IsOver: false,
          Status: "InProgress",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
          },
          Quarter: "1",
          TimeRemaining: "15:00",
          Possession: null,
          Down: null,
          Distance: null,
          YardLine: null,
          YardLineTerritory: null,
          DownAndDistance: null,
        },
        Quarters: [],
        Plays: [],
      };

      mockProvider.getPlayByPlay.mockResolvedValue(mockPlayByPlayData);

      await service.ingestGamePlayByPlay(19068);

      // Should have created 2 snapshots (one per agent, using their most recent pre-game prediction)
      expect(mockGamePredictionsRepo.create).toHaveBeenCalledTimes(2);

      // Agent 1's snapshot should use their most recent prediction (CHI @ 19:00)
      expect(mockGamePredictionsRepo.create).toHaveBeenCalledWith({
        competitionId,
        gameId,
        agentId: agent1Id,
        predictedWinner: "CHI",
        confidence: "0.65",
        reason: "[Snapshot at game start] Home field advantage",
        createdAt: gameStartTime,
      });

      // Agent 2's snapshot
      expect(mockGamePredictionsRepo.create).toHaveBeenCalledWith({
        competitionId,
        gameId,
        agentId: agent2Id,
        predictedWinner: "MIN",
        confidence: "0.90",
        reason: "[Snapshot at game start] Better defense",
        createdAt: gameStartTime,
      });
    });

    it("should not snapshot if no pre-game predictions exist", async () => {
      const gameId = randomUUID();
      const gameStartTime = new Date("2025-09-08T19:15:00Z");

      const existingGame: SelectGame = {
        id: gameId,
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: gameStartTime,
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "scheduled",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGamesRepo.findByProviderGameId.mockResolvedValue(existingGame);
      mockGamePredictionsRepo.findPregamePredictions.mockResolvedValue([]);

      const updatedGame: SelectGame = {
        ...existingGame,
        status: "in_progress",
      };
      mockGamesRepo.upsert.mockResolvedValue(updatedGame);

      const mockPlayByPlayData: SportsDataIOPlayByPlay = {
        Score: {
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          GlobalGameID: 19068,
          GameKey: "202510106",
          Date: "2025-09-08T19:15:00",
          GameEndDateTime: null,
          HomeTeam: "CHI",
          AwayTeam: "MIN",
          AwayScore: 0,
          HomeScore: 0,
          HasStarted: true,
          IsInProgress: true,
          IsOver: false,
          Status: "InProgress",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
          },
          Quarter: "1",
          TimeRemaining: "15:00",
          Possession: null,
          Down: null,
          Distance: null,
          YardLine: null,
          YardLineTerritory: null,
          DownAndDistance: null,
        },
        Quarters: [],
        Plays: [],
      };

      mockProvider.getPlayByPlay.mockResolvedValue(mockPlayByPlayData);

      await service.ingestGamePlayByPlay(19068);

      // Should not create any snapshots
      expect(mockGamePredictionsRepo.create).not.toHaveBeenCalled();
    });

    it("should not snapshot if game was already in_progress", async () => {
      const gameId = randomUUID();
      const gameStartTime = new Date("2025-09-08T19:15:00Z");

      const existingGame: SelectGame = {
        id: gameId,
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: gameStartTime,
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "in_progress", // Already in progress
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGamesRepo.findByProviderGameId.mockResolvedValue(existingGame);

      const updatedGame: SelectGame = {
        ...existingGame,
        status: "in_progress",
      };
      mockGamesRepo.upsert.mockResolvedValue(updatedGame);

      const mockPlayByPlayData: SportsDataIOPlayByPlay = {
        Score: {
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          GlobalGameID: 19068,
          GameKey: "202510106",
          Date: "2025-09-08T19:15:00",
          GameEndDateTime: null,
          HomeTeam: "CHI",
          AwayTeam: "MIN",
          AwayScore: 7,
          HomeScore: 3,
          HasStarted: true,
          IsInProgress: true,
          IsOver: false,
          Status: "InProgress",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
          },
          Quarter: "2",
          TimeRemaining: "10:00",
          Possession: "CHI",
          Down: 1,
          Distance: "10",
          YardLine: 50,
          YardLineTerritory: "CHI",
          DownAndDistance: "1st and 10",
        },
        Quarters: [],
        Plays: [],
      };

      mockProvider.getPlayByPlay.mockResolvedValue(mockPlayByPlayData);

      await service.ingestGamePlayByPlay(19068);

      // Should not call findPregamePredictions or create snapshots
      expect(
        mockGamePredictionsRepo.findPregamePredictions,
      ).not.toHaveBeenCalled();
      expect(mockGamePredictionsRepo.create).not.toHaveBeenCalled();
    });

    it("should handle multiple predictions from same agent and pick most recent", async () => {
      const gameId = randomUUID();
      const competitionId = randomUUID();
      const agentId = randomUUID();
      const gameStartTime = new Date("2025-09-08T19:15:00Z");

      const existingGame: SelectGame = {
        id: gameId,
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: gameStartTime,
        endTime: null,
        homeTeam: "CHI",
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "scheduled",
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Multiple predictions from same agent, different times
      const preGamePredictions: SelectGamePrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN",
          confidence: "0.75",
          reason: "First prediction",
          createdAt: new Date("2025-09-08T17:00:00Z"), // Oldest
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN",
          confidence: "0.80",
          reason: "Updated prediction",
          createdAt: new Date("2025-09-08T18:00:00Z"),
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "CHI",
          confidence: "0.70",
          reason: "Final prediction before game", // Most recent!
          createdAt: new Date("2025-09-08T19:10:00Z"),
        },
      ];

      mockGamesRepo.findByProviderGameId.mockResolvedValue(existingGame);
      mockGamePredictionsRepo.findPregamePredictions.mockResolvedValue(
        preGamePredictions,
      );
      mockGamePredictionsRepo.create.mockResolvedValue(
        {} as SelectGamePrediction,
      );

      const updatedGame: SelectGame = {
        ...existingGame,
        status: "in_progress",
      };
      mockGamesRepo.upsert.mockResolvedValue(updatedGame);

      const mockPlayByPlayData: SportsDataIOPlayByPlay = {
        Score: {
          SeasonType: 1,
          Season: 2025,
          Week: 1,
          GlobalGameID: 19068,
          GameKey: "202510106",
          Date: "2025-09-08T19:15:00",
          GameEndDateTime: null,
          HomeTeam: "CHI",
          AwayTeam: "MIN",
          AwayScore: 0,
          HomeScore: 0,
          HasStarted: true,
          IsInProgress: true,
          IsOver: false,
          Status: "InProgress",
          StadiumDetails: {
            StadiumID: 1,
            Name: "Soldier Field",
            City: "Chicago",
            State: "IL",
          },
          Quarter: "1",
          TimeRemaining: "15:00",
          Possession: null,
          Down: null,
          Distance: null,
          YardLine: null,
          YardLineTerritory: null,
          DownAndDistance: null,
        },
        Quarters: [],
        Plays: [],
      };

      mockProvider.getPlayByPlay.mockResolvedValue(mockPlayByPlayData);

      await service.ingestGamePlayByPlay(19068);

      // Should create exactly 1 snapshot using the most recent prediction (CHI @ 19:10)
      expect(mockGamePredictionsRepo.create).toHaveBeenCalledTimes(1);
      expect(mockGamePredictionsRepo.create).toHaveBeenCalledWith({
        competitionId,
        gameId,
        agentId,
        predictedWinner: "CHI", // Changed from MIN to CHI
        confidence: "0.70",
        reason: "[Snapshot at game start] Final prediction before game",
        createdAt: gameStartTime,
      });
    });
  });
});
