import { and, count as drizzleCount, eq, inArray } from "drizzle-orm";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { balances } from "@/database/schema/trading/defs.js";
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
 * Create or update a balance
 * @param agentId Agent ID
 * @param tokenAddress Token address
 * @param amount Amount
 * @param specificChain Specific chain for the token
 * @param symbol Token symbol
 */
async function saveBalanceImpl(
  agentId: string,
  tokenAddress: string,
  amount: number,
  specificChain: string,
  symbol: string,
) {
  try {
    const now = new Date();
    const [result] = await db
      .insert(balances)
      .values({
        agentId,
        tokenAddress,
        amount,
        specificChain,
        symbol,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [balances.agentId, balances.tokenAddress],
        set: {
          amount,
          updatedAt: new Date(),
          specificChain,
          symbol,
        },
      })
      .returning();

    if (!result) {
      throw new Error("Failed to save balance - no result returned");
    }

    return result;
  } catch (error) {
    repositoryLogger.error("Error in saveBalance:", error);
    throw error;
  }
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
 * Initialize default balances for an agent
 * @param agentId Agent ID
 * @param initialBalances Map of token addresses to amounts and symbols
 */
async function initializeAgentBalancesImpl(
  agentId: string,
  initialBalances: Map<string, { amount: number; symbol: string }>,
) {
  try {
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const [
        tokenAddress,
        { amount, symbol },
      ] of initialBalances.entries()) {
        const specificChain = getTokenSpecificChain(
          tokenAddress,
        ) as SpecificChain;
        await tx
          .insert(balances)
          .values({
            agentId,
            tokenAddress,
            amount,
            specificChain,
            symbol,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [balances.agentId, balances.tokenAddress],
            set: {
              amount,
              specificChain,
              symbol,
              updatedAt: now,
            },
          });
      }
    });
  } catch (error) {
    repositoryLogger.error("Error in initializeAgentBalances:", error);
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

export const saveBalance = createTimedRepositoryFunction(
  saveBalanceImpl,
  "BalanceRepository",
  "saveBalance",
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

export const initializeAgentBalances = createTimedRepositoryFunction(
  initializeAgentBalancesImpl,
  "BalanceRepository",
  "initializeAgentBalances",
);

export const resetAgentBalances = createTimedRepositoryFunction(
  resetAgentBalancesImpl,
  "BalanceRepository",
  "resetAgentBalances",
);
