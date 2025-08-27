import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import {
  liveTradingChains,
  scanProgress,
} from "@/database/schema/trading/defs.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

type InsertScanProgress = typeof scanProgress.$inferInsert;
type SelectScanProgress = typeof scanProgress.$inferSelect;
type LiveTradingChain = (typeof liveTradingChains.enumValues)[number];

/**
 * Get scan progress for a specific agent/competition/chain combination
 */
async function getScanProgressImpl(
  agentId: string,
  competitionId: string,
  chain: LiveTradingChain,
): Promise<SelectScanProgress | undefined> {
  try {
    const [result] = await db
      .select()
      .from(scanProgress)
      .where(
        and(
          eq(scanProgress.agentId, agentId),
          eq(scanProgress.competitionId, competitionId),
          eq(scanProgress.chain, chain),
        ),
      );
    return result;
  } catch (error) {
    repositoryLogger.error("Error in getScanProgress:", error);
    throw error;
  }
}

/**
 * Get all scan progress for a competition
 * Useful for monitoring overall scanning status
 */
async function getScanProgressByCompetitionImpl(
  competitionId: string,
): Promise<SelectScanProgress[]> {
  try {
    return await db
      .select()
      .from(scanProgress)
      .where(eq(scanProgress.competitionId, competitionId))
      .orderBy(scanProgress.agentId, scanProgress.chain);
  } catch (error) {
    repositoryLogger.error("Error in getScanProgressByCompetition:", error);
    throw error;
  }
}

/**
 * Get all scan progress for multiple agents in a competition
 * Avoids N+1 queries when processing multiple agents
 */
async function getBatchScanProgressImpl(
  agentIds: string[],
  competitionId: string,
): Promise<SelectScanProgress[]> {
  try {
    if (agentIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(scanProgress)
      .where(
        and(
          inArray(scanProgress.agentId, agentIds),
          eq(scanProgress.competitionId, competitionId),
        ),
      );
  } catch (error) {
    repositoryLogger.error("Error in getBatchScanProgress:", error);
    throw error;
  }
}

/**
 * Upsert scan progress - create if doesn't exist, update if it does
 * This is the primary method for updating scan progress after processing blocks
 */
async function upsertScanProgressImpl(
  progress: Omit<InsertScanProgress, "id" | "createdAt" | "updatedAt">,
): Promise<SelectScanProgress> {
  try {
    const now = new Date();
    const [result] = await db
      .insert(scanProgress)
      .values({
        id: uuidv4(),
        ...progress,
        lastScanTime: progress.lastScanTime || now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          scanProgress.agentId,
          scanProgress.competitionId,
          scanProgress.chain,
        ],
        set: {
          lastScannedBlock: sql`excluded.last_scanned_block`,
          lastScanTime: sql`excluded.last_scan_time`,
          updatedAt: now,
        },
      })
      .returning();

    if (!result) {
      throw new Error("Failed to upsert scan progress");
    }

    return result;
  } catch (error) {
    repositoryLogger.error("Error in upsertScanProgress:", error);
    throw error;
  }
}

/**
 * Batch upsert scan progress for multiple agent/chain combinations
 * Critical for performance when updating progress for many agents at once
 */
async function batchUpsertScanProgressImpl(
  progressArray: Array<
    Omit<InsertScanProgress, "id" | "createdAt" | "updatedAt">
  >,
): Promise<SelectScanProgress[]> {
  try {
    if (progressArray.length === 0) {
      return [];
    }

    return await db.transaction(async (tx) => {
      const now = new Date();
      const values = progressArray.map((progress) => ({
        id: uuidv4(),
        ...progress,
        lastScanTime: progress.lastScanTime || now,
        createdAt: now,
        updatedAt: now,
      }));

      return await tx
        .insert(scanProgress)
        .values(values)
        .onConflictDoUpdate({
          target: [
            scanProgress.agentId,
            scanProgress.competitionId,
            scanProgress.chain,
          ],
          set: {
            lastScannedBlock: sql`excluded.last_scanned_block`,
            lastScanTime: sql`excluded.last_scan_time`,
            updatedAt: now,
          },
        })
        .returning();
    });
  } catch (error) {
    repositoryLogger.error("Error in batchUpsertScanProgress:", error);
    throw error;
  }
}

/**
 * Delete all scan progress for a competition
 * Useful for cleanup or restarting scanning
 */
async function deleteScanProgressByCompetitionImpl(
  competitionId: string,
): Promise<void> {
  try {
    await db
      .delete(scanProgress)
      .where(eq(scanProgress.competitionId, competitionId));
  } catch (error) {
    repositoryLogger.error("Error in deleteScanProgressByCompetition:", error);
    throw error;
  }
}

// Export wrapped functions with timing
export const getScanProgress = createTimedRepositoryFunction(
  getScanProgressImpl,
  "ScanProgressRepository",
  "getScanProgress",
);

export const getScanProgressByCompetition = createTimedRepositoryFunction(
  getScanProgressByCompetitionImpl,
  "ScanProgressRepository",
  "getScanProgressByCompetition",
);

export const getBatchScanProgress = createTimedRepositoryFunction(
  getBatchScanProgressImpl,
  "ScanProgressRepository",
  "getBatchScanProgress",
);

export const upsertScanProgress = createTimedRepositoryFunction(
  upsertScanProgressImpl,
  "ScanProgressRepository",
  "upsertScanProgress",
);

export const batchUpsertScanProgress = createTimedRepositoryFunction(
  batchUpsertScanProgressImpl,
  "ScanProgressRepository",
  "batchUpsertScanProgress",
);

export const deleteScanProgressByCompetition = createTimedRepositoryFunction(
  deleteScanProgressByCompetitionImpl,
  "ScanProgressRepository",
  "deleteScanProgressByCompetition",
);
