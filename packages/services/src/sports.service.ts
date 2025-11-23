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

/**
 * Sports Service
 * Provides read-only accessors for sports data and related scoring utilities
 * Used by consumer surfaces that should not depend on external provider config
 */
export class SportsService {
  // Repositories
  readonly competitionRepository: CompetitionRepository;
  readonly competitionAggregateScoresRepository: CompetitionAggregateScoresRepository;
  readonly competitionGamesRepository: CompetitionGamesRepository;
  readonly gamesRepository: GamesRepository;
  readonly gamePlaysRepository: GamePlaysRepository;
  readonly gamePredictionsRepository: GamePredictionsRepository;
  readonly gamePredictionScoresRepository: GamePredictionScoresRepository;
  readonly #db: Database;

  // Services
  readonly gamePredictionService: GamePredictionService;
  readonly gameScoringService: GameScoringService;

  constructor(
    db: Database,
    competitionRepo: CompetitionRepository,
    logger: Logger,
  ) {
    // Initialize repositories
    this.#db = db;
    this.competitionRepository = competitionRepo;
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

    this.gameScoringService = new GameScoringService(
      this.gamePredictionsRepository,
      this.gamePredictionScoresRepository,
      this.competitionAggregateScoresRepository,
      this.gamesRepository,
      db,
      logger,
    );

    this.gamePredictionService = new GamePredictionService(
      this.gamePredictionsRepository,
      this.gamesRepository,
      competitionRepo,
      db,
      logger,
    );
  }

  get db(): Database {
    return this.#db;
  }
}
