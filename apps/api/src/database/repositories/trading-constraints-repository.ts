import { eq } from "drizzle-orm";

import { db } from "@/database/db.js";
import { tradingConstraints } from "@/database/schema/trading/defs.js";
import {
  InsertTradingConstraints,
  SelectTradingConstraints,
} from "@/database/schema/trading/types.js";

/**
 * Creates trading constraints for a competition
 * @param data - The trading constraints data to insert
 * @returns The created trading constraints record
 */
async function createImpl(
  data: InsertTradingConstraints,
): Promise<SelectTradingConstraints | undefined> {
  const [result] = await db.insert(tradingConstraints).values(data).returning();
  return result;
}

/**
 * Finds trading constraints by competition ID
 * @param competitionId - The competition ID to find constraints for
 * @returns The trading constraints record or null if not found
 */
async function findByCompetitionIdImpl(
  competitionId: string,
): Promise<SelectTradingConstraints | null> {
  const [result] = await db
    .select()
    .from(tradingConstraints)
    .where(eq(tradingConstraints.competitionId, competitionId))
    .limit(1);
  return result || null;
}

/**
 * Updates trading constraints for a competition
 * @param competitionId - The competition ID to update constraints for
 * @param data - The updated trading constraints data
 * @returns The updated trading constraints record
 */
async function updateImpl(
  competitionId: string,
  data: Partial<InsertTradingConstraints>,
): Promise<SelectTradingConstraints | undefined> {
  const [result] = await db
    .update(tradingConstraints)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(tradingConstraints.competitionId, competitionId))
    .returning();
  return result;
}

/**
 * Deletes trading constraints for a competition
 * @param competitionId - The competition ID to delete constraints for
 * @returns True if constraints were deleted, false if not found
 */
async function deleteImpl(competitionId: string): Promise<boolean> {
  const result = await db
    .delete(tradingConstraints)
    .where(eq(tradingConstraints.competitionId, competitionId));
  return result.rowCount ? result.rowCount > 0 : false;
}

/**
 * Upserts trading constraints for a competition
 * @param data - The trading constraints data to upsert
 * @returns The upserted trading constraints record
 */
async function upsertImpl(
  data: InsertTradingConstraints,
): Promise<SelectTradingConstraints | undefined> {
  const [result] = await db
    .insert(tradingConstraints)
    .values(data)
    .onConflictDoUpdate({
      target: tradingConstraints.competitionId,
      set: {
        minimumPairAgeHours: data.minimumPairAgeHours,
        minimum24hVolumeUsd: data.minimum24hVolumeUsd,
        minimumLiquidityUsd: data.minimumLiquidityUsd,
        minimumFdvUsd: data.minimumFdvUsd,
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
export const deleteConstraints = deleteImpl;
export const upsert = upsertImpl;
