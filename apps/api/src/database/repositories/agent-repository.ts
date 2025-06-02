import {
  AnyColumn,
  and,
  asc,
  desc,
  count as drizzleCount,
  eq,
  ilike,
} from "drizzle-orm";

import { db } from "@/database/db.js";
import {
  agents,
  competitionAgents,
  competitions,
} from "@/database/schema/core/defs.js";
import { InsertAgent, SelectAgent } from "@/database/schema/core/types.js";
import {
  AgentSearchParams,
  CompetitionAgentsParams,
  PagingParams,
} from "@/types/index.js";

import { getSort } from "./helpers.js";
import { PartialExcept } from "./types.js";

/**
 * Agent Repository
 * Handles database operations for agents
 */

/**
 * allowable order by database columns
 */
const agentOrderByFields: Record<string, AnyColumn> = {
  id: agents.id,
  ownerId: agents.ownerId,
  walletAddress: agents.walletAddress,
  name: agents.name,
  description: agents.description,
  imageUrl: agents.imageUrl,
  status: agents.status,
  createdAt: agents.createdAt,
  updatedAt: agents.updatedAt,
};

/**
 * Create a new agent
 * @param agent Agent to create
 */
export async function create(agent: InsertAgent): Promise<SelectAgent> {
  try {
    const now = new Date();
    const normalizedWalletAddress = agent.walletAddress?.toLowerCase();
    const data = {
      ...agent,
      walletAddress: normalizedWalletAddress,
      createdAt: agent.createdAt || now,
      updatedAt: agent.updatedAt || now,
    };
    const [result] = await db.insert(agents).values(data).returning();

    if (!result) {
      throw new Error("Failed to create agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Find all agents
 */
export async function findAll(
  pagingParams?: PagingParams,
): Promise<SelectAgent[]> {
  try {
    if (!pagingParams) {
      return db.select().from(agents);
    }

    let query = db.select().from(agents).$dynamic();

    if (pagingParams.sort) {
      query = getSort(query, pagingParams.sort, agentOrderByFields);
    }

    query = query.limit(pagingParams.limit).offset(pagingParams.offset);

    return query;
  } catch (error) {
    console.error("[AgentRepository] Error in findAll:", error);
    throw error;
  }
}

/**
 * Find all competitions that given agent is, or has, participated in
 * @param agentId the ID of the agent used for lookup
 */
export async function findAgentCompetitions(agentId: string) {
  try {
    return db
      .select()
      .from(competitions)
      .innerJoin(
        competitionAgents,
        eq(competitions.id, competitionAgents.competitionId),
      )
      .where(eq(competitionAgents.agentId, agentId));
  } catch (error) {
    console.error("[AgentRepository] Error in findAgentCompetitions:", error);
    throw error;
  }
}

/**
 * Find agents participating in a specific competition with pagination and sorting
 * @param competitionId Competition ID
 * @param params Query parameters for filtering, sorting, and pagination
 * @returns Object containing agents array and total count
 */
export async function findByCompetition(
  competitionId: string,
  params: CompetitionAgentsParams,
): Promise<{ agents: SelectAgent[]; total: number }> {
  try {
    const { filter, sort, limit, offset } = params;

    // Build where conditions
    const whereConditions = [
      eq(competitionAgents.competitionId, competitionId),
    ];

    if (filter) {
      whereConditions.push(ilike(agents.name, `%${filter}%`));
    }

    // Determine sort order
    let orderBy;
    switch (sort?.toLowerCase()) {
      case "name":
        orderBy = asc(agents.name);
        break;
      case "name_desc":
        orderBy = desc(agents.name);
        break;
      case "created":
        orderBy = asc(agents.createdAt);
        break;
      case "created_desc":
        orderBy = desc(agents.createdAt);
        break;
      case "status":
        orderBy = asc(agents.status);
        break;
      default:
        // Default to name ascending
        orderBy = asc(agents.name);
        break;
    }

    // Query for agents with pagination
    const agentsResult = await db
      .select()
      .from(agents)
      .innerJoin(competitionAgents, eq(agents.id, competitionAgents.agentId))
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Query for total count
    const countResult = await db
      .select({ count: drizzleCount() })
      .from(agents)
      .innerJoin(competitionAgents, eq(agents.id, competitionAgents.agentId))
      .where(and(...whereConditions));

    const total = countResult[0]?.count ?? 0;

    // Extract agent data from the joined result
    const agents_data = agentsResult.map((row) => row.agents);

    return {
      agents: agents_data,
      total,
    };
  } catch (error) {
    console.error("[AgentRepository] Error in findByCompetition:", error);
    throw error;
  }
}

/**
 * Find an agent by ID
 * @param id Agent ID to find
 */
export async function findById(id: string): Promise<SelectAgent | undefined> {
  try {
    const [result] = await db.select().from(agents).where(eq(agents.id, id));
    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in findById:", error);
    throw error;
  }
}

/**
 * Find agents by owner ID
 * @param ownerId Owner ID to search for
 */
export async function findByOwnerId(ownerId: string): Promise<SelectAgent[]> {
  try {
    return await db.select().from(agents).where(eq(agents.ownerId, ownerId));
  } catch (error) {
    console.error("[AgentRepository] Error in findByOwnerId:", error);
    throw error;
  }
}

/**
 * Find an agent by API key
 * @param apiKey The API key to search for
 */
export async function findByApiKey(
  apiKey: string,
): Promise<SelectAgent | undefined> {
  try {
    const [result] = await db
      .select()
      .from(agents)
      .where(eq(agents.apiKey, apiKey));

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in findByApiKey:", error);
    throw error;
  }
}

/**
 * Get agents based on wallet address
 * @param walletAddress the wallet address to filter by
 * @param pagingParams pagination parameters
 */
export async function findByWallet({
  walletAddress,
  pagingParams,
}: {
  walletAddress: string;
  pagingParams: PagingParams;
}): Promise<SelectAgent[]> {
  const normalizedWalletAddress = walletAddress.toLowerCase();
  try {
    let query = db
      .select()
      .from(agents)
      .where(eq(agents.walletAddress, normalizedWalletAddress))
      .$dynamic();

    if (pagingParams.sort) {
      query = getSort(query, pagingParams.sort, agentOrderByFields);
    }

    query = query.limit(pagingParams.limit).offset(pagingParams.offset);

    return await query;
  } catch (error) {
    console.error("[AgentRepository] Error in findByWallet:", error);
    throw error;
  }
}

/**
 * Get agents filtered by name.  The filter input is converted to a where
 *  clause with an ILIKE operator that matches all names that start with the provided filter
 * @param name characters to use in the ilike pattern
 * @param pagingParams pagination parameters
 */
export async function findByName({
  name,
  pagingParams,
}: {
  name: string;
  pagingParams: PagingParams;
}): Promise<SelectAgent[]> {
  try {
    let query = db
      .select()
      .from(agents)
      .where(ilike(agents.name, name + "%"))
      .$dynamic();

    if (pagingParams.sort) {
      query = getSort(query, pagingParams.sort, agentOrderByFields);
    }

    query = query.limit(pagingParams.limit).offset(pagingParams.offset);

    return await query;
  } catch (error) {
    console.error("[AgentRepository] Error in findByName:", error);
    throw error;
  }
}

/**
 * Update an agent
 * @param agent Agent data to update (must include id)
 */
export async function update(
  agent: PartialExcept<InsertAgent, "id">,
): Promise<SelectAgent> {
  try {
    const now = new Date();
    const normalizedWalletAddress = agent.walletAddress?.toLowerCase();
    const data = {
      ...agent,
      walletAddress: normalizedWalletAddress,
      updatedAt: now,
    };
    const [result] = await db
      .update(agents)
      .set(data)
      .where(eq(agents.id, agent.id))
      .returning();

    if (!result) {
      throw new Error("Failed to update agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Delete an agent by ID
 * @param id Agent ID to delete
 * @returns true if agent was deleted, false otherwise
 */
export async function deleteAgent(id: string): Promise<boolean> {
  try {
    const [result] = await db
      .delete(agents)
      .where(eq(agents.id, id))
      .returning();

    return !!result;
  } catch (error) {
    console.error("[AgentRepository] Error in delete:", error);
    throw error;
  }
}

/**
 * Check if an agent exists in a competition
 * @param agentId Agent ID
 * @param competitionId Competition ID
 */
export async function isAgentInCompetition(
  agentId: string,
  competitionId: string,
): Promise<boolean> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.agentId, agentId),
          eq(competitionAgents.competitionId, competitionId),
        ),
      )
      .limit(1);

    return !!result?.count;
  } catch (error) {
    console.error("[AgentRepository] Error in isAgentInCompetition:", error);
    throw error;
  }
}

/**
 * Deactivate an agent with a reason
 * @param agentId Agent ID to deactivate
 * @param reason Reason for deactivation
 */
export async function deactivateAgent(
  agentId: string,
  reason: string,
): Promise<SelectAgent> {
  try {
    const now = new Date();
    const [result] = await db
      .update(agents)
      .set({
        status: "inactive",
        deactivationReason: reason,
        deactivationDate: now,
        updatedAt: now,
      })
      .where(eq(agents.id, agentId))
      .returning();

    if (!result) {
      throw new Error("Failed to deactivate agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in deactivateAgent:", error);
    throw error;
  }
}

/**
 * Reactivate an agent
 * @param agentId Agent ID to reactivate
 */
export async function reactivateAgent(agentId: string): Promise<SelectAgent> {
  try {
    const now = new Date();
    const [result] = await db
      .update(agents)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(agents.id, agentId))
      .returning();

    if (!result) {
      throw new Error("Failed to reactivate agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in reactivateAgent:", error);
    throw error;
  }
}

/**
 * Search for agents by various attributes
 * @param searchParams Object containing search parameters
 * @returns Array of agents matching the search criteria
 */
export async function searchAgents(
  searchParams: AgentSearchParams,
): Promise<SelectAgent[]> {
  try {
    const conditions = [];

    // Add filters for each provided parameter
    if (searchParams.name) {
      conditions.push(ilike(agents.name, `%${searchParams.name}%`));
    }

    if (searchParams.ownerId) {
      conditions.push(eq(agents.ownerId, searchParams.ownerId));
    }

    if (searchParams.walletAddress) {
      const normalizedWalletAddress = searchParams.walletAddress.toLowerCase();
      conditions.push(
        ilike(agents.walletAddress, `%${normalizedWalletAddress}%`),
      );
    }

    if (searchParams.status) {
      conditions.push(eq(agents.status, searchParams.status));
    }

    // If no search parameters were provided, return all agents
    if (conditions.length === 0) {
      return await db.select().from(agents);
    }

    // Combine all conditions with AND operator
    return await db
      .select()
      .from(agents)
      .where(and(...conditions));
  } catch (error) {
    console.error("[AgentRepository] Error in searchAgents:", error);
    throw error;
  }
}

/**
 * Count all agents
 */
export async function count(): Promise<number> {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(agents);
    return result?.count ?? 0;
  } catch (error) {
    console.error("[AgentRepository] Error in count:", error);
    throw error;
  }
}

/**
 * Count agents with a given wallet address
 */
export async function countByWallet(walletAddress: string): Promise<number> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(agents)
      .where(eq(agents.walletAddress, walletAddress));
    return result?.count ?? 0;
  } catch (error) {
    console.error("[AgentRepository] Error in countByWallet:", error);
    throw error;
  }
}

/**
 * Count agents with a given name
 */
export async function countByName(name: string): Promise<number> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(agents)
      .where(ilike(agents.name, name));
    return result?.count ?? 0;
  } catch (error) {
    console.error("[AgentRepository] Error in countByName:", error);
    throw error;
  }
}

/**
 * Find all inactive agents
 */
export async function findInactiveAgents(): Promise<SelectAgent[]> {
  try {
    return await db.select().from(agents).where(eq(agents.status, "suspended"));
  } catch (error) {
    console.error("[AgentRepository] Error in findInactiveAgents:", error);
    throw error;
  }
}
