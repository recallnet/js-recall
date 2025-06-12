import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";
import { agentRank, agentRankHistory } from "@/database/schema/ranking/defs.js";
import {
  InsertAgentRank,
  InsertAgentRankHistory,
} from "@/database/schema/ranking/types.js";
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
  score: number;
}

/**
 * Fetches all agent ranks and returns them as an array of objects containing
 * the agent information and rank score.
 * @returns An array of objects with agent ID, name, and rank score
 */
export async function getAllAgentRanks(): Promise<AgentRankInfo[]> {
  console.log("[AgentRankRepository] getAllAgentRanks called");

  try {
    const rows = await db
      .select({
        id: agents.id,
        imageUrl: agents.imageUrl,
        description: agents.description,
        metadata: agents.metadata,
        name: agents.name,
        ordinal: agentRank.ordinal,
      })
      .from(agentRank)
      .innerJoin(agents, eq(agentRank.agentId, agents.id));

    return rows.map((agent) => {
      return {
        id: agent.id,
        name: agent.name,
        imageUrl: agent.imageUrl!,
        description: agent.description!,
        metadata: (agent.metadata as AgentMetadata)!,
        score: agent.ordinal,
      };
    });
  } catch (error) {
    console.error("[AgentRankRepository] Error in getAllAgentRanks:", error);
    throw error;
  }
}

/**
 * Updates an existing agent rank entry or creates a new one if it doesn't exist
 * Also creates an entry in the agent rank history table using a transaction
 * @param data The agent rank data to insert
 * @param competitionId The competition ID to associate with the rank history
 * @returns The updated agent rank record
 */
export async function updateAgentRank(
  data: Omit<InsertAgentRank, "id" | "createdAt" | "updatedAt">,
  competitionId: string,
): Promise<InsertAgentRank> {
  try {
    const rankData: InsertAgentRank = {
      id: uuidv4(),
      agentId: data.agentId,
      mu: data.mu,
      sigma: data.sigma,
      ordinal: data.ordinal,
    };

    return await db.transaction(async (tx) => {
      const [result] = await tx
        .insert(agentRank)
        .values(rankData)
        .onConflictDoUpdate({
          target: agentRank.agentId,
          set: {
            mu: rankData.mu,
            sigma: rankData.sigma,
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to update agent rank - no result returned");
      }

      // Create a history entry
      const historyData: InsertAgentRankHistory = {
        id: uuidv4(),
        agentId: data.agentId,
        competitionId: competitionId,
        mu: data.mu,
        sigma: data.sigma,
        ordinal: data.ordinal,
        createdAt: new Date(),
      };

      const [historyResult] = await tx
        .insert(agentRankHistory)
        .values(historyData)
        .returning();

      if (!historyResult) {
        throw new Error(
          "Failed to create agent rank history - no result returned",
        );
      }

      return result;
    });
  } catch (error) {
    console.error("[AgentRankRepository] Error in updateAgentRank:", error);
    throw error;
  }
}
