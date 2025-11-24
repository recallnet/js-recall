import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import type { SelectCompetition } from "@recallnet/db/schema/core/types";
import type {
  SelectGame,
  SelectGamePrediction,
} from "@recallnet/db/schema/sports/types";
import type { Database, Transaction } from "@recallnet/db/types";

import { GamePredictionService } from "../game-prediction.service.js";

const defaultMockCompetition: SelectCompetition = {
  id: randomUUID(),
  name: "Test",
  description: "Test",
  type: "sports_prediction",
  status: "active",
  arenaId: "default-nfl-game-prediction-arena",
  engineId: null,
  engineVersion: null,
  agentAllocation: null,
  agentAllocationUnit: null,
  boosterAllocation: null,
  boosterAllocationUnit: null,
  rewardRules: null,
  rewardDetails: null,
  startDate: new Date(),
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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
};

const defaultMockGame: SelectGame = {
  id: randomUUID(),
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
  status: "scheduled",
  winner: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCompetition = (competition: Partial<SelectCompetition> = {}) => {
  return {
    ...defaultMockCompetition,
    ...competition,
    crossChainTradingType: "allow" as const,
  };
};

const mockGame = (game: Partial<SelectGame> = {}) => {
  return {
    ...defaultMockGame,
    ...game,
  };
};

describe("GamePredictionService", () => {
  let service: GamePredictionService;
  let mockGamePredictionsRepo: MockProxy<GamePredictionsRepository>;
  let mockGamesRepo: MockProxy<GamesRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockDb: MockProxy<Database>;
  let mockLogger: MockProxy<Logger>;

  const competitionId = randomUUID();
  const gameId = randomUUID();
  const agentId = randomUUID();

  beforeEach(() => {
    mockGamePredictionsRepo = mock<GamePredictionsRepository>();
    mockGamesRepo = mock<GamesRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockDb = mock<Database>();
    mockLogger = mock<Logger>();

    service = new GamePredictionService(
      mockGamePredictionsRepo,
      mockGamesRepo,
      mockCompetitionRepo,
      mockDb,
      mockLogger,
    );
  });

  describe("createPrediction", () => {
    const competition = mockCompetition();
    const game = mockGame();

    beforeEach(() => {
      // Mock transaction to execute callback immediately with typed tx
      mockDb.transaction.mockImplementation(
        async <T>(callback: (tx: Transaction) => Promise<T>) => {
          return await callback(mockDb as unknown as Transaction);
        },
      );
    });

    it("should validate competition exists", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          0.85,
          "Test",
        ),
      ).rejects.toThrow("not found");
    });

    it("should validate competition is active", async () => {
      const inactiveCompetition = mockCompetition({ status: "ended" as const });
      mockCompetitionRepo.findById.mockResolvedValue(inactiveCompetition);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          0.85,
          "Test",
        ),
      ).rejects.toThrow("is not active");
    });

    it("should validate competition is NFL type", async () => {
      const tradingCompetition = mockCompetition({
        type: "trading" as const,
      });
      mockCompetitionRepo.findById.mockResolvedValue(tradingCompetition);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          0.85,
          "Test",
        ),
      ).rejects.toThrow("not an NFL competition");
    });

    it("should validate game exists", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(competition);
      mockGamesRepo.findByIdForUpdate.mockResolvedValue(undefined);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          0.85,
          "Test",
        ),
      ).rejects.toThrow("Game");
    });

    it("should validate game is not final", async () => {
      const finalGame = mockGame({ status: "final" as const });
      mockCompetitionRepo.findById.mockResolvedValue(competition);
      mockGamesRepo.findByIdForUpdate.mockResolvedValue(finalGame);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          0.85,
          "Test",
        ),
      ).rejects.toThrow("has already ended");
    });

    it("should validate predicted winner is one of the teams", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(competition);
      mockGamesRepo.findByIdForUpdate.mockResolvedValue(game);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "GB",
          0.85,
          "Test",
        ),
      ).rejects.toThrow("Invalid predicted winner");
    });

    it("should validate confidence range", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(competition);

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          1.5,
          "Test",
        ),
      ).rejects.toThrow("Invalid confidence");

      await expect(
        service.createPrediction(
          competitionId,
          gameId,
          agentId,
          "MIN",
          -0.1,
          "Test",
        ),
      ).rejects.toThrow("Invalid confidence");
    });

    it("should create prediction successfully", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(competition);
      mockGamesRepo.findByIdForUpdate.mockResolvedValue(game);

      const mockPrediction: SelectGamePrediction = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId,
        predictedWinner: "MIN",
        confidence: 0.85,
        reason: "Test",
        createdAt: new Date(),
      };

      mockGamePredictionsRepo.create.mockResolvedValue(mockPrediction);

      const result = await service.createPrediction(
        competitionId,
        gameId,
        agentId,
        "MIN",
        0.85,
        "Test",
      );

      expect(result).toBe(mockPrediction);
      expect(mockGamePredictionsRepo.create).toHaveBeenCalledWith(
        {
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN",
          confidence: 0.85,
          reason: "Test",
        },
        mockDb,
      );
    });
  });

  describe("getLatestPrediction", () => {
    it("should return latest prediction for agent", async () => {
      const mockPrediction = {
        id: randomUUID(),
        competitionId,
        gameId,
        agentId,
        predictedWinner: "MIN" as const,
        confidence: 0.85,
        reason: "Test",
        createdAt: new Date(),
        agentName: null,
      };

      mockGamePredictionsRepo.findLatestByGameAndAgent.mockResolvedValue(
        mockPrediction,
      );

      const result = await service.getLatestPrediction(
        gameId,
        agentId,
        competitionId,
      );

      expect(result).toBe(mockPrediction);
      expect(
        mockGamePredictionsRepo.findLatestByGameAndAgent,
      ).toHaveBeenCalledWith(gameId, agentId, competitionId);
    });
  });

  describe("getPredictionHistory", () => {
    it("should return all predictions for agent sorted by time", async () => {
      const mockPredictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "MIN" as const,
          confidence: 0.9,
          reason: "Updated",
          createdAt: new Date("2025-09-08T21:00:00Z"),
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId,
          predictedWinner: "CHI" as const,
          confidence: 0.7,
          reason: "Initial",
          createdAt: new Date("2025-09-08T20:00:00Z"),
          agentName: null,
        },
      ];

      mockGamePredictionsRepo.findByGameAndAgent.mockResolvedValue(
        mockPredictions,
      );

      const result = await service.getPredictionHistory(
        gameId,
        agentId,
        competitionId,
      );

      expect(result).toBe(mockPredictions);
      expect(mockGamePredictionsRepo.findByGameAndAgent).toHaveBeenCalledWith(
        gameId,
        agentId,
        competitionId,
      );
    });
  });

  describe("getGamePredictions", () => {
    it("should return all predictions for game", async () => {
      const mockPredictions = [
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: randomUUID(),
          predictedWinner: "MIN" as const,
          confidence: 0.9,
          reason: "Test 1",
          createdAt: new Date(),
          agentName: null,
        },
        {
          id: randomUUID(),
          competitionId,
          gameId,
          agentId: randomUUID(),
          predictedWinner: "CHI" as const,
          confidence: 0.8,
          reason: "Test 2",
          createdAt: new Date(),
          agentName: null,
        },
      ];

      mockGamePredictionsRepo.findByGame.mockResolvedValue(mockPredictions);

      const result = await service.getGamePredictions(gameId, competitionId);

      expect(result).toBe(mockPredictions);
      expect(mockGamePredictionsRepo.findByGame).toHaveBeenCalledWith(
        gameId,
        competitionId,
        {},
      );
    });
  });
});
