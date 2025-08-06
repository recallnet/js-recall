import { desc, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";
import {
  agentScore,
  agentScoreHistory,
} from "@/database/schema/ranking/defs.js";
import {
  InsertAgentScore,
  InsertAgentScoreHistory,
} from "@/database/schema/ranking/types.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { AgentMetadata } from "@/types/index.js";

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
  metadata?: AgentMetadata;
  mu: number;
  sigma: number;
  score: number;
}

/**
 * Fetches all agent ranks and returns them as an array of objects containing
 * the agent information and rank score.
 * @returns An array of objects with agent ID, name, and rank score
 */
async function getAllAgentRanksImpl(
  agentIds?: string[],
): Promise<AgentRankInfo[]> {
  repositoryLogger.debug("getAllAgentRanks called");

  try {
    const query = db
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

    if (agentIds) {
      query.where(inArray(agentScore.agentId, agentIds));
    }

    const rows = await query;

    return rows.map((agent) => {
      return {
        id: agent.id,
        name: agent.name,
        imageUrl: agent.imageUrl!,
        description: agent.description!,
        metadata: (agent.metadata as AgentMetadata)!,
        mu: agent.mu,
        sigma: agent.sigma,
        score: agent.ordinal,
      };
    });
  } catch (error) {
    repositoryLogger.error("Error in getAllAgentRanks:", error);
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
/**
 * Fetches the current rank for a specific agent by ID
 * @param agentId The ID of the agent to get the rank for
 * @returns The agent's simplified rank information (id, rank, score) or null if not found
 */
async function getAgentRankByIdImpl(agentId: string): Promise<{
  id: string;
  rank: number;
  score: number;
} | null> {
  repositoryLogger.debug(`getAgentRankById called for agent ${agentId}`);

  try {
    const result = await db.execute(sql`
      WITH ranked_agents AS (
        SELECT
          agent_id as id,
          ordinal as score,
          row_number() OVER (ORDER BY ordinal DESC) as rank
        FROM agent_score
      )
      SELECT id, rank, score
      FROM ranked_agents
      WHERE id = ${agentId}
    `);

    if (!result.rows || result.rows.length === 0) {
      repositoryLogger.debug(`No rank found for agent ${agentId}`);
      return null;
    }

    const agentRow = result.rows[0];
    if (!agentRow) {
      repositoryLogger.debug(`No rank data found for agent ${agentId}`);
      return null;
    }

    return {
      id: String(agentRow.id),
      rank: Number(agentRow.rank),
      score: Number(agentRow.score),
    };
  } catch (error) {
    repositoryLogger.error(
      `Error in getAgentRankById for agent ${agentId}:`,
      error,
    );
    throw error;
  }
}

async function batchUpdateAgentRanksImpl(
  dataArray: Array<Omit<InsertAgentScore, "id" | "createdAt" | "updatedAt">>,
  competitionId: string,
): Promise<InsertAgentScore[]> {
  if (dataArray.length === 0) {
    repositoryLogger.debug("No agent ranks to update in batch");
    return [];
  }

  try {
    repositoryLogger.debug(`Batch updating ${dataArray.length} agent ranks`);

    return await db.transaction(async (tx) => {
      // Prepare rank data with IDs
      const rankDataArray: InsertAgentScore[] = dataArray.map((data) => ({
        id: uuidv4(),
        agentId: data.agentId,
        mu: data.mu,
        sigma: data.sigma,
        ordinal: data.ordinal,
      }));

      // Prepare history data with IDs
      const historyDataArray: InsertAgentScoreHistory[] = dataArray.map(
        (data) => ({
          id: uuidv4(),
          agentId: data.agentId,
          competitionId: competitionId,
          mu: data.mu,
          sigma: data.sigma,
          ordinal: data.ordinal,
        }),
      );

      // Batch update agent ranks
      const results = await Promise.all(
        rankDataArray.map(async (rankData) => {
          const [result] = await tx
            .insert(agentScore)
            .values(rankData)
            .onConflictDoUpdate({
              target: agentScore.agentId,
              set: {
                mu: rankData.mu,
                sigma: rankData.sigma,
                ordinal: rankData.ordinal,
                updatedAt: new Date(),
              },
            })
            .returning();

          if (!result) {
            throw new Error(
              `Failed to update agent rank for agent ${rankData.agentId}`,
            );
          }

          return result;
        }),
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
    repositoryLogger.error("Error in batchUpdateAgentRanks:", error);
    throw error;
  }
}

/**
 * Get all agent rank history records
 * @param competitionId Optional competition ID to filter by
 */
async function getAllAgentRankHistoryImpl(competitionId?: string) {
  try {
    const query = db
      .select()
      .from(agentScoreHistory)
      .orderBy(desc(agentScoreHistory.createdAt));

    if (competitionId) {
      query.where(eq(agentScoreHistory.competitionId, competitionId));
    }

    return await query;
  } catch (error) {
    repositoryLogger.error("Error in getAllAgentRankHistory:", error);
    throw error;
  }
}

/**
 * Get all raw agent ranks (without joins)
 */
async function getAllRawAgentRanksImpl() {
  try {
    return await db.select().from(agentScore).orderBy(desc(agentScore.ordinal));
  } catch (error) {
    repositoryLogger.error("Error in getAllRawAgentRanks:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const getAllAgentRanks = createTimedRepositoryFunction(
  getAllAgentRanksImpl,
  "AgentScoreRepository",
  "getAllAgentRanks",
);

export const getAgentRankById = createTimedRepositoryFunction(
  getAgentRankByIdImpl,
  "AgentScoreRepository",
  "getAgentRankById",
);

export const batchUpdateAgentRanks = createTimedRepositoryFunction(
  batchUpdateAgentRanksImpl,
  "AgentScoreRepository",
  "batchUpdateAgentRanks",
);

export const getAllAgentRankHistory = createTimedRepositoryFunction(
  getAllAgentRankHistoryImpl,
  "AgentScoreRepository",
  "getAllAgentRankHistory",
);

export const getAllRawAgentRanks = createTimedRepositoryFunction(
  getAllRawAgentRanksImpl,
  "AgentScoreRepository",
  "getAllRawAgentRanks",
);
