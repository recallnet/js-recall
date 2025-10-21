import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type {
  InsertPerpsRiskMetrics,
  SelectPerpsRiskMetrics,
} from "@recallnet/db/schema/trading/types";

/**
 * Result of calculating and saving risk metrics
 */
export interface RiskMetricsResult {
  metrics: SelectPerpsRiskMetrics;
}

/**
 * Service for calculating Calmar Ratio and other risk metrics
 * Calmar Ratio = Return / Max Drawdown
 *
 * NOTE: Mid-competition transfers are now PROHIBITED
 * This service uses simple returns since agents cannot add/withdraw funds during competitions
 */
export class CalmarRatioService {
  private competitionRepo: CompetitionRepository;
  private perpsRepo: PerpsRepository;
  private logger: Logger;

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
   * Calculate and persist Calmar Ratio with all risk metrics
   * Uses simple returns: (endValue/startValue) - 1
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Saved risk metrics
   */
  async calculateAndSaveCalmarRatio(
    agentId: string,
    competitionId: string,
  ): Promise<RiskMetricsResult> {
    try {
      this.logger.info(
        `[CalmarRatio] Calculating Calmar Ratio for agent ${agentId} in competition ${competitionId}`,
      );

      // 1. Get competition dates
      const competition = await this.competitionRepo.findById(competitionId);
      if (!competition) {
        throw new Error(`Competition ${competitionId} not found`);
      }

      if (!competition.startDate) {
        throw new Error(`Competition ${competitionId} has not started yet`);
      }

      const startDate = new Date(competition.startDate);
      const endDate = competition.endDate
        ? new Date(competition.endDate)
        : new Date();

      this.logger.debug(
        `[CalmarRatio] Competition period: ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // 2. Calculate simple return from first and last portfolio snapshots
      // Since transfers are prohibited, we can use simple return: (endValue/startValue) - 1
      const { first: startSnapshot, last: endSnapshot } =
        await this.competitionRepo.getFirstAndLastSnapshots(
          competitionId,
          agentId,
        );

      if (!startSnapshot || !endSnapshot) {
        this.logger.warn(
          `[CalmarRatio] No portfolio snapshots found for agent ${agentId}`,
        );
        throw new Error("Insufficient data: No portfolio snapshots found");
      }

      const startValue = new Decimal(startSnapshot.totalValue);
      const endValue = new Decimal(endSnapshot.totalValue);

      if (startValue.isZero()) {
        this.logger.warn(
          `[CalmarRatio] Starting value is zero for agent ${agentId}`,
        );
        throw new Error("Invalid data: Starting portfolio value is zero");
      }

      const simpleReturn = endValue.minus(startValue).dividedBy(startValue);

      this.logger.debug(
        `[CalmarRatio] Simple return calculated: ${(simpleReturn.toNumber() * 100).toFixed(4)}% (${startValue.toFixed(2)} → ${endValue.toFixed(2)})`,
      );

      // 3. Calculate Max Drawdown using SQL
      // Use the same time period as the return calculation (snapshot dates, not competition dates)
      // This ensures consistent risk metrics over the same time window
      const maxDrawdown = await this.competitionRepo.calculateMaxDrawdownSQL(
        agentId,
        competitionId,
        startSnapshot.timestamp, // Use first snapshot date
        endSnapshot.timestamp, // Use last snapshot date
      );

      this.logger.debug(
        `[CalmarRatio] Max drawdown calculated: ${(maxDrawdown * 100).toFixed(4)}%`,
      );

      // 4. Process the return
      // Calculate the period length for logging purposes
      const daysInPeriod =
        (endSnapshot.timestamp.getTime() - startSnapshot.timestamp.getTime()) /
        (1000 * 60 * 60 * 24);
      const periodReturn = this.processReturn(simpleReturn, daysInPeriod);

      this.logger.debug(
        `[CalmarRatio] Period return: ${(periodReturn.toNumber() * 100).toFixed(4)}% over ${daysInPeriod.toFixed(1)} days`,
      );

      // 5. Calculate Calmar Ratio
      const calmarRatio = this.computeCalmarRatio(periodReturn, maxDrawdown);

      this.logger.info(
        `[CalmarRatio] Calculated metrics for agent ${agentId}: Calmar=${calmarRatio.toFixed(4)}, Return=${(simpleReturn.toNumber() * 100).toFixed(2)}%, Drawdown=${(maxDrawdown * 100).toFixed(2)}%`,
      );

      // 6. Save risk metrics
      const metricsData: InsertPerpsRiskMetrics = {
        agentId,
        competitionId,
        simpleReturn: simpleReturn.toFixed(8),
        calmarRatio: calmarRatio.toFixed(8),
        annualizedReturn: periodReturn.toFixed(8), // DB field still named annualizedReturn for backward compatibility
        maxDrawdown: maxDrawdown.toFixed(8),
        snapshotCount: 2, // We only use first and last snapshots
      };

      const savedMetrics = await this.perpsRepo.saveRiskMetrics(metricsData);

      this.logger.info(`[CalmarRatio] Saved risk metrics for agent ${agentId}`);

      return { metrics: savedMetrics };
    } catch (error) {
      this.logger.error(
        `[CalmarRatio] Error calculating Calmar Ratio for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process return for Calmar ratio calculation
   * Returns raw period return
   *
   * @param periodReturn The return for the period (as Decimal)
   * @param daysInPeriod Number of days in the period (kept for logging)
   * @returns Raw period return as Decimal
   */
  private processReturn(periodReturn: Decimal, daysInPeriod: number): Decimal {
    if (daysInPeriod <= 0) {
      this.logger.warn(
        `[CalmarRatio] Invalid period length: ${daysInPeriod} days`,
      );
      return new Decimal(0);
    }

    // Always return raw period return
    this.logger.debug(
      `[CalmarRatio] Using raw return for ${daysInPeriod.toFixed(2)} days period`,
    );

    return periodReturn;
  }

  /**
   * Calculate Calmar Ratio with proper edge case handling
   * Calmar = Return / |Max Drawdown|
   *
   * Note: Using raw return/drawdown ratio
   *
   * @param periodReturn Period return as Decimal
   * @param maxDrawdown Maximum drawdown as decimal (negative or 0)
   * @returns Calmar ratio as Decimal (Return/Drawdown ratio)
   */
  private computeCalmarRatio(
    periodReturn: Decimal,
    maxDrawdown: number,
  ): Decimal {
    // Use minimum drawdown of 0.01 to avoid division by zero
    // and handle edge cases cleanly
    if (maxDrawdown > 0) throw new Error("invalid max drawdown");
    const adjustedMaxDrawdown = Math.max(Math.abs(maxDrawdown), 0.001);

    return periodReturn.dividedBy(adjustedMaxDrawdown);
  }
}
