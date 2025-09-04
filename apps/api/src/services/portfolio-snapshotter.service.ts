import { config } from "@/config/index.js";
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
import { PriceReport, SpecificChain } from "@/types/index.js";

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
        const backoffDelay = Math.min(
          1000 * Math.pow(2, attemptNumber - 2),
          10000,
        ); // Max 10 seconds
        repositoryLogger.debug(
          `[PortfolioSnapshotter] Retry attempt ${attemptNumber}/${maxRetries} for agent ${agentId} after ${backoffDelay}ms delay`,
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

      // Step 4: Try individual retries for failed tokens (with rate limiting)
      repositoryLogger.debug(
        `[PortfolioSnapshotter] ${failedTokens.length} tokens still missing prices for agent ${agentId}, trying individual fetches`,
      );

      for (const tokenAddress of failedTokens) {
        // Skip if we somehow got a price in the meantime
        if (priceMap.get(tokenAddress) !== null) {
          continue;
        }

        // Add delay between individual retries to avoid rate limiting
        // DexScreener has 100ms built-in rate limiting, so we add a small buffer
        // Shorter delay = faster recovery, but higher risk of rate limiting
        const individualRetryDelayMs = 200; // 200ms is safe given DexScreener's throttling
        await new Promise((resolve) =>
          setTimeout(resolve, individualRetryDelayMs),
        );

        const balance = balances.find((b) => b.tokenAddress === tokenAddress);
        if (balance) {
          const priceResult = await this.priceTracker.getPrice(
            tokenAddress,
            undefined,
            balance.specificChain as SpecificChain,
          );

          if (priceResult) {
            priceMap.set(tokenAddress, priceResult);
            repositoryLogger.debug(
              `[PortfolioSnapshotter] Individual retry successful for ${tokenAddress}: $${priceResult.price}`,
            );
          } else {
            // Keep it as null to indicate we tried
            repositoryLogger.warn(
              `[PortfolioSnapshotter] Individual retry failed for ${tokenAddress} (${balance.symbol})`,
            );
          }
        }
      }

      // Check if we've resolved all failures after individual retries
      const stillFailedCount = balances.filter(
        (balance) =>
          balance.amount > 0 && priceMap.get(balance.tokenAddress) === null,
      ).length;

      if (stillFailedCount === 0) {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] All prices resolved after individual retries for agent ${agentId}`,
        );
        break;
      }

      // If this was the last attempt and we still have failures, log it
      if (attemptNumber === maxRetries) {
        repositoryLogger.error(
          `[PortfolioSnapshotter] Failed to fetch prices for ${stillFailedCount} tokens after ${maxRetries} attempts for agent ${agentId}`,
        );
      }
    }

    // Step 4: Calculate total value
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

    // Step 5: Handle snapshot creation based on price fetch results
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

    // Pre-fetch all unique tokens to populate cache
    try {
      await this.preFetchAllTokenPrices(agents);
    } catch (error) {
      // Log warning but continue - individual agent snapshots will retry
      repositoryLogger.warn(
        `[PortfolioSnapshotter] Pre-fetch failed, will rely on per-agent fetching: ${error}`,
      );
    }

    // Dynamic batch processing based on cache TTL and rate limits
    // Goal: Complete all snapshots before price cache expires
    const cacheTTLMs = config.priceTracker.priceTTLMs || 60000; // Default 60s
    const safeProcessingTimeMs = cacheTTLMs * 0.8; // Use 80% of cache TTL to be safe
    const totalAgents = agents.length;

    // Calculate optimal batch size and delays
    // Assumption: ~200ms per agent processing time
    const ESTIMATED_AGENT_PROCESS_TIME_MS = 200;

    // Calculate how many batches we can fit in the safe processing time
    // If we have 100 agents and 48s (80% of 60s) to process them:
    // We need to determine batch size and delays
    let BATCH_SIZE: number;
    let BATCH_DELAY_MS: number;

    if (totalAgents <= 40) {
      // Small competition - process all at once
      BATCH_SIZE = totalAgents;
      BATCH_DELAY_MS = 0;
    } else if (totalAgents <= 200) {
      // Medium competition - optimize for cache TTL
      const maxBatches = 5; // Reasonable max to fit in cache TTL
      BATCH_SIZE = Math.ceil(totalAgents / maxBatches);
      // Calculate delay to fit within safe processing time
      const totalProcessingTime =
        BATCH_SIZE * ESTIMATED_AGENT_PROCESS_TIME_MS * maxBatches;
      const availableDelayTime = Math.max(
        0,
        safeProcessingTimeMs - totalProcessingTime,
      );
      BATCH_DELAY_MS = Math.min(
        15000,
        Math.floor(availableDelayTime / (maxBatches - 1)),
      );
    } else {
      // Large competition - use conservative defaults
      // May need to increase cache TTL for very large competitions
      BATCH_SIZE = 50;
      BATCH_DELAY_MS = 10000;
      repositoryLogger.warn(
        `[PortfolioSnapshotter] Large competition (${totalAgents} agents) may exceed cache TTL of ${cacheTTLMs}ms. ` +
          `Consider increasing PRICE_CACHE_TTL_MS for competitions this large.`,
      );
    }

    repositoryLogger.debug(
      `[PortfolioSnapshotter] Processing ${agents.length} agents in batches of ${BATCH_SIZE} with ${BATCH_DELAY_MS}ms delays. ` +
        `Cache TTL: ${cacheTTLMs}ms, Safe processing time: ${safeProcessingTimeMs}ms`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
      const batch = agents.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(agents.length / BATCH_SIZE);

      // Use current timestamp for this batch - ensures accurate time tracking
      // even if processing takes several minutes
      const batchTimestamp = new Date();

      repositoryLogger.debug(
        `[PortfolioSnapshotter] Processing batch ${batchNumber}/${totalBatches} (${batch.length} agents) at ${batchTimestamp.toISOString()}`,
      );

      // Process agents in this batch sequentially (they'll share token cache)
      for (const agentId of batch) {
        try {
          await this.takePortfolioSnapshotForAgent(
            competitionId,
            agentId,
            batchTimestamp,
            force,
          );
          successCount++;
        } catch (error) {
          // Log error but continue with other agents
          repositoryLogger.error(
            `[PortfolioSnapshotter] Failed to take snapshot for agent ${agentId}: ${error}`,
          );
          failureCount++;
          // Continue processing other agents rather than failing the entire batch
        }
      }

      // Add delay between batches (except after the last batch)
      if (i + BATCH_SIZE < agents.length) {
        repositoryLogger.debug(
          `[PortfolioSnapshotter] Batch ${batchNumber} complete. Waiting ${BATCH_DELAY_MS}ms before next batch...`,
        );
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log final summary
    if (failureCount > 0) {
      repositoryLogger.warn(
        `[PortfolioSnapshotter] Completed with partial failures: ${successCount} succeeded, ${failureCount} failed out of ${agents.length} agents. Duration: ${duration}ms (${Math.round(duration / 1000)}s)`,
      );
    } else {
      repositoryLogger.debug(
        `[PortfolioSnapshotter] Successfully completed all ${successCount} portfolio snapshots in ${duration}ms (${Math.round(duration / 1000)}s)`,
      );
    }
  }

  /**
   * Pre-fetch prices for all unique tokens across all agents
   * This populates the cache before processing to avoid cache expiration
   * @param agentIds Array of agent IDs
   */
  private async preFetchAllTokenPrices(agentIds: string[]): Promise<void> {
    repositoryLogger.debug(
      `[PortfolioSnapshotter] Pre-fetching token prices for ${agentIds.length} agents`,
    );

    // Step 1: Collect all unique tokens across all agents
    const uniqueTokens = new Set<string>();
    const tokenToAgentCount = new Map<string, number>(); // Track how many agents hold each token

    // Fetch all balances in bulk (much faster than sequential)
    const allBalances = await this.balanceManager.getBulkBalances(agentIds);

    for (const balance of allBalances) {
      if (balance.amount > 0) {
        uniqueTokens.add(balance.tokenAddress);
        tokenToAgentCount.set(
          balance.tokenAddress,
          (tokenToAgentCount.get(balance.tokenAddress) || 0) + 1,
        );
      }
    }

    const tokenArray = Array.from(uniqueTokens);
    repositoryLogger.debug(
      `[PortfolioSnapshotter] Found ${tokenArray.length} unique tokens across all agents`,
    );

    // Log most common tokens for debugging
    const commonTokens = Array.from(tokenToAgentCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([token, count]) => `${token.slice(0, 10)}...: ${count} agents`);

    if (commonTokens.length > 0) {
      repositoryLogger.debug(
        `[PortfolioSnapshotter] Most common tokens: ${commonTokens.join(", ")}`,
      );
    }

    // Step 2: Fetch prices in controlled batches
    // Dynamic sizing based on total tokens and cache TTL
    const cacheTTLMs = config.priceTracker.priceTTLMs || 60000;
    const totalTokens = tokenArray.length;

    // Calculate optimal pre-fetch batch size
    // For initial snapshots with ~15-20 tokens, we can fetch all at once
    // For larger sets, we need to batch to avoid rate limits
    let PREFETCH_BATCH_SIZE: number;
    let PREFETCH_DELAY_MS: number;

    if (totalTokens <= 30) {
      // Small token set - fetch all at once
      PREFETCH_BATCH_SIZE = totalTokens;
      PREFETCH_DELAY_MS = 0;
    } else if (totalTokens <= 100) {
      // Medium token set - 2-3 batches
      PREFETCH_BATCH_SIZE = 50;
      PREFETCH_DELAY_MS = 3000; // 3 seconds between batches
    } else {
      // Large token set - need more conservative approach
      PREFETCH_BATCH_SIZE = 40;
      PREFETCH_DELAY_MS = 5000; // 5 seconds between batches

      // Check if we might exceed cache TTL
      const estimatedTime =
        (Math.ceil(totalTokens / PREFETCH_BATCH_SIZE) - 1) * PREFETCH_DELAY_MS;
      if (estimatedTime > cacheTTLMs * 0.5) {
        repositoryLogger.warn(
          `[PortfolioSnapshotter] Pre-fetching ${totalTokens} tokens might exceed cache TTL. Consider increasing PRICE_CACHE_TTL_MS.`,
        );
      }
    }

    for (let i = 0; i < tokenArray.length; i += PREFETCH_BATCH_SIZE) {
      const batch = tokenArray.slice(i, i + PREFETCH_BATCH_SIZE);
      const batchNumber = Math.floor(i / PREFETCH_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(tokenArray.length / PREFETCH_BATCH_SIZE);

      repositoryLogger.debug(
        `[PortfolioSnapshotter] Pre-fetching price batch ${batchNumber}/${totalBatches} (${batch.length} tokens)`,
      );

      // Fetch this batch of prices (will be cached)
      const prices = await this.priceTracker.getBulkPrices(batch);

      // Log how many succeeded
      const successCount = Array.from(prices.values()).filter(
        (p) => p !== null,
      ).length;
      repositoryLogger.debug(
        `[PortfolioSnapshotter] Pre-fetch batch ${batchNumber}: ${successCount}/${batch.length} prices fetched successfully`,
      );

      // Add delay between batches to avoid rate limiting (except after last batch)
      if (
        i + PREFETCH_BATCH_SIZE < tokenArray.length &&
        PREFETCH_DELAY_MS > 0
      ) {
        await new Promise((resolve) => setTimeout(resolve, PREFETCH_DELAY_MS));
      }
    }

    repositoryLogger.debug(
      `[PortfolioSnapshotter] Pre-fetch complete. Cache is now warm for all tokens.`,
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
