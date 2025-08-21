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
import {
  BalanceManager,
  ConfigurationService,
  PriceTracker,
} from "@/services/index.js";
import { SpecificChain } from "@/types/index.js";

/**
 * Portfolio Snapshotter Service
 * Manages creating portfolio snapshots
 */
export class PortfolioSnapshotter {
  private balanceManager: BalanceManager;
  private priceTracker: PriceTracker;
  private configurationService: ConfigurationService;

  constructor(
    balanceManager: BalanceManager,
    priceTracker: PriceTracker,
    configurationService: ConfigurationService,
  ) {
    this.balanceManager = balanceManager;
    this.priceTracker = priceTracker;
    this.configurationService = configurationService;
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
      const priceResult = await this.priceTracker.getPrice(
        balance.tokenAddress,
        undefined, // Let PriceTracker determine blockchain type
        balance.specificChain as SpecificChain,
      );

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
