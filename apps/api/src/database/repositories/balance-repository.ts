import { and, count as drizzleCount, eq, inArray, sql } from "drizzle-orm";

import { balances } from "@recallnet/db-schema/trading/defs";
import type { Transaction as DatabaseTransaction } from "@recallnet/db-schema/types";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Balance Repository
 * Handles database operations for balances
 */

/**
 * Count all balances
 */
async function countImpl() {
  const res = await db.select({ count: drizzleCount() }).from(balances);
  if (!res.length) {
    throw new Error("No count result returned");
  }
  return res[0]!.count;
}

/**
 * Get a specific balance
 * @param agentId Agent ID
 * @param tokenAddress Token address
 */
async function getBalanceImpl(agentId: string, tokenAddress: string) {
  try {
    const [result] = await db
      .select()
      .from(balances)
      .where(
        and(
          eq(balances.agentId, agentId),
          eq(balances.tokenAddress, tokenAddress),
        ),
      );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in getBalance:", error);
    throw error;
  }
}

/**
 * Get all balances for an agent
 * @param agentId Agent ID
 */
async function getAgentBalancesImpl(agentId: string) {
  try {
    return await db
      .select()
      .from(balances)
      .where(eq(balances.agentId, agentId));
  } catch (error) {
    repositoryLogger.error("Error in getAgentBalances:", error);
    throw error;
  }
}

/**
 * Get all balances for multiple agents in bulk
 * @param agentIds Array of agent IDs
 */
export async function getAgentsBulkBalances(agentIds: string[]) {
  try {
    if (agentIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(balances)
      .where(inArray(balances.agentId, agentIds));
  } catch (error) {
    repositoryLogger.error("Error in getAgentsBulkBalances:", error);
    throw error;
  }
}

/**
 * Determine the specific chain for a token address based on token patterns
 * @param tokenAddress The token address
 * @returns The specific chain string or null if not determined
 */
function getTokenSpecificChain(tokenAddress: string): string | null {
  const token = tokenAddress.toLowerCase();

  // Check each chain's tokens to find a match
  const specificChainTokens = config.specificChainTokens;

  for (const [chain, tokens] of Object.entries(specificChainTokens)) {
    // Check all tokens for this chain
    for (const [, address] of Object.entries(tokens)) {
      if (address.toLowerCase() === token) {
        return chain;
      }
    }
  }

  repositoryLogger.warn(
    `Could not determine specific chain for token: ${tokenAddress}`,
  );
  return null;
}

/**
 * Reset balances for an agent
 * @param agentId Agent ID
 * @param initialBalances Map of token addresses to amounts and symbols
 */
async function resetAgentBalancesImpl(
  agentId: string,
  initialBalances: Map<string, { amount: number; symbol: string }>,
) {
  try {
    await db.transaction(async (tx) => {
      // First delete all current balances
      await tx.delete(balances).where(eq(balances.agentId, agentId));

      // Then initialize with new balances
      const now = new Date();
      for (const [
        tokenAddress,
        { amount, symbol },
      ] of initialBalances.entries()) {
        const specificChain = getTokenSpecificChain(
          tokenAddress,
        ) as SpecificChain;
        await tx.insert(balances).values({
          agentId,
          tokenAddress,
          amount,
          specificChain,
          symbol,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  } catch (error) {
    repositoryLogger.error("Error in resetAgentBalances:", error);
    throw error;
  }
}

/**
 * Atomic balance update within a transaction
 * @param tx Database transaction
 * @param agentId Agent ID
 * @param tokenAddress Token address
 * @param amountDelta Positive for increment, negative for decrement
 * @param specificChain Specific chain for the token
 * @param symbol Token symbol
 * @returns The new balance amount
 */
async function updateBalanceInTransactionImpl(
  tx: DatabaseTransaction,
  agentId: string,
  tokenAddress: string,
  amountDelta: number,
  specificChain: SpecificChain,
  symbol: string,
): Promise<number> {
  const [result] = await tx
    .update(balances)
    .set({
      amount: sql`${balances.amount} + ${amountDelta}`,
      updatedAt: new Date(),
      specificChain,
      symbol,
    })
    .where(
      and(
        eq(balances.agentId, agentId),
        eq(balances.tokenAddress, tokenAddress),
      ),
    )
    .returning();

  if (!result) {
    if (amountDelta > 0) {
      // Create balance if it doesn't exist for increments
      const [newResult] = await tx
        .insert(balances)
        .values({
          agentId,
          tokenAddress,
          amount: amountDelta,
          specificChain,
          symbol,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!newResult) {
        throw new Error("Failed to create new balance");
      }

      return newResult.amount;
    } else {
      // For decrements, the balance should already exist
      throw new Error(
        `Balance not found for agent ${agentId}, token ${tokenAddress}`,
      );
    }
  } else if (amountDelta < 0 && result.amount < 0) {
    throw new Error(
      `Insufficient balance. Current: ${result.amount - amountDelta}, Requested: ${Math.abs(amountDelta)}`,
    );
  }

  repositoryLogger.debug(
    `[BalanceRepository] Updated balance: agent=${agentId}, token=${tokenAddress} (${symbol}), newAmount=${result.amount}`,
  );

  return result.amount;
}

/**
 * Atomic balance increment within a transaction
 * @param tx Database transaction
 * @param agentId Agent ID
 * @param tokenAddress Token address
 * @param amount Amount to add
 * @param specificChain Specific chain for the token
 * @param symbol Token symbol
 * @returns The new balance amount
 */
async function incrementBalanceInTransactionImpl(
  tx: DatabaseTransaction,
  agentId: string,
  tokenAddress: string,
  amount: number,
  specificChain: SpecificChain,
  symbol: string,
): Promise<number> {
  return await updateBalanceInTransactionImpl(
    tx,
    agentId,
    tokenAddress,
    amount,
    specificChain,
    symbol,
  );
}

/**
 * Atomic balance decrement within a transaction
 * @param tx Database transaction
 * @param agentId Agent ID
 * @param tokenAddress Token address
 * @param amount Amount to subtract
 * @param specificChain Specific chain for the token
 * @param symbol Token symbol
 * @returns The new balance amount
 */
async function decrementBalanceInTransactionImpl(
  tx: DatabaseTransaction,
  agentId: string,
  tokenAddress: string,
  amount: number,
  specificChain: SpecificChain,
  symbol: string,
): Promise<number> {
  return await updateBalanceInTransactionImpl(
    tx,
    agentId,
    tokenAddress,
    -amount,
    specificChain,
    symbol,
  );
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const count = createTimedRepositoryFunction(
  countImpl,
  "BalanceRepository",
  "count",
);

export const getBalance = createTimedRepositoryFunction(
  getBalanceImpl,
  "BalanceRepository",
  "getBalance",
);

export const getAgentBalances = createTimedRepositoryFunction(
  getAgentBalancesImpl,
  "BalanceRepository",
  "getAgentBalances",
);

export const resetAgentBalances = createTimedRepositoryFunction(
  resetAgentBalancesImpl,
  "BalanceRepository",
  "resetAgentBalances",
);

// Export atomic balance functions
export const incrementBalanceInTransaction = createTimedRepositoryFunction(
  incrementBalanceInTransactionImpl,
  "BalanceRepository",
  "incrementBalanceInTransaction",
);

export const decrementBalanceInTransaction = createTimedRepositoryFunction(
  decrementBalanceInTransactionImpl,
  "BalanceRepository",
  "decrementBalanceInTransaction",
);
