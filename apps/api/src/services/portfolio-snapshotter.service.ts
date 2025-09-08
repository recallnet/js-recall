import {
  createPortfolioSnapshot,
  findAll,
  findById,
  getAgentPortfolioSnapshots,
  getAgentPortfolioTimeline,
  getCompetitionAgents,
} from "@/database/repositories/competition-repository.js";
import { repositoryLogger } from "@/lib/logger.js";
import { serviceLogger } from "@/lib/logger.js";
import { BalanceManager, PriceTracker } from "@/services/index.js";
import { PriceReport } from "@/types/index.js";

/**
 * Portfolio Snapshotter Service
 * Manages creating portfolio snapshots
 */
export class PortfolioSnapshotter {
  private balanceManager: BalanceManager;
  private priceTracker: PriceTracker;

  constructor(balanceManager: BalanceManager, priceTracker: PriceTracker) {
    this.balanceManager = balanceManager;
    this.priceTracker = priceTracker;
  }

  /**
   * Take a portfolio snapshot for a specific agent in a competition
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @param timestamp Optional timestamp for the snapshot (defaults to current time)
   * @param force Optional flag to force snapshot even if competition has ended
   * @param maxRetries Maximum number of retry attempts if price fetching fails (defaults to 3)
   */
  async takePortfolioSnapshotForAgent(
    competitionId: string,
    agentId: string,
    timestamp: Date = new Date(),
    force: boolean = false,
    maxRetries: number = 3,
  ): Promise<void> {
    repositoryLogger.debug(
      `[PortfolioSnapshotter] Taking portfolio snapshot for agent ${agentId} in competition ${competitionId}`,
    );

    // Check if competition exists and if end date has passed
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error(`Competition with ID ${competitionId} not found`);
    }

    const now = new Date();
    if (competition.endDate && now > competition.endDate) {
      if (!force) {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] Competition ${competitionId} has ended (end date: ${competition.endDate.toISOString()}, current time: ${timestamp.toISOString()}). Skipping portfolio snapshot for agent ${agentId}`,
        );
        return;
      }
      // Competition has ended but we're forcing the snapshot
      repositoryLogger.debug(
        `[PortfolioSnapshotter] Competition ${competitionId} has ended, but taking final snapshot anyway (forced) for agent ${agentId}`,
      );
    }

    const balances = await this.balanceManager.getAllBalances(agentId);

    // Skip if no balances
    if (balances.length === 0) {
      repositoryLogger.debug(
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
    const hasFailures = balances.some(
      (balance) =>
        balance.amount > 0 && priceMap.get(balance.tokenAddress) === null,
    );
    if (hasFailures) {
      // We have incomplete price data - skip snapshot creation
      // Detailed error logging already done in fetchPricesWithRetries
      repositoryLogger.warn(
        `[PortfolioSnapshotter] Skipping snapshot creation for agent ${agentId} due to incomplete price data.`,
      );
      return;
    }

    // Calculate total portfolio value (we know all prices are available now)
    const { totalValue, pricesFetched } = this.calculatePortfolioValue(
      balances,
      priceMap,
    );

    // All prices fetched successfully - create accurate snapshot
    await createPortfolioSnapshot({
      agentId,
      competitionId,
      timestamp,
      totalValue,
    });

    repositoryLogger.debug(
      `[PortfolioSnapshotter] Completed portfolio snapshot for agent ${agentId} with calculated total value $${totalValue.toFixed(2)}. ` +
        `All ${pricesFetched} prices fetched successfully.`,
    );
  }

  /**
   * Take portfolio snapshots for all agents in a competition
   * @param competitionId The competition ID
   * @param force Optional flag to force snapshots even if competition has ended
   */
  async takePortfolioSnapshots(competitionId: string, force: boolean = false) {
    repositoryLogger.debug(
      `[PortfolioSnapshotter] Taking portfolio snapshots for competition ${competitionId}${force ? " (forced)" : ""}`,
    );

    const startTime = Date.now();
    const agents = await getCompetitionAgents(competitionId);
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

    repositoryLogger.debug(
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
    const snapshots = await getAgentPortfolioSnapshots(
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
   * @returns Array of portfolio timelines per agent
   */
  async getAgentPortfolioTimeline(competitionId: string, bucket: number = 30) {
    return await getAgentPortfolioTimeline(competitionId, bucket);
  }

  /**
   * Check if Portfolio Snapshotter is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await findAll();
      return true;
    } catch (error) {
      serviceLogger.error("[PortfolioSnapshotter] Health check failed:", error);
      return false;
    }
  }

  /**
   * Fetch prices for tokens with retry logic and exponential backoff
   * @private
   */
  private async fetchPricesWithRetries(
    balances: Array<{ tokenAddress: string; amount: number; symbol: string }>,
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
        repositoryLogger.debug(
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
        for (const balance of balances) {
          if (
            balance.amount > 0 &&
            priceMap.get(balance.tokenAddress) === null
          ) {
            tokensNeedingPrices.push(balance.tokenAddress);
          }
        }
      }

      // If we have all prices already, we're done
      if (tokensNeedingPrices.length === 0) {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] All prices already fetched for agent ${agentId}`,
        );
        break;
      }

      // Step 2: Try batch pricing for tokens that need prices
      repositoryLogger.debug(
        `[PortfolioSnapshotter] Fetching prices for ${tokensNeedingPrices.length} tokens (attempt ${attemptNumber}/${maxRetries + 1})`,
      );
      const newPrices =
        await this.priceTracker.getBulkPrices(tokensNeedingPrices);

      // Merge new prices into our map (preserving existing successful prices)
      for (const [tokenAddress, priceReport] of newPrices) {
        // Only update if we got a successful price (not null)
        if (priceReport !== null) {
          priceMap.set(tokenAddress, priceReport);
        } else if (!priceMap.has(tokenAddress)) {
          // Set to null if we don't have it yet (to track that we tried)
          priceMap.set(tokenAddress, null);
        }
      }

      // Step 3: Check if we have all prices we need
      const allPricesFetched = !balances.some(
        (balance) =>
          balance.amount > 0 && priceMap.get(balance.tokenAddress) === null,
      );

      if (allPricesFetched) {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] All prices fetched successfully for agent ${agentId} on attempt ${attemptNumber}`,
        );
        break;
      }

      // Log remaining failures for this attempt
      if (attemptNumber === maxRetries + 1) {
        // Build detailed list of missing tokens for final error
        const missingTokenDetails: string[] = [];
        let failedCount = 0;
        for (const balance of balances) {
          if (
            priceMap.get(balance.tokenAddress) === null &&
            balance.amount > 0
          ) {
            missingTokenDetails.push(
              `${balance.tokenAddress} (${balance.symbol})`,
            );
            failedCount++;
          }
        }
        repositoryLogger.error(
          `[PortfolioSnapshotter] Failed to fetch prices for ${failedCount} tokens after ${maxRetries + 1} attempts for agent ${agentId}. ` +
            `Missing prices for: ${missingTokenDetails.join(", ")}`,
        );
      } else {
        // Count failures for debug message
        const failedCount = balances.filter(
          (balance) =>
            balance.amount > 0 && priceMap.get(balance.tokenAddress) === null,
        ).length;
        repositoryLogger.debug(
          `[PortfolioSnapshotter] ${failedCount} tokens still missing prices for agent ${agentId}, will retry entire batch`,
        );
      }
    }

    return priceMap;
  }

  /**
   * Calculate the total portfolio value from balances and prices
   * Assumes all prices are available (verified by caller)
   * @private
   */
  private calculatePortfolioValue(
    balances: Array<{ tokenAddress: string; amount: number; symbol: string }>,
    priceMap: Map<string, PriceReport | null>,
  ): {
    totalValue: number;
    pricesFetched: number;
  } {
    let totalValue = 0;
    let pricesFetched = 0;

    for (const balance of balances) {
      // Skip zero balances
      if (balance.amount === 0) {
        continue;
      }

      const priceResult = priceMap.get(balance.tokenAddress);
      // We know all prices are available since we checked before calling this
      if (priceResult) {
        const valueUsd = balance.amount * priceResult.price;
        totalValue += valueUsd;
        pricesFetched++;
      }
    }

    return { totalValue, pricesFetched };
  }
}
