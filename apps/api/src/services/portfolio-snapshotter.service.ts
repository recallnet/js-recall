import { config } from "@/config/index.js";
import {
  createPortfolioSnapshot,
  createPortfolioTokenValue,
  findAll,
  getAgentPortfolioSnapshots,
  getCompetitionAgents,
  getPortfolioTokenValues,
} from "@/database/repositories/competition-repository.js";
import { getLatestPrice } from "@/database/repositories/price-repository.js";
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
   * Take portfolio snapshots for all agents in a competition
   * @param competitionId The competition ID
   */
  async takePortfolioSnapshots(competitionId: string) {
    console.log(
      `[PortfolioSnapshotter] Taking portfolio snapshots for competition ${competitionId}`,
    );

    const startTime = Date.now();
    const agents = await getCompetitionAgents(competitionId);
    const timestamp = new Date();
    let priceLookupCount = 0;
    let dbPriceHitCount = 0;
    let reusedPriceCount = 0;

    for (const agentId of agents) {
      const balances = await this.balanceManager.getAllBalances(agentId);
      const valuesByToken: Record<
        string,
        {
          amount: number;
          valueUsd: number;
          price: number;
          symbol: string;
          specificChain: string | null;
        }
      > = {};
      let totalValue = 0;

      for (const balance of balances) {
        priceLookupCount++;

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
          dbPriceHitCount++;
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
            reusedPriceCount++;
            console.log(
              `[PortfolioSnapshotter] Using fresh price for ${balance.tokenAddress} from DB: $${priceResult.price} (${specificChain}) - age ${Math.round(priceAge / 1000)}s, threshold ${Math.round(config.portfolio.priceFreshnessMs / 1000)}s`,
            );
          } else if (specificChain && latestPriceRecord.chain) {
            // Use specific chain information to avoid chain detection when fetching a new price
            console.log(
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
            const result = await this.priceTracker.getPrice(
              balance.tokenAddress,
            );
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
          valuesByToken[balance.tokenAddress] = {
            amount: balance.amount,
            valueUsd,
            price: priceResult.price,
            symbol: priceResult.symbol,
            specificChain: priceResult.specificChain,
          };
          totalValue += valueUsd;
        } else {
          console.warn(
            `[PortfolioSnapshotter] No price available for token ${balance.tokenAddress}, excluding from portfolio snapshot`,
          );
        }
      }

      // Create portfolio snapshot in database
      const snapshot = await createPortfolioSnapshot({
        agentId,
        competitionId,
        timestamp,
        totalValue,
      });

      // Store token values
      for (const [token, data] of Object.entries(valuesByToken)) {
        await createPortfolioTokenValue({
          portfolioSnapshotId: snapshot.id,
          tokenAddress: token,
          amount: data.amount,
          valueUsd: data.valueUsd,
          price: data.price,
          symbol: data.symbol,
          specificChain: data.specificChain,
        });
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `[PortfolioSnapshotter] Completed portfolio snapshots for ${agents.length} agents in ${duration}ms`,
    );
    console.log(
      `[PortfolioSnapshotter] Price lookup stats: Total: ${priceLookupCount}, DB hits: ${dbPriceHitCount}, Hit rate: ${((dbPriceHitCount / priceLookupCount) * 100).toFixed(2)}%`,
    );
    console.log(
      `[PortfolioSnapshotter] Reused existing prices: ${reusedPriceCount}/${priceLookupCount} (${((reusedPriceCount / priceLookupCount) * 100).toFixed(2)}%)`,
    );
  }

  /**
   * Get portfolio snapshots for an agent in a competition
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @returns Array of portfolio snapshots
   */
  async getAgentPortfolioSnapshots(competitionId: string, agentId: string) {
    const snapshots = await getAgentPortfolioSnapshots(competitionId, agentId);

    const promises = snapshots.map(async (snapshot) => {
      const tokenValues = await getPortfolioTokenValues(snapshot.id);
      const valuesByToken: Record<
        string,
        { amount: number; valueUsd: number }
      > = {};
      for (const tokenValue of tokenValues) {
        valuesByToken[tokenValue.tokenAddress] = {
          amount: tokenValue.amount,
          valueUsd: tokenValue.valueUsd,
        };
      }

      return {
        ...snapshot,
        valuesByToken,
      };
    });

    return await Promise.all(promises);
  }

  /**
   * Take a portfolio snapshot for a specific agent in a competition
   * Used for sandbox mode when auto-joining agents to avoid snapshotting all agents
   * @param competitionId The competition ID
   * @param agentId The specific agent ID to snapshot
   */
  async takeAgentPortfolioSnapshot(
    competitionId: string,
    agentId: string,
  ): Promise<void> {
    console.log(
      `[PortfolioSnapshotter] Taking portfolio snapshot for agent ${agentId} in competition ${competitionId}`,
    );

    const startTime = Date.now();
    const timestamp = new Date();
    let priceLookupCount = 0;
    let dbPriceHitCount = 0;
    let reusedPriceCount = 0;

    const balances = await this.balanceManager.getAllBalances(agentId);
    const valuesByToken: Record<
      string,
      {
        amount: number;
        valueUsd: number;
        price: number;
        symbol: string;
        specificChain: string | null;
      }
    > = {};
    let totalValue = 0;

    for (const balance of balances) {
      priceLookupCount++;

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
        dbPriceHitCount++;
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
          reusedPriceCount++;
          console.log(
            `[PortfolioSnapshotter] Using fresh price for ${balance.tokenAddress} from DB: $${priceResult.price} (${specificChain}) - age ${Math.round(priceAge / 1000)}s, threshold ${Math.round(config.portfolio.priceFreshnessMs / 1000)}s`,
          );
        } else if (specificChain && latestPriceRecord.chain) {
          // Use specific chain information to avoid chain detection when fetching a new price
          console.log(
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
        valuesByToken[balance.tokenAddress] = {
          amount: balance.amount,
          valueUsd,
          price: priceResult.price,
          symbol: priceResult.symbol,
          specificChain: priceResult.specificChain,
        };
        totalValue += valueUsd;
      } else {
        console.warn(
          `[PortfolioSnapshotter] No price available for token ${balance.tokenAddress}, excluding from portfolio snapshot`,
        );
      }
    }

    // Create portfolio snapshot in database
    const snapshot = await createPortfolioSnapshot({
      agentId,
      competitionId,
      timestamp,
      totalValue,
    });

    // Store token values
    for (const [token, data] of Object.entries(valuesByToken)) {
      await createPortfolioTokenValue({
        portfolioSnapshotId: snapshot.id,
        tokenAddress: token,
        amount: data.amount,
        valueUsd: data.valueUsd,
        price: data.price,
        symbol: data.symbol,
        specificChain: data.specificChain,
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `[PortfolioSnapshotter] Completed portfolio snapshot for agent ${agentId} in ${duration}ms`,
    );
    console.log(
      `[PortfolioSnapshotter] Price lookup stats: Total: ${priceLookupCount}, DB hits: ${dbPriceHitCount}, Hit rate: ${((dbPriceHitCount / priceLookupCount) * 100).toFixed(2)}%`,
    );
    console.log(
      `[PortfolioSnapshotter] Reused existing prices: ${reusedPriceCount}/${priceLookupCount} (${((reusedPriceCount / priceLookupCount) * 100).toFixed(2)}%)`,
    );
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
      console.error("[PortfolioSnapshotter] Health check failed:", error);
      return false;
    }
  }
}
