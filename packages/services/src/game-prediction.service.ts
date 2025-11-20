import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { SelectGamePrediction } from "@recallnet/db/schema/sports/types";

/**
 * Game Prediction Service
 * Handles business logic for game winner predictions
 */
export class GamePredictionService {
  readonly #gamePredictionsRepo: GamePredictionsRepository;
  readonly #gamesRepo: GamesRepository;
  readonly #competitionRepo: CompetitionRepository;
  readonly #logger: Logger;

  constructor(
    gamePredictionsRepo: GamePredictionsRepository,
    gamesRepo: GamesRepository,
    competitionRepo: CompetitionRepository,
    logger: Logger,
  ) {
    this.#gamePredictionsRepo = gamePredictionsRepo;
    this.#gamesRepo = gamesRepo;
    this.#competitionRepo = competitionRepo;
    this.#logger = logger;
  }

  /**
   * Create a prediction for a game winner
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
    // Validate competition is active
    const competition = await this.#competitionRepo.findById(competitionId);
    if (!competition) {
      throw new Error(`Competition ${competitionId} not found`);
    }

    if (competition.status !== "active") {
      throw new Error(
        `Competition ${competitionId} is not active (status: ${competition.status})`,
      );
    }

    if (competition.type !== "nfl") {
      throw new Error(
        `Competition ${competitionId} is not an NFL competition (type: ${competition.type})`,
      );
    }

    // Validate game exists and is not final
    const game = await this.#gamesRepo.findById(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.status === "final") {
      throw new Error(`Game ${gameId} has already ended`);
    }

    // Validate predicted winner is one of the teams
    if (
      predictedWinner !== game.homeTeam &&
      predictedWinner !== game.awayTeam
    ) {
      throw new Error(
        `Invalid predicted winner "${predictedWinner}". Must be "${game.homeTeam}" or "${game.awayTeam}"`,
      );
    }

    // Validate confidence range
    if (confidence < 0 || confidence > 1) {
      throw new Error(
        `Invalid confidence ${confidence}. Must be between 0.0 and 1.0`,
      );
    }

    // Create prediction
    const prediction = await this.#gamePredictionsRepo.create({
      competitionId,
      gameId,
      agentId,
      predictedWinner,
      confidence: confidence.toString(),
      reason,
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
   * @returns Array of predictions
   */
  async getGamePredictions(gameId: string): Promise<SelectGamePrediction[]> {
    return this.#gamePredictionsRepo.findByGame(gameId);
  }
}
