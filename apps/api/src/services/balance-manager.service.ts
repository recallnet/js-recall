import { config } from "@/config/index.js";
import {
  count,
  getAgentBalances,
  getAgentsBulkBalances,
  getBalance,
  initializeAgentBalances,
  resetAgentBalances,
  saveBalance,
} from "@/database/repositories/balance-repository.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Balance Manager Service
 * Manages token balances for agents
 */
export class BalanceManager {
  // Cache of agentId -> Map of tokenAddress -> balance
  private balanceCache: Map<string, Map<string, number>>;

  constructor() {
    this.balanceCache = new Map();
  }

  /**
   * Initialize an agent's balances with default values
   * @param agentId The agent ID
   */
  async initializeAgentBalances(agentId: string): Promise<void> {
    console.log(`[BalanceManager] Initializing balances for agent ${agentId}`);

    try {
      const initialBalances = new Map<
        string,
        { amount: number; symbol: string }
      >();

      // Add specific chain token balances (more granular)
      this.addSpecificChainTokensToBalances(initialBalances);

      // Save to database
      await initializeAgentBalances(agentId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(agentId, balanceMap);
    } catch (error) {
      console.error(
        `[BalanceManager] Error initializing balances for agent ${agentId}:`,
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
   * Get an agent's balance for a specific token
   * @param agentId The agent ID
   * @param tokenAddress The token address
   * @returns The balance amount or 0 if not found
   */
  async getBalance(agentId: string, tokenAddress: string): Promise<number> {
    try {
      // First check cache
      const cachedBalances = this.balanceCache.get(agentId);
      if (cachedBalances && cachedBalances.has(tokenAddress)) {
        return cachedBalances.get(tokenAddress) || 0;
      }

      // Get from database
      const balance = await getBalance(agentId, tokenAddress);

      // If balance exists, update cache
      if (balance) {
        if (!this.balanceCache.has(agentId)) {
          this.balanceCache.set(agentId, new Map<string, number>());
        }
        this.balanceCache.get(agentId)?.set(tokenAddress, balance.amount);
        return balance.amount;
      }

      return 0;
    } catch (error) {
      console.error(
        `[BalanceManager] Error getting balance for agent ${agentId}, token ${tokenAddress}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get all balances for an agent
   * @param agentId The agent ID
   * @returns Array of Balance objects
   */
  async getAllBalances(agentId: string) {
    try {
      // Get from database
      const balances = await getAgentBalances(agentId);

      // Update cache
      const balanceMap = new Map<string, number>();
      balances.forEach((balance) => {
        balanceMap.set(balance.tokenAddress, balance.amount);
      });
      this.balanceCache.set(agentId, balanceMap);

      return balances;
    } catch (error) {
      console.error(
        `[BalanceManager] Error getting all balances for agent ${agentId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get all balances for multiple agents in bulk
   * @param agentIds Array of agent IDs
   * @returns Array of Balance objects for all agents
   */
  async getBulkBalances(agentIds: string[]) {
    try {
      if (agentIds.length === 0) {
        return [];
      }

      console.log(
        `[BalanceManager] Getting bulk balances for ${agentIds.length} agents`,
      );

      // Get all balances from database in one query
      const balances = await getAgentsBulkBalances(agentIds);

      // Update cache for all agents
      const agentBalanceMap = new Map<string, Map<string, number>>();

      // Initialize maps for each agent
      agentIds.forEach((agentId) => {
        agentBalanceMap.set(agentId, new Map<string, number>());
      });

      // Populate the cache
      balances.forEach((balance) => {
        const agentBalances = agentBalanceMap.get(balance.agentId);
        if (agentBalances) {
          agentBalances.set(balance.tokenAddress, balance.amount);
        }
      });

      // Update the main cache
      agentBalanceMap.forEach((balanceMap, agentId) => {
        this.balanceCache.set(agentId, balanceMap);
      });

      console.log(
        `[BalanceManager] Successfully retrieved ${balances.length} balances for ${agentIds.length} agents`,
      );

      return balances;
    } catch (error) {
      console.error(
        `[BalanceManager] Error getting bulk balances for ${agentIds.length} agents:`,
        error,
      );
      return [];
    }
  }

  /**
   * Update an agent's token balance
   * @param agentId The agent ID
   * @param tokenAddress The token address
   * @param amount The new balance amount
   * @param specificChain The specific chain for the token
   * @param symbol The token symbol
   */
  async updateBalance(
    agentId: string,
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
      await saveBalance(agentId, tokenAddress, amount, specificChain, symbol);

      // Update cache
      if (!this.balanceCache.has(agentId)) {
        this.balanceCache.set(agentId, new Map<string, number>());
      }
      this.balanceCache.get(agentId)?.set(tokenAddress, amount);

      console.log(
        `[BalanceManager] Updated balance for agent ${agentId}, token ${tokenAddress} (${symbol}): ${amount}`,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error updating balance for agent ${agentId}, token ${tokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add amount to an agent's token balance
   * @param agentId The agent ID
   * @param tokenAddress The token address
   * @param amount The amount to add
   * @param specificChain The specific chain for the token
   * @param symbol The token symbol
   */
  async addAmount(
    agentId: string,
    tokenAddress: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<void> {
    try {
      const currentBalance = await this.getBalance(agentId, tokenAddress);
      const newBalance = currentBalance + amount;
      await this.updateBalance(
        agentId,
        tokenAddress,
        newBalance,
        specificChain,
        symbol,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error adding amount for agent ${agentId}, token ${tokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Subtract amount from an agent's token balance
   * @param agentId The agent ID
   * @param tokenAddress The token address
   * @param amount The amount to subtract
   * @param specificChain The specific chain for the token
   * @param symbol The token symbol
   */
  async subtractAmount(
    agentId: string,
    tokenAddress: string,
    amount: number,
    specificChain: SpecificChain,
    symbol: string,
  ): Promise<void> {
    try {
      const currentBalance = await this.getBalance(agentId, tokenAddress);
      const newBalance = currentBalance - amount;

      if (newBalance < 0) {
        throw new Error(
          `Insufficient balance. Current: ${currentBalance}, Requested: ${amount}`,
        );
      }

      await this.updateBalance(
        agentId,
        tokenAddress,
        newBalance,
        specificChain,
        symbol,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error subtracting amount for agent ${agentId}, token ${tokenAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Reset an agent's balances to initial values
   * @param agentId The agent ID
   */
  async resetAgentBalances(agentId: string): Promise<void> {
    try {
      console.log(`[BalanceManager] Resetting balances for agent ${agentId}`);

      const initialBalances = new Map<
        string,
        { amount: number; symbol: string }
      >();

      // Add specific chain token balances (more granular)
      this.addSpecificChainTokensToBalances(initialBalances);

      // Reset in database
      await resetAgentBalances(agentId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(agentId, balanceMap);

      console.log(
        `[BalanceManager] Successfully reset balances for agent ${agentId}`,
      );
    } catch (error) {
      console.error(
        `[BalanceManager] Error resetting balances for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if an agent has sufficient balance for a trade
   * @param agentId The agent ID
   * @param tokenAddress The token address
   * @param amount The amount to check
   * @returns True if the agent has sufficient balance
   */
  async hasSufficientBalance(
    agentId: string,
    tokenAddress: string,
    amount: number,
  ): Promise<boolean> {
    const balance = await this.getBalance(agentId, tokenAddress);
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
