import { config } from "@/config/index.js";
import { repositories } from "@/database/index.js";
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
   * Take portfolio snapshots for all teams in a competition
   * @param competitionId The competition ID
   */
  async takePortfolioSnapshots(competitionId: string) {
    console.log(
      `[PortfolioSnapshotter] Taking portfolio snapshots for competition ${competitionId}`,
    );

    const startTime = Date.now();
    const teams =
      await repositories.competitionRepository.getCompetitionTeams(
        competitionId,
      );
    const timestamp = new Date();
    let priceLookupCount = 0;
    let dbPriceHitCount = 0;
    let reusedPriceCount = 0;

    for (const teamId of teams) {
      const balances = await this.balanceManager.getAllBalances(teamId);
      const valuesByToken: Record<
        string,
        {
          amount: number;
          valueUsd: number;
          price: number;
          specificChain: string | null;
        }
      > = {};
      let totalValue = 0;

      for (const balance of balances) {
        priceLookupCount++;

        // First try to get latest price record from the database to reuse chain information
        const latestPriceRecord =
          await repositories.priceRepository.getLatestPrice(
            balance.tokenAddress,
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
      const snapshot =
        await repositories.competitionRepository.createPortfolioSnapshot({
          teamId,
          competitionId,
          timestamp,
          totalValue,
        });

      // Store token values
      for (const [token, data] of Object.entries(valuesByToken)) {
        await repositories.competitionRepository.createPortfolioTokenValue({
          portfolioSnapshotId: snapshot.id,
          tokenAddress: token,
          amount: data.amount,
          valueUsd: data.valueUsd,
          price: data.price,
          specificChain: data.specificChain,
        });
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `[PortfolioSnapshotter] Completed portfolio snapshots for ${teams.length} teams in ${duration}ms`,
    );
    console.log(
      `[PortfolioSnapshotter] Price lookup stats: Total: ${priceLookupCount}, DB hits: ${dbPriceHitCount}, Hit rate: ${((dbPriceHitCount / priceLookupCount) * 100).toFixed(2)}%`,
    );
    console.log(
      `[PortfolioSnapshotter] Reused existing prices: ${reusedPriceCount}/${priceLookupCount} (${((reusedPriceCount / priceLookupCount) * 100).toFixed(2)}%)`,
    );
  }

  /**
   * Get portfolio snapshots for a team in a competition
   * @param competitionId The competition ID
   * @param teamId The team ID
   * @returns Array of portfolio snapshots
   */
  async getTeamPortfolioSnapshots(competitionId: string, teamId: string) {
    const snapshots =
      await repositories.competitionRepository.getTeamPortfolioSnapshots(
        competitionId,
        teamId,
      );

    const promises = snapshots.map(async (snapshot) => {
      const tokenValues =
        await repositories.competitionRepository.getPortfolioTokenValues(
          snapshot.id,
        );
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
   * Check if Portfolio Snapshotter is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await repositories.competitionRepository.count();
      return true;
    } catch (error) {
      console.error("[PortfolioSnapshotter] Health check failed:", error);
      return false;
    }
  }
}
