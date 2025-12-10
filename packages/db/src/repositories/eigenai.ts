import {
  and,
  desc,
  count as drizzleCount,
  eq,
  gte,
  inArray,
  lte,
  max,
  sql,
} from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import {
  agentBadgeStatus,
  signatureSubmissions,
} from "../schema/eigenai/defs.js";
import type {
  InsertAgentBadgeStatus,
  InsertSignatureSubmission,
  SelectAgentBadgeStatus,
  SelectSignatureSubmission,
  VerificationStatus,
} from "../schema/eigenai/types.js";
import { Database, Transaction } from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Paginated result for signature submissions
 */
export interface PaginatedSubmissions {
  submissions: SelectSignatureSubmission[];
  total: number;
}

/**
 * Badge status with agent info for display
 */
export interface BadgeStatusWithAgent {
  agentId: string;
  agentName: string;
  agentImageUrl: string | null;
  isBadgeActive: boolean;
  signaturesLast24h: number;
  lastVerifiedAt: Date | null;
}

/**
 * Competition badge statistics
 */
export interface CompetitionBadgeStats {
  totalAgentsWithSubmissions: number;
  agentsWithActiveBadge: number;
  totalVerifiedSignatures: number;
}

/**
 * Data for batch badge status refresh
 */
export interface BadgeRefreshData {
  agentId: string;
  competitionId: string;
  verifiedCount: number;
  lastVerifiedAt: Date | null;
}

// =============================================================================
// REPOSITORY
// =============================================================================

/**
 * EigenAI Repository
 *
 * Handles database operations for EigenAI verifiable inference badge tracking.
 *
 * Tables managed:
 * - eigenai.signature_submissions: Immutable log of signature submissions
 * - eigenai.agent_badge_status: Computed badge state per agent/competition
 */
export class EigenaiRepository {
  readonly #db: Database;
  readonly #dbRead: Database;
  readonly #logger: Logger;

  constructor(database: Database, readDatabase: Database, logger: Logger) {
    this.#db = database;
    this.#dbRead = readDatabase;
    this.#logger = logger;
  }

  // ===========================================================================
  // SIGNATURE SUBMISSIONS
  // ===========================================================================

  /**
   * Create a signature submission
   * @param submission Signature submission data
   * @param tx Optional transaction
   * @returns Created submission
   */
  async createSignatureSubmission(
    submission: InsertSignatureSubmission,
    tx?: Transaction,
  ): Promise<SelectSignatureSubmission> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(signatureSubmissions)
        .values(submission)
        .returning();

      if (!result) {
        throw new Error("Failed to create signature submission");
      }

      this.#logger.debug(
        `[EigenaiRepository] Created signature submission for agent=${submission.agentId}, competition=${submission.competitionId}, status=${submission.verificationStatus}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in createSignatureSubmission");
      throw error;
    }
  }

  /**
   * Batch create signature submissions
   * @param submissions Array of submissions to create
   * @returns Array of created submissions
   */
  async batchCreateSignatureSubmissions(
    submissions: InsertSignatureSubmission[],
  ): Promise<SelectSignatureSubmission[]> {
    if (submissions.length === 0) {
      return [];
    }

    try {
      const BATCH_SIZE = 500;
      const allResults: SelectSignatureSubmission[] = [];

      for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
        const batch = submissions.slice(i, i + BATCH_SIZE);
        const results = await this.#db
          .insert(signatureSubmissions)
          .values(batch)
          .returning();

        allResults.push(...results);
      }

      this.#logger.debug(
        `[EigenaiRepository] Batch created ${allResults.length} signature submissions in ${Math.ceil(submissions.length / BATCH_SIZE)} batches`,
      );

      return allResults;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchCreateSignatureSubmissions");
      throw error;
    }
  }

  /**
   * Get signature submissions for an agent in a competition with pagination
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param options Pagination and filter options
   * @returns Paginated submissions
   */
  async getAgentSubmissions(
    agentId: string,
    competitionId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: VerificationStatus;
    },
  ): Promise<PaginatedSubmissions> {
    try {
      const conditions = [
        eq(signatureSubmissions.agentId, agentId),
        eq(signatureSubmissions.competitionId, competitionId),
      ];

      if (options?.status) {
        conditions.push(
          eq(signatureSubmissions.verificationStatus, options.status),
        );
      }

      const whereClause = and(...conditions);

      // Build data query
      const dataQuery = this.#dbRead
        .select()
        .from(signatureSubmissions)
        .where(whereClause)
        .orderBy(desc(signatureSubmissions.submittedAt));

      if (options?.limit !== undefined) {
        dataQuery.limit(options.limit);
      }

      if (options?.offset !== undefined) {
        dataQuery.offset(options.offset);
      }

      // Build count query
      const countQuery = this.#dbRead
        .select({ count: drizzleCount() })
        .from(signatureSubmissions)
        .where(whereClause);

      // Execute in parallel
      const [submissions, countResult] = await Promise.all([
        dataQuery,
        countQuery,
      ]);

      return {
        submissions,
        total: countResult[0]?.count ?? 0,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getAgentSubmissions");
      throw error;
    }
  }

  /**
   * Get all submissions for a competition with pagination
   * @param competitionId Competition ID
   * @param options Pagination and filter options
   * @returns Paginated submissions
   */
  async getCompetitionSubmissions(
    competitionId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: VerificationStatus;
    },
  ): Promise<PaginatedSubmissions> {
    try {
      const conditions = [
        eq(signatureSubmissions.competitionId, competitionId),
      ];

      if (options?.status) {
        conditions.push(
          eq(signatureSubmissions.verificationStatus, options.status),
        );
      }

      const whereClause = and(...conditions);

      // Build data query
      const dataQuery = this.#dbRead
        .select()
        .from(signatureSubmissions)
        .where(whereClause)
        .orderBy(desc(signatureSubmissions.submittedAt));

      if (options?.limit !== undefined) {
        dataQuery.limit(options.limit);
      }

      if (options?.offset !== undefined) {
        dataQuery.offset(options.offset);
      }

      // Build count query
      const countQuery = this.#dbRead
        .select({ count: drizzleCount() })
        .from(signatureSubmissions)
        .where(whereClause);

      // Execute in parallel
      const [submissions, countResult] = await Promise.all([
        dataQuery,
        countQuery,
      ]);

      return {
        submissions,
        total: countResult[0]?.count ?? 0,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getCompetitionSubmissions");
      throw error;
    }
  }

  /**
   * Count verified submissions for an agent in a competition since a timestamp
   * Used for badge status calculation
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param since Timestamp to count from
   * @returns Count of verified submissions
   */
  async countVerifiedSubmissionsSince(
    agentId: string,
    competitionId: string,
    since: Date,
  ): Promise<number> {
    try {
      const [result] = await this.#dbRead
        .select({ count: drizzleCount() })
        .from(signatureSubmissions)
        .where(
          and(
            eq(signatureSubmissions.agentId, agentId),
            eq(signatureSubmissions.competitionId, competitionId),
            eq(signatureSubmissions.verificationStatus, "verified"),
            gte(signatureSubmissions.submittedAt, since),
          ),
        );

      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in countVerifiedSubmissionsSince");
      throw error;
    }
  }

  /**
   * Get badge refresh data for a competition
   * Counts verified signatures in the time window per agent and gets last verified timestamp
   * Used by the badge refresh cron job
   * @param competitionId Competition ID
   * @param since Window start (typically referenceDate - 24h)
   * @param until Window end (defaults to unbounded; use competition endDate for ended competitions)
   * @returns Array of badge refresh data per agent
   */
  async getBadgeRefreshData(
    competitionId: string,
    since: Date,
    until?: Date,
  ): Promise<BadgeRefreshData[]> {
    try {
      // Build base conditions for the time window
      const windowConditions = [
        eq(signatureSubmissions.competitionId, competitionId),
        eq(signatureSubmissions.verificationStatus, "verified"),
        gte(signatureSubmissions.submittedAt, since),
      ];

      // Add upper bound if provided (for ended competitions)
      if (until) {
        windowConditions.push(lte(signatureSubmissions.submittedAt, until));
      }

      // Query 1: Count verified submissions in the time window per agent
      const verifiedCounts = await this.#dbRead
        .select({
          agentId: signatureSubmissions.agentId,
          verifiedCount: drizzleCount(signatureSubmissions.id),
        })
        .from(signatureSubmissions)
        .where(and(...windowConditions))
        .groupBy(signatureSubmissions.agentId);

      // Build conditions for lastVerifiedAt (bounded by until if provided)
      const lastVerifiedConditions = [
        eq(signatureSubmissions.competitionId, competitionId),
        eq(signatureSubmissions.verificationStatus, "verified"),
      ];

      if (until) {
        lastVerifiedConditions.push(
          lte(signatureSubmissions.submittedAt, until),
        );
      }

      // Query 2: Get the most recent verified submission per agent (within bounds)
      const lastVerifiedDates = await this.#dbRead
        .select({
          agentId: signatureSubmissions.agentId,
          lastVerifiedAt: max(signatureSubmissions.submittedAt),
        })
        .from(signatureSubmissions)
        .where(and(...lastVerifiedConditions))
        .groupBy(signatureSubmissions.agentId);

      // Build conditions for all agents (bounded by until if provided)
      const allAgentsConditions = [
        eq(signatureSubmissions.competitionId, competitionId),
      ];

      if (until) {
        allAgentsConditions.push(lte(signatureSubmissions.submittedAt, until));
      }

      // Query 3: Get all agents with any submissions in this competition (within bounds)
      const allAgents = await this.#dbRead
        .selectDistinct({
          agentId: signatureSubmissions.agentId,
        })
        .from(signatureSubmissions)
        .where(and(...allAgentsConditions));

      // Build lookup maps
      const countMap = new Map<string, number>();
      for (const row of verifiedCounts) {
        countMap.set(row.agentId, row.verifiedCount);
      }

      const lastVerifiedMap = new Map<string, Date | null>();
      for (const row of lastVerifiedDates) {
        lastVerifiedMap.set(row.agentId, row.lastVerifiedAt);
      }

      // Combine results for all agents
      const results: BadgeRefreshData[] = allAgents.map((row) => ({
        agentId: row.agentId,
        competitionId,
        verifiedCount: countMap.get(row.agentId) ?? 0,
        lastVerifiedAt: lastVerifiedMap.get(row.agentId) ?? null,
      }));

      this.#logger.debug(
        `[EigenaiRepository] Retrieved badge refresh data for ${results.length} agents in competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in getBadgeRefreshData");
      throw error;
    }
  }

  // ===========================================================================
  // BADGE STATUS
  // ===========================================================================

  /**
   * Get badge status for an agent in a competition
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Badge status or null if not found
   */
  async getBadgeStatus(
    agentId: string,
    competitionId: string,
  ): Promise<SelectAgentBadgeStatus | null> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(agentBadgeStatus)
        .where(
          and(
            eq(agentBadgeStatus.agentId, agentId),
            eq(agentBadgeStatus.competitionId, competitionId),
          ),
        )
        .limit(1);

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getBadgeStatus");
      throw error;
    }
  }

  /**
   * Upsert badge status for an agent in a competition
   * Creates if not exists, updates if exists
   * @param status Badge status data
   * @param tx Optional transaction
   * @returns Created or updated badge status
   */
  async upsertBadgeStatus(
    status: InsertAgentBadgeStatus,
    tx?: Transaction,
  ): Promise<SelectAgentBadgeStatus> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(agentBadgeStatus)
        .values(status)
        .onConflictDoUpdate({
          target: [agentBadgeStatus.agentId, agentBadgeStatus.competitionId],
          set: {
            isBadgeActive: status.isBadgeActive,
            signaturesLast24h: status.signaturesLast24h,
            lastVerifiedAt: status.lastVerifiedAt,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to upsert badge status");
      }

      this.#logger.debug(
        `[EigenaiRepository] Upserted badge status for agent=${status.agentId}, competition=${status.competitionId}, active=${status.isBadgeActive}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in upsertBadgeStatus");
      throw error;
    }
  }

  /**
   * Batch upsert badge statuses for a competition
   * Used by badge refresh cron job
   * @param statuses Array of badge status data
   * @returns Array of upserted badge statuses
   */
  async batchUpsertBadgeStatuses(
    statuses: InsertAgentBadgeStatus[],
  ): Promise<SelectAgentBadgeStatus[]> {
    if (statuses.length === 0) {
      return [];
    }

    try {
      // Process in controlled batches to avoid database contention
      const BATCH_SIZE = 100;
      const allResults: SelectAgentBadgeStatus[] = [];

      for (let i = 0; i < statuses.length; i += BATCH_SIZE) {
        const batch = statuses.slice(i, i + BATCH_SIZE);

        // Build a single batch upsert query
        const results = await this.#db
          .insert(agentBadgeStatus)
          .values(batch)
          .onConflictDoUpdate({
            target: [agentBadgeStatus.agentId, agentBadgeStatus.competitionId],
            set: {
              isBadgeActive: sql`excluded.is_badge_active`,
              signaturesLast24h: sql`excluded.signatures_last_24h`,
              lastVerifiedAt: sql`excluded.last_verified_at`,
              updatedAt: new Date(),
            },
          })
          .returning();

        allResults.push(...results);
      }

      this.#logger.info(
        `[EigenaiRepository] Batch upserted ${allResults.length} badge statuses in ${Math.ceil(statuses.length / BATCH_SIZE)} batches`,
      );

      return allResults;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchUpsertBadgeStatuses");
      throw error;
    }
  }

  /**
   * Get active badges for a competition with agent info
   * Used for leaderboard badge display
   * @param competitionId Competition ID
   * @param options Pagination options
   * @returns Array of badge statuses with agent info
   */
  async getActiveBadgesForCompetition(
    competitionId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<BadgeStatusWithAgent[]> {
    try {
      const query = this.#dbRead
        .select({
          agentId: agentBadgeStatus.agentId,
          agentName: agents.name,
          agentImageUrl: agents.imageUrl,
          isBadgeActive: agentBadgeStatus.isBadgeActive,
          signaturesLast24h: agentBadgeStatus.signaturesLast24h,
          lastVerifiedAt: agentBadgeStatus.lastVerifiedAt,
        })
        .from(agentBadgeStatus)
        .innerJoin(agents, eq(agentBadgeStatus.agentId, agents.id))
        .where(
          and(
            eq(agentBadgeStatus.competitionId, competitionId),
            eq(agentBadgeStatus.isBadgeActive, true),
          ),
        )
        .orderBy(desc(agentBadgeStatus.signaturesLast24h));

      if (options?.limit !== undefined) {
        query.limit(options.limit);
      }

      if (options?.offset !== undefined) {
        query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      this.#logger.error({ error }, "Error in getActiveBadgesForCompetition");
      throw error;
    }
  }

  /**
   * Get all badge statuses for a competition
   * Used for frontend to determine if any agent has a badge and display accordingly
   * @param competitionId Competition ID
   * @returns Array of all badge statuses for the competition
   */
  async getAllBadgeStatusesForCompetition(
    competitionId: string,
  ): Promise<SelectAgentBadgeStatus[]> {
    try {
      const results = await this.#dbRead
        .select()
        .from(agentBadgeStatus)
        .where(eq(agentBadgeStatus.competitionId, competitionId));

      this.#logger.debug(
        `[EigenaiRepository] Retrieved ${results.length} badge statuses for competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in getAllBadgeStatusesForCompetition",
      );
      throw error;
    }
  }

  /**
   * Get all badge statuses for an agent across all competitions
   * Used for agent profile page to show badges in competitions table
   * @param agentId Agent ID
   * @returns Array of all badge statuses for the agent
   */
  async getBadgeStatusesForAgent(
    agentId: string,
  ): Promise<SelectAgentBadgeStatus[]> {
    try {
      const results = await this.#dbRead
        .select()
        .from(agentBadgeStatus)
        .where(eq(agentBadgeStatus.agentId, agentId));

      this.#logger.debug(
        `[EigenaiRepository] Retrieved ${results.length} badge statuses for agent ${agentId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in getBadgeStatusesForAgent");
      throw error;
    }
  }

  /**
   * Get badge statuses for multiple agents in a competition
   * Used for bulk enrichment of agent data
   * @param agentIds Array of agent IDs
   * @param competitionId Competition ID
   * @returns Map of agent ID to badge status
   */
  async getBulkAgentBadgeStatuses(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, SelectAgentBadgeStatus>> {
    if (agentIds.length === 0) {
      return new Map();
    }

    try {
      const BATCH_SIZE = 500;
      const allResults: SelectAgentBadgeStatus[] = [];

      for (let i = 0; i < agentIds.length; i += BATCH_SIZE) {
        const batchIds = agentIds.slice(i, i + BATCH_SIZE);

        const results = await this.#dbRead
          .select()
          .from(agentBadgeStatus)
          .where(
            and(
              inArray(agentBadgeStatus.agentId, batchIds),
              eq(agentBadgeStatus.competitionId, competitionId),
            ),
          );

        allResults.push(...results);
      }

      // Build map
      const statusMap = new Map<string, SelectAgentBadgeStatus>();
      for (const status of allResults) {
        statusMap.set(status.agentId, status);
      }

      this.#logger.debug(
        `[EigenaiRepository] Bulk fetched badge statuses for ${statusMap.size}/${agentIds.length} agents`,
      );

      return statusMap;
    } catch (error) {
      this.#logger.error({ error }, "Error in getBulkAgentBadgeStatuses");
      throw error;
    }
  }

  /**
   * Get badge statistics for a competition
   * @param competitionId Competition ID
   * @returns Competition badge statistics
   */
  async getCompetitionBadgeStats(
    competitionId: string,
  ): Promise<CompetitionBadgeStats> {
    try {
      // Query count of distinct agents with ANY submissions (verified or not)
      const [agentCountResult] = await this.#dbRead
        .select({
          count:
            sql<number>`COUNT(DISTINCT ${signatureSubmissions.agentId})::int`.as(
              "count",
            ),
        })
        .from(signatureSubmissions)
        .where(eq(signatureSubmissions.competitionId, competitionId));

      // Query agents with active badges
      const [badgeStats] = await this.#dbRead
        .select({
          agentsWithActiveBadge: drizzleCount(),
        })
        .from(agentBadgeStatus)
        .where(
          and(
            eq(agentBadgeStatus.competitionId, competitionId),
            eq(agentBadgeStatus.isBadgeActive, true),
          ),
        );

      // Query total verified signatures
      const [signatureStats] = await this.#dbRead
        .select({
          totalVerified: drizzleCount(),
        })
        .from(signatureSubmissions)
        .where(
          and(
            eq(signatureSubmissions.competitionId, competitionId),
            eq(signatureSubmissions.verificationStatus, "verified"),
          ),
        );

      return {
        totalAgentsWithSubmissions: agentCountResult?.count ?? 0,
        agentsWithActiveBadge: badgeStats?.agentsWithActiveBadge ?? 0,
        totalVerifiedSignatures: signatureStats?.totalVerified ?? 0,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getCompetitionBadgeStats");
      throw error;
    }
  }

  /**
   * Check if an agent has a specific badge active in a competition
   * Convenience method for quick badge checks
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns true if badge is active
   */
  async isAgentBadgeActive(
    agentId: string,
    competitionId: string,
  ): Promise<boolean> {
    try {
      const [result] = await this.#dbRead
        .select({ isBadgeActive: agentBadgeStatus.isBadgeActive })
        .from(agentBadgeStatus)
        .where(
          and(
            eq(agentBadgeStatus.agentId, agentId),
            eq(agentBadgeStatus.competitionId, competitionId),
          ),
        )
        .limit(1);

      return result?.isBadgeActive ?? false;
    } catch (error) {
      this.#logger.error({ error }, "Error in isAgentBadgeActive");
      throw error;
    }
  }
}
