import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { SelectGamePrediction } from "@recallnet/db/schema/sports/types";
import { Database, Transaction } from "@recallnet/db/types";

import { ApiError } from "./types/index.js";

/**
 * Game Prediction Service
 * Handles business logic for game winner predictions
 */
export class GamePredictionService {
  readonly #gamePredictionsRepo: GamePredictionsRepository;
  readonly #gamesRepo: GamesRepository;
  readonly #competitionRepo: CompetitionRepository;
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(
    gamePredictionsRepo: GamePredictionsRepository,
    gamesRepo: GamesRepository,
    competitionRepo: CompetitionRepository,
    db: Database,
    logger: Logger,
  ) {
    this.#gamePredictionsRepo = gamePredictionsRepo;
    this.#gamesRepo = gamesRepo;
    this.#competitionRepo = competitionRepo;
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Create a prediction for a game winner
   * Uses atomic transaction with row lock to prevent race conditions
   * @param competitionId Competition ID
   * @param gameId Game ID
   * @param agentId Agent ID
   * @param predictedWinner Team ticker (e.g., "MIN", "CHI")
   * @param confidence Confidence score (0.0 - 1.0)
   * @returns The created prediction
   */
  async createPrediction(
    competitionId: string,
    gameId: string,
    agentId: string,
    predictedWinner: string,
    confidence: number,
    reason: string,
  ): Promise<SelectGamePrediction> {
    const competition = await this.#competitionRepo.findById(competitionId);
    if (!competition) {
      throw new ApiError(404, `Competition ${competitionId} not found`);
    }
    if (competition.status !== "active") {
      throw new ApiError(
        409,
        `Competition ${competitionId} is not active (status: ${competition.status})`,
      );
    }
    if (competition.type !== "sports_prediction") {
      throw new ApiError(
        400,
        `Competition ${competitionId} is not an NFL competition (type: ${competition.type})`,
      );
    }
    if (confidence < 0 || confidence > 1) {
      throw new ApiError(
        400,
        `Invalid confidence ${confidence}. Must be between 0.0 and 1.0`,
      );
    }

    const prediction = await this.#db.transaction(async (tx: Transaction) => {
      const game = await this.#gamesRepo.findByIdForUpdate(gameId, tx);
      if (!game) {
        throw new ApiError(404, `Game ${gameId} not found`);
      }
      if (game.status === "final") {
        throw new ApiError(409, `Game ${gameId} has already ended`);
      }
      if (
        predictedWinner !== game.homeTeam &&
        predictedWinner !== game.awayTeam
      ) {
        throw new ApiError(
          400,
          `Invalid predicted winner "${predictedWinner}". Must be "${game.homeTeam}" or "${game.awayTeam}"`,
        );
      }

      return await this.#gamePredictionsRepo.create(
        {
          competitionId,
          gameId,
          agentId,
          predictedWinner,
          confidence,
          reason,
        },
        tx,
      );
    });

    this.#logger.info(
      {
        predictionId: prediction.id,
        gameId,
        agentId,
        predictedWinner,
        confidence,
        reason,
      },
      "Created game prediction",
    );

    return prediction;
  }

  /**
   * Get latest prediction for an agent in a game
   * @param gameId Game ID
   * @param agentId Agent ID
   * @returns The latest prediction or undefined
   */
  async getLatestPrediction(
    gameId: string,
    agentId: string,
  ): Promise<SelectGamePrediction | undefined> {
    return this.#gamePredictionsRepo.findLatestByGameAndAgent(gameId, agentId);
  }

  /**
   * Get prediction history for an agent in a game
   * @param gameId Game ID
   * @param agentId Agent ID
   * @returns Array of predictions ordered by creation time (newest first)
   */
  async getPredictionHistory(
    gameId: string,
    agentId: string,
  ): Promise<SelectGamePrediction[]> {
    return this.#gamePredictionsRepo.findByGameAndAgent(gameId, agentId);
  }

  /**
   * Get all predictions for a game
   * @param gameId Game ID
   * @param options Optional options or transaction
   * @returns Array of predictions
   */
  async getGamePredictions(
    gameId: string,
    options?: { startTime?: Date; endTime?: Date; tx?: Transaction },
  ): Promise<SelectGamePrediction[]> {
    return this.#gamePredictionsRepo.findByGame(gameId, options);
  }
}
