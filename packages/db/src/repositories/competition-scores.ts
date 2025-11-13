import { and, eq, sql } from "drizzle-orm";
import { Logger } from "pino";

import { competitionScores } from "../schema/sports/defs.js";
import {
  InsertCompetitionScore,
  SelectCompetitionScore,
} from "../schema/sports/types.js";
import { Database } from "../types.js";

/**
 * Competition Scores Repository
 * Handles database operations for aggregated competition scores
 */
export class CompetitionScoresRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Upsert competition score
   * @param score Score data to insert or update
   * @returns The upserted score
   */
  async upsert(score: InsertCompetitionScore): Promise<SelectCompetitionScore> {
    try {
      const now = new Date();
      const data = {
        ...score,
        updatedAt: now,
      };

      const [result] = await this.#db
        .insert(competitionScores)
        .values(data)
        .onConflictDoUpdate({
          target: [competitionScores.competitionId, competitionScores.agentId],
          set: {
            totalPredictions: data.totalPredictions,
            correctPredictions: data.correctPredictions,
            brierSum: data.brierSum,
            updatedAt: now,
          },
        })
        .returning();

      if (!result) {
        throw new Error(
          "Failed to upsert competition score - no result returned",
        );
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in upsert:", error);
      throw error;
    }
  }

  /**
   * Find score for a specific agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns The score or undefined
   */
  async findByCompetitionAndAgent(
    competitionId: string,
    agentId: string,
  ): Promise<SelectCompetitionScore | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(competitionScores)
        .where(
          and(
            eq(competitionScores.competitionId, competitionId),
            eq(competitionScores.agentId, agentId),
          ),
        )
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error("Error in findByCompetitionAndAgent:", error);
      throw error;
    }
  }

  /**
   * Find all scores for a competition
   * @param competitionId Competition ID
   * @returns Array of scores
   */
  async findByCompetition(
    competitionId: string,
  ): Promise<SelectCompetitionScore[]> {
    try {
      const results = await this.#db
        .select()
        .from(competitionScores)
        .where(eq(competitionScores.competitionId, competitionId))
        .orderBy(
          sql`CASE WHEN ${competitionScores.totalPredictions} > 0 THEN (${competitionScores.correctPredictions}::float / ${competitionScores.totalPredictions}::float) ELSE 0 END DESC`,
        );

      return results;
    } catch (error) {
      this.#logger.error("Error in findByCompetition:", error);
      throw error;
    }
  }

  /**
   * Increment score for an agent
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param isCorrect Whether the prediction was correct
   * @param brierTerm The Brier score term to add
   * @returns The updated score
   */
  async increment(
    competitionId: string,
    agentId: string,
    isCorrect: boolean,
    brierTerm: number,
  ): Promise<SelectCompetitionScore> {
    try {
      const now = new Date();

      // Try to update existing record
      const [updated] = await this.#db
        .update(competitionScores)
        .set({
          totalPredictions: sql`${competitionScores.totalPredictions} + 1`,
          correctPredictions: isCorrect
            ? sql`${competitionScores.correctPredictions} + 1`
            : competitionScores.correctPredictions,
          brierSum: sql`${competitionScores.brierSum} + ${brierTerm}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(competitionScores.competitionId, competitionId),
            eq(competitionScores.agentId, agentId),
          ),
        )
        .returning();

      if (updated) {
        return updated;
      }

      // If no existing record, insert new one
      return await this.upsert({
        competitionId,
        agentId,
        totalPredictions: 1,
        correctPredictions: isCorrect ? 1 : 0,
        brierSum: brierTerm.toString(),
      });
    } catch (error) {
      this.#logger.error("Error in increment:", error);
      throw error;
    }
  }
}
