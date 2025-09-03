import { count as drizzleCount, eq, inArray } from "drizzle-orm";

import { liveCompetitionConfig } from "@recallnet/db-schema/trading/defs";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

type InsertLiveCompetitionConfig = typeof liveCompetitionConfig.$inferInsert;
type SelectLiveCompetitionConfig = typeof liveCompetitionConfig.$inferSelect;

/**
 * Create live competition configuration
 * Called when creating a new live trading competition
 */
async function createLiveCompetitionConfigImpl(
  config: Omit<InsertLiveCompetitionConfig, "createdAt">,
): Promise<SelectLiveCompetitionConfig> {
  try {
    const [result] = await db
      .insert(liveCompetitionConfig)
      .values({
        ...config,
        createdAt: new Date(),
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create live competition config");
    }

    repositoryLogger.info(
      `[LiveCompetitionConfigRepository] Created config for competition ${config.competitionId}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in createLiveCompetitionConfig:", error);
    throw error;
  }
}

/**
 * Get live competition configuration by competition ID
 * Primary method used by the indexer and monitoring services
 */
async function getLiveCompetitionConfigImpl(
  competitionId: string,
): Promise<SelectLiveCompetitionConfig | undefined> {
  try {
    const [result] = await db
      .select()
      .from(liveCompetitionConfig)
      .where(eq(liveCompetitionConfig.competitionId, competitionId));

    return result;
  } catch (error) {
    repositoryLogger.error("Error in getLiveCompetitionConfig:", error);
    throw error;
  }
}

/**
 * Update live competition configuration
 * Allows updating supported chains, scan interval, and thresholds
 */
async function updateLiveCompetitionConfigImpl(
  competitionId: string,
  updates: Partial<
    Omit<InsertLiveCompetitionConfig, "competitionId" | "createdAt">
  >,
): Promise<SelectLiveCompetitionConfig> {
  try {
    const [result] = await db
      .update(liveCompetitionConfig)
      .set(updates)
      .where(eq(liveCompetitionConfig.competitionId, competitionId))
      .returning();

    if (!result) {
      throw new Error(`Live competition config for ${competitionId} not found`);
    }

    repositoryLogger.info(
      `[LiveCompetitionConfigRepository] Updated config for competition ${competitionId}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in updateLiveCompetitionConfig:", error);
    throw error;
  }
}

/**
 * Delete live competition configuration
 * Called when a competition is deleted or cancelled
 */
async function deleteLiveCompetitionConfigImpl(
  competitionId: string,
): Promise<void> {
  try {
    await db
      .delete(liveCompetitionConfig)
      .where(eq(liveCompetitionConfig.competitionId, competitionId));

    repositoryLogger.info(
      `[LiveCompetitionConfigRepository] Deleted config for competition ${competitionId}`,
    );
  } catch (error) {
    repositoryLogger.error("Error in deleteLiveCompetitionConfig:", error);
    throw error;
  }
}

/**
 * Get all live competition configurations
 * Useful for admin monitoring and cron job initialization
 */
async function getAllLiveCompetitionConfigsImpl(): Promise<
  SelectLiveCompetitionConfig[]
> {
  try {
    return await db
      .select()
      .from(liveCompetitionConfig)
      .orderBy(liveCompetitionConfig.createdAt);
  } catch (error) {
    repositoryLogger.error("Error in getAllLiveCompetitionConfigs:", error);
    throw error;
  }
}

/**
 * Get live competition configurations with pagination
 * For admin dashboards that need pagination support
 */
async function getLiveCompetitionConfigsPaginatedImpl(
  limit: number,
  offset: number,
): Promise<{
  configs: SelectLiveCompetitionConfig[];
  total: number;
}> {
  try {
    const configsQuery = db
      .select()
      .from(liveCompetitionConfig)
      .orderBy(liveCompetitionConfig.createdAt)
      .limit(limit)
      .offset(offset);

    const totalQuery = db
      .select({ count: drizzleCount() })
      .from(liveCompetitionConfig);

    const [configs, totalResult] = await Promise.all([
      configsQuery,
      totalQuery,
    ]);

    return {
      configs,
      total: totalResult[0]?.count || 0,
    };
  } catch (error) {
    repositoryLogger.error(
      "Error in getLiveCompetitionConfigsPaginated:",
      error,
    );
    throw error;
  }
}

/**
 * Check if a competition has live trading enabled
 * Quick check without loading full config
 */
async function isLiveTradingEnabledImpl(
  competitionId: string,
): Promise<boolean> {
  try {
    const [result] = await db
      .select({ competitionId: liveCompetitionConfig.competitionId })
      .from(liveCompetitionConfig)
      .where(eq(liveCompetitionConfig.competitionId, competitionId));

    return !!result;
  } catch (error) {
    repositoryLogger.error("Error in isLiveTradingEnabled:", error);
    throw error;
  }
}

/**
 * Get live competition configurations for multiple competitions
 * Avoids N+1 queries when checking multiple competitions
 */
async function getBatchLiveCompetitionConfigsImpl(
  competitionIds: string[],
): Promise<SelectLiveCompetitionConfig[]> {
  try {
    if (competitionIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(liveCompetitionConfig)
      .where(inArray(liveCompetitionConfig.competitionId, competitionIds))
      .orderBy(liveCompetitionConfig.createdAt);
  } catch (error) {
    repositoryLogger.error("Error in getBatchLiveCompetitionConfigs:", error);
    throw error;
  }
}

// Export wrapped functions with timing
export const createLiveCompetitionConfig = createTimedRepositoryFunction(
  createLiveCompetitionConfigImpl,
  "LiveCompetitionConfigRepository",
  "createLiveCompetitionConfig",
);

export const getLiveCompetitionConfig = createTimedRepositoryFunction(
  getLiveCompetitionConfigImpl,
  "LiveCompetitionConfigRepository",
  "getLiveCompetitionConfig",
);

export const updateLiveCompetitionConfig = createTimedRepositoryFunction(
  updateLiveCompetitionConfigImpl,
  "LiveCompetitionConfigRepository",
  "updateLiveCompetitionConfig",
);

export const deleteLiveCompetitionConfig = createTimedRepositoryFunction(
  deleteLiveCompetitionConfigImpl,
  "LiveCompetitionConfigRepository",
  "deleteLiveCompetitionConfig",
);

export const getAllLiveCompetitionConfigs = createTimedRepositoryFunction(
  getAllLiveCompetitionConfigsImpl,
  "LiveCompetitionConfigRepository",
  "getAllLiveCompetitionConfigs",
);

export const getLiveCompetitionConfigsPaginated = createTimedRepositoryFunction(
  getLiveCompetitionConfigsPaginatedImpl,
  "LiveCompetitionConfigRepository",
  "getLiveCompetitionConfigsPaginated",
);

export const isLiveTradingEnabled = createTimedRepositoryFunction(
  isLiveTradingEnabledImpl,
  "LiveCompetitionConfigRepository",
  "isLiveTradingEnabled",
);

export const getBatchLiveCompetitionConfigs = createTimedRepositoryFunction(
  getBatchLiveCompetitionConfigsImpl,
  "LiveCompetitionConfigRepository",
  "getBatchLiveCompetitionConfigs",
);
