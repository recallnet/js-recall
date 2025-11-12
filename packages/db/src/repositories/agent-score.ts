import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Logger } from "pino";

import { agents, competitions } from "../schema/core/defs.js";
import { agentScore, agentScoreHistory } from "../schema/ranking/defs.js";
import {
  InsertAgentScore,
  InsertAgentScoreHistory,
  SelectAgentScore,
} from "../schema/ranking/types.js";
import type { Transaction as DatabaseTransaction } from "../types.js";
import { Database } from "../types.js";
import { CompetitionType } from "./types/index.js";

/**
 * Agent Rank Repository
 * Handles database operations for agent ranks
 */

/**
 * Represents an agent with its rank information
 */
export interface AgentRankInfo {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  metadata?: unknown;
  mu: number;
  sigma: number;
  score: number;
}

export class AgentScoreRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Get a single agent's global rank for a specific competition type
   * @param agentId Agent ID
   * @param type Competition type (trading or perpetual_futures)
   * @returns Agent's rank and score, or undefined if agent has no rank for that type
   */
  async getAgentRank(
    agentId: string,
    type: CompetitionType,
  ): Promise<{ rank: number; ordinal: number } | undefined> {
    try {
      // Use DENSE_RANK() to calculate position among all agents
      // Higher ordinal = better performance = lower rank number
      const rankedAgentsSubquery = this.#db
        .select({
          agentId: agentScore.agentId,
          ordinal: agentScore.ordinal,
          rank: sql<number>`DENSE_RANK() OVER (PARTITION BY ${agentScore.type} ORDER BY ${agentScore.ordinal} DESC)::int`.as(
            "rank",
          ),
        })
        .from(agentScore)
        .where(eq(agentScore.type, type))
        .as("rankedAgents");

      const [result] = await this.#db
        .select({
          rank: rankedAgentsSubquery.rank,
          ordinal: rankedAgentsSubquery.ordinal,
        })
        .from(rankedAgentsSubquery)
        .where(eq(rankedAgentsSubquery.agentId, agentId))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error(
        {
          agentId,
          type,
          error,
        },
        "Error in getAgentRank",
      );
      throw error;
    }
  }

  /**
   * Fetches all agent ranks and returns them as an array of objects containing
   * the agent information and rank score.
   * @returns An array of objects with agent ID, name, and rank score
   */
  async getAllAgentRanks({
    type,
    agentIds,
  }: {
    type?: CompetitionType;
    agentIds?: string[];
  }): Promise<AgentRankInfo[]> {
    try {
      // Only include global scores (arena_id IS NULL)
      const whereConditions = [];
      if (type) {
        whereConditions.push(eq(agentScore.type, type));
      }
      if (agentIds) {
        whereConditions.push(inArray(agentScore.agentId, agentIds));
      }
      whereConditions.push(isNull(agentScore.arenaId));

      const query = this.#db
        .select({
          id: agents.id,
          imageUrl: agents.imageUrl,
          description: agents.description,
          metadata: agents.metadata,
          name: agents.name,
          mu: agentScore.mu,
          sigma: agentScore.sigma,
          ordinal: agentScore.ordinal,
        })
        .from(agentScore)
        .innerJoin(agents, eq(agentScore.agentId, agents.id));
      if (whereConditions.length > 0) {
        query.where(and(...whereConditions));
      }

      const rows = await query;

      return rows.map((agent) => {
        return {
          id: agent.id,
          name: agent.name,
          imageUrl: agent.imageUrl!,
          description: agent.description!,
          metadata: agent.metadata,
          mu: agent.mu,
          sigma: agent.sigma,
          score: agent.ordinal,
        };
      });
    } catch (error) {
      this.#logger.error(
        {
          type,
          agentIds,
          error,
        },
        "Error in getAllAgentRanks",
      );
      throw error;
    }
  }

  /**
   * Updates multiple agent ranks in a single transaction
   * Also creates entries in the agent rank history table for each agent
   * @param dataArray Array of agent rank data to insert/update
   * @param competitionId The competition ID to associate with the rank history
   * @returns Array of updated agent rank records
   */
  async batchUpdateAgentRanks(
    dataArray: Array<Omit<InsertAgentScore, "id" | "createdAt" | "updatedAt">>,
    competitionId: string,
    type: CompetitionType,
    tx?: DatabaseTransaction,
  ): Promise<InsertAgentScore[]> {
    if (dataArray.length === 0) {
      this.#logger.debug("No agent ranks to update in batch");
      return [];
    }

    const executor = tx || this.#db;

    try {
      this.#logger.debug(`Batch updating ${dataArray.length} agent ranks`);

      return await executor.transaction(async (tx) => {
        // Prepare rank data with IDs
        const rankDataArray: InsertAgentScore[] = dataArray.map((data) => ({
          id: randomUUID(),
          agentId: data.agentId,
          type,
          mu: data.mu,
          sigma: data.sigma,
          ordinal: data.ordinal,
        }));

        // Prepare history data with IDs
        const historyDataArray: InsertAgentScoreHistory[] = dataArray.map(
          (data) => ({
            id: randomUUID(),
            agentId: data.agentId,
            competitionId: competitionId,
            type,
            mu: data.mu,
            sigma: data.sigma,
            ordinal: data.ordinal,
          }),
        );

        // Batch update agent ranks using a single query
        const results = await this.batchUpsertAgentScores(tx, rankDataArray);

        // Batch insert history entries
        const historyResults = await tx
          .insert(agentScoreHistory)
          .values(historyDataArray)
          .returning();

        if (historyResults.length !== historyDataArray.length) {
          throw new Error(
            `Failed to create all agent rank history entries: expected ${historyDataArray.length}, got ${historyResults.length}`,
          );
        }

        return results;
      });
    } catch (error) {
      this.#logger.error("Error in batchUpdateAgentRanks:", error);
      throw error;
    }
  }

  /**
   * Updates multiple agent ranks for a specific arena in a single transaction
   * Similar to batchUpdateAgentRanks but for arena-specific scores.
   * The type and arenaId are provided as parameters and added to each record.
   * Also creates entries in the agent rank history table for each agent
   * @param dataArray Array of agent rank data to insert/update (type and arenaId will be added from parameters)
   * @param competitionId The competition ID to associate with the rank history
   * @param arenaId The arena ID for arena-specific rankings
   * @param type The competition type
   * @returns Array of updated agent rank records
   */
  async batchUpdateArenaRanks(
    dataArray: Array<
      Omit<InsertAgentScore, "id" | "createdAt" | "updatedAt" | "arenaId">
    >,
    competitionId: string,
    arenaId: string,
    type: CompetitionType,
    tx?: DatabaseTransaction,
  ): Promise<InsertAgentScore[]> {
    if (dataArray.length === 0) {
      this.#logger.debug("No arena agent ranks to update in batch");
      return [];
    }

    const executor = tx || this.#db;

    try {
      this.#logger.debug(
        `Batch updating ${dataArray.length} arena agent ranks for arena: ${arenaId}`,
      );

      return await executor.transaction(async (tx) => {
        // Prepare rank data with IDs and arena_id
        const rankDataArray: InsertAgentScore[] = dataArray.map((data) => ({
          id: randomUUID(),
          agentId: data.agentId,
          type,
          arenaId,
          mu: data.mu,
          sigma: data.sigma,
          ordinal: data.ordinal,
        }));

        // Prepare history data with IDs
        const historyDataArray: InsertAgentScoreHistory[] = dataArray.map(
          (data) => ({
            id: randomUUID(),
            agentId: data.agentId,
            competitionId: competitionId,
            type,
            mu: data.mu,
            sigma: data.sigma,
            ordinal: data.ordinal,
          }),
        );

        // Batch update agent ranks using a single query
        const results = await this.batchUpsertArenaScores(
          tx,
          rankDataArray,
          arenaId,
        );

        // Batch insert history entries
        const historyResults = await tx
          .insert(agentScoreHistory)
          .values(historyDataArray)
          .returning();

        if (historyResults.length !== historyDataArray.length) {
          throw new Error(
            `Failed to create all agent rank history entries: expected ${historyDataArray.length}, got ${historyResults.length}`,
          );
        }

        return results;
      });
    } catch (error) {
      this.#logger.error("Error in batchUpdateArenaRanks:", error);
      throw error;
    }
  }

  /**
   * Get all agent rank history records
   * @param competitionId Optional competition ID to filter by (single competition)
   * @param competitionIds Optional competition IDs to filter by (multiple competitions)
   * @param type Optional competition type to filter by
   */
  async getAllAgentRankHistory({
    competitionId,
    competitionIds,
    type,
  }: {
    competitionId?: string;
    competitionIds?: string[];
    type?: CompetitionType;
  }) {
    try {
      const query = this.#db
        .select()
        .from(agentScoreHistory)
        .orderBy(desc(agentScoreHistory.createdAt));

      const whereConditions = [];
      if (competitionId) {
        whereConditions.push(
          eq(agentScoreHistory.competitionId, competitionId),
        );
      }
      if (competitionIds && competitionIds.length > 0) {
        whereConditions.push(
          inArray(agentScoreHistory.competitionId, competitionIds),
        );
      }
      if (type) {
        whereConditions.push(eq(agentScoreHistory.type, type));
      }
      if (whereConditions.length > 0) {
        query.where(and(...whereConditions));
      }

      return await query;
    } catch (error) {
      this.#logger.error("Error in getAllAgentRankHistory:", error);
      throw error;
    }
  }

  /**
   * Get agent rank history for all competitions in a specific arena
   * @param arenaId Arena ID to filter by
   * @returns Array of agent score history entries for the arena, sorted chronologically
   */
  async getHistoryForArena(arenaId: string) {
    try {
      const results = await this.#db
        .select({
          id: agentScoreHistory.id,
          agentId: agentScoreHistory.agentId,
          competitionId: agentScoreHistory.competitionId,
          type: agentScoreHistory.type,
          mu: agentScoreHistory.mu,
          sigma: agentScoreHistory.sigma,
          ordinal: agentScoreHistory.ordinal,
          createdAt: agentScoreHistory.createdAt,
        })
        .from(agentScoreHistory)
        .innerJoin(
          competitions,
          eq(agentScoreHistory.competitionId, competitions.id),
        )
        .where(eq(competitions.arenaId, arenaId))
        .orderBy(agentScoreHistory.createdAt);

      this.#logger.debug(
        `[AgentScoreRepository] Retrieved ${results.length} history entries for arena ${arenaId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ arenaId, error }, "Error in getHistoryForArena");
      throw error;
    }
  }

  /**
   * Get latest arena score history for specific agents
   * Returns the most recent history entry per agent within the arena
   * @param arenaId Arena ID to filter by
   * @param agentIds Array of agent IDs to get history for
   * @returns Array with one entry per agent (their latest arena history)
   */
  async getLatestArenaHistoryForAgents(
    arenaId: string,
    agentIds: string[],
  ): Promise<
    Array<{
      agentId: string;
      mu: number;
      sigma: number;
      ordinal: number;
      createdAt: Date;
    }>
  > {
    if (agentIds.length === 0) {
      return [];
    }

    try {
      const results = await this.#db
        .selectDistinctOn([agentScoreHistory.agentId], {
          agentId: agentScoreHistory.agentId,
          mu: agentScoreHistory.mu,
          sigma: agentScoreHistory.sigma,
          ordinal: agentScoreHistory.ordinal,
          createdAt: agentScoreHistory.createdAt,
        })
        .from(agentScoreHistory)
        .innerJoin(
          competitions,
          eq(agentScoreHistory.competitionId, competitions.id),
        )
        .where(
          and(
            eq(competitions.arenaId, arenaId),
            inArray(agentScoreHistory.agentId, agentIds),
          ),
        )
        .orderBy(agentScoreHistory.agentId, desc(agentScoreHistory.createdAt));

      this.#logger.debug(
        `[AgentScoreRepository] Retrieved latest arena history for ${results.length}/${agentIds.length} agents in arena ${arenaId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error(
        { arenaId, agentIds: agentIds.length, error },
        "Error in getLatestArenaHistoryForAgents",
      );
      throw error;
    }
  }

  /**
   * Batch upsert agent scores using raw SQL
   */
  async batchUpsertAgentScores(
    tx: DatabaseTransaction,
    rankDataArray: InsertAgentScore[],
  ): Promise<SelectAgentScore[]> {
    if (rankDataArray.length === 0) {
      return [];
    }

    // Build the VALUES part dynamically
    const sqlChunks: ReturnType<typeof sql>[] = [];

    sqlChunks.push(sql`
    INSERT INTO agent_score (id, agent_id, type, mu, sigma, ordinal, arena_id)
    VALUES
  `);

    rankDataArray.forEach((data, index) => {
      if (index > 0) {
        sqlChunks.push(sql`, `);
      }
      // arena_id is NULL for global scores
      sqlChunks.push(
        sql`(${data.id}, ${data.agentId}, ${data.type}, ${data.mu}, ${data.sigma}, ${data.ordinal}, NULL)`,
      );
    });

    sqlChunks.push(sql`
    ON CONFLICT (agent_id, type) WHERE arena_id IS NULL
    DO UPDATE SET
      mu = EXCLUDED.mu,
      sigma = EXCLUDED.sigma,
      ordinal = EXCLUDED.ordinal,
      updated_at = NOW()
    RETURNING *
  `);

    // Combine all SQL chunks
    const query = sql.join(sqlChunks, sql``);

    const result = await tx.execute<SelectAgentScore>(query);

    if (result.rows.length !== rankDataArray.length) {
      throw new Error(
        `Failed to update all agent ranks. Expected ${rankDataArray.length}, got ${result.rows.length}`,
      );
    }

    return result.rows as SelectAgentScore[];
  }

  /**
   * Batch upsert arena-specific agent scores using raw SQL
   * @param tx Database transaction
   * @param rankDataArray Array of agent score data to upsert
   * @param arenaId Arena ID for the scores
   * @returns Array of upserted agent scores
   */
  async batchUpsertArenaScores(
    tx: DatabaseTransaction,
    rankDataArray: InsertAgentScore[],
    arenaId: string,
  ): Promise<SelectAgentScore[]> {
    if (rankDataArray.length === 0) {
      return [];
    }

    // Build the VALUES part dynamically
    const sqlChunks: ReturnType<typeof sql>[] = [];

    sqlChunks.push(sql`
    INSERT INTO agent_score (id, agent_id, type, mu, sigma, ordinal, arena_id)
    VALUES
  `);

    rankDataArray.forEach((data, index) => {
      if (index > 0) {
        sqlChunks.push(sql`, `);
      }
      sqlChunks.push(
        sql`(${data.id}, ${data.agentId}, ${data.type}, ${data.mu}, ${data.sigma}, ${data.ordinal}, ${arenaId})`,
      );
    });

    sqlChunks.push(sql`
    ON CONFLICT (agent_id, arena_id) WHERE arena_id IS NOT NULL
    DO UPDATE SET
      mu = EXCLUDED.mu,
      sigma = EXCLUDED.sigma,
      ordinal = EXCLUDED.ordinal,
      updated_at = NOW()
    RETURNING *
  `);

    // Combine all SQL chunks
    const query = sql.join(sqlChunks, sql``);

    const result = await tx.execute<SelectAgentScore>(query);

    if (result.rows.length !== rankDataArray.length) {
      throw new Error(
        `Failed to update all arena agent ranks. Expected ${rankDataArray.length}, got ${result.rows.length}`,
      );
    }

    return result.rows as SelectAgentScore[];
  }
}
