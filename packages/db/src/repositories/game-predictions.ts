import { and, desc, eq, inArray } from "drizzle-orm";
import { Logger } from "pino";

import { gamePredictions } from "../schema/sports/defs.js";
import {
  InsertGamePrediction,
  SelectGamePrediction,
} from "../schema/sports/types.js";
import { Database } from "../types.js";

/**
 * Game Predictions Repository
 * Handles database operations for game winner predictions
 */
export class GamePredictionsRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Create a new prediction
   * @param prediction Prediction data
   * @returns The created prediction
   */
  async create(
    prediction: InsertGamePrediction,
  ): Promise<SelectGamePrediction> {
    try {
      const [result] = await this.#db
        .insert(gamePredictions)
        .values(prediction)
        .returning();

      if (!result) {
        throw new Error("Failed to create prediction - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in create");
      throw error;
    }
  }

  /**
   * Find all predictions for a game and agent (history)
   * @param gameId Game ID
   * @param agentId Agent ID
   * @returns Array of predictions ordered by creation time (newest first)
   */
  async findByGameAndAgent(
    gameId: string,
    agentId: string,
  ): Promise<SelectGamePrediction[]> {
    try {
      const results = await this.#db
        .select()
        .from(gamePredictions)
        .where(
          and(
            eq(gamePredictions.gameId, gameId),
            eq(gamePredictions.agentId, agentId),
          ),
        )
        .orderBy(desc(gamePredictions.createdAt));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByGameAndAgent");
      throw error;
    }
  }

  /**
   * Find the latest prediction for a game and agent
   * @param gameId Game ID
   * @param agentId Agent ID
   * @returns The most recent prediction or undefined
   */
  async findLatestByGameAndAgent(
    gameId: string,
    agentId: string,
  ): Promise<SelectGamePrediction | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(gamePredictions)
        .where(
          and(
            eq(gamePredictions.gameId, gameId),
            eq(gamePredictions.agentId, agentId),
          ),
        )
        .orderBy(desc(gamePredictions.createdAt))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findLatestByGameAndAgent");
      throw error;
    }
  }

  /**
   * Find all predictions for a game
   * @param gameId Game ID
   * @returns Array of predictions
   */
  async findByGame(gameId: string): Promise<SelectGamePrediction[]> {
    try {
      const results = await this.#db
        .select()
        .from(gamePredictions)
        .where(eq(gamePredictions.gameId, gameId))
        .orderBy(desc(gamePredictions.createdAt));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByGame");
      throw error;
    }
  }

  /**
   * Find all predictions for a competition
   * @param competitionId Competition ID
   * @returns Array of predictions
   */
  async findByCompetition(
    competitionId: string,
  ): Promise<SelectGamePrediction[]> {
    try {
      const results = await this.#db
        .select()
        .from(gamePredictions)
        .where(eq(gamePredictions.competitionId, competitionId))
        .orderBy(desc(gamePredictions.createdAt));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetition");
      throw error;
    }
  }

  /**
   * Count predictions for a game and agent
   * @param gameId Game ID
   * @param agentId Agent ID
   * @returns Count of predictions
   */
  async countByGameAndAgent(gameId: string, agentId: string): Promise<number> {
    try {
      const results = await this.#db
        .select()
        .from(gamePredictions)
        .where(
          and(
            eq(gamePredictions.gameId, gameId),
            eq(gamePredictions.agentId, agentId),
          ),
        );

      return results.length;
    } catch (error) {
      this.#logger.error({ error }, "Error in countByGameAndAgent");
      throw error;
    }
  }

  /**
   * Find predictions for multiple games
   * @param gameIds Array of game IDs
   * @returns Array of predictions
   */
  async findByGameIds(gameIds: string[]): Promise<SelectGamePrediction[]> {
    try {
      if (gameIds.length === 0) {
        return [];
      }

      const results = await this.#db
        .select()
        .from(gamePredictions)
        .where(inArray(gamePredictions.gameId, gameIds))
        .orderBy(desc(gamePredictions.createdAt));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByGameIds");
      throw error;
    }
  }
}
