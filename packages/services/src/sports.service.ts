import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionAggregateScoresRepository } from "@recallnet/db/repositories/competition-aggregate-scores";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamePredictionScoresRepository } from "@recallnet/db/repositories/game-prediction-scores";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { Database } from "@recallnet/db/types";

import { GamePredictionService } from "./game-prediction.service.js";
import { GameScoringService } from "./game-scoring.service.js";
import { SportsDataIONflProvider } from "./providers/sportsdataio.provider.js";
import { NflIngestorService } from "./sports-nfl-ingestor.service.js";

export interface SportsServiceConfig {
  sportsDataApi: {
    apiKey: string;
    baseUrl?: string;
  };
}

/**
 * Sports Service
 * Encapsulates all NFL/sports prediction functionality
 * Provides a clean interface for sports-related operations
 */
export class SportsService {
  // Repositories
  readonly gamesRepository: GamesRepository;
  readonly gamePlaysRepository: GamePlaysRepository;
  readonly competitionGamesRepository: CompetitionGamesRepository;
  readonly gamePredictionsRepository: GamePredictionsRepository;
  readonly gamePredictionScoresRepository: GamePredictionScoresRepository;
  readonly competitionAggregateScoresRepository: CompetitionAggregateScoresRepository;

  // Services
  readonly nflIngestorService: NflIngestorService;
  readonly gamePredictionService: GamePredictionService;
  readonly gameScoringService: GameScoringService;
  readonly sportsDataIOProvider: SportsDataIONflProvider;

  constructor(
    db: Database,
    competitionRepo: CompetitionRepository,
    logger: Logger,
    config: SportsServiceConfig,
  ) {
    // Initialize repositories
    this.gamesRepository = new GamesRepository(db, logger);
    this.gamePlaysRepository = new GamePlaysRepository(db, logger);
    this.competitionGamesRepository = new CompetitionGamesRepository(
      db,
      logger,
    );
    this.gamePredictionsRepository = new GamePredictionsRepository(db, logger);
    this.gamePredictionScoresRepository = new GamePredictionScoresRepository(
      db,
      logger,
    );
    this.competitionAggregateScoresRepository =
      new CompetitionAggregateScoresRepository(db, logger);

    // Initialize provider
    this.sportsDataIOProvider = new SportsDataIONflProvider(
      config.sportsDataApi.apiKey,
      logger,
      config.sportsDataApi.baseUrl,
    );

    this.gameScoringService = new GameScoringService(
      this.gamePredictionsRepository,
      this.gamePredictionScoresRepository,
      this.competitionAggregateScoresRepository,
      this.gamesRepository,
      logger,
    );

    // Initialize services
    this.nflIngestorService = new NflIngestorService(
      this.gamesRepository,
      this.gamePlaysRepository,
      competitionRepo,
      this.competitionGamesRepository,
      this.gameScoringService,
      this.sportsDataIOProvider,
      logger,
    );

    this.gamePredictionService = new GamePredictionService(
      this.gamePredictionsRepository,
      this.gamesRepository,
      competitionRepo,
      logger,
    );
  }
}
