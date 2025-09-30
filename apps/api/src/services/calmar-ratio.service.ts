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
 * Calmar Ratio = Return / Max Drawdown
 *
 * NOTE: Mid-competition transfers are now PROHIBITED
 * This service uses simple returns since agents cannot add/withdraw funds during competitions
 */
export class CalmarRatioService {
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
      // Use the same time period as the return calculation (snapshot dates, not competition dates)
      // This ensures consistent risk metrics over the same time window
      const maxDrawdown = await calculateMaxDrawdownSQL(
        agentId,
        competitionId,
        startSnapshot.timestamp, // Use first snapshot date
        endSnapshot.timestamp, // Use last snapshot date
      );

      serviceLogger.debug(
        `[CalmarRatio] Max drawdown calculated: ${(maxDrawdown * 100).toFixed(4)}%`,
      );

      // 4. Process the return
      // Calculate the period length for logging purposes
      const daysInPeriod =
        (endSnapshot.timestamp.getTime() - startSnapshot.timestamp.getTime()) /
        (1000 * 60 * 60 * 24);
      const periodReturn = this.processReturn(simpleReturn, daysInPeriod);

      serviceLogger.debug(
        `[CalmarRatio] Period return: ${(periodReturn.toNumber() * 100).toFixed(4)}% over ${daysInPeriod.toFixed(1)} days`,
      );

      // 5. Calculate Calmar Ratio
      const calmarRatio = this.computeCalmarRatio(periodReturn, maxDrawdown);

      serviceLogger.info(
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
   * Process return for Calmar ratio calculation
   * Returns raw period return
   *
   * @param periodReturn The return for the period (as Decimal)
   * @param daysInPeriod Number of days in the period (kept for logging)
   * @returns Raw period return as Decimal
   */
  private processReturn(periodReturn: Decimal, daysInPeriod: number): Decimal {
    if (daysInPeriod <= 0) {
      serviceLogger.warn(
        `[CalmarRatio] Invalid period length: ${daysInPeriod} days`,
      );
      return new Decimal(0);
    }

    // Always return raw period return
    serviceLogger.debug(
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
    // Handle edge cases
    if (maxDrawdown === 0) {
      // No drawdown
      if (periodReturn.greaterThan(0)) {
        // Positive return with no drawdown - cap at 100
        serviceLogger.debug(
          `[CalmarRatio] No drawdown with positive return, capping Calmar at 100`,
        );
        return new Decimal(100);
      } else if (periodReturn.lessThan(0)) {
        // Negative return with no drawdown - shouldn't happen but handle it
        return new Decimal(-100);
      } else {
        // Zero return, zero drawdown
        return new Decimal(0);
      }
    }

    // Normal case: divide return by absolute value of drawdown
    // Since drawdown is negative, we use Math.abs
    return periodReturn.dividedBy(Math.abs(maxDrawdown));
  }
}
