import { config } from "@/config/index.js";
import {
  count,
  getBalance,
  getTeamBalances,
  initializeTeamBalances,
  resetTeamBalances,
  saveBalance,
} from "@/database/repositories/balance-repository.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Balance Manager Service
 * Manages token balances for teams
 */
export class BalanceManager {
  // Cache of teamId -> Map of tokenAddress -> balance
  private balanceCache: Map<string, Map<string, number>>;

  constructor() {
    this.balanceCache = new Map();
  }

  /**
   * Initialize a team's balances with default values
   * @param teamId The team ID
   */
  async initializeTeamBalances(teamId: string): Promise<void> {
    console.log(`[BalanceManager] Initializing balances for team ${teamId}`);

    try {
      const initialBalances = new Map<
        string,
        { amount: number; symbol: string }
      >();

      // Add specific chain token balances (more granular)
      this.addSpecificChainTokensToBalances(initialBalances);

      // Save to database
      await initializeTeamBalances(teamId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(teamId, balanceMap);
    } catch (error) {
      console.error(
        `[BalanceManager] Error initializing balances for team ${teamId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper method to add token balances for specific chains
   * @param balances The balances map to update
   */
  private addSpecificChainTokensToBalances(
    balances: Map<string, { amount: number; symbol: string }>,
  ): void {
    const specificChainBalances = config.specificChainBalances;
    const specificChainTokens = config.specificChainTokens;

    if (!specificChainBalances || !specificChainTokens) {
      console.warn(`[BalanceManager] No specific chain configuration found`);
      return;
    }

    // Process each specific chain that we have balances for
    Object.entries(specificChainBalances).forEach(([chain, tokenBalances]) => {
      const specificChain = chain as SpecificChain;

      // Only process chains that we have token configurations for
      if (
        specificChain === "eth" ||
        specificChain === "polygon" ||
        specificChain === "base" ||
        specificChain === "svm" ||
        specificChain === "optimism" ||
        specificChain === "arbitrum"
      ) {
        // Type-safe access to the chain tokens
        const chainTokens = specificChainTokens[specificChain];

        // Add each configured token for this specific chain
        Object.entries(tokenBalances).forEach(([symbol, amount]) => {
          // Type assertion for the symbol access
          const tokenAddress = chainTokens[symbol as keyof typeof chainTokens];

          if (tokenAddress && amount > 0) {
            console.log(
              `[BalanceManager] Setting initial balance for specific chain ${chain} ${symbol}: ${amount}`,
            );
            balances.set(tokenAddress, { amount, symbol });
          }
        });
      } else {
        console.warn(
          `[BalanceManager] No token configuration found for specific chain: ${chain}`,
        );
      }
    });
  }

  /**
   * Get a team's balance for a specific token
   * @param teamId The team ID
   * @param tokenAddress The token address
   * @returns The balance amount or 0 if not found
   */
  async getBalance(teamId: string, tokenAddress: string): Promise<number> {
    try {
      // First check cache
      const cachedBalances = this.balanceCache.get(teamId);
      if (cachedBalances && cachedBalances.has(tokenAddress)) {
        return cachedBalances.get(tokenAddress) || 0;
      }

      // Get from database
      const balance = await getBalance(teamId, tokenAddress);

      // If balance exists, update cache
      if (balance) {
        if (!this.balanceCache.has(teamId)) {
          this.balanceCache.set(teamId, new Map<string, number>());
        }
        this.balanceCache.get(teamId)?.set(tokenAddress, balance.amount);
        return balance.amount;
      }

      return 0;
    } catch (error) {
      console.error(
        `[BalanceManager] Error getting balance for team ${teamId}, token ${tokenAddress}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get all balances for a team
   * @param teamId The team ID
   * @returns Array of Balance objects
   */
  async getAllBalances(teamId: string) {
    try {
      // Get from database
      const balances = await getTeamBalances(teamId);

      // Update cache
      const balanceMap = new Map<string, number>();
      balances.forEach((balance) => {
        balanceMap.set(balance.tokenAddress, balance.amount);
      });
      this.balanceCache.set(teamId, balanceMap);

      return balances;
    } catch (error) {
      console.error(
        `[BalanceManager] Error getting all balances for team ${teamId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Update a team's token balance
   * @param teamId The team ID
   * @param tokenAddress The token address
   * @param amount The new balance amount
   * @param specificChain The specific chain for the token
   * @param symbol The token symbol
   */
  async updateBalance(
    teamId: string,
    tokenAddress: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<void> {
    try {
      if (amount < 0) {
        throw new Error("Balance cannot be negative");
      }

      // Save to database
      await saveBalance(teamId, tokenAddress, amount, specificChain, symbol);

      // Update cache
      if (!this.balanceCache.has(teamId)) {
        this.balanceCache.set(teamId, new Map<string, number>());
      }
      this.balanceCache.get(teamId)?.set(tokenAddress, amount);

      console.log(
        `[BalanceManager] Updated balance for team ${teamId}, token ${tokenAddress} (${symbol}): ${amount}`,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error updating balance for team ${teamId}, token ${tokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add amount to a team's token balance
   * @param teamId The team ID
   * @param tokenAddress The token address
   * @param amount The amount to add
   * @param specificChain The specific chain for the token
   * @param symbol The token symbol
   */
  async addAmount(
    teamId: string,
    tokenAddress: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<void> {
    try {
      const currentBalance = await this.getBalance(teamId, tokenAddress);
      const newBalance = currentBalance + amount;
      await this.updateBalance(
        teamId,
        tokenAddress,
        newBalance,
        specificChain,
        symbol,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error adding amount for team ${teamId}, token ${tokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Subtract amount from a team's token balance
   * @param teamId The team ID
   * @param tokenAddress The token address
   * @param amount The amount to subtract
   * @param specificChain The specific chain for the token
   * @param symbol The token symbol
   */
  async subtractAmount(
    teamId: string,
    tokenAddress: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<void> {
    try {
      const currentBalance = await this.getBalance(teamId, tokenAddress);
      const newBalance = currentBalance - amount;

      if (newBalance < 0) {
        throw new Error(
          `Insufficient balance. Current: ${currentBalance}, Requested: ${amount}`,
        );
      }

      await this.updateBalance(
        teamId,
        tokenAddress,
        newBalance,
        specificChain,
        symbol,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error subtracting amount for team ${teamId}, token ${tokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Reset a team's balances to initial values
   * @param teamId The team ID
   */
  async resetTeamBalances(teamId: string): Promise<void> {
    try {
      console.log(`[BalanceManager] Resetting balances for team ${teamId}`);

      const initialBalances = new Map<
        string,
        { amount: number; symbol: string }
      >();

      // Add specific chain token balances (more granular)
      this.addSpecificChainTokensToBalances(initialBalances);

      // Reset in database
      await resetTeamBalances(teamId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(teamId, balanceMap);

      console.log(
        `[BalanceManager] Successfully reset balances for team ${teamId}`,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error resetting balances for team ${teamId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if a team has sufficient balance for a trade
   * @param teamId The team ID
   * @param tokenAddress The token address
   * @param amount The amount to check
   * @returns True if the team has sufficient balance
   */
  async hasSufficientBalance(
    teamId: string,
    tokenAddress: string,
    amount: number,
  ): Promise<boolean> {
    const balance = await this.getBalance(teamId, tokenAddress);
    return balance >= amount;
  }

  /**
   * Check if balance manager is healthy
   * For system health check use
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Simple check to see if we can connect to the database
      await count();
      return true;
    } catch (error) {
      console.error("[BalanceManager] Health check failed:", error);
      return false;
    }
  }
}
