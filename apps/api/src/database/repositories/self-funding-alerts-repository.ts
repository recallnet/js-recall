import { and, desc, count as drizzleCount, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { selfFundingAlerts } from "@recallnet/db-schema/trading/defs";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

type InsertSelfFundingAlert = typeof selfFundingAlerts.$inferInsert;
type SelectSelfFundingAlert = typeof selfFundingAlerts.$inferSelect;

/**
 * Create a new self-funding alert
 */
async function createSelfFundingAlertImpl(
  alert: Omit<
    InsertSelfFundingAlert,
    "id" | "detectedAt" | "reviewed" | "reviewNote"
  >,
): Promise<SelectSelfFundingAlert> {
  try {
    const [result] = await db
      .insert(selfFundingAlerts)
      .values({
        id: uuidv4(),
        ...alert,
        detectedAt: new Date(),
        reviewed: false,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create self-funding alert");
    }

    repositoryLogger.info(
      `[SelfFundingAlertsRepository] Created alert for agent ${alert.agentId} - ${alert.tokenAddress} increase of ${alert.valueUsd} USD`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in createSelfFundingAlert:", error);
    throw error;
  }
}

/**
 * Batch create self-funding alerts for performance
 */
async function batchCreateSelfFundingAlertsImpl(
  alerts: Array<
    Omit<
      InsertSelfFundingAlert,
      "id" | "detectedAt" | "reviewed" | "reviewNote"
    >
  >,
): Promise<SelectSelfFundingAlert[]> {
  try {
    if (alerts.length === 0) {
      return [];
    }

    return await db.transaction(async (tx) => {
      const now = new Date();
      const values = alerts.map((alert) => ({
        id: uuidv4(),
        ...alert,
        detectedAt: now,
        reviewed: false,
      }));

      const results = await tx
        .insert(selfFundingAlerts)
        .values(values)
        .returning();

      repositoryLogger.info(
        `[SelfFundingAlertsRepository] Created ${results.length} alerts in batch`,
      );

      return results;
    });
  } catch (error) {
    repositoryLogger.error("Error in batchCreateSelfFundingAlerts:", error);
    throw error;
  }
}

/**
 * Get all unreviewed alerts for a competition
 * Used for the monitoring dashboard
 */
async function getUnreviewedAlertsImpl(
  competitionId: string,
): Promise<SelectSelfFundingAlert[]> {
  try {
    return await db
      .select()
      .from(selfFundingAlerts)
      .where(
        and(
          eq(selfFundingAlerts.competitionId, competitionId),
          eq(selfFundingAlerts.reviewed, false),
        ),
      )
      .orderBy(desc(selfFundingAlerts.detectedAt));
  } catch (error) {
    repositoryLogger.error("Error in getUnreviewedAlerts:", error);
    throw error;
  }
}

/**
 * Get all alerts for a competition with pagination
 */
async function getAlertsForCompetitionImpl(
  competitionId: string,
  params: {
    reviewed?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  alerts: SelectSelfFundingAlert[];
  total: number;
}> {
  try {
    const { reviewed, limit = 50, offset = 0 } = params;

    const whereConditions = [
      eq(selfFundingAlerts.competitionId, competitionId),
    ];
    if (reviewed !== undefined) {
      whereConditions.push(eq(selfFundingAlerts.reviewed, reviewed));
    }

    const whereClause = and(...whereConditions);

    const alertsQuery = db
      .select()
      .from(selfFundingAlerts)
      .where(whereClause)
      .orderBy(desc(selfFundingAlerts.detectedAt))
      .limit(limit)
      .offset(offset);

    const totalQuery = db
      .select({ count: drizzleCount() })
      .from(selfFundingAlerts)
      .where(whereClause);

    const [alerts, totalResult] = await Promise.all([alertsQuery, totalQuery]);

    return {
      alerts,
      total: totalResult[0]?.count || 0,
    };
  } catch (error) {
    repositoryLogger.error("Error in getAlertsForCompetition:", error);
    throw error;
  }
}

/**
 * Get alerts for multiple agents in a competition
 * Avoids N+1 queries when checking multiple agents
 */
async function getAlertsForAgentsImpl(
  agentIds: string[],
  competitionId: string,
): Promise<SelectSelfFundingAlert[]> {
  try {
    if (agentIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(selfFundingAlerts)
      .where(
        and(
          inArray(selfFundingAlerts.agentId, agentIds),
          eq(selfFundingAlerts.competitionId, competitionId),
        ),
      )
      .orderBy(selfFundingAlerts.agentId, desc(selfFundingAlerts.detectedAt));
  } catch (error) {
    repositoryLogger.error("Error in getAlertsForAgents:", error);
    throw error;
  }
}

/**
 * Get a single alert by ID
 */
async function getAlertByIdImpl(
  alertId: string,
): Promise<SelectSelfFundingAlert | undefined> {
  try {
    const [result] = await db
      .select()
      .from(selfFundingAlerts)
      .where(eq(selfFundingAlerts.id, alertId));

    return result;
  } catch (error) {
    repositoryLogger.error("Error in getAlertById:", error);
    throw error;
  }
}

/**
 * Mark an alert as reviewed with optional notes
 */
async function reviewAlertImpl(
  alertId: string,
  reviewNote?: string,
): Promise<SelectSelfFundingAlert> {
  try {
    const [result] = await db
      .update(selfFundingAlerts)
      .set({
        reviewed: true,
        reviewNote,
      })
      .where(eq(selfFundingAlerts.id, alertId))
      .returning();

    if (!result) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    repositoryLogger.info(
      `[SelfFundingAlertsRepository] Marked alert ${alertId} as reviewed`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in reviewAlert:", error);
    throw error;
  }
}

/**
 * Batch review multiple alerts
 * Useful for bulk operations from admin dashboard
 */
async function batchReviewAlertsImpl(
  alertIds: string[],
  reviewNote?: string,
): Promise<SelectSelfFundingAlert[]> {
  try {
    if (alertIds.length === 0) {
      return [];
    }

    return await db.transaction(async (tx) => {
      const results = await tx
        .update(selfFundingAlerts)
        .set({
          reviewed: true,
          reviewNote,
        })
        .where(inArray(selfFundingAlerts.id, alertIds))
        .returning();

      repositoryLogger.info(
        `[SelfFundingAlertsRepository] Batch reviewed ${results.length} alerts`,
      );

      return results;
    });
  } catch (error) {
    repositoryLogger.error("Error in batchReviewAlerts:", error);
    throw error;
  }
}

/**
 * Count unreviewed alerts for a competition
 * Useful for dashboard notifications
 */
async function countUnreviewedAlertsImpl(
  competitionId: string,
): Promise<number> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(selfFundingAlerts)
      .where(
        and(
          eq(selfFundingAlerts.competitionId, competitionId),
          eq(selfFundingAlerts.reviewed, false),
        ),
      );

    return result?.count || 0;
  } catch (error) {
    repositoryLogger.error("Error in countUnreviewedAlerts:", error);
    throw error;
  }
}

// Export wrapped functions with timing
export const createSelfFundingAlert = createTimedRepositoryFunction(
  createSelfFundingAlertImpl,
  "SelfFundingAlertsRepository",
  "createSelfFundingAlert",
);

export const batchCreateSelfFundingAlerts = createTimedRepositoryFunction(
  batchCreateSelfFundingAlertsImpl,
  "SelfFundingAlertsRepository",
  "batchCreateSelfFundingAlerts",
);

export const getUnreviewedAlerts = createTimedRepositoryFunction(
  getUnreviewedAlertsImpl,
  "SelfFundingAlertsRepository",
  "getUnreviewedAlerts",
);

export const getAlertsForCompetition = createTimedRepositoryFunction(
  getAlertsForCompetitionImpl,
  "SelfFundingAlertsRepository",
  "getAlertsForCompetition",
);

export const getAlertsForAgents = createTimedRepositoryFunction(
  getAlertsForAgentsImpl,
  "SelfFundingAlertsRepository",
  "getAlertsForAgents",
);

export const getAlertById = createTimedRepositoryFunction(
  getAlertByIdImpl,
  "SelfFundingAlertsRepository",
  "getAlertById",
);

export const reviewAlert = createTimedRepositoryFunction(
  reviewAlertImpl,
  "SelfFundingAlertsRepository",
  "reviewAlert",
);

export const batchReviewAlerts = createTimedRepositoryFunction(
  batchReviewAlertsImpl,
  "SelfFundingAlertsRepository",
  "batchReviewAlerts",
);

export const countUnreviewedAlerts = createTimedRepositoryFunction(
  countUnreviewedAlertsImpl,
  "SelfFundingAlertsRepository",
  "countUnreviewedAlerts",
);
