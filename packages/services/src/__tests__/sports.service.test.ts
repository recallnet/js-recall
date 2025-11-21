import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { Database } from "@recallnet/db/types";

import { SportsService } from "../sports.service.js";

describe("SportsService", () => {
  let service: SportsService;
  let mockDb: MockProxy<Database>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockLogger: MockProxy<Logger>;

  const mockConfig = {
    sportsDataApi: {
      apiKey: "test-api-key",
      baseUrl: "http://localhost:4569",
    },
  };

  beforeEach(() => {
    mockDb = mock<Database>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();

    service = new SportsService(
      mockDb,
      mockCompetitionRepo,
      mockLogger,
      mockConfig,
    );
  });

  describe("constructor initialization", () => {
    it("should initialize all repositories", () => {
      expect(service.gamesRepository).toBeDefined();
      expect(service.gamePlaysRepository).toBeDefined();
      expect(service.competitionGamesRepository).toBeDefined();
      expect(service.gamePredictionsRepository).toBeDefined();
      expect(service.gamePredictionScoresRepository).toBeDefined();
      expect(service.competitionAggregateScoresRepository).toBeDefined();
    });

    it("should initialize all services", () => {
      expect(service.nflIngestorService).toBeDefined();
      expect(service.gamePredictionService).toBeDefined();
      expect(service.gameScoringService).toBeDefined();
    });

    it("should initialize SportsDataIO provider", () => {
      expect(service.sportsDataIOProvider).toBeDefined();
    });
  });

  describe("repository getters", () => {
    it("should return gamesRepository instance", () => {
      const repo = service.gamesRepository;
      expect(repo).toBeDefined();
      expect(repo.constructor.name).toBe("GamesRepository");
    });

    it("should return gamePlaysRepository instance", () => {
      const repo = service.gamePlaysRepository;
      expect(repo).toBeDefined();
      expect(repo.constructor.name).toBe("GamePlaysRepository");
    });

    it("should return competitionGamesRepository instance", () => {
      const repo = service.competitionGamesRepository;
      expect(repo).toBeDefined();
      expect(repo.constructor.name).toBe("CompetitionGamesRepository");
    });

    it("should return gamePredictionsRepository instance", () => {
      const repo = service.gamePredictionsRepository;
      expect(repo).toBeDefined();
      expect(repo.constructor.name).toBe("GamePredictionsRepository");
    });

    it("should return gamePredictionScoresRepository instance", () => {
      const repo = service.gamePredictionScoresRepository;
      expect(repo).toBeDefined();
      expect(repo.constructor.name).toBe("GamePredictionScoresRepository");
    });

    it("should return competitionAggregateScoresRepository instance", () => {
      const repo = service.competitionAggregateScoresRepository;
      expect(repo).toBeDefined();
      expect(repo.constructor.name).toBe(
        "CompetitionAggregateScoresRepository",
      );
    });
  });

  describe("service getters", () => {
    it("should return nflIngestorService instance", () => {
      const svc = service.nflIngestorService;
      expect(svc).toBeDefined();
      expect(svc.constructor.name).toBe("NflIngestorService");
    });

    it("should return gamePredictionService instance", () => {
      const svc = service.gamePredictionService;
      expect(svc).toBeDefined();
      expect(svc.constructor.name).toBe("GamePredictionService");
    });

    it("should return gameScoringService instance", () => {
      const svc = service.gameScoringService;
      expect(svc).toBeDefined();
      expect(svc.constructor.name).toBe("GameScoringService");
    });
  });

  describe("provider getter", () => {
    it("should return sportsDataIOProvider instance", () => {
      const provider = service.sportsDataIOProvider;
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe("SportsDataIONflProvider");
    });
  });
});
