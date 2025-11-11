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
import { Logger } from "pino";

import {
  agents,
  competitionAgents,
  competitions,
  competitionsLeaderboard,
} from "../schema/core/defs.js";
import {
  InsertAgent,
  SelectAgent,
  SelectAgentWithCompetitionStatus,
} from "../schema/core/types.js";
import { Database, Transaction } from "../types.js";
import { CompetitionRewardsRepository } from "./competition-rewards.js";
import {
  AgentCompetitionsParams,
  AgentSearchParams,
  AgentTrophy,
  PagingParams,
} from "./types/index.js";
import { AgentQueryParams } from "./types/sort/agent.js";
import { getSort } from "./util/query.js";
import { PartialExcept } from "./util/types.js";

/**
 * allowable order by database columns
 */
const agentOrderByFields: Record<string, AnyColumn> = {
  id: agents.id,
  ownerId: agents.ownerId,
  walletAddress: agents.walletAddress,
  name: agents.name,
  handle: agents.handle,
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
  "totalPositions",
  "rank",
  "bestPlacement",
  "agentName",
  "agentHandle",
] as const;

/**
 * Transform raw competition data to AgentTrophy format
 * Shared utility to ensure consistent trophy transformation across service and repository layers
 *
 * @param data Raw trophy data from database query
 * @returns Formatted AgentTrophy object
 */
export function transformToTrophy(data: {
  competitionId: string;
  name: string;
  rank?: number | null;
  imageUrl?: string | null;
  endDate?: Date | null;
  createdAt?: Date | null;
}): AgentTrophy {
  return {
    competitionId: data.competitionId,
    name: data.name,
    rank: data.rank || 0,
    imageUrl: data.imageUrl || "",
    createdAt:
      data.endDate?.toISOString() ||
      data.createdAt?.toISOString() ||
      new Date().toISOString(),
  };
}

/**
 * Agent Repository
 * Handles database operations for agents
 */
export class AgentRepository {
  readonly #db: Database;
  readonly #logger: Logger;
  readonly #competitionRewardsRepository: CompetitionRewardsRepository;

  constructor(
    database: Database,
    logger: Logger,
    competitionRewardsRepo: CompetitionRewardsRepository,
  ) {
    this.#db = database;
    this.#logger = logger;
    this.#competitionRewardsRepository = competitionRewardsRepo;
  }

  /**
   * Create a new agent
   * @param agent Agent to create
   */
  async create(agent: InsertAgent): Promise<SelectAgent> {
    try {
      const now = new Date();
      const normalizedWalletAddress = agent.walletAddress?.toLowerCase();
      const data = {
        ...agent,
        walletAddress: normalizedWalletAddress,
        createdAt: agent.createdAt || now,
        updatedAt: agent.updatedAt || now,
      };
      const [result] = await this.#db.insert(agents).values(data).returning();

      if (!result) {
        throw new Error("Failed to create agent - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in create:", error);
      throw error;
    }
  }

  /**
   * Find all agents
   */
  async findAll(pagingParams?: PagingParams): Promise<SelectAgent[]> {
    try {
      if (!pagingParams) {
        return this.#db.select().from(agents);
      }

      let query = this.#db.select().from(agents).$dynamic();

      if (pagingParams.sort) {
        query = getSort(query, pagingParams.sort, agentOrderByFields);
      }

      query = query.limit(pagingParams.limit).offset(pagingParams.offset);

      return query;
    } catch (error) {
      this.#logger.error("Error in findAll:", error);
      throw error;
    }
  }

  /**
   * Find all competitions that given agent is, or has, participated in
   * @param agentId the ID of the agent used for lookup
   * @param params the filtering, sorting, and paging parameters
   */
  async findAgentCompetitions(
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
        this.#logger.warn(
          "attempting to filter by claimed rewards, but NOT IMPLEMENTED",
        );
      }

      let query = this.#db
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

      // Get total count for pagination (count of competitions, not agents)
      const total = await this.#db
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
      this.#logger.error("Error in findAgentCompetitions:", error);
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
  async findByCompetition(
    competitionId: string,
    params: AgentQueryParams,
    isComputedSort: boolean = false,
  ): Promise<{
    agents: SelectAgentWithCompetitionStatus[];
    total: number;
  }> {
    try {
      const { filter, sort, limit, offset, includeInactive } = params;

      // Build where conditions
      const whereConditions = [
        eq(competitionAgents.competitionId, competitionId),
      ];

      // Filter by status - default to active only, unless includeInactive is true
      if (!includeInactive) {
        whereConditions.push(eq(competitionAgents.status, "active"));
      }

      if (filter) {
        whereConditions.push(ilike(agents.name, `%${filter}%`));
      }

      let query = this.#db
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
      const countResult = await this.#db
        .select({ count: drizzleCount() })
        .from(agents)
        .innerJoin(competitionAgents, eq(agents.id, competitionAgents.agentId))
        .innerJoin(
          competitions,
          eq(competitionAgents.competitionId, competitions.id),
        )
        .where(and(...whereConditions));

      const total = countResult[0]?.count ?? 0;

      // Extract agent data from the joined result and include competition status
      const agentsData = agentsResult.map((row) => ({
        ...row.agents,
        competitionStatus: row.competition_agents.status,
        competitionDeactivationReason:
          row.competition_agents.deactivationReason,
      }));

      return {
        agents: agentsData,
        total,
      };
    } catch (error) {
      this.#logger.error("Error in findByCompetition:", error);
      throw error;
    }
  }

  /**
   * Find an agent by ID
   * @param id Agent ID to find
   */
  async findById(id: string): Promise<SelectAgent | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(agents)
        .where(eq(agents.id, id));
      return result;
    } catch (error) {
      this.#logger.error("[AgentRepository] Error in findById:", error);
      throw error;
    }
  }

  /**
   * Find multiple agents by their IDs
   * @param ids Array of agent IDs to search for
   * @returns Array of agents matching the provided IDs
   */
  async findByIds(ids: string[]): Promise<SelectAgent[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const results = await this.#db
        .select()
        .from(agents)
        .where(inArray(agents.id, ids));

      return results;
    } catch (error) {
      this.#logger.error("[AgentRepository] Error in findByIds:", error);
      throw error;
    }
  }

  /**
   * Find multiple agents by their IDs with shared lock
   * Prevents concurrent updates to agent eligibility during reward distribution
   * @param ids Array of agent IDs to search for
   * @param tx Transaction context (required for locking)
   * @returns Array of agents matching the provided IDs
   */
  async findByIdsWithLock(
    ids: string[],
    tx: Transaction,
  ): Promise<SelectAgent[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const results = await tx
        .select()
        .from(agents)
        .where(inArray(agents.id, ids))
        .for("share");

      return results;
    } catch (error) {
      this.#logger.error(
        "[AgentRepository] Error in findByIdsWithLock:",
        error,
      );
      throw error;
    }
  }

  /**
   * Find agents by owner ID
   * @param ownerId Owner ID to search for
   */
  async findByOwnerId(
    ownerId: string,
    pagingParams: PagingParams,
  ): Promise<SelectAgent[]> {
    try {
      let query = this.#db
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
      this.#logger.error("[AgentRepository] Error in findByOwnerId:", error);
      throw error;
    }
  }

  /**
   * Find an agent by API key hash
   * @param apiKeyHash The API key hash to search for
   */
  async findByApiKeyHash(apiKeyHash: string): Promise<SelectAgent | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(agents)
        .where(eq(agents.apiKeyHash, apiKeyHash));

      return result;
    } catch (error) {
      this.#logger.error("[AgentRepository] Error in findByApiKeyHash:", error);
      throw error;
    }
  }

  /**
   * Get agents based on wallet address
   * @param walletAddress the wallet address to filter by
   * @param pagingParams pagination parameters
   */
  async findByWallet({
    walletAddress,
    pagingParams,
  }: {
    walletAddress: string;
    pagingParams: PagingParams;
  }): Promise<SelectAgent[]> {
    const normalizedWalletAddress = walletAddress.toLowerCase();
    try {
      let query = this.#db
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
      this.#logger.error("[AgentRepository] Error in findByWallet:", error);
      throw error;
    }
  }

  /**
   * Get agents filtered by name.  The filter input is converted to a where
   *  clause with an ILIKE operator that matches all names that start with the provided filter
   * @param name characters to use in the ilike pattern
   * @param pagingParams pagination parameters
   */
  async findByName({
    name,
    pagingParams,
  }: {
    name: string;
    pagingParams: PagingParams;
  }): Promise<SelectAgent[]> {
    try {
      let query = this.#db
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
      this.#logger.error("[AgentRepository] Error in findByName:", error);
      throw error;
    }
  }

  /**
   * Update an agent
   * @param agent Agent data to update (must include id)
   */
  async update(agent: PartialExcept<InsertAgent, "id">): Promise<SelectAgent> {
    try {
      const now = new Date();
      const normalizedWalletAddress = agent.walletAddress?.toLowerCase();
      const data = {
        ...agent,
        walletAddress: normalizedWalletAddress,
        updatedAt: now,
      };
      const [result] = await this.#db
        .update(agents)
        .set(data)
        .where(eq(agents.id, agent.id))
        .returning();

      if (!result) {
        throw new Error("Failed to update agent - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in update:", error);
      throw error;
    }
  }

  /**
   * Delete an agent by ID
   * @param id Agent ID to delete
   * @returns true if agent was deleted, false otherwise
   */
  async deleteAgent(id: string): Promise<boolean> {
    try {
      const [result] = await this.#db
        .delete(agents)
        .where(eq(agents.id, id))
        .returning();

      return !!result;
    } catch (error) {
      this.#logger.error("Error in delete:", error);
      throw error;
    }
  }

  /**
   * Check if an agent exists in a competition
   * @param agentId Agent ID
   * @param competitionId Competition ID
   */
  async isAgentInCompetition(
    agentId: string,
    competitionId: string,
  ): Promise<boolean> {
    try {
      const [result] = await this.#db
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
      this.#logger.error("Error in isAgentInCompetition:", error);
      throw error;
    }
  }

  /**
   * Deactivate an agent with a reason
   * @param agentId Agent ID to deactivate
   * @param reason Reason for deactivation
   */
  async deactivateAgent(agentId: string, reason: string): Promise<SelectAgent> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error("Error in deactivateAgent:", error);
      throw error;
    }
  }

  /**
   * Reactivate an agent
   * @param agentId Agent ID to reactivate
   */
  async reactivateAgent(agentId: string): Promise<SelectAgent> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error("Error in reactivateAgent:", error);
      throw error;
    }
  }

  /**
   * Search for agents by various attributes
   * @param searchParams Object containing search parameters
   * @returns Array of agents matching the search criteria
   */
  async searchAgents(searchParams: AgentSearchParams): Promise<SelectAgent[]> {
    try {
      const conditions = [];

      // Add filters for each provided parameter
      if (searchParams.name) {
        conditions.push(ilike(agents.name, `%${searchParams.name}%`));
      }

      if (searchParams.handle) {
        conditions.push(eq(agents.handle, searchParams.handle));
      }

      if (searchParams.ownerId) {
        conditions.push(eq(agents.ownerId, searchParams.ownerId));
      }

      if (searchParams.walletAddress) {
        const normalizedWalletAddress =
          searchParams.walletAddress.toLowerCase();
        conditions.push(
          ilike(agents.walletAddress, `%${normalizedWalletAddress}%`),
        );
      }

      if (searchParams.status) {
        conditions.push(eq(agents.status, searchParams.status));
      }

      // If no search parameters were provided, return all agents
      if (conditions.length === 0) {
        return await this.#db.select().from(agents);
      }

      // Combine all conditions with AND operator
      return await this.#db
        .select()
        .from(agents)
        .where(and(...conditions));
    } catch (error) {
      this.#logger.error("Error in searchAgents:", error);
      throw error;
    }
  }

  /**
   * Count all agents
   */
  async count(): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(agents);
      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error("Error in count:", error);
      throw error;
    }
  }

  /**
   * Count agents with a given wallet address
   */
  async countByWallet(walletAddress: string): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(agents)
        .where(eq(agents.walletAddress, walletAddress));
      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error("Error in countByWallet:", error);
      throw error;
    }
  }

  /**
   * Count agents with a given name
   */
  async countByName(name: string): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(agents)
        .where(ilike(agents.name, name));
      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error("Error in countByName:", error);
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
  async findUserAgentCompetitions(
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
        this.#logger.warn(
          "attempting to filter by claimed rewards, but NOT IMPLEMENTED",
        );
      }

      // Check if sorting by computed fields
      const isComputedSort =
        sort &&
        COMPUTED_SORT_FIELDS.some(
          (field) => sort.includes(field) || sort.includes(`-${field}`),
        );

      // Step 1: Get unique competition IDs
      let uniqueCompetitionsQuery = this.#db
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

      let fullResultsQuery = this.#db
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

      // Step 3: Fetch rewards for all unique competitions in a single query
      const allCompetitionIds = uniqueCompetitionIds
        .map((c) => c.id)
        .filter(Boolean) as string[];
      const allRewards =
        await this.#competitionRewardsRepository.findRewardsByCompetitions(
          allCompetitionIds,
        );

      // Step 4: Group rewards by competition ID for efficient lookup
      const rewardsByCompetitionId = allRewards.reduce(
        (acc, reward) => {
          if (!acc[reward.competitionId]) {
            acc[reward.competitionId] = [];
          }
          acc[reward.competitionId]!.push(reward);
          return acc;
        },
        {} as Record<string, typeof allRewards>,
      );

      // Step 5: Merge rewards into the final results
      const competitionsWithRewards = fullResults.map((result) => ({
        ...result,
        competitions: {
          ...result.competitions,
          rewards: rewardsByCompetitionId[result.competitions!.id] || [],
        },
      }));

      // Step 6: Count total unique competitions (for pagination metadata)
      const totalCountResult = await this.#db
        .selectDistinct({ id: competitions.id })
        .from(competitionAgents)
        .leftJoin(
          competitions,
          eq(competitionAgents.competitionId, competitions.id),
        )
        .where(and(...whereConditions));

      return {
        competitions: competitionsWithRewards,
        total: totalCountResult.length,
        isComputedSort, // Flag to indicate service layer needs to handle sorting
      };
    } catch (error) {
      this.#logger.error("Error in findUserAgentCompetitionsOptimized:", error);
      throw error;
    }
  }

  /**
   * Get trophies for multiple agents in a single optimized query
   * @param agentIds Array of agent IDs to get trophies for
   * @returns Array of trophies grouped by agentId
   */
  async getBulkAgentTrophies(agentIds: string[]): Promise<
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

      this.#logger.info(`Getting bulk trophies for ${agentIds.length} agents`);

      // Single optimized query to get trophy data for all agents
      const results = await this.#db
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
            eq(competitionAgents.status, "active"), // Only active participations
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

      this.#logger.info(
        `Bulk trophy query retrieved ${results.length} total trophy records for ${agentIds.length} agents`,
      );

      return bulkTrophies;
    } catch (error) {
      this.#logger.error("Error in getBulkAgentTrophies:", error);
      throw error;
    }
  }

  /**
   * Update the agent owner for all of their agents
   * @param userId The userId of the existing owner
   * @param newUserId The userId of the new owner
   * @param tx An optional database transaction to run the operation in
   * @returns The number of rows updated
   */
  async updateAgentsOwner(userId: string, newUserId: string, tx?: Transaction) {
    try {
      const executor = tx || this.#db;
      const res = await executor
        .update(agents)
        .set({ ownerId: newUserId })
        .where(eq(agents.ownerId, userId));
      return res.rowCount || 0;
    } catch (error) {
      this.#logger.error(
        "[AgentRepository] Error in updateAgentsOwner:",
        error,
      );
      throw error;
    }
  }
}
