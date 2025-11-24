import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { Database } from "@recallnet/db/types";

import { SportsIngesterService } from "../sports-ingester.service.js";
import { SportsService } from "../sports.service.js";

describe("SportsService", () => {
  let service: SportsService;
  let mockDb: MockProxy<Database>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    mockDb = mock<Database>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();

    service = new SportsService(mockDb, mockCompetitionRepo, mockLogger);
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

    it("should initialize read-only services", () => {
      expect(service.gamePredictionService).toBeDefined();
      expect(service.gameScoringService).toBeDefined();
    });
  });

  describe("repository getters", () => {
    it("should return gamesRepository instance", () => {
      expect(service.gamesRepository.constructor.name).toBe("GamesRepository");
    });

    it("should return gamePlaysRepository instance", () => {
      expect(service.gamePlaysRepository.constructor.name).toBe(
        "GamePlaysRepository",
      );
    });

    it("should return competitionGamesRepository instance", () => {
      expect(service.competitionGamesRepository.constructor.name).toBe(
        "CompetitionGamesRepository",
      );
    });

    it("should return gamePredictionsRepository instance", () => {
      expect(service.gamePredictionsRepository.constructor.name).toBe(
        "GamePredictionsRepository",
      );
    });

    it("should return gamePredictionScoresRepository instance", () => {
      expect(service.gamePredictionScoresRepository.constructor.name).toBe(
        "GamePredictionScoresRepository",
      );
    });

    it("should return competitionAggregateScoresRepository instance", () => {
      expect(
        service.competitionAggregateScoresRepository.constructor.name,
      ).toBe("CompetitionAggregateScoresRepository");
    });
  });

  describe("service getters", () => {
    it("should return gamePredictionService instance", () => {
      expect(service.gamePredictionService.constructor.name).toBe(
        "GamePredictionService",
      );
    });

    it("should return gameScoringService instance", () => {
      expect(service.gameScoringService.constructor.name).toBe(
        "GameScoringService",
      );
    });
  });
});

describe("SportsIngesterService", () => {
  let sportsService: SportsService;
  let ingesterService: SportsIngesterService;
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
    sportsService = new SportsService(mockDb, mockCompetitionRepo, mockLogger);
    ingesterService = new SportsIngesterService(
      sportsService,
      mockLogger,
      mockConfig,
    );
  });

  it("should initialize SportsDataIO provider", () => {
    expect(ingesterService.sportsDataIOProvider.constructor.name).toBe(
      "SportsDataIONflProvider",
    );
  });

  it("should initialize nflIngesterService", () => {
    expect(ingesterService.nflIngesterService.constructor.name).toBe(
      "NflIngesterService",
    );
  });
});
