import { and, desc, eq } from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import { gamePredictionScores } from "../schema/sports/defs.js";
import {
  InsertGamePredictionScore,
  SelectGamePredictionScore,
} from "../schema/sports/types.js";
import { Database, Transaction } from "../types.js";

export type GamePredictionScoreWithAgent = SelectGamePredictionScore & {
  agentName: string | null;
};

/**
 * Game Prediction Scores Repository
 * Handles database operations for per-game prediction scores
 */
export class GamePredictionScoresRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Upsert game prediction score
   * @param score Score data to insert or update
   * @returns The upserted score
   */
  async upsert(
    score: InsertGamePredictionScore,
    tx?: Transaction,
  ): Promise<SelectGamePredictionScore> {
    try {
      const now = new Date();
      const data = {
        ...score,
        updatedAt: now,
      };

      const executor = tx || this.#db;

      const [result] = await executor
        .insert(gamePredictionScores)
        .values(data)
        .onConflictDoUpdate({
          target: [
            gamePredictionScores.competitionId,
            gamePredictionScores.gameId,
            gamePredictionScores.agentId,
          ],
          set: {
            timeWeightedBrierScore: data.timeWeightedBrierScore,
            finalPrediction: data.finalPrediction,
            finalConfidence: data.finalConfidence,
            predictionCount: data.predictionCount,
            updatedAt: now,
          },
        })
        .returning();

      if (!result) {
        throw new Error(
          "Failed to upsert game prediction score - no result returned",
        );
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in upsert");
      throw error;
    }
  }

  /**
   * Find all scores for a competition and game
   * @param competitionId Competition ID
   * @param gameId Game ID
   * @returns Array of scores
   */
  async findByCompetitionAndGame(
    competitionId: string,
    gameId: string,
  ): Promise<GamePredictionScoreWithAgent[]> {
    try {
      const results = await this.#db
        .select({
          score: gamePredictionScores,
          agentName: agents.name,
        })
        .from(gamePredictionScores)
        .leftJoin(agents, eq(gamePredictionScores.agentId, agents.id))
        .where(
          and(
            eq(gamePredictionScores.competitionId, competitionId),
            eq(gamePredictionScores.gameId, gameId),
          ),
        )
        .orderBy(desc(gamePredictionScores.timeWeightedBrierScore));

      return results.map(({ score, agentName }) => ({
        ...score,
        agentName: agentName ?? null,
      }));
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetitionAndGame");
      throw error;
    }
  }

  /**
   * Find all game scores for an agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns Array of scores
   */
  async findByCompetitionAndAgent(
    competitionId: string,
    agentId: string,
    tx?: Transaction,
  ): Promise<SelectGamePredictionScore[]> {
    try {
      const executor = tx || this.#db;
      const results = await executor
        .select()
        .from(gamePredictionScores)
        .where(
          and(
            eq(gamePredictionScores.competitionId, competitionId),
            eq(gamePredictionScores.agentId, agentId),
          ),
        );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetitionAndAgent");
      throw error;
    }
  }

  /**
   * Find specific game score for an agent
   * @param competitionId Competition ID
   * @param gameId Game ID
   * @param agentId Agent ID
   * @returns The score or undefined
   */
  async findByCompetitionGameAndAgent(
    competitionId: string,
    gameId: string,
    agentId: string,
  ): Promise<SelectGamePredictionScore | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(gamePredictionScores)
        .where(
          and(
            eq(gamePredictionScores.competitionId, competitionId),
            eq(gamePredictionScores.gameId, gameId),
            eq(gamePredictionScores.agentId, agentId),
          ),
        )
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetitionGameAndAgent");
      throw error;
    }
  }
}
