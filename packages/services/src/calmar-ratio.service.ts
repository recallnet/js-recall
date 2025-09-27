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
 * Calmar Ratio = Annualized Return / Max Drawdown
 *
 * NOTE: Mid-competition transfers are now PROHIBITED
 * This service uses simple returns since agents cannot add/withdraw funds during competitions
 */
export class CalmarRatioService {
  private readonly DAYS_PER_YEAR = 365; // Calendar days for annualization

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

      // 4. Annualize the return
      // Use the actual snapshot period for accurate annualization
      const daysInPeriod =
        (endSnapshot.timestamp.getTime() - startSnapshot.timestamp.getTime()) /
        (1000 * 60 * 60 * 24);
      const annualizedReturn = this.annualizeReturn(simpleReturn, daysInPeriod);

      this.logger.debug(
        `[CalmarRatio] Annualized return: ${(annualizedReturn.toNumber() * 100).toFixed(4)}% over ${daysInPeriod.toFixed(1)} days`,
      );

      // 5. Calculate Calmar Ratio
      const calmarRatio = this.computeCalmarRatio(
        annualizedReturn,
        maxDrawdown,
      );

      this.logger.info(
        `[CalmarRatio] Calculated metrics for agent ${agentId}: Calmar=${calmarRatio.toFixed(4)}, Return=${(simpleReturn.toNumber() * 100).toFixed(2)}%, Drawdown=${(maxDrawdown * 100).toFixed(2)}%`,
      );

      // 6. Save risk metrics
      const metricsData: InsertPerpsRiskMetrics = {
        agentId,
        competitionId,
        simpleReturn: simpleReturn.toFixed(8),
        calmarRatio: calmarRatio.toFixed(8),
        annualizedReturn: annualizedReturn.toFixed(8),
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
   * Annualize a return over a given period
   * Uses compound annualization formula: (1 + r)^(365/days) - 1
   *
   * @param periodReturn The return for the period (as Decimal)
   * @param daysInPeriod Number of days in the period
   * @returns Annualized return as Decimal
   */
  private annualizeReturn(
    periodReturn: Decimal,
    daysInPeriod: number,
  ): Decimal {
    if (daysInPeriod <= 0) {
      this.logger.warn(
        `[CalmarRatio] Invalid period length: ${daysInPeriod} days`,
      );
      return new Decimal(0);
    }

    // For very short periods (< 1 day), don't annualize
    if (daysInPeriod < 1) {
      return periodReturn;
    }

    const yearsInPeriod = daysInPeriod / this.DAYS_PER_YEAR;

    // If period is exactly 1 year, return the period return directly
    // This avoids pow() operation for the common case
    if (Math.abs(yearsInPeriod - 1) < 0.0001) {
      return periodReturn;
    }

    // Use Decimal for precise calculation
    const onePlusReturn = new Decimal(1).plus(periodReturn);
    const exponent = new Decimal(1).div(yearsInPeriod);
    const annualized = onePlusReturn.pow(exponent).minus(1);

    return annualized;
  }

  /**
   * Calculate Calmar Ratio with proper edge case handling
   * Calmar = Annualized Return / |Max Drawdown|
   *
   * @param annualizedReturn Annualized return as Decimal
   * @param maxDrawdown Maximum drawdown as decimal (negative or 0)
   * @returns Calmar ratio as Decimal
   */
  private computeCalmarRatio(
    annualizedReturn: Decimal,
    maxDrawdown: number,
  ): Decimal {
    // Handle edge cases
    if (maxDrawdown === 0) {
      // No drawdown
      if (annualizedReturn.greaterThan(0)) {
        // Positive return with no drawdown - cap at 100
        this.logger.debug(
          `[CalmarRatio] No drawdown with positive return, capping Calmar at 100`,
        );
        return new Decimal(100);
      } else if (annualizedReturn.lessThan(0)) {
        // Negative return with no drawdown - shouldn't happen but handle it
        return new Decimal(-100);
      } else {
        // Zero return, zero drawdown
        return new Decimal(0);
      }
    }

    // Normal case: divide return by absolute value of drawdown
    // Since drawdown is negative, we use Math.abs
    return annualizedReturn.dividedBy(Math.abs(maxDrawdown));
  }
}
