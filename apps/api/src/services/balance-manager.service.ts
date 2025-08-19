import {
  count,
  getAgentBalances,
  getAgentsBulkBalances,
  getBalance,
  initializeAgentBalances,
  resetAgentBalances,
} from "@/database/repositories/balance-repository.js";
import { serviceLogger } from "@/lib/logger.js";

import { CompetitionInitialBalancesService } from "./competition-initial-balances.service.js";

/**
 * Balance Manager Service
 * Manages token balances for agents
 */
export class BalanceManager {
  // Cache of agentId -> Map of tokenAddress -> balance
  private balanceCache: Map<string, Map<string, number>>;
  private competitionInitialBalancesService: CompetitionInitialBalancesService;

  constructor(
    competitionInitialBalancesService: CompetitionInitialBalancesService,
  ) {
    this.competitionInitialBalancesService = competitionInitialBalancesService;
    this.balanceCache = new Map();
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
      serviceLogger.error(
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
      serviceLogger.error(
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

      serviceLogger.debug(
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

      serviceLogger.debug(
        `[BalanceManager] Successfully retrieved ${balances.length} balances for ${agentIds.length} agents`,
      );

      return balances;
    } catch (error) {
      serviceLogger.error(
        `[BalanceManager] Error getting bulk balances for ${agentIds.length} agents:`,
        error,
      );
      return [];
    }
  }

  /**
   * Initialize an agent's balances for a specific competition
   * @param agentId The agent ID
   * @param competitionId The competition ID
   */
  async initializeAgentBalancesForCompetition(
    agentId: string,
    competitionId: string,
  ): Promise<void> {
    serviceLogger.debug(
      `[BalanceManager] Initializing balances for agent ${agentId} in competition ${competitionId}`,
    );

    try {
      // Get competition-specific initial balances
      const initialBalances =
        await this.competitionInitialBalancesService.getInitialBalancesMap(
          competitionId,
        );

      // Save to database
      await initializeAgentBalances(agentId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(agentId, balanceMap);
    } catch (error) {
      serviceLogger.error(
        `[BalanceManager] Error initializing balances for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Reset agent balances for a specific competition
   * @param agentId The agent ID
   * @param competitionId The competition ID
   */
  async resetAgentBalancesForCompetition(
    agentId: string,
    competitionId: string,
  ): Promise<void> {
    try {
      serviceLogger.debug(
        `[BalanceManager] Resetting balances for agent ${agentId} in competition ${competitionId}`,
      );

      // Get competition-specific initial balances
      const initialBalances =
        await this.competitionInitialBalancesService.getInitialBalancesMap(
          competitionId,
        );

      // Reset in database
      await resetAgentBalances(agentId, initialBalances);

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });
      this.balanceCache.set(agentId, balanceMap);

      serviceLogger.debug(
        `[BalanceManager] Successfully reset balances for agent ${agentId} in competition ${competitionId}`,
      );
    } catch (error) {
      serviceLogger.error(
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
      serviceLogger.error("[BalanceManager] Health check failed:", error);
      return false;
    }
  }
}
