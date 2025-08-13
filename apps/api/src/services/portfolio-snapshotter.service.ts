import { config } from "@/config/index.js";
import {
  createPortfolioSnapshot,
  findAll,
  findById,
  getAgentPortfolioSnapshots,
  getAgentPortfolioTimeline,
  getCompetitionAgents,
} from "@/database/repositories/competition-repository.js";
import { getLatestPrice } from "@/database/repositories/price-repository.js";
import { repositoryLogger } from "@/lib/logger.js";
import { serviceLogger } from "@/lib/logger.js";
import { BalanceManager, PriceTracker } from "@/services/index.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

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
   */
  async takePortfolioSnapshotForAgent(
    competitionId: string,
    agentId: string,
    timestamp: Date = new Date(),
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
      repositoryLogger.debug(
        `[PortfolioSnapshotter] Competition ${competitionId} has ended (end date: ${competition.endDate.toISOString()}, current time: ${timestamp.toISOString()}). Skipping portfolio snapshot for agent ${agentId}`,
      );
      return;
    }

    const balances = await this.balanceManager.getAllBalances(agentId);
    let totalValue = 0;

    for (const balance of balances) {
      // First try to get latest price record from the database to reuse chain information
      const latestPriceRecord = await getLatestPrice(
        balance.tokenAddress,
        balance.specificChain as SpecificChain,
      );

      let specificChain: string | null;
      let priceResult;

      if (
        latestPriceRecord &&
        latestPriceRecord.timestamp &&
        latestPriceRecord.chain &&
        latestPriceRecord.specificChain
      ) {
        specificChain = latestPriceRecord.specificChain;

        // If price is recent enough (less than 10 minutes old), use it directly
        const priceAge = Date.now() - latestPriceRecord.timestamp.getTime();
        const isFreshPrice = priceAge < config.portfolio.priceFreshnessMs;

        if (isFreshPrice) {
          // Use the existing price if it's fresh
          priceResult = {
            price: latestPriceRecord.price,
            symbol: latestPriceRecord.symbol,
            timestamp: latestPriceRecord.timestamp,
            // TODO: Implement typing for these as Drizzle enums or custom types
            chain: latestPriceRecord.chain as BlockchainType,
            specificChain: latestPriceRecord.specificChain as SpecificChain,
            token: latestPriceRecord.token,
          };
          repositoryLogger.debug(
            `[PortfolioSnapshotter] Using fresh price for ${balance.tokenAddress} from DB: $${priceResult.price} (${specificChain}) - age ${Math.round(priceAge / 1000)}s, threshold ${Math.round(config.portfolio.priceFreshnessMs / 1000)}s`,
          );
        } else if (specificChain && latestPriceRecord.chain) {
          // Use specific chain information to avoid chain detection when fetching a new price
          repositoryLogger.debug(
            `[PortfolioSnapshotter] Using specific chain info from DB for ${balance.tokenAddress}: ${specificChain}`,
          );

          // Pass both chain type and specific chain to getPrice to bypass chain detection
          const result = await this.priceTracker.getPrice(
            balance.tokenAddress,
            latestPriceRecord.chain as BlockchainType,
            specificChain as SpecificChain,
          );
          if (result !== null) {
            priceResult = result;
          }
        } else {
          // Fallback to regular price lookup
          const result = await this.priceTracker.getPrice(balance.tokenAddress);
          if (result !== null) {
            priceResult = result;
          }
        }
      } else {
        // No price record found, do regular price lookup
        const result = await this.priceTracker.getPrice(balance.tokenAddress);
        if (result !== null) {
          priceResult = result;
        }
      }

      if (priceResult) {
        const valueUsd = balance.amount * priceResult.price;
        totalValue += valueUsd;
      } else {
        repositoryLogger.warn(
          `[PortfolioSnapshotter] No price available for token ${balance.tokenAddress}, excluding from portfolio snapshot`,
        );
      }
    }

    // Create portfolio snapshot in database
    await createPortfolioSnapshot({
      agentId,
      competitionId,
      timestamp,
      totalValue,
    });

    repositoryLogger.debug(
      `[PortfolioSnapshotter] Completed portfolio snapshot for agent ${agentId} - Total value: $${totalValue.toFixed(2)}`,
    );
  }

  /**
   * Take portfolio snapshots for all agents in a competition
   * @param competitionId The competition ID
   */
  async takePortfolioSnapshots(competitionId: string) {
    repositoryLogger.debug(
      `[PortfolioSnapshotter] Taking portfolio snapshots for competition ${competitionId}`,
    );

    const startTime = Date.now();
    const agents = await getCompetitionAgents(competitionId);
    const timestamp = new Date();

    for (const agentId of agents) {
      await this.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
        timestamp,
      );
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    repositoryLogger.debug(
      `[PortfolioSnapshotter] Completed portfolio snapshots for ${agents.length} agents in ${duration}ms`,
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
