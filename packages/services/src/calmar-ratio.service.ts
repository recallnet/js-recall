import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

/**
 * Calculated Calmar metrics
 */
export interface CalmarMetrics {
  agentId: string;
  competitionId: string;
  calmarRatio: string;
  annualizedReturn: string;
  simpleReturn: string;
  maxDrawdown: string;
  snapshotCount: number;
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
  private logger: Logger;

  // Minimum drawdown threshold to avoid division by zero
  // Prevents infinite Calmar ratios while maintaining meaningful comparisons
  private readonly MIN_DRAWDOWN = 0.0001;

  constructor(competitionRepo: CompetitionRepository, logger: Logger) {
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }

  /**
   * Calculate Calmar Ratio metrics (without persisting)
   * Uses simple returns: (endValue/startValue) - 1
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Calculated metrics
   */
  async calculateCalmarRatio(
    agentId: string,
    competitionId: string,
  ): Promise<CalmarMetrics> {
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
      const maxDrawdown = await this.competitionRepo.calculateMaxDrawdown(
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
      // Return calculated metrics
      const metrics: CalmarMetrics = {
        agentId,
        competitionId,
        calmarRatio: calmarRatio.toFixed(8),
        annualizedReturn: periodReturn.toFixed(8),
        simpleReturn: simpleReturn.toFixed(8),
        maxDrawdown: maxDrawdown.toFixed(8),
        snapshotCount: 2, // We only use first and last snapshots
      };

      this.logger.info(`[CalmarRatio] Calculated metrics for agent ${agentId}`);

      return metrics;
    } catch (error) {
      this.logger.error(
        { error },
        `[CalmarRatio] Error calculating Calmar Ratio for agent ${agentId}`,
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
    // Use minimum drawdown threshold to avoid division by zero
    // and handle edge cases cleanly
    if (maxDrawdown > 0) {
      this.logger.error(
        `[CalmarRatio] Invalid positive drawdown detected: ${maxDrawdown}`,
      );
      throw new Error(
        `Invalid max drawdown: expected negative or zero, got ${maxDrawdown}`,
      );
    }
    const adjustedMaxDrawdown = Math.max(
      Math.abs(maxDrawdown),
      this.MIN_DRAWDOWN,
    );

    return periodReturn.dividedBy(adjustedMaxDrawdown);
  }
}
