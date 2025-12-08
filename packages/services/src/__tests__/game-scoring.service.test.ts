import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionAggregateScoresRepository } from "@recallnet/db/repositories/competition-aggregate-scores";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePredictionScoresRepository } from "@recallnet/db/repositories/game-prediction-scores";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import type {
  SelectCompetitionAggregateScore,
  SelectGame,
  SelectGamePredictionScore,
} from "@recallnet/db/schema/sports/types";
import type { Database, Transaction } from "@recallnet/db/types";

import { GameScoringService } from "../game-scoring.service.js";

describe("GameScoringService", () => {
  let service: GameScoringService;
  let mockGamePredictionsRepo: MockProxy<GamePredictionsRepository>;
  let mockGamePredictionScoresRepo: MockProxy<GamePredictionScoresRepository>;
  let mockCompetitionAggregateScoresRepo: MockProxy<CompetitionAggregateScoresRepository>;
  let mockGamesRepo: MockProxy<GamesRepository>;
  let mockCompetitionGamesRepo: MockProxy<CompetitionGamesRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockDb: MockProxy<Database>;
  let mockTransaction: Transaction;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    mockGamePredictionsRepo = mock<GamePredictionsRepository>();
    mockGamePredictionScoresRepo = mock<GamePredictionScoresRepository>();
    mockCompetitionAggregateScoresRepo =
      mock<CompetitionAggregateScoresRepository>();
    mockGamesRepo = mock<GamesRepository>();
    mockCompetitionGamesRepo = mock<CompetitionGamesRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockDb = mock<Database>();
    mockTransaction = {} as Transaction;
    mockDb.transaction.mockImplementation(async (callback) =>
      callback(mockTransaction),
    );
    mockLogger = mock<Logger>();

    service = new GameScoringService(
      mockGamePredictionsRepo,
      mockGamePredictionScoresRepo,
      mockCompetitionAggregateScoresRepo,
      mockGamesRepo,
      mockCompetitionGamesRepo,
      mockCompetitionRepo,
      mockDb,
      mockLogger,
    );
  });

  describe("scoreGame", () => {
    const gameId = randomUUID();
    const competitionId = randomUUID();
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();

    const mockGame: SelectGame = {
      id: gameId,
      providerGameId: 19068,
      season: 2025,
      week: 1,
      startTime: new Date("2025-09-08T19:15:00Z"),
      endTime: new Date("2025-09-08T23:15:00Z"),
      homeTeam: "CHI",
      awayTeam: "MIN" as const,
      spread: null,
      overUnder: null,
      homeTeamMoneyLine: null,
      awayTeamMoneyLine: null,
      venue: "Soldier Field",
      status: "final",
      winner: "MIN" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should validate game is final", async () => {
      const scheduledGame = { ...mockGame, status: "scheduled" as const };
      mockGamesRepo.findById.mockResolvedValue(scheduledGame);

      await expect(service.scoreGame(gameId)).rejects.toThrow("is not final");
    });

    it("should validate game has end time", async () => {
      const gameNoEndTime = { ...mockGame, endTime: null };
      mockGamesRepo.findById.mockResolvedValue(gameNoEndTime);

      await expect(service.scoreGame(gameId)).rejects.toThrow(
        "has no end time",
      );
    });

    it("should validate game has winner", async () => {
      const gameNoWinner = { ...mockGame, winner: null };
      mockGamesRepo.findById.mockResolvedValue(gameNoWinner);

      await expect(service.scoreGame(gameId)).rejects.toThrow("has no winner");
    });

    it("should validate game duration > 0", async () => {
      const invalidGame = {
        ...mockGame,
        startTime: new Date("2025-09-08T19:15:00Z"),
        endTime: new Date("2025-09-08T19:15:00Z"), // Same time
      };
      mockGamesRepo.findById.mockResolvedValue(invalidGame);
      mockGamePredictionsRepo.findByGame.mockResolvedValue([]);

      await expect(service.scoreGame(gameId)).rejects.toThrow(
        "invalid duration",
      );
    });

    it("should return 0 for game with no predictions and no registered agents", async () => {
      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([]); // No registered agents
      mockGamePredictionScoresRepo.findByCompetitionAndAgent.mockResolvedValue(
        [],
      );
      mockGamePredictionsRepo.findByGame.mockResolvedValue([]);

      const result = await service.scoreGame(gameId);

      expect(result).toBe(0);
    });

    it("should calculate time-weighted Brier scores correctly", async () => {
      const predictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN" as const,
          confidence: 0.9,
          reason: "Test",
          createdAt: new Date("2025-09-08T20:00:00Z"), // t ≈ 0.1875
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent2Id,
          predictedWinner: "CHI" as const,
          confidence: 0.7,
          reason: "Test",
          createdAt: new Date("2025-09-08T21:00:00Z"), // t ≈ 0.4375
          agentName: null,
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([agent1Id, agent2Id]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockPredictionScore: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 0.85,
        finalPrediction: "MIN" as const,
        finalConfidence: 0.9,
        predictionCount: 1,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert.mockResolvedValue(
        mockPredictionScore,
      );

      // Mock findByCompetitionAndAgent to return scores for aggregate calculation
      mockGamePredictionScoresRepo.findByCompetitionAndAgent.mockResolvedValue([
        mockPredictionScore,
      ]);

      const mockAggregateScore: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent1Id,
        averageBrierScore: 0.85,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      mockCompetitionAggregateScoresRepo.upsert.mockResolvedValue(
        mockAggregateScore,
      );

      const result = await service.scoreGame(gameId);

      expect(result).toBe(2);
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledTimes(2);
    });

    it("should handle predictions at exactly game start time (t=0)", async () => {
      const predictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN" as const,
          confidence: 1,
          reason: "Test",
          createdAt: new Date("2025-09-08T19:15:00Z"), // Exactly at game start
          agentName: null,
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([agent1Id]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockScore1: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 1,
        finalPrediction: "MIN" as const,
        finalConfidence: 1,
        predictionCount: 1,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert.mockResolvedValue(mockScore1);

      const mockAggScore1: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent1Id,
        averageBrierScore: 1,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      mockCompetitionAggregateScoresRepo.upsert.mockResolvedValue(
        mockAggScore1,
      );
      mockGamePredictionScoresRepo.findByCompetitionAndAgent.mockResolvedValue(
        [],
      );

      const result = await service.scoreGame(gameId);

      expect(result).toBe(1);
      // Should score with t=0 (clamped)
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalled();
    });

    it("should handle predictions after game ends (t=1)", async () => {
      const predictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN" as const,
          confidence: 1,
          reason: "Test",
          createdAt: new Date("2025-09-09T00:00:00Z"), // After game end
          agentName: null,
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([agent1Id]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockScore2: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 1,
        finalPrediction: "MIN" as const,
        finalConfidence: 1,
        predictionCount: 1,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert.mockResolvedValue(mockScore2);

      const mockAggScore2: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent1Id,
        averageBrierScore: 1,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      mockCompetitionAggregateScoresRepo.upsert.mockResolvedValue(
        mockAggScore2,
      );
      mockGamePredictionScoresRepo.findByCompetitionAndAgent.mockResolvedValue(
        [],
      );

      const result = await service.scoreGame(gameId);

      expect(result).toBe(1);
      // Should score with t=1 (clamped)
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalled();
    });

    it("should continue scoring other agents if one fails", async () => {
      const predictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN" as const,
          confidence: 0.9,
          reason: "Test",
          createdAt: new Date("2025-09-08T20:00:00Z"),
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent2Id,
          predictedWinner: "CHI" as const,
          confidence: 0.7,
          reason: "Test",
          createdAt: new Date("2025-09-08T21:00:00Z"),
          agentName: null,
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([agent1Id, agent2Id]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockScore3: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent2Id,
        timeWeightedBrierScore: 0.7,
        finalPrediction: "CHI",
        finalConfidence: 0.7,
        predictionCount: 1,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce(mockScore3);

      const mockAggScore3: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent2Id,
        averageBrierScore: 0.7,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      mockCompetitionAggregateScoresRepo.upsert.mockResolvedValue(
        mockAggScore3,
      );
      mockGamePredictionScoresRepo.findByCompetitionAndAgent.mockResolvedValue(
        [],
      );

      const result = await service.scoreGame(gameId);

      // Should score 1 agent (second one after first fails)
      expect(result).toBe(1);
    });

    it("should return 0 when game is not linked to any competition", async () => {
      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([]);

      const result = await service.scoreGame(gameId);

      expect(result).toBe(0);
      expect(mockGamePredictionsRepo.findByGame).not.toHaveBeenCalled();
    });
  });

  describe("getGameLeaderboard", () => {
    it("should return ranked leaderboard sorted by score", async () => {
      const competitionId = randomUUID();
      const gameId = randomUUID();

      const mockScores = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: randomUUID(),
          timeWeightedBrierScore: 0.95,
          finalPrediction: "MIN" as const,
          finalConfidence: 0.95,
          predictionCount: 2,
          updatedAt: new Date(),
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: randomUUID(),
          timeWeightedBrierScore: 0.85,
          finalPrediction: "CHI" as const,
          finalConfidence: 0.8,
          predictionCount: 1,
          updatedAt: new Date(),
          agentName: null,
        },
      ];

      mockGamePredictionScoresRepo.findByCompetitionAndGame.mockResolvedValue(
        mockScores,
      );

      const result = await service.getGameLeaderboard(competitionId, gameId);

      expect(result).toHaveLength(2);
      expect(result[0]!.rank).toBe(1);
      expect(result[0]!.timeWeightedBrierScore).toBe(0.95);
      expect(result[1]!.rank).toBe(2);
      expect(result[1]!.timeWeightedBrierScore).toBe(0.85);
    });
  });

  describe("getCompetitionLeaderboard", () => {
    it("should return ranked leaderboard sorted by average score", async () => {
      const competitionId = randomUUID();

      const mockScores = [
        {
          id: randomUUID(),
          competitionId,
          agentId: randomUUID(),
          averageBrierScore: 0.92,
          gamesScored: 5,
          updatedAt: new Date(),
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          agentId: randomUUID(),
          averageBrierScore: 0.85,
          gamesScored: 5,
          updatedAt: new Date(),
          agentName: null,
        },
      ];

      mockCompetitionAggregateScoresRepo.findByCompetition.mockResolvedValue(
        mockScores,
      );

      const result = await service.getCompetitionLeaderboard(competitionId);

      expect(result).toHaveLength(2);
      expect(result[0]!.rank).toBe(1);
      expect(result[0]!.averageBrierScore).toBe(0.92);
      expect(result[1]!.rank).toBe(2);
      expect(result[1]!.averageBrierScore).toBe(0.85);
    });
  });

  describe("scoreGame with pregame predictions", () => {
    it("should only use predictions at or after game start time", async () => {
      const gameId = randomUUID();
      const competitionId = randomUUID();
      const agentId = randomUUID();
      const gameStartTime = new Date("2025-09-08T19:15:00Z");
      const gameEndTime = new Date("2025-09-08T23:15:00Z");

      const mockGame: SelectGame = {
        id: gameId,
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: gameStartTime,
        endTime: gameEndTime,
        homeTeam: "CHI",
        awayTeam: "MIN" as const,
        spread: null,
        overUnder: null,
        homeTeamMoneyLine: null,
        awayTeamMoneyLine: null,
        venue: "Soldier Field",
        status: "final",
        winner: "MIN" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Agent made multiple pregame predictions, then the system snapshotted the latest at game start
      const allPredictions = [
        // Original pregame predictions (should NOT be used directly in scoring)
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "CHI" as const,
          confidence: 0.6,
          reason: "Opening prediction",
          createdAt: new Date("2025-09-08T17:30:00Z"), // T-1h45m
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN" as const,
          confidence: 0.7,
          reason: "Updated prediction",
          createdAt: new Date("2025-09-08T18:45:00Z"), // T-30m
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "CHI" as const,
          confidence: 0.8,
          reason: "Final pregame edit",
          createdAt: new Date("2025-09-08T19:10:00Z"), // T-5m
          agentName: null,
        },
        // Snapshot at game start (SHOULD be used in scoring)
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN" as const,
          confidence: 0.8,
          reason: "Final pregame prediction",
          createdAt: gameStartTime, // Exactly at game start
          agentName: null,
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionRepo.getAgents.mockResolvedValue([agentId]);
      mockGamePredictionsRepo.findByGame.mockImplementation(
        async (_gameId, _competitionId, options) => {
          expect(options?.startTime).toEqual(gameStartTime);
          expect(options?.endTime).toEqual(gameEndTime);
          return allPredictions.filter(
            (prediction) =>
              prediction.createdAt >= gameStartTime &&
              prediction.createdAt <= gameEndTime,
          );
        },
      );

      const mockPredictionScore: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId,
        timeWeightedBrierScore: 0.85,
        finalPrediction: "MIN" as const,
        finalConfidence: 0.8,
        // Should be 1, not 4 because only the final pregame prediction is counted (snapshot within game window)
        predictionCount: 1,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert.mockResolvedValue(
        mockPredictionScore,
      );
      mockGamePredictionScoresRepo.findByCompetitionAndAgent.mockResolvedValue([
        mockPredictionScore,
      ]);
      mockCompetitionAggregateScoresRepo.upsert.mockResolvedValue({
        id: randomUUID(),
        competitionId,
        agentId,
        averageBrierScore: 0.85,
        gamesScored: 1,
        updatedAt: new Date(),
      });
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);

      await service.scoreGame(gameId);

      // Should only count the snapshot, not all of the pregame predictions
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          predictionCount: 1,
          finalPrediction: "MIN" as const,
          finalConfidence: 0.8,
        }),
        mockTransaction,
      );

      expect(mockGamePredictionsRepo.findByGame).toHaveBeenCalledWith(
        gameId,
        competitionId,
        {
          startTime: gameStartTime,
          endTime: gameEndTime,
        },
      );
    });
  });

  describe("Zero predictions handling", () => {
    const gameId = randomUUID();
    const competitionId = randomUUID();
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();

    const mockGame: SelectGame = {
      id: gameId,
      providerGameId: 19068,
      season: 2025,
      week: 1,
      startTime: new Date("2025-09-08T19:15:00Z"),
      endTime: new Date("2025-09-08T23:15:00Z"),
      homeTeam: "CHI",
      awayTeam: "MIN" as const,
      spread: null,
      overUnder: null,
      homeTeamMoneyLine: null,
      awayTeamMoneyLine: null,
      venue: "Soldier Field",
      status: "final",
      winner: "MIN" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should record zero score for registered agents with no predictions", async () => {
      const predictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN" as const,
          confidence: 0.9,
          reason: "Test",
          createdAt: new Date("2025-09-08T20:00:00Z"),
          agentName: null,
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([agent1Id, agent2Id]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockPredictionScore: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 0.85,
        finalPrediction: "MIN" as const,
        finalConfidence: 0.9,
        predictionCount: 1,
        updatedAt: new Date(),
      };
      const mockZeroScore: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent2Id,
        timeWeightedBrierScore: 0,
        finalPrediction: null,
        finalConfidence: null,
        predictionCount: 0,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert
        .mockResolvedValueOnce(mockPredictionScore)
        .mockResolvedValueOnce(mockZeroScore);

      mockGamePredictionScoresRepo.findByCompetitionAndAgent
        .mockResolvedValueOnce([mockPredictionScore])
        .mockResolvedValueOnce([mockZeroScore]);

      const mockAggregateScore1: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent1Id,
        averageBrierScore: 0.85,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      const mockAggregateScore2: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent2Id,
        averageBrierScore: 0,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      mockCompetitionAggregateScoresRepo.upsert
        .mockResolvedValueOnce(mockAggregateScore1)
        .mockResolvedValueOnce(mockAggregateScore2);

      const result = await service.scoreGame(gameId);

      expect(result).toBe(2);
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledTimes(2);

      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent1Id,
          predictionCount: 1,
          timeWeightedBrierScore: expect.any(Number),
        }),
        mockTransaction,
      );

      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent2Id,
          predictionCount: 0,
          timeWeightedBrierScore: 0,
          finalPrediction: null,
          finalConfidence: null,
        }),
        mockTransaction,
      );

      expect(mockCompetitionAggregateScoresRepo.upsert).toHaveBeenCalledTimes(
        2,
      );
      expect(mockCompetitionAggregateScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          agentId: agent1Id,
          averageBrierScore: 0.85,
          gamesScored: 1,
        }),
        mockTransaction,
      );
      expect(mockCompetitionAggregateScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          agentId: agent2Id,
          averageBrierScore: 0,
          gamesScored: 1,
        }),
        mockTransaction,
      );
    });

    it("should record zero scores for all registered agents when no predictions exist", async () => {
      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([agent1Id, agent2Id]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue([]);

      const mockZeroScore1: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 0,
        finalPrediction: null,
        finalConfidence: null,
        predictionCount: 0,
        updatedAt: new Date(),
      };
      const mockZeroScore2: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent2Id,
        timeWeightedBrierScore: 0,
        finalPrediction: null,
        finalConfidence: null,
        predictionCount: 0,
        updatedAt: new Date(),
      };
      mockGamePredictionScoresRepo.upsert
        .mockResolvedValueOnce(mockZeroScore1)
        .mockResolvedValueOnce(mockZeroScore2);

      mockGamePredictionScoresRepo.findByCompetitionAndAgent
        .mockResolvedValueOnce([mockZeroScore1])
        .mockResolvedValueOnce([mockZeroScore2]);

      const mockAggregateScore1: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent1Id,
        averageBrierScore: 0,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      const mockAggregateScore2: SelectCompetitionAggregateScore = {
        id: randomUUID(),
        competitionId,
        agentId: agent2Id,
        averageBrierScore: 0,
        gamesScored: 1,
        updatedAt: new Date(),
      };
      mockCompetitionAggregateScoresRepo.upsert
        .mockResolvedValueOnce(mockAggregateScore1)
        .mockResolvedValueOnce(mockAggregateScore2);

      const result = await service.scoreGame(gameId);

      expect(result).toBe(2);
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledTimes(2);

      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent1Id,
          predictionCount: 0,
          timeWeightedBrierScore: 0,
        }),
        mockTransaction,
      );
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent2Id,
          predictionCount: 0,
          timeWeightedBrierScore: 0,
        }),
        mockTransaction,
      );

      expect(mockCompetitionAggregateScoresRepo.upsert).toHaveBeenCalledTimes(
        2,
      );
      expect(mockCompetitionAggregateScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          agentId: agent1Id,
          averageBrierScore: 0,
          gamesScored: 1,
        }),
        mockTransaction,
      );
      expect(mockCompetitionAggregateScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          agentId: agent2Id,
          averageBrierScore: 0,
          gamesScored: 1,
        }),
        mockTransaction,
      );
    });

    it("should return 0 when no agents are registered", async () => {
      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockCompetitionGamesRepo.findCompetitionIdsByGameId.mockResolvedValue([
        competitionId,
      ]);
      mockCompetitionRepo.getAgents.mockResolvedValue([]);
      mockGamePredictionsRepo.findByGame.mockResolvedValue([]);

      const result = await service.scoreGame(gameId);

      expect(result).toBe(0);
      expect(mockGamePredictionScoresRepo.upsert).not.toHaveBeenCalled();
    });
  });
});
