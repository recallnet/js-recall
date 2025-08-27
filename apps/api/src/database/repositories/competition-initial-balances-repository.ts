import { and, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { competitionInitialBalances } from "@/database/schema/trading/defs.js";
import {
  InsertCompetitionInitialBalance,
  SelectCompetitionInitialBalance,
} from "@/database/schema/trading/types.js";

/**
 * Creates initial balances for a competition in bulk
 * @param data - The initial balance data to insert
 * @returns The created initial balance records
 */
async function createBulkImpl(
  data: InsertCompetitionInitialBalance[],
): Promise<SelectCompetitionInitialBalance[]> {
  if (data.length === 0) return [];

  const withIds = data.map((item) => ({
    ...item,
    id: item.id || uuidv4(),
  }));

  return db.insert(competitionInitialBalances).values(withIds).returning();
}

/**
 * Finds all initial balances by competition ID
 * @param competitionId - The competition ID to find initial balances for
 * @returns The initial balance records
 */
async function findByCompetitionIdImpl(
  competitionId: string,
): Promise<SelectCompetitionInitialBalance[]> {
  return db
    .select()
    .from(competitionInitialBalances)
    .where(eq(competitionInitialBalances.competitionId, competitionId));
}

/**
 * Finds a specific initial balance by competition ID, chain, and token symbol
 * @param competitionId - The competition ID
 * @param specificChain - The specific chain
 * @param tokenSymbol - The token symbol
 * @returns The initial balance record or null if not found
 */
async function findByCompetitionChainTokenImpl(
  competitionId: string,
  specificChain: string,
  tokenSymbol: string,
): Promise<SelectCompetitionInitialBalance | null> {
  const [result] = await db
    .select()
    .from(competitionInitialBalances)
    .where(
      and(
        eq(competitionInitialBalances.competitionId, competitionId),
        eq(competitionInitialBalances.specificChain, specificChain),
        eq(competitionInitialBalances.tokenSymbol, tokenSymbol),
      ),
    )
    .limit(1);
  return result || null;
}

/**
 * Updates a specific initial balance
 * @param id - The initial balance ID
 * @param data - The updated initial balance data
 * @returns The updated initial balance record
 */
async function updateImpl(
  id: string,
  data: Partial<InsertCompetitionInitialBalance>,
): Promise<SelectCompetitionInitialBalance | undefined> {
  const [result] = await db
    .update(competitionInitialBalances)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(competitionInitialBalances.id, id))
    .returning();
  return result;
}

/**
 * Deletes all initial balances for a competition
 * @param competitionId - The competition ID to delete initial balances for
 * @returns The number of deleted records
 */
async function deleteByCompetitionIdImpl(
  competitionId: string,
): Promise<number> {
  const result = await db
    .delete(competitionInitialBalances)
    .where(eq(competitionInitialBalances.competitionId, competitionId));
  return result.rowCount || 0;
}

/**
 * Upserts initial balances for a competition in bulk
 * @param data - The initial balance data to upsert
 * @returns The upserted initial balance records
 */
async function upsertBulkImpl(
  data: InsertCompetitionInitialBalance[],
): Promise<SelectCompetitionInitialBalance[]> {
  if (data.length === 0) return [];

  const withIds = data.map((item) => ({
    ...item,
    id: item.id || uuidv4(),
  }));

  return db
    .insert(competitionInitialBalances)
    .values(withIds)
    .onConflictDoUpdate({
      target: [
        competitionInitialBalances.competitionId,
        competitionInitialBalances.specificChain,
        competitionInitialBalances.tokenSymbol,
      ],
      set: {
        amount: sql`excluded.amount`,
        tokenAddress: sql`excluded.token_address`,
        updatedAt: new Date(),
      },
    })
    .returning();
}

// Export the repository functions
export const createBulk = createBulkImpl;
export const findByCompetitionId = findByCompetitionIdImpl;
export const findByCompetitionChainToken = findByCompetitionChainTokenImpl;
export const update = updateImpl;
export const deleteByCompetitionId = deleteByCompetitionIdImpl;
export const upsertBulk = upsertBulkImpl;
