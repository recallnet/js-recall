import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import { gamePredictions } from "../schema/sports/defs.js";
import {
  InsertGamePrediction,
  SelectGamePrediction,
} from "../schema/sports/types.js";
import { Database, Transaction } from "../types.js";

export type GamePredictionWithAgent = SelectGamePrediction & {
  agentName: string | null;
};

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
   * @param tx Optional transaction
   * @returns The created prediction
   */
  async create(
    prediction: InsertGamePrediction,
    tx?: Transaction,
  ): Promise<SelectGamePrediction> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
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
   * @param competitionId Competition ID
   * @returns Array of predictions ordered by creation time (newest first)
   */
  async findByGameAndAgent(
    gameId: string,
    agentId: string,
    competitionId: string,
  ): Promise<GamePredictionWithAgent[]> {
    try {
      const results = await this.#db
        .select({
          prediction: gamePredictions,
          agentName: agents.name,
        })
        .from(gamePredictions)
        .leftJoin(agents, eq(gamePredictions.agentId, agents.id))
        .where(
          and(
            eq(gamePredictions.gameId, gameId),
            eq(gamePredictions.agentId, agentId),
            eq(gamePredictions.competitionId, competitionId),
          ),
        )
        .orderBy(desc(gamePredictions.createdAt));

      return results.map(({ prediction, agentName }) => ({
        ...prediction,
        agentName: agentName ?? null,
      }));
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
    competitionId: string,
  ): Promise<GamePredictionWithAgent | undefined> {
    try {
      const [result] = await this.#db
        .select({
          prediction: gamePredictions,
          agentName: agents.name,
        })
        .from(gamePredictions)
        .leftJoin(agents, eq(gamePredictions.agentId, agents.id))
        .where(
          and(
            eq(gamePredictions.gameId, gameId),
            eq(gamePredictions.agentId, agentId),
            eq(gamePredictions.competitionId, competitionId),
          ),
        )
        .orderBy(desc(gamePredictions.createdAt))
        .limit(1);

      if (!result) {
        return undefined;
      }
      return {
        ...result.prediction,
        agentName: result.agentName ?? null,
      };
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
  async findByGame(
    gameId: string,
    competitionId: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      tx?: Transaction;
    },
  ): Promise<GamePredictionWithAgent[]> {
    try {
      const executor = options?.tx || this.#db;
      const conditions = [
        eq(gamePredictions.gameId, gameId),
        eq(gamePredictions.competitionId, competitionId),
      ];
      if (options?.startTime) {
        conditions.push(gte(gamePredictions.createdAt, options.startTime));
      }
      if (options?.endTime) {
        conditions.push(lte(gamePredictions.createdAt, options.endTime));
      }

      const query = executor
        .select({
          prediction: gamePredictions,
          agentName: agents.name,
        })
        .from(gamePredictions)
        .leftJoin(agents, eq(gamePredictions.agentId, agents.id))
        .where(and(...conditions))
        .orderBy(desc(gamePredictions.createdAt));

      const rows = await query;

      return rows.map(({ prediction, agentName }) => ({
        ...prediction,
        agentName: agentName ?? null,
      }));
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
  ): Promise<GamePredictionWithAgent[]> {
    try {
      const results = await this.#db
        .select({
          prediction: gamePredictions,
          agentName: agents.name,
        })
        .from(gamePredictions)
        .leftJoin(agents, eq(gamePredictions.agentId, agents.id))
        .where(eq(gamePredictions.competitionId, competitionId))
        .orderBy(desc(gamePredictions.createdAt));

      return results.map(({ prediction, agentName }) => ({
        ...prediction,
        agentName: agentName ?? null,
      }));
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

  /**
   * Find all predictions made before a specific time for a game
   * @param gameId Game ID
   * @param beforeTime Timestamp to compare against
   * @returns Array of predictions created before the specified time
   */
  async findPregamePredictions(
    gameId: string,
    beforeTime: Date,
    tx?: Transaction,
  ): Promise<SelectGamePrediction[]> {
    try {
      const executor = tx || this.#db;
      const results = await executor
        .select()
        .from(gamePredictions)
        .where(
          and(
            eq(gamePredictions.gameId, gameId),
            lt(gamePredictions.createdAt, beforeTime),
          ),
        )
        .orderBy(desc(gamePredictions.createdAt));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findPreGamePredictions");
      throw error;
    }
  }
}
