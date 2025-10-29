import { and, count as drizzleCount, eq, inArray, sql } from "drizzle-orm";
import { Logger } from "pino";

import { balances } from "../schema/trading/defs.js";
import type { SelectBalance } from "../schema/trading/types.js";
import type { Database, Transaction } from "../types.js";
import { SpecificChain } from "./types/index.js";

/**
 * Balance Repository
 * Handles database operations for balances
 */
export class BalanceRepository {
  readonly #db: Database;
  readonly #logger: Logger;
  readonly #specificChainTokens: Record<string, Record<string, string>>;

  constructor(
    db: Database,
    logger: Logger,
    specificChainTokens: Record<string, Record<string, string>>,
  ) {
    this.#db = db;
    this.#logger = logger;
    this.#specificChainTokens = specificChainTokens;
  }

  /**
   * Balance Repository
   * Handles database operations for balances
   */

  /**
   * Count all balances
   * @param competitionId Optional competition ID to filter by
   */
  async count(competitionId?: string): Promise<number> {
    const query = this.#db.select({ count: drizzleCount() }).from(balances);

    if (competitionId) {
      query.where(eq(balances.competitionId, competitionId));
    }

    const res = await query;
    if (!res.length) {
      throw new Error("No count result returned");
    }
    return res[0]!.count;
  }

  /**
   * Get a specific balance
   * @param agentId Agent ID
   * @param tokenAddress Token address
   * @param competitionId Competition ID
   */
  async getBalance(
    agentId: string,
    tokenAddress: string,
    competitionId: string,
  ): Promise<SelectBalance | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(balances)
        .where(
          and(
            eq(balances.agentId, agentId),
            eq(balances.competitionId, competitionId),
            eq(balances.tokenAddress, tokenAddress),
          ),
        );

      return result;
    } catch (error) {
      this.#logger.error("Error in getBalance:", error);
      throw error;
    }
  }

  /**
   * Get all balances for an agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   */
  async getAgentBalances(
    agentId: string,
    competitionId: string,
  ): Promise<SelectBalance[]> {
    try {
      return await this.#db
        .select()
        .from(balances)
        .where(
          and(
            eq(balances.agentId, agentId),
            eq(balances.competitionId, competitionId),
          ),
        );
    } catch (error) {
      this.#logger.error("Error in getAgentBalances:", error);
      throw error;
    }
  }

  /**
   * Get all balances for multiple agents in bulk
   * @param agentIds Array of agent IDs
   * @param competitionId Competition ID
   */
  async getAgentsBulkBalances(
    agentIds: string[],
    competitionId: string,
  ): Promise<SelectBalance[]> {
    try {
      if (agentIds.length === 0) {
        return [];
      }

      return await this.#db
        .select()
        .from(balances)
        .where(
          and(
            inArray(balances.agentId, agentIds),
            eq(balances.competitionId, competitionId),
          ),
        );
    } catch (error) {
      this.#logger.error("Error in getAgentsBulkBalances:", error);
      throw error;
    }
  }

  /**
   * Determine the specific chain for a token address based on token patterns
   * @param tokenAddress The token address
   * @returns The specific chain string or null if not determined
   */
  getTokenSpecificChain(tokenAddress: string): string | null {
    const token = tokenAddress.toLowerCase();

    // Check each chain's tokens to find a match
    const specificChainTokens = this.#specificChainTokens;

    for (const [chain, tokens] of Object.entries(specificChainTokens)) {
      // Check all tokens for this chain
      for (const [, address] of Object.entries(tokens)) {
        if (address.toLowerCase() === token) {
          return chain;
        }
      }
    }

    this.#logger.warn(
      `Could not determine specific chain for token: ${tokenAddress}`,
    );
    return null;
  }

  /**
   * Reset balances for an agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param initialBalances Map of token addresses to amounts and symbols
   */
  async resetAgentBalances(
    agentId: string,
    competitionId: string,
    initialBalances: Map<string, { amount: number; symbol: string }>,
  ): Promise<void> {
    try {
      await this.#db.transaction(async (tx) => {
        // First delete all current balances for this agent in this competition
        await tx
          .delete(balances)
          .where(
            and(
              eq(balances.agentId, agentId),
              eq(balances.competitionId, competitionId),
            ),
          );

        // Then initialize with new balances
        const now = new Date();
        for (const [
          tokenAddress,
          { amount, symbol },
        ] of initialBalances.entries()) {
          const specificChain = this.getTokenSpecificChain(
            tokenAddress,
          ) as SpecificChain;
          await tx.insert(balances).values({
            agentId,
            competitionId,
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
      this.#logger.error("Error in resetAgentBalances:", error);
      throw error;
    }
  }

  /**
   * Atomic balance update within a transaction
   * @param tx Database transaction
   * @param agentId Agent ID
   * @param tokenAddress Token address
   * @param competitionId Competition ID
   * @param amountDelta Positive for increment, negative for decrement
   * @param specificChain Specific chain for the token
   * @param symbol Token symbol
   * @returns The new balance amount
   */
  async updateBalanceInTransaction(
    tx: Transaction,
    agentId: string,
    tokenAddress: string,
    competitionId: string,
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
          eq(balances.competitionId, competitionId),
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
            competitionId,
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

    this.#logger.debug(
      `[BalanceRepository] Updated balance: agent=${agentId}, token=${tokenAddress} (${symbol}), newAmount=${result.amount}`,
    );

    return result.amount;
  }

  /**
   * Atomic balance increment within a transaction
   * @param tx Database transaction
   * @param agentId Agent ID
   * @param tokenAddress Token address
   * @param competitionId Competition ID
   * @param amount Amount to add
   * @param specificChain Specific chain for the token
   * @param symbol Token symbol
   * @returns The new balance amount
   */
  async incrementBalanceInTransaction(
    tx: Transaction,
    agentId: string,
    tokenAddress: string,
    competitionId: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<number> {
    return await this.updateBalanceInTransaction(
      tx,
      agentId,
      tokenAddress,
      competitionId,
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
   * @param competitionId Competition ID
   * @param amount Amount to subtract
   * @param specificChain Specific chain for the token
   * @param symbol Token symbol
   * @returns The new balance amount
   */
  async decrementBalanceInTransaction(
    tx: Transaction,
    agentId: string,
    tokenAddress: string,
    competitionId: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<number> {
    return await this.updateBalanceInTransaction(
      tx,
      agentId,
      tokenAddress,
      competitionId,
      -amount,
      specificChain,
      symbol,
    );
  }
}
