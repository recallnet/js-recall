import { and, eq, inArray, sql } from "drizzle-orm";
import { Logger } from "pino";

import { predictions } from "../schema/sports/defs.js";
import { InsertPrediction, SelectPrediction } from "../schema/sports/types.js";
import { Database } from "../types.js";

/**
 * Predictions Repository
 * Handles database operations for agent predictions
 */
export class PredictionsRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Create a prediction
   * @param prediction Prediction data
   * @returns The created prediction
   */
  async create(prediction: InsertPrediction): Promise<SelectPrediction> {
    try {
      const now = new Date();
      const data = {
        ...prediction,
        createdAt: prediction.createdAt || now,
      };

      const [result] = await this.#db
        .insert(predictions)
        .values(data)
        .returning();

      if (!result) {
        throw new Error("Failed to create prediction - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in create:", error);
      throw error;
    }
  }

  /**
   * Find a prediction by agent, competition, and play
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param gamePlayId Game play ID
   * @returns The prediction or undefined
   */
  async findByAgentCompetitionAndPlay(
    agentId: string,
    competitionId: string,
    gamePlayId: string,
  ): Promise<SelectPrediction | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(predictions)
        .where(
          and(
            eq(predictions.agentId, agentId),
            eq(predictions.competitionId, competitionId),
            eq(predictions.gamePlayId, gamePlayId),
          ),
        )
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByAgentCompetitionAndPlay");
      throw error;
    }
  }

  /**
   * Find all predictions for a play
   * @param gamePlayId Game play ID
   * @returns Array of predictions
   */
  async findByPlayId(gamePlayId: string): Promise<SelectPrediction[]> {
    try {
      const results = await this.#db
        .select()
        .from(predictions)
        .where(eq(predictions.gamePlayId, gamePlayId));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByPlayId");
      throw error;
    }
  }

  /**
   * Find all predictions for a competition and agent
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns Array of predictions
   */
  async findByCompetitionAndAgent(
    competitionId: string,
    agentId: string,
  ): Promise<SelectPrediction[]> {
    try {
      const results = await this.#db
        .select()
        .from(predictions)
        .where(
          and(
            eq(predictions.competitionId, competitionId),
            eq(predictions.agentId, agentId),
          ),
        );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetitionAndAgent");
      throw error;
    }
  }

  /**
   * Count predictions for a competition
   * @param competitionId Competition ID
   * @returns Count of predictions
   */
  async countByCompetition(competitionId: string): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: sql<number>`count(*)::int` })
        .from(predictions)
        .where(eq(predictions.competitionId, competitionId));

      return result?.count || 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in countByCompetition");
      throw error;
    }
  }

  /**
   * Find predictions for multiple plays
   * @param gamePlayIds Array of game play IDs
   * @returns Array of predictions
   */
  async findByPlayIds(gamePlayIds: string[]): Promise<SelectPrediction[]> {
    try {
      if (gamePlayIds.length === 0) {
        return [];
      }

      const results = await this.#db
        .select()
        .from(predictions)
        .where(inArray(predictions.gamePlayId, gamePlayIds));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByPlayIds");
      throw error;
    }
  }
}
