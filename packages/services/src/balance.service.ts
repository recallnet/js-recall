import { Logger } from "pino";

import { BalanceRepository } from "@recallnet/db/repositories/balance";
import type { SelectBalance } from "@recallnet/db/schema/trading/types";

import { assertUnreachable } from "./lib/typescript-utils.js";
import {
  ApiError,
  CompetitionType,
  SpecificChain,
  SpecificChainBalances,
  SpecificChainTokens,
} from "./types/index.js";

export interface BalanceServiceConfig {
  specificChainBalances: SpecificChainBalances;
  specificChainTokens: SpecificChainTokens;
}

/**
 * Balance Service
 * Manages token balances for agents
 */
export class BalanceService {
  // Cache structure: agentId → competitionId → (tokenAddress → amount)
  private balanceCache: Map<string, Map<string, Map<string, number>>>;
  private balanceRepo: BalanceRepository;
  private specificChainBalances: SpecificChainBalances;
  private specificChainTokens: SpecificChainTokens;
  private logger: Logger;
  private getActiveCompetitionFn: (() => Promise<{ id: string } | null>) | null;

  constructor(
    balanceRepo: BalanceRepository,
    config: BalanceServiceConfig,
    logger: Logger,
    getActiveCompetitionFn?: () => Promise<{ id: string } | null>,
  ) {
    this.balanceCache = new Map();
    this.balanceRepo = balanceRepo;
    this.specificChainBalances = config.specificChainBalances;
    this.specificChainTokens = config.specificChainTokens;
    this.logger = logger;
    this.getActiveCompetitionFn = getActiveCompetitionFn ?? null;
  }

  /**
   * Set the balance cache for an agent to an absolute value
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param tokenAddress The token address
   * @param absoluteBalance The absolute balance amount to set
   */
  setBalanceCache(
    agentId: string,
    competitionId: string,
    tokenAddress: string,
    absoluteBalance: number,
  ): void {
    if (!this.balanceCache.has(agentId)) {
      this.balanceCache.set(agentId, new Map());
    }
    const agentCache = this.balanceCache.get(agentId)!;
    if (!agentCache.has(competitionId)) {
      agentCache.set(competitionId, new Map());
    }
    agentCache.get(competitionId)!.set(tokenAddress, absoluteBalance);
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
            const tokenAddress =
              chainTokens?.[symbol as keyof typeof chainTokens];

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
   * @param competitionId The competition ID (optional, will use active competition if not provided)
   * @returns The balance amount or 0 if not found
   */
  async getBalance(
    agentId: string,
    tokenAddress: string,
    competitionId?: string,
  ): Promise<number> {
    try {
      // TODO(ENG-783): Remove getActiveCompetition() and require competitionId from caller
      if (!competitionId) {
        if (!this.getActiveCompetitionFn) {
          throw new ApiError(
            400,
            "Competition ID is required for this operation",
          );
        }
        const activeComp = await this.getActiveCompetitionFn();
        if (!activeComp) {
          throw new ApiError(400, "No active competition");
        }
        competitionId = activeComp.id;
      }

      // First check cache
      const agentCache = this.balanceCache.get(agentId);
      const competitionCache = agentCache?.get(competitionId);
      if (competitionCache && competitionCache.has(tokenAddress)) {
        return competitionCache.get(tokenAddress) || 0;
      }

      // Get from database
      const balance = await this.balanceRepo.getBalance(
        agentId,
        tokenAddress,
        competitionId,
      );

      // If balance exists, update cache
      if (balance) {
        if (!this.balanceCache.has(agentId)) {
          this.balanceCache.set(agentId, new Map());
        }
        const agentCache = this.balanceCache.get(agentId)!;
        if (!agentCache.has(competitionId)) {
          agentCache.set(competitionId, new Map());
        }
        agentCache.get(competitionId)!.set(tokenAddress, balance.amount);
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
   * @param competitionId The competition ID (optional, will use active competition if not provided)
   * @returns Array of Balance objects
   */
  async getAllBalances(
    agentId: string,
    competitionId?: string,
  ): Promise<SelectBalance[]> {
    try {
      // TODO(ENG-783): Remove getActiveCompetition() and require competitionId from caller
      if (!competitionId) {
        if (!this.getActiveCompetitionFn) {
          throw new ApiError(
            400,
            "No active competition function provided to BalanceService",
          );
        }
        const activeComp = await this.getActiveCompetitionFn();
        if (!activeComp) {
          throw new ApiError(400, "No active competition");
        }
        competitionId = activeComp.id;
      }

      // Get from database
      const balances = await this.balanceRepo.getAgentBalances(
        agentId,
        competitionId,
      );

      // Update cache
      const balanceMap = new Map<string, number>();
      balances.forEach((balance) => {
        balanceMap.set(balance.tokenAddress, balance.amount);
      });

      if (!this.balanceCache.has(agentId)) {
        this.balanceCache.set(agentId, new Map());
      }
      this.balanceCache.get(agentId)!.set(competitionId, balanceMap);

      return balances;
    } catch (error) {
      this.logger.error(
        {
          error,
          agentId,
          competitionId,
        },
        `[BalanceManager] Error getting all balances for agent ${agentId}`,
      );
      return [];
    }
  }

  /**
   * Get all balances for multiple agents in bulk
   * @param agentIds Array of agent IDs
   * @param competitionId The competition ID (optional, will use active competition if not provided)
   * @returns Array of Balance objects for all agents
   */
  async getBulkBalances(
    agentIds: string[],
    competitionId?: string,
  ): Promise<SelectBalance[]> {
    try {
      if (agentIds.length === 0) {
        return [];
      }

      // TODO(ENG-783): Remove getActiveCompetition() and require competitionId from caller
      let resolvedCompetitionId: string;
      if (!competitionId) {
        if (!this.getActiveCompetitionFn) {
          throw new ApiError(
            400,
            "No active competition function provided to BalanceService",
          );
        }
        const activeComp = await this.getActiveCompetitionFn();
        if (!activeComp) {
          throw new ApiError(400, "No active competition");
        }
        resolvedCompetitionId = activeComp.id;
      } else {
        resolvedCompetitionId = competitionId;
      }

      this.logger.debug(
        `[BalanceManager] Getting bulk balances for ${agentIds.length} agents`,
      );

      // Get all balances from database in one query
      const balances = await this.balanceRepo.getAgentsBulkBalances(
        agentIds,
        resolvedCompetitionId,
      );

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
        if (!this.balanceCache.has(agentId)) {
          this.balanceCache.set(agentId, new Map());
        }
        this.balanceCache.get(agentId)!.set(resolvedCompetitionId, balanceMap);
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
   * @param competitionId The competition ID
   * @param competitionType The competition type
   */
  async resetAgentBalances(
    agentId: string,
    competitionId: string,
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
      await this.balanceRepo.resetAgentBalances(
        agentId,
        competitionId,
        initialBalances,
      );

      // Update cache
      const balanceMap = new Map<string, number>();
      initialBalances.forEach(({ amount }, tokenAddress) => {
        balanceMap.set(tokenAddress, amount);
      });

      if (!this.balanceCache.has(agentId)) {
        this.balanceCache.set(agentId, new Map());
      }
      this.balanceCache.get(agentId)!.set(competitionId, balanceMap);

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
   * @param competitionId The competition ID (optional, will use active competition if not provided)
   * @returns True if the agent has sufficient balance
   */
  async hasSufficientBalance(
    agentId: string,
    tokenAddress: string,
    amount: number,
    competitionId?: string,
  ): Promise<boolean> {
    const balance = await this.getBalance(agentId, tokenAddress, competitionId);
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
