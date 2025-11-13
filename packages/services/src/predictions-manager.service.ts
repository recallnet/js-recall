import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { PredictionsRepository } from "@recallnet/db/repositories/predictions";
import { SelectPrediction } from "@recallnet/db/schema/sports/types";

/**
 * Prediction input data
 */
export interface CreatePredictionInput {
  competitionId: string;
  gamePlayId: string;
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
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #predictionsRepo: PredictionsRepository;
  readonly #logger: Logger;

  constructor(
    competitionRepo: CompetitionRepository,
    gamePlaysRepo: GamePlaysRepository,
    predictionsRepo: PredictionsRepository,
    logger: Logger,
  ) {
    this.#competitionRepo = competitionRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#predictionsRepo = predictionsRepo;
    this.#logger = logger;
  }

  /**
   * Create a prediction with validation
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

      // Validate play exists and is open
      const play = await this.#gamePlaysRepo.findById(input.gamePlayId);
      if (!play) {
        throw new Error(`Play ${input.gamePlayId} not found`);
      }

      if (play.status !== "open") {
        throw new Error(
          `Play ${input.gamePlayId} is not open for predictions (status: ${play.status})`,
        );
      }

      // Check if prediction is before lock time
      const now = new Date();
      if (now >= play.lockTime) {
        throw new Error(
          `Play ${input.gamePlayId} is locked (lock time: ${play.lockTime.toISOString()})`,
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
          input.gamePlayId,
        );

      if (existing) {
        throw new Error(
          `Agent ${input.agentId} has already predicted on play ${input.gamePlayId}`,
        );
      }

      // Create the prediction
      const prediction = await this.#predictionsRepo.create({
        competitionId: input.competitionId,
        gamePlayId: input.gamePlayId,
        agentId: input.agentId,
        prediction: input.prediction,
        confidence: input.confidence.toString(),
      });

      this.#logger.info(
        `Created prediction ${prediction.id} for agent ${input.agentId} on play ${input.gamePlayId}`,
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
