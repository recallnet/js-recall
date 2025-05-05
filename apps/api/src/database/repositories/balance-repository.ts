import { and, count, eq } from "drizzle-orm";

import { balances } from "@recallnet/comps-db/schema";

import { config } from "@/config/index.js";
import { BaseRepository } from "@/database/base-repository.js";
import { db } from "@/database/db.js";

/**
 * Balance Repository
 * Handles database operations for balances
 */
export class BalanceRepository extends BaseRepository {
  constructor() {
    super();
  }

  /**
   * Count all balances
   */
  async count() {
    const res = await db.select({ count: count() }).from(balances);
    if (!res.length) {
      throw new Error("No count result returned");
    }
    return res[0]!.count;
  }

  /**
   * Create or update a balance
   * @param teamId Team ID
   * @param tokenAddress Token address
   * @param amount Amount
   * @param specificChain Specific chain for the token
   * @param client Optional database client for transactions
   */
  async saveBalance(
    teamId: string,
    tokenAddress: string,
    amount: number,
    specificChain: string,
  ) {
    try {
      const [result] = await db
        .insert(balances)
        .values({
          teamId,
          tokenAddress,
          amount,
          specificChain,
        })
        .onConflictDoUpdate({
          target: [balances.teamId, balances.tokenAddress],
          set: {
            amount,
            updatedAt: new Date(),
            specificChain,
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to save balance - no result returned");
      }

      return result;
    } catch (error) {
      console.error("[BalanceRepository] Error in saveBalance:", error);
      throw error;
    }
  }

  /**
   * Get a specific balance
   * @param teamId Team ID
   * @param tokenAddress Token address
   */
  async getBalance(teamId: string, tokenAddress: string) {
    try {
      const [result] = await db
        .select()
        .from(balances)
        .where(
          and(
            eq(balances.teamId, teamId),
            eq(balances.tokenAddress, tokenAddress),
          ),
        );

      return result;
    } catch (error) {
      console.error("[BalanceRepository] Error in getBalance:", error);
      throw error;
    }
  }

  /**
   * Get all balances for a team
   * @param teamId Team ID
   */
  async getTeamBalances(teamId: string) {
    try {
      return await db
        .select()
        .from(balances)
        .where(eq(balances.teamId, teamId));
    } catch (error) {
      console.error("[BalanceRepository] Error in getTeamBalances:", error);
      throw error;
    }
  }

  /**
   * Initialize default balances for a team
   * @param teamId Team ID
   * @param initialBalances Map of token addresses to amounts
   */
  async initializeTeamBalances(
    teamId: string,
    initialBalances: Map<string, number>,
  ) {
    try {
      await db.transaction(async (tx) => {
        for (const [tokenAddress, amount] of initialBalances.entries()) {
          const specificChain = this.getTokenSpecificChain(tokenAddress);

          await tx
            .insert(balances)
            .values({
              teamId,
              tokenAddress,
              amount,
              specificChain,
            })
            .onConflictDoUpdate({
              target: [balances.teamId, balances.tokenAddress],
              set: {
                amount,
                specificChain,
                updatedAt: new Date(),
              },
            });
        }
      });
    } catch (error) {
      console.error(
        "[BalanceRepository] Error in initializeTeamBalances:",
        error,
      );
      throw error;
    }
  }

  /**
   * Determine the specific chain for a token address based on token patterns
   * @param tokenAddress The token address
   * @returns The specific chain string or null if not determined
   */
  private getTokenSpecificChain(tokenAddress: string): string | null {
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

    console.log(
      `[BalanceRepository] Could not determine specific chain for token: ${tokenAddress}`,
    );
    return null;
  }

  /**
   * Reset balances for a team
   * @param teamId Team ID
   * @param initialBalances Map of token addresses to amounts
   */
  async resetTeamBalances(
    teamId: string,
    initialBalances: Map<string, number>,
  ) {
    try {
      await db.transaction(async (tx) => {
        // First delete all current balances
        await tx.delete(balances).where(eq(balances.teamId, teamId));

        // Then initialize new ones
        for (const [tokenAddress, amount] of initialBalances.entries()) {
          const specificChain = this.getTokenSpecificChain(tokenAddress);

          await tx.insert(balances).values({
            teamId,
            tokenAddress,
            amount,
            specificChain,
          });
        }
      });
    } catch (error) {
      console.error("[BalanceRepository] Error in resetTeamBalances:", error);
      throw error;
    }
  }
}
