import { eq } from "drizzle-orm";

import { db } from "@/database/db.js";
import { competitionConfigurations } from "@/database/schema/trading/defs.js";
import {
  InsertCompetitionConfiguration,
  SelectCompetitionConfiguration,
} from "@/database/schema/trading/types.js";

/**
 * Creates competition configuration for a competition
 * @param data - The competition configuration data to insert
 * @returns The created competition configuration record
 */
async function createImpl(
  data: InsertCompetitionConfiguration,
): Promise<SelectCompetitionConfiguration | undefined> {
  const [result] = await db
    .insert(competitionConfigurations)
    .values(data)
    .returning();
  return result;
}

/**
 * Finds competition configuration by competition ID
 * @param competitionId - The competition ID to find configuration for
 * @returns The competition configuration record or null if not found
 */
async function findByCompetitionIdImpl(
  competitionId: string,
): Promise<SelectCompetitionConfiguration | null> {
  const [result] = await db
    .select()
    .from(competitionConfigurations)
    .where(eq(competitionConfigurations.competitionId, competitionId))
    .limit(1);
  return result || null;
}

/**
 * Updates competition configuration for a competition
 * @param competitionId - The competition ID to update configuration for
 * @param data - The updated competition configuration data
 * @returns The updated competition configuration record
 */
async function updateImpl(
  competitionId: string,
  data: Partial<InsertCompetitionConfiguration>,
): Promise<SelectCompetitionConfiguration | undefined> {
  const [result] = await db
    .update(competitionConfigurations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(competitionConfigurations.competitionId, competitionId))
    .returning();
  return result;
}

/**
 * Deletes competition configuration for a competition
 * @param competitionId - The competition ID to delete configuration for
 * @returns True if configuration was deleted, false if not found
 */
async function deleteImpl(competitionId: string): Promise<boolean> {
  const result = await db
    .delete(competitionConfigurations)
    .where(eq(competitionConfigurations.competitionId, competitionId));
  return result.rowCount ? result.rowCount > 0 : false;
}

/**
 * Upserts competition configuration for a competition
 * @param data - The competition configuration data to upsert
 * @returns The upserted competition configuration record
 */
async function upsertImpl(
  data: InsertCompetitionConfiguration,
): Promise<SelectCompetitionConfiguration | undefined> {
  const [result] = await db
    .insert(competitionConfigurations)
    .values(data)
    .onConflictDoUpdate({
      target: competitionConfigurations.competitionId,
      set: {
        portfolioSnapshotCron: data.portfolioSnapshotCron,
        maxTradePercentage: data.maxTradePercentage,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result;
}

// Export the repository functions
export const create = createImpl;
export const findByCompetitionId = findByCompetitionIdImpl;
export const update = updateImpl;
export const deleteConfiguration = deleteImpl;
export const upsert = upsertImpl;
