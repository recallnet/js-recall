import { randomUUID } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
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
      const whereConditions = [];
      if (type) {
        whereConditions.push(eq(agentScore.type, type));
      }
      if (agentIds) {
        whereConditions.push(inArray(agentScore.agentId, agentIds));
      }
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
   * Get all agent rank history records
   * @param competitionId Optional competition ID to filter by
   */
  async getAllAgentRankHistory({
    competitionId,
    type,
  }: {
    competitionId?: string;
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
   * Batch upsert agent scores using raw SQL for better performance
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
    INSERT INTO agent_score (id, agent_id, type, mu, sigma, ordinal)
    VALUES
  `);

    rankDataArray.forEach((data, index) => {
      if (index > 0) {
        sqlChunks.push(sql`, `);
      }
      sqlChunks.push(
        sql`(${data.id}, ${data.agentId}, ${data.type}, ${data.mu}, ${data.sigma}, ${data.ordinal})`,
      );
    });

    sqlChunks.push(sql`
    ON CONFLICT (agent_id, type) DO UPDATE SET
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
}
