import { desc, count as drizzleCount, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { indexerSyncProgress } from "@/database/schema/trading/defs.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

type IndexerSyncProgress = typeof indexerSyncProgress.$inferSelect;

/**
 * Get the sync progress for a specific competition.
 */
async function getLastSyncImpl(
  competitionId: string,
): Promise<IndexerSyncProgress | null> {
  try {
    const [result] = await db
      .select()
      .from(indexerSyncProgress)
      .where(eq(indexerSyncProgress.competitionId, competitionId))
      .limit(1);

    return result || null;
  } catch (error) {
    repositoryLogger.error("Error in getLastSync:", error);
    throw error;
  }
}

/**
 * Update or create sync progress for a competition.
 * Uses upsert pattern to handle both insert and update cases.
 */
async function updateSyncProgressImpl(
  competitionId: string,
  lastSyncedTimestamp: bigint,
): Promise<IndexerSyncProgress> {
  try {
    const id = uuidv4();
    const now = new Date();

    const [result] = await db
      .insert(indexerSyncProgress)
      .values({
        id,
        competitionId,
        lastSyncedTimestamp: Number(lastSyncedTimestamp),
        lastSyncTime: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: indexerSyncProgress.competitionId,
        set: {
          lastSyncedTimestamp: sql`excluded.last_synced_timestamp`,
          lastSyncTime: sql`excluded.last_sync_time`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning();

    if (!result) {
      throw new Error("Failed to update sync progress");
    }

    repositoryLogger.info(
      `[IndexerSyncProgressRepository] Updated sync progress for competition ${competitionId}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in updateSyncProgress:", error);
    throw error;
  }
}

/**
 * Get all sync progress records (useful for monitoring).
 * Returns all records without pagination - use getAllSyncProgressPaginated for large datasets.
 */
async function getAllSyncProgressImpl(): Promise<IndexerSyncProgress[]> {
  try {
    return await db
      .select()
      .from(indexerSyncProgress)
      .orderBy(desc(indexerSyncProgress.lastSyncTime));
  } catch (error) {
    repositoryLogger.error("Error in getAllSyncProgress:", error);
    throw error;
  }
}

/**
 * Delete sync progress for a competition (useful for cleanup or reset).
 */
async function deleteSyncProgressImpl(competitionId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(indexerSyncProgress)
      .where(eq(indexerSyncProgress.competitionId, competitionId));

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    repositoryLogger.error("Error in deleteSyncProgress:", error);
    throw error;
  }
}

/**
 * Check if a competition has been synced before.
 */
async function hasBeenSyncedImpl(competitionId: string): Promise<boolean> {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(indexerSyncProgress)
      .where(eq(indexerSyncProgress.competitionId, competitionId));

    return (result?.count ?? 0) > 0;
  } catch (error) {
    repositoryLogger.error("Error in hasBeenSynced:", error);
    throw error;
  }
}

/**
 * Get competitions that haven't been synced recently.
 * Useful for identifying stale or stuck sync jobs.
 */
async function getStaleSyncProgressImpl(
  staleThresholdMinutes: number = 10,
): Promise<IndexerSyncProgress[]> {
  try {
    const staleTime = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

    return await db
      .select()
      .from(indexerSyncProgress)
      .where(sql`${indexerSyncProgress.lastSyncTime} < ${staleTime}`)
      .orderBy(indexerSyncProgress.lastSyncTime);
  } catch (error) {
    repositoryLogger.error("Error in getStaleSyncProgress:", error);
    throw error;
  }
}

/**
 * Get sync progress for multiple competitions (avoids N+1 queries).
 * Useful when checking sync status for multiple competitions at once.
 */
async function getBatchSyncProgressImpl(
  competitionIds: string[],
): Promise<IndexerSyncProgress[]> {
  try {
    if (competitionIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(indexerSyncProgress)
      .where(inArray(indexerSyncProgress.competitionId, competitionIds))
      .orderBy(indexerSyncProgress.competitionId);
  } catch (error) {
    repositoryLogger.error("Error in getBatchSyncProgress:", error);
    throw error;
  }
}

/**
 * Batch update sync progress for multiple competitions.
 * Critical for performance when syncing multiple competitions.
 */
async function batchUpdateSyncProgressImpl(
  updates: Array<{
    competitionId: string;
    lastSyncedTimestamp: bigint;
  }>,
): Promise<IndexerSyncProgress[]> {
  try {
    if (updates.length === 0) {
      return [];
    }

    const now = new Date();

    // Use transaction for atomicity
    const results = await db.transaction(async (tx) => {
      const values = updates.map((update) => ({
        id: uuidv4(),
        competitionId: update.competitionId,
        lastSyncedTimestamp: Number(update.lastSyncedTimestamp),
        lastSyncTime: now,
        createdAt: now,
        updatedAt: now,
      }));

      return await tx
        .insert(indexerSyncProgress)
        .values(values)
        .onConflictDoUpdate({
          target: indexerSyncProgress.competitionId,
          set: {
            lastSyncedTimestamp: sql`excluded.last_synced_timestamp`,
            lastSyncTime: sql`excluded.last_sync_time`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning();
    });

    repositoryLogger.info(
      `[IndexerSyncProgressRepository] Batch updated ${results.length} sync progress records`,
    );

    return results;
  } catch (error) {
    repositoryLogger.error("Error in batchUpdateSyncProgress:", error);
    throw error;
  }
}

/**
 * Get sync progress for competitions that need syncing.
 * This can be used with active competition IDs to determine which ones need updating.
 */
async function getSyncProgressForCompetitionsImpl(
  competitionIds: string[],
  staleThresholdMinutes?: number,
): Promise<
  Array<{
    competitionId: string;
    lastSyncedTimestamp: number;
    lastSyncTime: Date;
    isStale: boolean;
  }>
> {
  try {
    if (competitionIds.length === 0) {
      return [];
    }

    const staleTime = staleThresholdMinutes
      ? new Date(Date.now() - staleThresholdMinutes * 60 * 1000)
      : null;

    const results = await db
      .select()
      .from(indexerSyncProgress)
      .where(inArray(indexerSyncProgress.competitionId, competitionIds));

    // Map results and add isStale flag
    const mappedResults = results.map((result) => ({
      competitionId: result.competitionId,
      lastSyncedTimestamp: result.lastSyncedTimestamp,
      lastSyncTime: result.lastSyncTime,
      isStale: staleTime ? result.lastSyncTime < staleTime : false,
    }));

    // Include competitions that have never been synced
    const syncedCompetitionIds = new Set(results.map((r) => r.competitionId));
    const neverSyncedCompetitions = competitionIds
      .filter((id) => !syncedCompetitionIds.has(id))
      .map((competitionId) => ({
        competitionId,
        lastSyncedTimestamp: 0,
        lastSyncTime: new Date(0), // epoch
        isStale: true,
      }));

    return [...mappedResults, ...neverSyncedCompetitions];
  } catch (error) {
    repositoryLogger.error("Error in getSyncProgressForCompetitions:", error);
    throw error;
  }
}

/**
 * Get all sync progress records with pagination support.
 * Useful for admin dashboards and monitoring pages.
 */
async function getAllSyncProgressPaginatedImpl(
  params: {
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  syncProgress: IndexerSyncProgress[];
  total: number;
}> {
  try {
    const { limit = 50, offset = 0 } = params;

    const syncProgressQuery = db
      .select()
      .from(indexerSyncProgress)
      .orderBy(desc(indexerSyncProgress.lastSyncTime))
      .limit(limit)
      .offset(offset);

    const totalQuery = db
      .select({ count: drizzleCount() })
      .from(indexerSyncProgress);

    const [syncProgress, totalResult] = await Promise.all([
      syncProgressQuery,
      totalQuery,
    ]);

    return {
      syncProgress,
      total: totalResult[0]?.count || 0,
    };
  } catch (error) {
    repositoryLogger.error("Error in getAllSyncProgressPaginated:", error);
    throw error;
  }
}

// Export wrapped functions with timing
export const getLastSync = createTimedRepositoryFunction(
  getLastSyncImpl,
  "IndexerSyncProgressRepository",
  "getLastSync",
);

export const updateSyncProgress = createTimedRepositoryFunction(
  updateSyncProgressImpl,
  "IndexerSyncProgressRepository",
  "updateSyncProgress",
);

export const getAllSyncProgress = createTimedRepositoryFunction(
  getAllSyncProgressImpl,
  "IndexerSyncProgressRepository",
  "getAllSyncProgress",
);

export const deleteSyncProgress = createTimedRepositoryFunction(
  deleteSyncProgressImpl,
  "IndexerSyncProgressRepository",
  "deleteSyncProgress",
);

export const hasBeenSynced = createTimedRepositoryFunction(
  hasBeenSyncedImpl,
  "IndexerSyncProgressRepository",
  "hasBeenSynced",
);

export const getStaleSyncProgress = createTimedRepositoryFunction(
  getStaleSyncProgressImpl,
  "IndexerSyncProgressRepository",
  "getStaleSyncProgress",
);

export const getBatchSyncProgress = createTimedRepositoryFunction(
  getBatchSyncProgressImpl,
  "IndexerSyncProgressRepository",
  "getBatchSyncProgress",
);

export const batchUpdateSyncProgress = createTimedRepositoryFunction(
  batchUpdateSyncProgressImpl,
  "IndexerSyncProgressRepository",
  "batchUpdateSyncProgress",
);

export const getAllSyncProgressPaginated = createTimedRepositoryFunction(
  getAllSyncProgressPaginatedImpl,
  "IndexerSyncProgressRepository",
  "getAllSyncProgressPaginated",
);

export const getSyncProgressForCompetitions = createTimedRepositoryFunction(
  getSyncProgressForCompetitionsImpl,
  "IndexerSyncProgressRepository",
  "getSyncProgressForCompetitions",
);
