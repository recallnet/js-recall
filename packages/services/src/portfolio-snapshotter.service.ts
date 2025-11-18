import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

import { BalanceService } from "./balance.service.js";
import { PriceTrackerService } from "./price-tracker.service.js";
import { BlockchainType, PriceReport, SpecificChain } from "./types/index.js";

/**
 * Portfolio Snapshotter Service
 * Manages creating portfolio snapshots
 */
export class PortfolioSnapshotterService {
  private balanceService: BalanceService;
  private priceTrackerService: PriceTrackerService;
  private competitionRepo: CompetitionRepository;
  private logger: Logger;

  constructor(
    balanceService: BalanceService,
    priceTrackerService: PriceTrackerService,
    competitionRepo: CompetitionRepository,
    logger: Logger,
  ) {
    this.balanceService = balanceService;
    this.priceTrackerService = priceTrackerService;
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }

  /**
   * Take a portfolio snapshot for a specific agent in a competition
   *
   * Behavior on price fetch failures:
   * - Retries with exponential backoff up to maxRetries times
   * - If prices still cannot be fetched after all retries, the method logs a warning and returns silently
   * - No snapshot is created when prices are missing (no snapshot is better than an inaccurate one)
   * - This is NOT an exception - it's an expected condition during high load periods
   * - The method returns normally to allow batch processing to continue for other agents
   *
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @param timestamp Optional timestamp for the snapshot (defaults to current time)
   * @param force Optional flag to force snapshot even if competition has ended
   * @param maxRetries Maximum number of retry attempts if price fetching fails (defaults to 3)
   * @returns Promise<void> - Completes successfully even if snapshot creation is skipped
   */
  async takePortfolioSnapshotForAgent(
    competitionId: string,
    agentId: string,
    timestamp: Date = new Date(),
    force: boolean = false,
    maxRetries: number = 3,
  ): Promise<void> {
    this.logger.debug(
      `[PortfolioSnapshotter] Taking portfolio snapshot for agent ${agentId} in competition ${competitionId}`,
    );

    // Check if competition exists and if end date has passed
    const competition = await this.competitionRepo.findById(competitionId);
    if (!competition) {
      throw new Error(`Competition with ID ${competitionId} not found`);
    }

    const now = new Date();
    if (competition.endDate && now > competition.endDate) {
      if (!force) {
        this.logger.debug(
          `[PortfolioSnapshotter] Competition ${competitionId} has ended (end date: ${competition.endDate.toISOString()}, current time: ${timestamp.toISOString()}). Skipping portfolio snapshot for agent ${agentId}`,
        );
        return;
      }
      // Competition has ended but we're forcing the snapshot
      this.logger.debug(
        `[PortfolioSnapshotter] Competition ${competitionId} has ended, but taking final snapshot anyway (forced) for agent ${agentId}`,
      );
    }

    const balances = await this.balanceService.getAllBalances(
      agentId,
      competitionId,
    );

    // Skip if no balances
    if (balances.length === 0) {
      this.logger.debug(
        `[PortfolioSnapshotter] No balances found for agent ${agentId}, skipping snapshot`,
      );
      return;
    }

    // Fetch prices with retry logic
    const priceMap = await this.fetchPricesWithRetries(
      balances,
      agentId,
      maxRetries,
    );

    // Check if we have any price failures for non-zero balances and fail fast
    const hasFailures = balances.some((balance) => {
      const priceKey = this.getPriceMapKey(
        balance.tokenAddress,
        balance.specificChain,
      );
      return balance.amount > 0 && priceMap.get(priceKey) == null;
    });
    if (hasFailures) {
      // We have incomplete price data - skip snapshot creation
      // Detailed error logging already done in fetchPricesWithRetries
      this.logger.warn(
        `[PortfolioSnapshotter] Skipping snapshot creation for agent ${agentId} due to incomplete price data.`,
      );
      return;
    }

    // Calculate total portfolio value (we know all prices are available now)
    const totalValue = this.calculatePortfolioValue(balances, priceMap);

    // All prices fetched successfully - create accurate snapshot
    await this.competitionRepo.createPortfolioSnapshot({
      agentId,
      competitionId,
      timestamp,
      totalValue,
    });

    // Count non-zero balances for logging
    const nonZeroBalances = balances.filter((b) => b.amount > 0).length;

    this.logger.debug(
      `[PortfolioSnapshotter] Completed portfolio snapshot for agent ${agentId} with calculated total value $${totalValue.toFixed(2)}. ` +
        `All ${nonZeroBalances} token prices fetched successfully.`,
    );
  }

  /**
   * Take portfolio snapshots for all agents in a competition
   * @param competitionId The competition ID
   * @param force Optional flag to force snapshots even if competition has ended
   */
  async takePortfolioSnapshots(competitionId: string, force: boolean = false) {
    this.logger.debug(
      `[PortfolioSnapshotter] Taking portfolio snapshots for competition ${competitionId}${force ? " (forced)" : ""}`,
    );

    const startTime = Date.now();
    const agents =
      await this.competitionRepo.getCompetitionAgents(competitionId);
    const timestamp = new Date();

    for (const agentId of agents) {
      await this.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
        timestamp,
        force,
      );
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.logger.debug(
      `[PortfolioSnapshotter] Completed portfolio snapshots for competition ${competitionId} in ${duration}ms (${Math.round(duration / 1000)}s)`,
    );
  }

  /**
   * Get portfolio snapshots for an agent in a competition
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @param limit Optional limit for the number of snapshots to return
   * @returns Array of portfolio snapshots
   */
  async getAgentPortfolioSnapshots(
    competitionId: string,
    agentId: string,
    limit?: number,
  ) {
    const snapshots = await this.competitionRepo.getAgentPortfolioSnapshots(
      competitionId,
      agentId,
      limit,
    );

    return snapshots;
  }

  /**
   * Get portfolio timeline for agents in a competition
   * @param competitionId The competition ID
   * @param bucket Time bucket interval in minutes (default: 30)
   * @param includeRiskMetrics Whether to include risk metrics (for perps competitions)
   * @returns Array of portfolio timelines per agent
   */
  async getAgentPortfolioTimeline(
    competitionId: string,
    bucket: number = 30,
    includeRiskMetrics = false,
  ) {
    return await this.competitionRepo.getAgentPortfolioTimeline(
      competitionId,
      bucket,
      includeRiskMetrics,
    );
  }

  /**
   * Check if Portfolio Snapshotter is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await this.competitionRepo.findAll();
      return true;
    } catch (error) {
      this.logger.error(
        { error },
        "[PortfolioSnapshotter] Health check failed",
      );
      return false;
    }
  }

  /**
   * Generate cache key for price map that includes chain
   * Prevents chain collision for tokens with same address on multiple chains
   * Uses same format as PriceTrackerService.getCacheKey() for consistency
   * @private
   */
  private getPriceMapKey(tokenAddress: string, specificChain: string): string {
    return `${tokenAddress.toLowerCase()}:${specificChain}`;
  }

  /**
   * Fetch prices for tokens with retry logic and exponential backoff
   * @private
   */
  private async fetchPricesWithRetries(
    balances: Array<{
      tokenAddress: string;
      amount: number;
      symbol: string;
      specificChain: string;
    }>,
    agentId: string,
    maxRetries: number,
  ): Promise<Map<string, PriceReport | null>> {
    const priceMap: Map<string, PriceReport | null> = new Map();

    // Loop will run maxRetries + 1 times (initial attempt + retries)
    for (
      let attemptNumber = 1;
      attemptNumber <= maxRetries + 1;
      attemptNumber++
    ) {
      // Add exponential backoff delay between retry attempts (except first attempt)
      if (attemptNumber > 1) {
        // Exponential backoff: attemptNumber - 2 is intentional to get 1s, 2s, 4s progression
        // Attempt 2: 2^(2-2) = 2^0 = 1 second
        // Attempt 3: 2^(3-2) = 2^1 = 2 seconds
        // Attempt 4: 2^(4-2) = 2^2 = 4 seconds
        const backoffDelay = Math.min(
          1000 * Math.pow(2, attemptNumber - 2),
          10000,
        ); // Max 10 seconds
        this.logger.debug(
          `[PortfolioSnapshotter] Retry attempt ${attemptNumber}/${maxRetries + 1} for agent ${agentId} after ${backoffDelay}ms delay`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }

      // Step 1: Determine which tokens need prices
      const tokensNeedingPrices: string[] = [];
      if (attemptNumber === 1) {
        // First attempt: fetch all tokens
        tokensNeedingPrices.push(...balances.map((b) => b.tokenAddress));
      } else {
        // Subsequent attempts: only fetch tokens that don't have prices yet
        // Use Set to avoid duplicates when same address exists on multiple chains
        const tokensNeedingSet = new Set<string>();
        for (const balance of balances) {
          const priceKey = this.getPriceMapKey(
            balance.tokenAddress,
            balance.specificChain,
          );
          if (balance.amount > 0 && priceMap.get(priceKey) == null) {
            tokensNeedingSet.add(balance.tokenAddress);
          }
        }
        tokensNeedingPrices.push(...Array.from(tokensNeedingSet));
      }

      // If we have all prices already, we're done
      if (tokensNeedingPrices.length === 0) {
        this.logger.debug(
          `[PortfolioSnapshotter] All prices already fetched for agent ${agentId}`,
        );
        break;
      }

      // Step 2: Try batch pricing for tokens that need prices
      this.logger.debug(
        `[PortfolioSnapshotter] Fetching prices for ${tokensNeedingPrices.length} tokens (attempt ${attemptNumber}/${maxRetries + 1})`,
      );
      const newPrices =
        await this.priceTrackerService.getBulkPrices(tokensNeedingPrices);

      // Build token-to-chains mapping once before loop for efficiency
      const tokenToChains = new Map<string, string[]>();
      for (const balance of balances) {
        const addr = balance.tokenAddress.toLowerCase();
        if (!tokenToChains.has(addr)) {
          tokenToChains.set(addr, []);
        }
        tokenToChains.get(addr)!.push(balance.specificChain);
      }

      // Merge new prices into our map (preserving existing successful prices)
      // Use chain-specific keys to prevent collisions for same address on different chains
      for (const [tokenAddress, priceReport] of newPrices) {
        // Get all chains where this token exists (from pre-built map)
        const chainsWithToken =
          tokenToChains.get(tokenAddress.toLowerCase()) ?? [];

        if (priceReport !== null && priceReport.specificChain) {
          // Store successful price for the specific chain returned by API
          const priceKey = this.getPriceMapKey(
            tokenAddress,
            priceReport.specificChain,
          );
          priceMap.set(priceKey, priceReport);

          // Also mark other chains as attempted but unavailable (null)
          // This prevents undefined checks from passing when price only exists on one chain
          for (const chain of chainsWithToken) {
            if (chain !== priceReport.specificChain) {
              const otherChainKey = this.getPriceMapKey(tokenAddress, chain);
              if (!priceMap.has(otherChainKey)) {
                priceMap.set(otherChainKey, null);
              }
            }
          }
        } else {
          // For null prices, set for all chains this token might be on
          for (const chain of chainsWithToken) {
            const priceKey = this.getPriceMapKey(tokenAddress, chain);
            if (!priceMap.has(priceKey)) {
              // Set to null if we don't have it yet (to track that we tried)
              priceMap.set(priceKey, null);
            }
          }
        }
      }

      // Step 3: Handle multi-chain token edge case
      // Edge case: If the same token address exists on multiple chains (e.g., ORDER on Arbitrum and Polygon)
      // and an agent holds it on multiple chains, getBulkPrices only returns ONE price (first chain found).
      // For any token+chain combinations still missing, we need to fetch them individually with the specific chain parameter.
      for (const balance of balances) {
        if (balance.amount === 0) {
          continue;
        }

        const priceKey = this.getPriceMapKey(
          balance.tokenAddress,
          balance.specificChain,
        );

        // If this specific token+chain combination is still missing after batch fetch
        if (priceMap.get(priceKey) == null) {
          this.logger.debug(
            `[PortfolioSnapshotter] Token ${balance.tokenAddress} on ${balance.specificChain} still missing after batch, fetching individually`,
          );

          try {
            const blockchainType =
              balance.specificChain === "svm"
                ? BlockchainType.SVM
                : BlockchainType.EVM;

            const chainSpecificPrice = await this.priceTrackerService.getPrice(
              balance.tokenAddress,
              blockchainType,
              balance.specificChain as SpecificChain,
            );

            if (chainSpecificPrice) {
              priceMap.set(priceKey, chainSpecificPrice);
              this.logger.debug(
                `[PortfolioSnapshotter] Successfully fetched chain-specific price for ${balance.tokenAddress} on ${balance.specificChain}: $${chainSpecificPrice.price}`,
              );
            } else {
              priceMap.set(priceKey, null);
            }
          } catch (error) {
            this.logger.debug(
              { error },
              `[PortfolioSnapshotter] Error fetching chain-specific price for ${balance.tokenAddress} on ${balance.specificChain}`,
            );
            priceMap.set(priceKey, null);
          }
        }
      }

      // Step 4: Check if we have all prices we need
      const allPricesFetched = !balances.some((balance) => {
        const priceKey = this.getPriceMapKey(
          balance.tokenAddress,
          balance.specificChain,
        );
        return balance.amount > 0 && priceMap.get(priceKey) == null;
      });

      if (allPricesFetched) {
        this.logger.debug(
          `[PortfolioSnapshotter] All prices fetched successfully for agent ${agentId} on attempt ${attemptNumber}`,
        );
        break;
      }

      // Step 5: Log remaining failures for this attempt
      if (attemptNumber === maxRetries + 1) {
        // Build detailed list of missing tokens for final error
        const missingTokenDetails: string[] = [];
        let failedCount = 0;
        for (const balance of balances) {
          const priceKey = this.getPriceMapKey(
            balance.tokenAddress,
            balance.specificChain,
          );
          if (priceMap.get(priceKey) == null && balance.amount > 0) {
            missingTokenDetails.push(
              `${balance.tokenAddress} on ${balance.specificChain} (${balance.symbol})`,
            );
            failedCount++;
          }
        }
        this.logger.error(
          `[PortfolioSnapshotter] Failed to fetch prices for ${failedCount} tokens after ${maxRetries + 1} attempts for agent ${agentId}. ` +
            `Missing prices for: ${missingTokenDetails.join(", ")}`,
        );
      } else {
        // Count failures for debug message
        const failedCount = balances.filter((balance) => {
          const priceKey = this.getPriceMapKey(
            balance.tokenAddress,
            balance.specificChain,
          );
          return balance.amount > 0 && priceMap.get(priceKey) == null;
        }).length;
        this.logger.debug(
          `[PortfolioSnapshotter] ${failedCount} tokens still missing prices for agent ${agentId}, will retry entire batch`,
        );
      }
    }

    return priceMap;
  }

  /**
   * Calculate the total portfolio value from balances and prices
   * Assumes all prices are available (verified by caller)
   * Matches prices to balances using both token address and chain to handle
   * tokens with same address on multiple chains
   * @private
   */
  private calculatePortfolioValue(
    balances: Array<{
      tokenAddress: string;
      amount: number;
      symbol: string;
      specificChain: string;
    }>,
    priceMap: Map<string, PriceReport | null>,
  ): number {
    let totalValue = 0;

    for (const balance of balances) {
      // Skip zero balances
      if (balance.amount === 0) {
        continue;
      }

      // Use chain-specific key to lookup price
      const priceKey = this.getPriceMapKey(
        balance.tokenAddress,
        balance.specificChain,
      );
      const priceResult = priceMap.get(priceKey);
      // We know all prices are available since we checked before calling this
      if (priceResult) {
        const valueUsd = balance.amount * priceResult.price;
        totalValue += valueUsd;
      }
    }

    return totalValue;
  }
}
