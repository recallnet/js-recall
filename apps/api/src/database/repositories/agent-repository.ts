import {
  AnyColumn,
  and,
  desc,
  count as drizzleCount,
  eq,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";

import { db } from "@/database/db.js";
import {
  agents,
  competitionAgents,
  competitions,
  competitionsLeaderboard,
} from "@/database/schema/core/defs.js";
import { InsertAgent, SelectAgent } from "@/database/schema/core/types.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { transformToTrophy } from "@/lib/trophy-utils.js";
import {
  AgentCompetitionsParams,
  AgentSearchParams,
  COMPETITION_AGENT_STATUS,
  CompetitionStatus,
  PagingParams,
} from "@/types/index.js";
import { AgentQueryParams } from "@/types/sort/agent.js";

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

const agentCompetitionsOrderByFields: Record<string, AnyColumn> = {
  id: competitions.id,
  name: competitions.name,
  description: competitions.description,
  startDate: competitions.startDate,
  endDate: competitions.endDate,
  createdAt: competitions.createdAt,
  updatedAt: competitions.updatedAt,
  status: competitions.status,
};

// Computed fields that need to be sorted at the service layer
export const COMPUTED_SORT_FIELDS = [
  "portfolioValue",
  "pnl",
  "totalTrades",
  "rank",
  "agentName",
] as const;

/**
 * Create a new agent
 * @param agent Agent to create
 */
async function createImpl(agent: InsertAgent): Promise<SelectAgent> {
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
async function findAllImpl(
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
 * @param params the filtering, sorting, and paging parameters
 */
async function findAgentCompetitionsImpl(
  agentId: string,
  params: AgentCompetitionsParams,
) {
  try {
    const { status, claimed, sort, limit, offset } = params;

    // Build where conditions
    const whereConditions = [eq(competitionAgents.agentId, agentId)];

    if (status) {
      whereConditions.push(eq(competitions.status, status));
    }

    if (claimed) {
      console.log(
        "[AgentRepository] attempting to filter by claimed rewards, but NOT IMPLEMENTED",
      );
    }

    let query = db
      .select()
      .from(competitionAgents)
      .leftJoin(agents, eq(competitionAgents.agentId, agents.id))
      .leftJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(and(...whereConditions))
      .$dynamic();

    // Check if sorting by computed fields (handled at service layer)
    const isComputedSort =
      sort &&
      COMPUTED_SORT_FIELDS.some(
        (field) => sort!.includes(field) || sort!.includes(`-${field}`),
      );

    // Only apply database sorting for non-computed fields
    if (sort && !isComputedSort) {
      query = getSort(query, sort, agentCompetitionsOrderByFields);
    }

    // For computed sorting, we'll need to get all results and sort at service layer
    // So we don't apply limit/offset here if sorting by computed fields
    if (!isComputedSort) {
      query = query.limit(limit).offset(offset);
    }

    const results = await query;
    const total = await db
      .select({ count: drizzleCount() })
      .from(competitionAgents)
      .leftJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(and(...whereConditions));

    return {
      competitions: results.map((data) => data.competitions),
      total: total[0]?.count || 0,
      isComputedSort, // Flag to indicate service layer needs to handle sorting
    };
  } catch (error) {
    console.error("[AgentRepository] Error in findAgentCompetitions:", error);
    throw error;
  }
}

/**
 * Find agents participating in a specific competition with pagination and sorting
 * @param competitionId Competition ID
 * @param params Query parameters for filtering, sorting, and pagination
 * @param isComputedSort Whether computed sorting is handled at the service layer (needs "full" results)
 * @returns Object containing agents array and total count
 */
async function findByCompetitionImpl(
  competitionId: string,
  params: AgentQueryParams,
  isComputedSort: boolean = false,
): Promise<{ agents: SelectAgent[]; total: number }> {
  try {
    const { filter, sort, limit, offset } = params;

    // Build where conditions
    const whereConditions = [
      eq(competitionAgents.competitionId, competitionId),
      eq(competitionAgents.status, COMPETITION_AGENT_STATUS.ACTIVE), // Only show active agents in competition
    ];

    if (filter) {
      whereConditions.push(ilike(agents.name, `%${filter}%`));
    }

    let query = db
      .select()
      .from(agents)
      .innerJoin(competitionAgents, eq(agents.id, competitionAgents.agentId))
      .innerJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(and(...whereConditions))
      .$dynamic();

    // Only apply database sorting for non-computed fields
    if (sort) {
      query = getSort(query, sort, agentOrderByFields);
    }

    // TODO: this is a hack to allow for computed sorting at the service layer. We don't apply
    // limit/offset because the service layer will sort the results in post-query logic.
    // See https://github.com/recallnet/js-recall/issues/620
    if (!isComputedSort) {
      query = query.limit(limit).offset(offset);
    }

    // Query for agents with pagination
    const agentsResult = await query;

    // Query for total count
    const countResult = await db
      .select({ count: drizzleCount() })
      .from(agents)
      .innerJoin(competitionAgents, eq(agents.id, competitionAgents.agentId))
      .innerJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(and(...whereConditions));

    const total = countResult[0]?.count ?? 0;

    // Extract agent data from the joined result
    const agentsData = agentsResult.map((row) => row.agents);

    return {
      agents: agentsData,
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
async function findByIdImpl(id: string): Promise<SelectAgent | undefined> {
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
async function findByOwnerIdImpl(
  ownerId: string,
  pagingParams: PagingParams,
): Promise<SelectAgent[]> {
  try {
    let query = db
      .select()
      .from(agents)
      .where(eq(agents.ownerId, ownerId))
      .$dynamic();

    if (pagingParams.sort) {
      query = getSort(query, pagingParams.sort, agentOrderByFields);
    }

    query = query.limit(pagingParams.limit).offset(pagingParams.offset);

    return query;
  } catch (error) {
    console.error("[AgentRepository] Error in findByOwnerId:", error);
    throw error;
  }
}

/**
 * Find an agent by API key
 * @param apiKey The API key to search for
 */
async function findByApiKeyImpl(
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
async function findByWalletImpl({
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
async function findByNameImpl({
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
async function updateImpl(
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
async function deleteAgentImpl(id: string): Promise<boolean> {
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
async function isAgentInCompetitionImpl(
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
async function deactivateAgentImpl(
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
async function reactivateAgentImpl(agentId: string): Promise<SelectAgent> {
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
async function searchAgentsImpl(
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
async function countImpl(): Promise<number> {
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
async function countByWalletImpl(walletAddress: string): Promise<number> {
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
async function countByNameImpl(name: string): Promise<number> {
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
 * Count competitions for a given agent
 */
async function countAgentCompetitionsForStatusImpl(
  agentId: string,
  status: CompetitionStatus[],
): Promise<number> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(competitionAgents)
      .leftJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(
        and(
          eq(competitionAgents.agentId, agentId),
          inArray(competitions.status, status),
        ),
      );
    return result?.count ?? 0;
  } catch (error) {
    console.error("[AgentRepository] Error in countAgentCompetitions:", error);
    throw error;
  }
}

/**
 * Find all inactive agents
 */
async function findInactiveAgentsImpl(): Promise<SelectAgent[]> {
  try {
    return await db.select().from(agents).where(eq(agents.status, "suspended"));
  } catch (error) {
    console.error("[AgentRepository] Error in findInactiveAgents:", error);
    throw error;
  }
}

/**
 * Find competitions for multiple agents (user's agents) with all sorting handled at database level
 * This replaces the inefficient approach of loading all data into memory for computed sorting
 * @param agentIds Array of agent IDs to find competitions for
 * @param params Query parameters for filtering, sorting, and pagination
 * @returns Object containing competitions array, total count, and computed sort flag
 */
async function findUserAgentCompetitionsImpl(
  agentIds: string[],
  params: AgentCompetitionsParams,
) {
  try {
    if (agentIds.length === 0) {
      return {
        competitions: [],
        total: 0,
      };
    }

    const { status, claimed, sort, limit, offset } = params;

    // Build where conditions for filtering
    const whereConditions = [inArray(competitionAgents.agentId, agentIds)];

    if (status) {
      whereConditions.push(eq(competitions.status, status));
    }

    if (claimed) {
      console.log(
        "[AgentRepository] attempting to filter by claimed rewards, but NOT IMPLEMENTED",
      );
    }

    // Check if sorting by computed fields
    const isComputedSort =
      sort &&
      COMPUTED_SORT_FIELDS.some(
        (field) => sort.includes(field) || sort.includes(`-${field}`),
      );

    // Step 1: Get unique competition IDs
    let uniqueCompetitionsQuery = db
      .selectDistinct({
        id: competitions.id,
        name: competitions.name,
        startDate: competitions.startDate,
        endDate: competitions.endDate,
        createdAt: competitions.createdAt,
        status: competitions.status,
      })
      .from(competitionAgents)
      .leftJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(and(...whereConditions))
      .$dynamic();

    // Only apply database sorting for non-computed fields
    if (sort && !isComputedSort) {
      uniqueCompetitionsQuery = getSort(
        uniqueCompetitionsQuery,
        sort,
        agentCompetitionsOrderByFields,
      );
    }

    // For computed sorting, we need to get all results first, then sort at service layer
    const uniqueCompetitionIds = !isComputedSort
      ? await uniqueCompetitionsQuery.limit(limit).offset(offset)
      : await uniqueCompetitionsQuery;

    // Step 2: Get full data for those specific competition IDs
    const orderedCompetitionIds = uniqueCompetitionIds
      .map((c) => c.id)
      .filter((id) => id !== null);

    if (orderedCompetitionIds.length === 0) {
      return {
        competitions: [],
        total: 0,
      };
    }

    let fullResultsQuery = db
      .select()
      .from(competitionAgents)
      .leftJoin(agents, eq(competitionAgents.agentId, agents.id))
      .leftJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .leftJoin(
        competitionsLeaderboard,
        and(
          eq(competitionsLeaderboard.agentId, agents.id),
          eq(competitionsLeaderboard.competitionId, competitions.id),
        ),
      )
      .where(
        and(
          inArray(competitions.id, orderedCompetitionIds),
          inArray(competitionAgents.agentId, agentIds), // Only user's agents
        ),
      )
      .$dynamic();

    // Always preserve the exact order from Step 1 using CASE statement
    if (orderedCompetitionIds.length > 0) {
      fullResultsQuery = fullResultsQuery.orderBy(
        sql`CASE ${competitions.id} ${sql.join(
          orderedCompetitionIds.map(
            (id, index) => sql`WHEN ${id} THEN ${index}`,
          ),
          sql` `,
        )} END`,
      );
    }

    const fullResults = await fullResultsQuery;

    // Step 3: Count total unique competitions (for pagination metadata)
    const totalCountResult = await db
      .selectDistinct({ id: competitions.id })
      .from(competitionAgents)
      .leftJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(and(...whereConditions));

    return {
      competitions: fullResults,
      total: totalCountResult.length,
      isComputedSort, // Flag to indicate service layer needs to handle sorting
    };
  } catch (error) {
    console.error(
      "[AgentRepository] Error in findUserAgentCompetitionsOptimized:",
      error,
    );
    throw error;
  }
}

/**
 * Get trophies for multiple agents in a single optimized query
 * @param agentIds Array of agent IDs to get trophies for
 * @returns Array of trophies grouped by agentId
 */
async function getBulkAgentTrophiesImpl(agentIds: string[]): Promise<
  {
    agentId: string;
    trophies: Array<{
      competitionId: string;
      name: string;
      rank: number;
      imageUrl: string;
      createdAt: string;
    }>;
  }[]
> {
  try {
    if (agentIds.length === 0) {
      return [];
    }

    console.log(
      `[AgentRepository] Getting bulk trophies for ${agentIds.length} agents`,
    );

    // Single optimized query to get trophy data for all agents
    const results = await db
      .select({
        agentId: competitionAgents.agentId,
        competitionId: competitions.id,
        name: competitions.name,
        imageUrl: competitions.imageUrl,
        endDate: competitions.endDate,
        createdAt: competitions.createdAt,
        rank: competitionsLeaderboard.rank,
      })
      .from(competitions)
      .innerJoin(
        competitionAgents,
        eq(competitions.id, competitionAgents.competitionId),
      )
      .leftJoin(
        competitionsLeaderboard,
        and(
          eq(competitions.id, competitionsLeaderboard.competitionId),
          eq(competitionAgents.agentId, competitionsLeaderboard.agentId),
        ),
      )
      .where(
        and(
          inArray(competitionAgents.agentId, agentIds),
          eq(competitions.status, "ended"), // Only ended competitions award trophies
          eq(competitionAgents.status, COMPETITION_AGENT_STATUS.ACTIVE), // Only active participations
        ),
      )
      .orderBy(desc(competitions.endDate)); // Most recent competitions first

    // Group results by agentId and transform to trophy format
    const trophiesByAgent = new Map<
      string,
      Array<{
        competitionId: string;
        name: string;
        rank: number;
        imageUrl: string;
        createdAt: string;
      }>
    >();

    for (const result of results) {
      if (!trophiesByAgent.has(result.agentId)) {
        trophiesByAgent.set(result.agentId, []);
      }

      trophiesByAgent.get(result.agentId)!.push(
        transformToTrophy({
          competitionId: result.competitionId,
          name: result.name,
          rank: result.rank,
          imageUrl: result.imageUrl,
          endDate: result.endDate,
          createdAt: result.createdAt,
        }),
      );
    }

    // Convert to array format and ensure all agents are represented
    const bulkTrophies = agentIds.map((agentId) => ({
      agentId,
      trophies: trophiesByAgent.get(agentId) || [],
    }));

    console.log(
      `[AgentRepository] Bulk trophy query retrieved ${results.length} total trophy records for ${agentIds.length} agents`,
    );

    return bulkTrophies;
  } catch (error) {
    console.error("[AgentRepository] Error in getBulkAgentTrophies:", error);
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

export const create = createTimedRepositoryFunction(
  createImpl,
  "AgentRepository",
  "create",
);

export const findAll = createTimedRepositoryFunction(
  findAllImpl,
  "AgentRepository",
  "findAll",
);

export const findAgentCompetitions = createTimedRepositoryFunction(
  findAgentCompetitionsImpl,
  "AgentRepository",
  "findAgentCompetitions",
);

export const findByCompetition = createTimedRepositoryFunction(
  findByCompetitionImpl,
  "AgentRepository",
  "findByCompetition",
);

export const findById = createTimedRepositoryFunction(
  findByIdImpl,
  "AgentRepository",
  "findById",
);

export const findByOwnerId = createTimedRepositoryFunction(
  findByOwnerIdImpl,
  "AgentRepository",
  "findByOwnerId",
);

export const findByApiKey = createTimedRepositoryFunction(
  findByApiKeyImpl,
  "AgentRepository",
  "findByApiKey",
);

export const findByWallet = createTimedRepositoryFunction(
  findByWalletImpl,
  "AgentRepository",
  "findByWallet",
);

export const findByName = createTimedRepositoryFunction(
  findByNameImpl,
  "AgentRepository",
  "findByName",
);

export const update = createTimedRepositoryFunction(
  updateImpl,
  "AgentRepository",
  "update",
);

export const deleteAgent = createTimedRepositoryFunction(
  deleteAgentImpl,
  "AgentRepository",
  "deleteAgent",
);

export const isAgentInCompetition = createTimedRepositoryFunction(
  isAgentInCompetitionImpl,
  "AgentRepository",
  "isAgentInCompetition",
);

export const deactivateAgent = createTimedRepositoryFunction(
  deactivateAgentImpl,
  "AgentRepository",
  "deactivateAgent",
);

export const reactivateAgent = createTimedRepositoryFunction(
  reactivateAgentImpl,
  "AgentRepository",
  "reactivateAgent",
);

export const searchAgents = createTimedRepositoryFunction(
  searchAgentsImpl,
  "AgentRepository",
  "searchAgents",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "AgentRepository",
  "count",
);

export const countByWallet = createTimedRepositoryFunction(
  countByWalletImpl,
  "AgentRepository",
  "countByWallet",
);

export const countByName = createTimedRepositoryFunction(
  countByNameImpl,
  "AgentRepository",
  "countByName",
);

export const countAgentCompetitionsForStatus = createTimedRepositoryFunction(
  countAgentCompetitionsForStatusImpl,
  "AgentRepository",
  "countAgentCompetitionsForStatus",
);

export const findInactiveAgents = createTimedRepositoryFunction(
  findInactiveAgentsImpl,
  "AgentRepository",
  "findInactiveAgents",
);

export const findUserAgentCompetitions = createTimedRepositoryFunction(
  findUserAgentCompetitionsImpl,
  "AgentRepository",
  "findUserAgentCompetitions",
);

export const getBulkAgentTrophies = createTimedRepositoryFunction(
  getBulkAgentTrophiesImpl,
  "AgentRepository",
  "getBulkAgentTrophies",
);
