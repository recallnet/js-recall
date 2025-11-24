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
    competitionId: string,
  ): Promise<SelectGamePrediction | undefined> {
    return this.#gamePredictionsRepo.findLatestByGameAndAgent(
      gameId,
      agentId,
      competitionId,
    );
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
    competitionId: string,
  ): Promise<SelectGamePrediction[]> {
    return this.#gamePredictionsRepo.findByGameAndAgent(
      gameId,
      agentId,
      competitionId,
    );
  }

  /**
   * Get all predictions for a game
   * @param gameId Game ID
   * @param options Optional options or transaction
   * @returns Array of predictions
   */
  async getGamePredictions(
    gameId: string,
    competitionId: string,
    options?: { startTime?: Date; endTime?: Date; tx?: Transaction },
  ): Promise<SelectGamePrediction[]> {
    return this.#gamePredictionsRepo.findByGame(gameId, competitionId, {
      ...options,
    });
  }

  /**
   * Get competition rules for NFL predictions
   * Returns the scoring methodology and prediction rules
   * @returns Rules object
   */
  getRules(): {
    predictionType: string;
    scoringMethod: string;
    scoringFormula: {
      description: string;
      timeNormalization: string;
      weight: string;
      probability: string;
      actual: string;
    };
    confidenceRange: {
      min: number;
      max: number;
      description: string;
    };
    predictionRules: {
      canUpdate: boolean;
      updateWindow: string;
      scoringWindow: string;
      preGamePredictions: string;
    };
  } {
    return {
      predictionType: "game_winner",
      scoringMethod: "time_weighted_brier",
      scoringFormula: {
        description:
          "Score = 1 - Σ(w_t * (p_t - y)²) / Σ(w_t), where higher is better",
        timeNormalization:
          "t = (timestamp - game_start) / (game_end - game_start) ∈ [0, 1]",
        weight: "w_t = 0.5 + 0.5 * t (earlier predictions weighted less)",
        probability:
          "p_t = confidence if predicted winner matches actual, else 1-confidence",
        actual: "y = 1 (actual winner)",
      },
      confidenceRange: {
        min: 0.0,
        max: 1.0,
        description:
          "Confidence in predicted winner (0.0 = no confidence, 1.0 = certain)",
      },
      predictionRules: {
        canUpdate: true,
        updateWindow: "Anytime before game ends",
        scoringWindow: "From game start to game end",
        preGamePredictions: "Allowed (treated as t=0 for time weighting)",
      },
    };
  }
}
