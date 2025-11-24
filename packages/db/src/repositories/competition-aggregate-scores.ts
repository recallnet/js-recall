import { and, desc, eq } from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import { competitionAggregateScores } from "../schema/sports/defs.js";
import {
  InsertCompetitionAggregateScore,
  SelectCompetitionAggregateScore,
} from "../schema/sports/types.js";
import { Database, Transaction } from "../types.js";

export type CompetitionAggregateScoreWithAgent =
  SelectCompetitionAggregateScore & {
    agentName: string | null;
  };

/**
 * Competition Aggregate Scores Repository
 * Handles database operations for competition-wide aggregate scores
 */
export class CompetitionAggregateScoresRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Upsert competition aggregate score
   * @param score Score data to insert or update
   * @param tx Optional transaction
   * @returns The upserted score
   */
  async upsert(
    score: InsertCompetitionAggregateScore,
    tx?: Transaction,
  ): Promise<SelectCompetitionAggregateScore> {
    try {
      const now = new Date();
      const data = {
        ...score,
        updatedAt: now,
      };

      const executor = tx || this.#db;
      const [result] = await executor
        .insert(competitionAggregateScores)
        .values(data)
        .onConflictDoUpdate({
          target: [
            competitionAggregateScores.competitionId,
            competitionAggregateScores.agentId,
          ],
          set: {
            averageBrierScore: data.averageBrierScore,
            gamesScored: data.gamesScored,
            updatedAt: now,
          },
        })
        .returning();

      if (!result) {
        throw new Error(
          "Failed to upsert competition aggregate score - no result returned",
        );
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in upsert");
      throw error;
    }
  }

  /**
   * Find all aggregate scores for a competition (for leaderboard)
   * @param competitionId Competition ID
   * @returns Array of scores ordered by average Brier score (descending = better)
   */
  async findByCompetition(
    competitionId: string,
  ): Promise<CompetitionAggregateScoreWithAgent[]> {
    try {
      const results = await this.#db
        .select({
          score: competitionAggregateScores,
          agentName: agents.name,
        })
        .from(competitionAggregateScores)
        .leftJoin(agents, eq(competitionAggregateScores.agentId, agents.id))
        .where(eq(competitionAggregateScores.competitionId, competitionId))
        .orderBy(desc(competitionAggregateScores.averageBrierScore));

      return results.map(({ score, agentName }) => ({
        ...score,
        agentName: agentName ?? null,
      }));
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetition");
      throw error;
    }
  }

  /**
   * Find specific aggregate score for an agent
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns The score or undefined
   */
  async findByCompetitionAndAgent(
    competitionId: string,
    agentId: string,
  ): Promise<SelectCompetitionAggregateScore | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(competitionAggregateScores)
        .where(
          and(
            eq(competitionAggregateScores.competitionId, competitionId),
            eq(competitionAggregateScores.agentId, agentId),
          ),
        )
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByCompetitionAndAgent");
      throw error;
    }
  }
}
