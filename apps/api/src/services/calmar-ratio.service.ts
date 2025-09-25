import { Decimal } from "decimal.js";

import type {
  InsertPerpsRiskMetrics,
  SelectPerpsRiskMetrics,
} from "@recallnet/db/schema/trading/types";

import {
  calculateMaxDrawdownSQL,
  findById as findCompetitionById,
  getFirstAndLastSnapshots,
} from "@/database/repositories/competition-repository.js";
import { saveRiskMetrics } from "@/database/repositories/perps-repository.js";
import { serviceLogger } from "@/lib/logger.js";

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

      // 2. Calculate simple return from first and last portfolio snapshots
      // Since transfers are prohibited, we can use simple return: (endValue/startValue) - 1
      const { first: startSnapshot, last: endSnapshot } =
        await getFirstAndLastSnapshots(competitionId, agentId);

      if (!startSnapshot || !endSnapshot) {
        serviceLogger.warn(
          `[CalmarRatio] No portfolio snapshots found for agent ${agentId}`,
        );
        throw new Error("Insufficient data: No portfolio snapshots found");
      }

      const startValue = new Decimal(startSnapshot.totalValue);
      const endValue = new Decimal(endSnapshot.totalValue);

      if (startValue.isZero()) {
        serviceLogger.warn(
          `[CalmarRatio] Starting value is zero for agent ${agentId}`,
        );
        throw new Error("Invalid data: Starting portfolio value is zero");
      }

      const simpleReturn = endValue.minus(startValue).dividedBy(startValue);

      serviceLogger.debug(
        `[CalmarRatio] Simple return calculated: ${(simpleReturn.toNumber() * 100).toFixed(4)}% (${startValue.toFixed(2)} → ${endValue.toFixed(2)})`,
      );

      // 3. Calculate Max Drawdown using SQL
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
        simpleReturn.toNumber(),
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

      const savedMetrics = await saveRiskMetrics(metricsData);

      serviceLogger.info(
        `[CalmarRatio] Saved risk metrics for agent ${agentId}`,
      );

      return { metrics: savedMetrics };
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

    // If period is exactly 1 year, return the period return directly
    // This avoids pow() operation for the common case
    if (Math.abs(yearsInPeriod - 1) < 0.0001) {
      return periodReturn;
    }

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
