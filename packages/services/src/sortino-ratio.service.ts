import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type {
  InsertPerpsRiskMetrics,
  SelectPerpsRiskMetrics,
} from "@recallnet/db/schema/trading/types";

/**
 * Result of calculating and saving Sortino ratio metrics
 */
export interface SortinoMetricsResult {
  metrics: SelectPerpsRiskMetrics;
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
  private perpsRepo: PerpsRepository;
  private logger: Logger;

  // Minimum Acceptable Return for crypto competitions (0%)
  private readonly MAR = 0;

  constructor(
    competitionRepo: CompetitionRepository,
    perpsRepo: PerpsRepository,
    logger: Logger,
  ) {
    this.competitionRepo = competitionRepo;
    this.perpsRepo = perpsRepo;
    this.logger = logger;
  }

  /**
   * Calculate and persist Sortino Ratio with downside deviation
   * Uses database-level window functions
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Saved risk metrics with Sortino ratio
   */
  async calculateAndSaveSortinoRatio(
    agentId: string,
    competitionId: string,
  ): Promise<SortinoMetricsResult> {
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
      const metrics = await this.competitionRepo.calculateSortinoMetricsSQL(
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

      // 4. Get existing metrics to preserve Calmar ratio and max drawdown
      // CalmarRatioService MUST run first to establish these values
      const riskMetrics = await this.perpsRepo.getBulkAgentRiskMetrics(
        agentId,
        [competitionId],
      );
      const existingMetrics = riskMetrics.get(competitionId);

      if (!existingMetrics?.calmarRatio || !existingMetrics?.maxDrawdown) {
        throw new Error(
          `Cannot calculate Sortino for agent ${agentId}: Missing Calmar metrics. CalmarRatioService must run first.`,
        );
      }

      this.logger.info(
        `[SortinoRatio] Calculated metrics for agent ${agentId}: ` +
          `Sortino=${sortinoRatio.toFixed(4)}, ` +
          `Avg Return=${(avgReturn.toNumber() * 100).toFixed(2)}%, ` +
          `Downside Dev=${(downsideDeviation.toNumber() * 100).toFixed(2)}%, ` +
          `Simple Return=${(simpleReturn.toNumber() * 100).toFixed(2)}%`,
      );

      // 5. Save risk metrics (update existing - Calmar already established)
      const metricsData: InsertPerpsRiskMetrics = {
        agentId,
        competitionId,
        simpleReturn: simpleReturn.toFixed(8),
        calmarRatio: existingMetrics.calmarRatio, // Preserved from CalmarRatioService
        annualizedReturn: avgReturn.toFixed(8),
        maxDrawdown: existingMetrics.maxDrawdown, // Preserved from CalmarRatioService
        sortinoRatio: sortinoRatio.toFixed(8),
        downsideDeviation: downsideDeviation.toFixed(8),
        snapshotCount: metrics.snapshotCount,
      };

      const savedMetrics = await this.perpsRepo.upsertRiskMetrics(metricsData);

      this.logger.info(
        `[SortinoRatio] Saved risk metrics and snapshot for agent ${agentId}`,
      );

      return { metrics: savedMetrics };
    } catch (error) {
      this.logger.error(
        `[SortinoRatio] Error calculating Sortino Ratio for agent ${agentId}:`,
        error,
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
   * @returns Sortino ratio as Decimal
   */
  private computeSortinoRatio(
    avgReturn: Decimal,
    downsideDeviation: Decimal,
  ): Decimal {
    const mar = new Decimal(this.MAR);

    if (downsideDeviation.isZero()) {
      if (avgReturn.greaterThan(mar)) {
        // Positive return with no downside deviation - cap at a high value
        this.logger.debug(
          `[SortinoRatio] No downside deviation with positive return, capping Sortino at 100`,
        );
        return new Decimal(100);
      } else if (avgReturn.lessThan(mar)) {
        // Negative return with no downside deviation - shouldn't happen but handle it
        return new Decimal(-100);
      } else {
        // Zero return, zero downside deviation
        return new Decimal(0);
      }
    }

    return avgReturn.minus(mar).dividedBy(downsideDeviation);
  }
}
