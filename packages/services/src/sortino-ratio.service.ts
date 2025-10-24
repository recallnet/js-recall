import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

/**
 * Calculated Sortino metrics
 */
export interface SortinoMetrics {
  agentId: string;
  competitionId: string;
  sortinoRatio: string;
  downsideDeviation: string;
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

  // Minimum downside deviation threshold to avoid division by zero
  // Consistent with Calmar ratio's minimum drawdown approach
  private readonly MIN_DOWNSIDE_DEVIATION = 0.0001;

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
          `Sortino=${sortinoRatio.toFixed(4)}, ` +
          `Avg Return=${(avgReturn.toNumber() * 100).toFixed(2)}%, ` +
          `Downside Dev=${(downsideDeviation.toNumber() * 100).toFixed(2)}%, ` +
          `Simple Return=${(simpleReturn.toNumber() * 100).toFixed(2)}%`,
      );

      // Return calculated metrics
      const calculatedMetrics: SortinoMetrics = {
        agentId,
        competitionId,
        sortinoRatio: sortinoRatio.toFixed(8),
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
   * Uses MIN_DOWNSIDE_DEVIATION threshold to avoid division by zero,
   * consistent with Calmar ratio's minimum threshold approach
   *
   * @param avgReturn Average period return as Decimal
   * @param downsideDeviation Downside deviation as Decimal
   * @returns Sortino ratio as Decimal
   */
  private computeSortinoRatio(
    avgReturn: Decimal,
    downsideDeviation: Decimal,
  ): Decimal {
    const mar = new Decimal(this.MAR);

    // Use minimum downside deviation to avoid division by zero
    // This matches the pattern used in Calmar ratio calculation
    const adjustedDownsideDeviation = downsideDeviation.isZero()
      ? new Decimal(this.MIN_DOWNSIDE_DEVIATION)
      : downsideDeviation;

    if (downsideDeviation.isZero()) {
      // Zero downside deviation means either:
      // 1. All returns are >= MAR (no negative deviations)
      // 2. Only 1-2 snapshots (insufficient variation to calculate deviation)
      // Using minimum threshold maintains consistency with Calmar approach
      this.logger.debug(
        {
          avgReturn: avgReturn.toString(),
          mar: this.MAR,
          adjustedDownsideDeviation: adjustedDownsideDeviation.toString(),
          minThreshold: this.MIN_DOWNSIDE_DEVIATION,
        },
        `[SortinoRatio] Zero downside deviation detected (all returns >= MAR or insufficient data points), using minimum threshold of ${this.MIN_DOWNSIDE_DEVIATION}`,
      );
    }

    return avgReturn.minus(mar).dividedBy(adjustedDownsideDeviation);
  }
}
