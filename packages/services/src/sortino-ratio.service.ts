import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

/**
 * Calculated Sortino metrics
 */
export interface SortinoMetrics {
  agentId: string;
  competitionId: string;
  sortinoRatio: string | null;
  downsideDeviation: string | null;
  annualizedReturn: string;
  simpleReturn: string;
  snapshotCount: number;
  // Also include Calmar metrics that must be preserved
  calmarRatio?: string;
  maxDrawdown?: string;
}

/**
 * Service for calculating Sortino Ratio and downside deviation
 * Sortino Ratio = (Return - MAR) / Downside Deviation
 *
 * For cryptocurrency trading competitions, MAR (Minimum Acceptable Return) is typically 0%
 * Downside deviation only considers returns below the MAR
 *
 * NOTE: Mid-competition transfers are PROHIBITED
 * This service uses simple returns since agents cannot add/withdraw funds during competitions
 */
export class SortinoRatioService {
  private competitionRepo: CompetitionRepository;
  private logger: Logger;

  // Minimum Acceptable Return for crypto competitions (0%)
  private readonly MAR = 0;

  constructor(competitionRepo: CompetitionRepository, logger: Logger) {
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }

  /**
   * Calculate Sortino Ratio metrics (without persisting)
   * Uses database-level window functions
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Calculated metrics
   */
  async calculateSortinoRatio(
    agentId: string,
    competitionId: string,
  ): Promise<SortinoMetrics> {
    try {
      this.logger.info(
        `[SortinoRatio] Calculating Sortino Ratio for agent ${agentId} in competition ${competitionId}`,
      );

      // 1. Get competition to validate it exists and has started
      const competition = await this.competitionRepo.findById(competitionId);
      if (!competition) {
        throw new Error(`Competition ${competitionId} not found`);
      }

      if (!competition.startDate) {
        throw new Error(`Competition ${competitionId} has not started yet`);
      }

      const endDate = competition.endDate
        ? new Date(competition.endDate)
        : new Date();

      this.logger.debug(
        `[SortinoRatio] Competition period: ${competition.startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // 2. Calculate all metrics at database level using window functions
      const metrics = await this.competitionRepo.calculateSortinoMetrics(
        agentId,
        competitionId,
        this.MAR,
      );

      if (metrics.snapshotCount < 2) {
        this.logger.warn(
          `[SortinoRatio] Insufficient snapshots for agent ${agentId}: ${metrics.snapshotCount} found`,
        );
        throw new Error("Insufficient data: Need at least 2 snapshots");
      }

      // 3. Calculate Sortino Ratio from database metrics
      const avgReturn = new Decimal(metrics.avgReturn);
      const downsideDeviation = new Decimal(metrics.downsideDeviation);
      const simpleReturn = new Decimal(metrics.simpleReturn);

      const sortinoRatio = this.computeSortinoRatio(
        avgReturn,
        downsideDeviation,
      );

      this.logger.info(
        `[SortinoRatio] Calculated metrics for agent ${agentId}: ` +
          `Sortino=${sortinoRatio ? sortinoRatio.toFixed(4) : "null"}, ` +
          `Avg Return=${(avgReturn.toNumber() * 100).toFixed(2)}%, ` +
          `Downside Dev=${(downsideDeviation.toNumber() * 100).toFixed(2)}%, ` +
          `Simple Return=${(simpleReturn.toNumber() * 100).toFixed(2)}%`,
      );

      // Return calculated metrics
      const calculatedMetrics: SortinoMetrics = {
        agentId,
        competitionId,
        sortinoRatio: sortinoRatio ? sortinoRatio.toFixed(8) : null,
        downsideDeviation: downsideDeviation.toFixed(8),
        annualizedReturn: avgReturn.toFixed(8),
        simpleReturn: simpleReturn.toFixed(8),
        snapshotCount: metrics.snapshotCount,
      };

      return calculatedMetrics;
    } catch (error) {
      this.logger.error(
        { error },
        `[SortinoRatio] Error calculating Sortino Ratio for agent ${agentId}`,
      );
      throw error;
    }
  }

  /**
   * Compute Sortino Ratio with proper edge case handling
   * Sortino = (Average Return - MAR) / Downside Deviation
   *
   * @param avgReturn Average period return as Decimal
   * @param downsideDeviation Downside deviation as Decimal
   * @returns Sortino ratio as Decimal, or null if insufficient data
   */
  private computeSortinoRatio(
    avgReturn: Decimal,
    downsideDeviation: Decimal,
  ): Decimal | null {
    const mar = new Decimal(this.MAR);

    if (downsideDeviation.isZero()) {
      if (avgReturn.greaterThan(mar)) {
        // Positive return with no downside deviation - cap at a high value
        this.logger.debug(
          `[SortinoRatio] No downside deviation with positive return, capping Sortino at 100`,
        );
        return new Decimal(100);
      } else {
        // avgReturn <= MAR with zero downside deviation
        // This occurs with insufficient data (1-2 snapshots) where we can't calculate meaningful volatility
        // The ranking system handles NULL metrics by using NULLS LAST and falling back to totalEquity
        this.logger.debug(
          {
            avgReturn: avgReturn.toString(),
            mar: this.MAR,
            downsideDeviation: downsideDeviation.toString(),
          },
          "[SortinoRatio] Insufficient data for Sortino calculation (likely 1-2 snapshots), returning null",
        );
        // Return null to indicate insufficient data - the DB and ranking system handle this gracefully
        return null;
      }
    }

    return avgReturn.minus(mar).dividedBy(downsideDeviation);
  }
}
