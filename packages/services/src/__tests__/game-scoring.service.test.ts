import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionAggregateScoresRepository } from "@recallnet/db/repositories/competition-aggregate-scores";
import { GamePredictionScoresRepository } from "@recallnet/db/repositories/game-prediction-scores";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import type {
  SelectCompetitionAggregateScore,
  SelectGame,
  SelectGamePrediction,
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
  let mockDb: MockProxy<Database>;
  let mockTransaction: Transaction;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    mockGamePredictionsRepo = mock<GamePredictionsRepository>();
    mockGamePredictionScoresRepo = mock<GamePredictionScoresRepository>();
    mockCompetitionAggregateScoresRepo =
      mock<CompetitionAggregateScoresRepository>();
    mockGamesRepo = mock<GamesRepository>();
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
      awayTeam: "MIN",
      spread: null,
      overUnder: null,
      venue: "Soldier Field",
      status: "final",
      winner: "MIN",
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

    it("should return 0 for game with no predictions", async () => {
      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockGamePredictionsRepo.findByGame.mockResolvedValue([]);

      const result = await service.scoreGame(gameId);

      expect(result).toBe(0);
    });

    it("should calculate time-weighted Brier scores correctly", async () => {
      const predictions: SelectGamePrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN",
          confidence: 0.9,
          reason: "Test",
          createdAt: new Date("2025-09-08T20:00:00Z"), // t ≈ 0.1875
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent2Id,
          predictedWinner: "CHI",
          confidence: 0.7,
          reason: "Test",
          createdAt: new Date("2025-09-08T21:00:00Z"), // t ≈ 0.4375
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockPredictionScore: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 0.85,
        finalPrediction: "MIN",
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
      const predictions: SelectGamePrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN",
          confidence: 1,
          reason: "Test",
          createdAt: new Date("2025-09-08T19:15:00Z"), // Exactly at game start
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockScore1: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 1,
        finalPrediction: "MIN",
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
      const predictions: SelectGamePrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN",
          confidence: 1,
          reason: "Test",
          createdAt: new Date("2025-09-09T00:00:00Z"), // After game end
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockGamePredictionsRepo.findByGame.mockResolvedValue(predictions);

      const mockScore2: SelectGamePredictionScore = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId: agent1Id,
        timeWeightedBrierScore: 1,
        finalPrediction: "MIN",
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
      const predictions: SelectGamePrediction[] = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent1Id,
          predictedWinner: "MIN",
          confidence: 0.9,
          reason: "Test",
          createdAt: new Date("2025-09-08T20:00:00Z"),
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: agent2Id,
          predictedWinner: "CHI",
          confidence: 0.7,
          reason: "Test",
          createdAt: new Date("2025-09-08T21:00:00Z"),
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
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
        },
        {
          id: randomUUID(),
          competitionId,
          agentId: randomUUID(),
          averageBrierScore: 0.85,
          gamesScored: 5,
          updatedAt: new Date(),
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
        awayTeam: "MIN",
        spread: null,
        overUnder: null,
        venue: "Soldier Field",
        status: "final",
        winner: "MIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Agent made multiple pregame predictions, then the system snapshotted the latest at game start
      const allPredictions: SelectGamePrediction[] = [
        // Original pregame predictions (should NOT be used directly in scoring)
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "CHI",
          confidence: 0.6,
          reason: "Opening prediction",
          createdAt: new Date("2025-09-08T17:30:00Z"), // T-1h45m
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN",
          confidence: 0.7,
          reason: "Updated prediction",
          createdAt: new Date("2025-09-08T18:45:00Z"), // T-30m
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "CHI",
          confidence: 0.8,
          reason: "Final pregame edit",
          createdAt: new Date("2025-09-08T19:10:00Z"), // T-5m
        },
        // Snapshot at game start (SHOULD be used in scoring)
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN",
          confidence: 0.8,
          reason: "Final pregame prediction",
          createdAt: gameStartTime, // Exactly at game start
        },
      ];

      mockGamesRepo.findById.mockResolvedValue(mockGame);
      mockGamePredictionsRepo.findByGame.mockImplementation(
        async (_gameId, options) => {
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
        finalPrediction: "MIN",
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

      await service.scoreGame(gameId);

      // Should only count the snapshot, not all of the pregame predictions
      expect(mockGamePredictionScoresRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          predictionCount: 1,
          finalPrediction: "MIN",
          finalConfidence: 0.8,
        }),
        mockTransaction,
      );

      expect(mockGamePredictionsRepo.findByGame).toHaveBeenCalledWith(gameId, {
        startTime: gameStartTime,
        endTime: gameEndTime,
      });
    });
  });
});
