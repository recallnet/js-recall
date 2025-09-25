import { Decimal } from "decimal.js";

import type {
  InsertPerpsRiskMetrics,
  SelectPerpsRiskMetrics,
  SelectPerpsTwrPeriod,
} from "@recallnet/db/schema/trading/types";

import {
  calculateMaxDrawdownSQL,
  findById as findCompetitionById,
} from "@/database/repositories/competition-repository.js";
import { saveRiskMetricsWithPeriods } from "@/database/repositories/perps-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { TWRCalculatorService } from "@/services/twr-calculator.service.js";

/**
 * Result of calculating and saving risk metrics
 */
export interface RiskMetricsResult {
  metrics: SelectPerpsRiskMetrics;
  periods: SelectPerpsTwrPeriod[];
}

/**
 * Service for calculating Calmar Ratio and other risk metrics
 * Calmar Ratio = Annualized Return / Max Drawdown
 */
export class CalmarRatioService {
  private readonly DAYS_PER_YEAR = 365; // Calendar days for annualization
  private readonly twrCalculator: TWRCalculatorService;

  constructor() {
    this.twrCalculator = new TWRCalculatorService();
  }

  /**
   * Calculate and persist Calmar Ratio with all risk metrics
   * Uses Time-Weighted Returns to neutralize deposit/withdrawal effects
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Saved risk metrics with TWR periods
   */
  async calculateAndSaveCalmarRatio(
    agentId: string,
    competitionId: string,
  ): Promise<RiskMetricsResult> {
    try {
      serviceLogger.info(
        `[CalmarRatio] Calculating Calmar Ratio for agent ${agentId} in competition ${competitionId}`,
      );

      // 1. Get competition dates
      const competition = await findCompetitionById(competitionId);
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

      serviceLogger.debug(
        `[CalmarRatio] Competition period: ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // 2. Calculate TWR (already optimized - only 2 snapshots + transfers)
      const twrResult = await this.twrCalculator.calculateTWR(
        agentId,
        competitionId,
        startDate,
        endDate,
      );

      serviceLogger.debug(
        `[CalmarRatio] TWR calculated: ${(twrResult.timeWeightedReturn * 100).toFixed(4)}% with ${twrResult.periods.length} periods`,
      );

      // 3. Calculate Max Drawdown using SQL (no memory issues!)
      const maxDrawdown = await calculateMaxDrawdownSQL(
        agentId,
        competitionId,
        startDate,
        endDate,
      );

      serviceLogger.debug(
        `[CalmarRatio] Max drawdown calculated: ${(maxDrawdown * 100).toFixed(4)}%`,
      );

      // 4. Annualize the return
      const daysInPeriod =
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const annualizedReturn = this.annualizeReturn(
        twrResult.timeWeightedReturn,
        daysInPeriod,
      );

      serviceLogger.debug(
        `[CalmarRatio] Annualized return: ${(annualizedReturn * 100).toFixed(4)}% over ${daysInPeriod.toFixed(1)} days`,
      );

      // 5. Calculate Calmar Ratio
      const calmarRatio = this.computeCalmarRatio(
        annualizedReturn,
        maxDrawdown,
      );

      serviceLogger.info(
        `[CalmarRatio] Calculated metrics for agent ${agentId}: Calmar=${calmarRatio.toFixed(4)}, TWR=${(twrResult.timeWeightedReturn * 100).toFixed(2)}%, Drawdown=${(maxDrawdown * 100).toFixed(2)}%`,
      );

      // 6. Save everything atomically
      const metricsData: InsertPerpsRiskMetrics = {
        agentId,
        competitionId,
        timeWeightedReturn: twrResult.timeWeightedReturn.toFixed(8),
        calmarRatio: calmarRatio.toFixed(8),
        annualizedReturn: annualizedReturn.toFixed(8),
        maxDrawdown: maxDrawdown.toFixed(8),
        transferCount: twrResult.transferCount,
        periodCount: twrResult.periods.length,
        snapshotCount: twrResult.snapshotCount,
      };

      const periodsData = twrResult.periods.map((period) => ({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        periodReturn: period.periodReturn.toFixed(8),
        startingEquity: period.startingEquity.toFixed(2),
        endingEquity: period.endingEquity.toFixed(2),
        transferId: period.transferId,
        sequenceNumber: period.sequenceNumber,
      }));

      // Only save metrics if we have transfers (meaningful risk data)
      // Without transfers, we can't calculate meaningful TWR or Calmar ratio
      if (twrResult.transferCount === 0) {
        serviceLogger.info(
          `[CalmarRatio] No transfers for agent ${agentId} - not saving risk metrics`,
        );
        // Return empty result - no metrics saved
        return {
          metrics: {} as SelectPerpsRiskMetrics,
          periods: [],
        };
      }

      const result = await saveRiskMetricsWithPeriods(metricsData, periodsData);

      serviceLogger.info(
        `[CalmarRatio] Saved risk metrics and ${periodsData.length} TWR periods for agent ${agentId}`,
      );

      return result;
    } catch (error) {
      serviceLogger.error(
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
   * @param periodReturn The return for the period (as decimal)
   * @param daysInPeriod Number of days in the period
   * @returns Annualized return as decimal
   */
  private annualizeReturn(periodReturn: number, daysInPeriod: number): number {
    if (daysInPeriod <= 0) {
      serviceLogger.warn(
        `[CalmarRatio] Invalid period length: ${daysInPeriod} days`,
      );
      return 0;
    }

    // For very short periods (< 1 day), don't annualize
    if (daysInPeriod < 1) {
      return periodReturn;
    }

    const yearsInPeriod = daysInPeriod / this.DAYS_PER_YEAR;

    // Use Decimal for precise calculation
    const onePlusReturn = new Decimal(1).plus(periodReturn);
    const exponent = new Decimal(1).div(yearsInPeriod);
    const annualized = onePlusReturn.pow(exponent).minus(1);

    return annualized.toNumber();
  }

  /**
   * Calculate Calmar Ratio with proper edge case handling
   * Calmar = Annualized Return / |Max Drawdown|
   *
   * @param annualizedReturn Annualized return as decimal
   * @param maxDrawdown Maximum drawdown as decimal (negative or 0)
   * @returns Calmar ratio
   */
  private computeCalmarRatio(
    annualizedReturn: number,
    maxDrawdown: number,
  ): number {
    // Handle edge cases
    if (maxDrawdown === 0) {
      // No drawdown
      if (annualizedReturn > 0) {
        // Positive return with no drawdown - cap at 100
        serviceLogger.debug(
          `[CalmarRatio] No drawdown with positive return, capping Calmar at 100`,
        );
        return 100;
      } else if (annualizedReturn < 0) {
        // Negative return with no drawdown - shouldn't happen but handle it
        return -100;
      } else {
        // Zero return, zero drawdown
        return 0;
      }
    }

    // Normal case: divide return by absolute value of drawdown
    // Since drawdown is negative, we use Math.abs
    return annualizedReturn / Math.abs(maxDrawdown);
  }
}
