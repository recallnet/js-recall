import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { PredictionsRepository } from "@recallnet/db/repositories/predictions";
import { SelectPrediction } from "@recallnet/db/schema/sports/types";

/**
 * Prediction input data
 */
export interface CreatePredictionInput {
  competitionId: string;
  globalGameId: number;
  agentId: string;
  prediction: "run" | "pass";
  confidence: number;
}

/**
 * Predictions Manager Service
 * Handles business logic for creating and validating predictions
 */
export class PredictionsManagerService {
  readonly #competitionRepo: CompetitionRepository;
  readonly #gamesRepo: GamesRepository;
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #predictionsRepo: PredictionsRepository;
  readonly #logger: Logger;

  constructor(
    competitionRepo: CompetitionRepository,
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    predictionsRepo: PredictionsRepository,
    logger: Logger,
  ) {
    this.#competitionRepo = competitionRepo;
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#predictionsRepo = predictionsRepo;
    this.#logger = logger;
  }

  /**
   * Create a prediction for the next open play in a game
   * @param input Prediction input data
   * @returns The created prediction
   */
  async createPrediction(
    input: CreatePredictionInput,
  ): Promise<SelectPrediction> {
    try {
      // Validate competition exists and is active
      const competition = await this.#competitionRepo.findById(
        input.competitionId,
      );
      if (!competition) {
        throw new Error(`Competition ${input.competitionId} not found`);
      }

      if (competition.status !== "active") {
        throw new Error(
          `Competition ${input.competitionId} is not active (status: ${competition.status})`,
        );
      }

      // Find the game by globalGameId
      const game = await this.#gamesRepo.findByGlobalGameId(input.globalGameId);
      if (!game) {
        throw new Error(`Game ${input.globalGameId} not found`);
      }

      // Find the next open play for this game
      const openPlays = await this.#gamePlaysRepo.findOpenByGameIds(
        [game.id],
        1,
        0,
      );

      if (openPlays.length === 0) {
        throw new Error(
          `No open plays available for game ${input.globalGameId}`,
        );
      }

      const play = openPlays[0];
      if (!play) {
        throw new Error(
          `No open plays available for game ${input.globalGameId}`,
        );
      }

      // Check if prediction is before lock time
      const now = new Date();
      if (now >= play.lockTime) {
        throw new Error(
          `Next play for game ${input.globalGameId} is locked (lock time: ${play.lockTime.toISOString()})`,
        );
      }

      // Validate confidence is between 0 and 1
      if (input.confidence < 0 || input.confidence > 1) {
        throw new Error(
          `Confidence must be between 0 and 1 (got ${input.confidence})`,
        );
      }

      // Check for duplicate prediction
      const existing =
        await this.#predictionsRepo.findByAgentCompetitionAndPlay(
          input.agentId,
          input.competitionId,
          play.id,
        );

      if (existing) {
        throw new Error(
          `Agent ${input.agentId} has already predicted the next play for game ${input.globalGameId}`,
        );
      }

      // Create the prediction
      const prediction = await this.#predictionsRepo.create({
        competitionId: input.competitionId,
        gamePlayId: play.id,
        agentId: input.agentId,
        prediction: input.prediction,
        confidence: input.confidence.toString(),
      });

      this.#logger.info(
        `Created prediction ${prediction.id} for agent ${input.agentId} on game ${input.globalGameId} play ${play.sequence}`,
      );

      return prediction;
    } catch (error) {
      this.#logger.error("Error in createPrediction:", error);
      throw error;
    }
  }

  /**
   * Get predictions for a specific play
   * @param gamePlayId Game play ID
   * @returns Array of predictions
   */
  async getPredictionsByPlay(gamePlayId: string): Promise<SelectPrediction[]> {
    try {
      return await this.#predictionsRepo.findByPlayId(gamePlayId);
    } catch (error) {
      this.#logger.error("Error in getPredictionsByPlay:", error);
      throw error;
    }
  }

  /**
   * Get predictions for an agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns Array of predictions
   */
  async getPredictionsByCompetitionAndAgent(
    competitionId: string,
    agentId: string,
  ): Promise<SelectPrediction[]> {
    try {
      return await this.#predictionsRepo.findByCompetitionAndAgent(
        competitionId,
        agentId,
      );
    } catch (error) {
      this.#logger.error(
        "Error in getPredictionsByCompetitionAndAgent:",
        error,
      );
      throw error;
    }
  }
}
