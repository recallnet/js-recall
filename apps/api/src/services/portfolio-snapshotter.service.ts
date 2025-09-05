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
    const startTime = Date.now();
    // Dynamic timeout based on expected processing time
    // Base time + (retries * backoff) + individual retries
    // For initial snapshots with ~20 tokens: ~10-15 seconds should be enough
    // For complex portfolios with many tokens: might need 30-60 seconds
    const MAX_AGENT_SNAPSHOT_TIME = Math.min(
      60000, // Max 60 seconds
      15000 + maxRetries * 5000, // Base 15s + 5s per retry attempt
    );
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

    // Retry loop for the entire snapshot if there are any failures
    let attemptNumber = 0;
    const priceMap: Map<string, PriceReport | null> = new Map();

    // Ensure at least one attempt even if maxRetries is 0
    // This handles the edge case where maxRetries=0 should still make 1 attempt
    const effectiveMaxRetries = Math.max(1, maxRetries);

    while (attemptNumber < effectiveMaxRetries) {
      attemptNumber++;

      // Check if we've exceeded max time for this agent
      if (Date.now() - startTime > MAX_AGENT_SNAPSHOT_TIME) {
        repositoryLogger.error(
          `[PortfolioSnapshotter] Timeout: Agent ${agentId} snapshot exceeded ${MAX_AGENT_SNAPSHOT_TIME}ms, aborting`,
        );
        break;
      }

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
          `[PortfolioSnapshotter] Retry attempt ${attemptNumber}/${effectiveMaxRetries} for agent ${agentId} after ${backoffDelay}ms delay`,
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
        `[PortfolioSnapshotter] Fetching prices for ${tokensNeedingPrices.length} tokens (attempt ${attemptNumber}/${maxRetries})`,
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

      // Step 3: Identify tokens that still need prices after batch
      const failedTokens: string[] = [];
      for (const balance of balances) {
        const priceReport = priceMap.get(balance.tokenAddress);
        // Only count as failed if the fetch actually failed (null), not if price is 0
        if (priceReport === null && balance.amount > 0) {
          failedTokens.push(balance.tokenAddress);
        }
      }

      // If no failures, we're done!
      if (failedTokens.length === 0) {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] All prices fetched successfully for agent ${agentId} on attempt ${attemptNumber}`,
        );
        break;
      }

      // Log remaining failures for this attempt
      if (attemptNumber === effectiveMaxRetries) {
        repositoryLogger.error(
          `[PortfolioSnapshotter] Failed to fetch prices for ${failedTokens.length} tokens after ${effectiveMaxRetries} attempts for agent ${agentId}`,
        );
      } else {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] ${failedTokens.length} tokens still missing prices for agent ${agentId}, will retry entire batch`,
        );
      }
    }

    // Step 3: Calculate total value
    let totalValue = 0;
    let pricesFetched = 0;
    let pricesFailed = 0;
    const missingPriceTokens: string[] = [];

    for (const balance of balances) {
      // Skip zero balances
      if (balance.amount === 0) {
        continue;
      }

      const priceResult = priceMap.get(balance.tokenAddress);
      if (priceResult !== null && priceResult !== undefined) {
        // We have a valid PriceReport (fetch succeeded)
        const valueUsd = balance.amount * priceResult.price;
        totalValue += valueUsd;
        pricesFetched++;
      } else {
        // Price fetch failed (null) or token wasn't in the response (undefined)
        pricesFailed++;
        missingPriceTokens.push(`${balance.tokenAddress} (${balance.symbol})`);
      }
    }

    // Step 4: Handle snapshot creation based on price fetch results
    if (pricesFailed > 0) {
      // We have incomplete price data - use most recent valid snapshot instead
      repositoryLogger.warn(
        `[PortfolioSnapshotter] Failed to get prices for ${pricesFailed}/${balances.filter((b) => b.amount > 0).length} tokens for agent ${agentId}: ${missingPriceTokens.join(", ")}. Attempting to use previous snapshot value.`,
      );

      // Get the most recent snapshot for this agent
      const recentSnapshots = await getAgentPortfolioSnapshots(
        competitionId,
        agentId,
        1, // limit to 1 most recent
      );

      if (recentSnapshots.length > 0 && recentSnapshots[0]) {
        const mostRecentSnapshot = recentSnapshots[0];
        const previousValue = Number(mostRecentSnapshot.totalValue);

        // Create a new snapshot with the carried-forward value
        await createPortfolioSnapshot({
          agentId,
          competitionId,
          timestamp,
          totalValue: previousValue,
        });

        repositoryLogger.info(
          `[PortfolioSnapshotter] Created snapshot for agent ${agentId} using previous value of $${previousValue.toFixed(2)} ` +
            `from ${mostRecentSnapshot.timestamp.toISOString()} due to ${pricesFailed} price fetch failures`,
        );
      } else {
        // No previous snapshot exists - this is likely the first snapshot and we can't get prices
        repositoryLogger.error(
          `[PortfolioSnapshotter] Cannot create initial snapshot for agent ${agentId} - ` +
            `failed to fetch prices for ${pricesFailed} tokens and no previous snapshot exists to use as fallback. ` +
            `Missing prices for: ${missingPriceTokens.join(", ")}`,
        );
        // Don't create a zero-value or partial-value snapshot
        return;
      }
    } else {
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
}
