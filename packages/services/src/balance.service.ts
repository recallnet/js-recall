import { Logger } from "pino";

import { BalanceRepository } from "@recallnet/db/repositories/balance";
import type { SelectBalance } from "@recallnet/db/schema/trading/types";

import { assertUnreachable } from "./lib/typescript-utils.js";
import {
  CompetitionType,
  SpecificChain,
  SpecificChainTokens,
} from "./types/index.js";

export interface BalanceServiceConfig {
  specificChainBalances: Record<SpecificChain, Record<string, number>>;
  specificChainTokens: SpecificChainTokens;
}

/**
 * Balance Service
 * Manages token balances for agents
 */
export class BalanceService {
  // Cache of agentId -> Map of tokenAddress -> balance
  private balanceCache: Map<string, Map<string, number>>;
  private balanceRepo: BalanceRepository;
  private specificChainBalances: Record<SpecificChain, Record<string, number>>;
  private specificChainTokens: SpecificChainTokens;
  private logger: Logger;

  constructor(
    balanceRepo: BalanceRepository,
    config: BalanceServiceConfig,
    logger: Logger,
  ) {
    this.balanceCache = new Map();
    this.balanceRepo = balanceRepo;
    this.specificChainBalances = config.specificChainBalances;
    this.specificChainTokens = config.specificChainTokens;
    this.logger = logger;
  }

  /**
   * Set the balance cache for an agent to an absolute value
   * @param agentId The agent ID
   * @param tokenAddress The token address
   * @param absoluteBalance The absolute balance amount to set
   */
  setBalanceCache(
    agentId: string,
    tokenAddress: string,
    absoluteBalance: number,
  ): void {
    if (!this.balanceCache.has(agentId)) {
      this.balanceCache.set(agentId, new Map<string, number>());
    }
    this.balanceCache.get(agentId)?.set(tokenAddress, absoluteBalance);
  }

  /**
   * Helper method to add token balances for specific chains
   * @param balances The balances map to update
   */
  private addSpecificChainTokensToBalances(
    balances: Map<string, { amount: number; symbol: string }>,
  ): void {
    // Process each specific chain that we have balances for
    Object.entries(this.specificChainBalances).forEach(
      ([chain, tokenBalances]) => {
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
          const chainTokens = this.specificChainTokens[specificChain];

          // Add each configured token for this specific chain
          Object.entries(tokenBalances).forEach(([symbol, amount]) => {
            // Type assertion for the symbol access
            const tokenAddress = chainTokens?.[symbol];

            if (tokenAddress && amount > 0) {
              this.logger.debug(
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
      },
    );
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
      const balance = await this.balanceRepo.getBalance(agentId, tokenAddress);

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
      this.logger.error(
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
  async getAllBalances(agentId: string): Promise<SelectBalance[]> {
    try {
      // Get from database
      const balances = await this.balanceRepo.getAgentBalances(agentId);

      // Update cache
      const balanceMap = new Map<string, number>();
      balances.forEach((balance) => {
        balanceMap.set(balance.tokenAddress, balance.amount);
      });
      this.balanceCache.set(agentId, balanceMap);

      return balances;
    } catch (error) {
      this.logger.error(
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

      this.logger.debug(
        `[BalanceManager] Getting bulk balances for ${agentIds.length} agents`,
      );

      // Get all balances from database in one query
      const balances = await this.balanceRepo.getAgentsBulkBalances(agentIds);

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

      this.logger.debug(
        `[BalanceManager] Successfully retrieved ${balances.length} balances for ${agentIds.length} agents`,
      );

      return balances;
    } catch (error) {
      this.logger.error(
        `[BalanceManager] Error getting bulk balances for ${agentIds.length} agents:`,
        error,
      );
      return [];
    }
  }

  /**
   * Reset an agent's balances to initial values, based on the competition type.
   *  Behavior by competition type:
   * - "trading": Resets to standard paper trading balances (5k USDC per chain)
   * - "perpetual_futures": Clears all balances (empty balance map)
   * @param agentId The agent ID
   * @param competitionType The competition type
   */
  async resetAgentBalances(
    agentId: string,
    competitionType: CompetitionType,
  ): Promise<void> {
    try {
      this.logger.debug(
        `[BalanceManager] Resetting balances for agent ${agentId}`,
      );

      const initialBalances = new Map<
        string,
        { amount: number; symbol: string }
      >();

      if (competitionType === "trading") {
        // Paper trading: Reset to standard balances
        this.addSpecificChainTokensToBalances(initialBalances);
      }

      // Reset in database
      await this.balanceRepo.resetAgentBalances(agentId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(agentId, balanceMap);

      switch (competitionType) {
        case "trading":
          this.logger.debug(
            `[BalanceManager] Successfully reset paper trading balances for agent ${agentId}`,
          );
          break;
        case "perpetual_futures":
          this.logger.debug(
            `[BalanceManager] Successfully cleared balances for perps agent ${agentId}`,
          );
          break;
        default:
          assertUnreachable(competitionType);
      }
    } catch (error) {
      this.logger.error(
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
      await this.balanceRepo.count();
      return true;
    } catch (error) {
      this.logger.error("[BalanceManager] Health check failed:", error);
      return false;
    }
  }
}
