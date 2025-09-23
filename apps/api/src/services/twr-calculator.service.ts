import { Decimal } from "decimal.js";

import type { SelectPortfolioSnapshot } from "@recallnet/db/schema/trading/types";
import type {
  InsertPerpsTwrPeriod,
  SelectPerpsTransferHistory,
} from "@recallnet/db/schema/trading/types";

import { getAgentPortfolioSnapshots } from "@/database/repositories/competition-repository.js";
import { getAgentTransferHistory } from "@/database/repositories/perps-repository.js";
import { serviceLogger } from "@/lib/logger.js";

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  minE: -40,
  maxE: 40,
  toExpNeg: -40,
  toExpPos: 40,
});

/**
 * Period for TWR calculation
 * Represents a time period between transfers (or start/end of competition)
 */
export interface TWRPeriod {
  periodStart: Date;
  periodEnd: Date;
  startingEquity: number;
  endingEquity: number;
  periodReturn: number;
  sequenceNumber: number;
  transferId?: string;
}

/**
 * Result of TWR calculation
 */
export interface TWRResult {
  timeWeightedReturn: number;
  periods: TWRPeriod[];
  transferCount: number;
  snapshotCount: number;
}

/**
 * Service for calculating Time-Weighted Returns (TWR)
 *
 * TWR is the industry standard (GIPS compliant) method for measuring
 * investment performance that eliminates the distorting effects of
 * cash inflows and outflows (deposits/withdrawals).
 *
 * This allows us to fairly compare agents regardless of how much
 * they deposit or withdraw during the competition.
 */
export class TWRCalculatorService {
  constructor() {
    // No dependencies needed
  }

  /**
   * Calculate Time-Weighted Return excluding deposits/withdrawals
   *
   * TWR Formula:
   * TWR = [(1 + r1) × (1 + r2) × ... × (1 + rn)] - 1
   *
   * Where r1, r2, etc. are the returns for each period between transfers
   *
   * If there are no transfers, this simplifies to a single period return
   */
  async calculateTWR(
    agentId: string,
    competitionId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TWRResult> {
    try {
      serviceLogger.debug(
        `[TWRCalculator] Calculating TWR for agent ${agentId} in competition ${competitionId}`,
      );

      // 1. Get ONLY the snapshots we need - first and last
      // This fetches max 2 snapshots, not thousands!
      const snapshots = await getAgentPortfolioSnapshots(
        competitionId,
        agentId,
        2,
      );

      if (snapshots.length === 0) {
        serviceLogger.warn(
          `[TWRCalculator] No snapshots found for agent ${agentId}, cannot calculate TWR`,
        );
        throw new Error("Insufficient data: No portfolio snapshots found");
      }

      // Since getAgentPortfolioSnapshots returns DESC order, last is first in array
      const lastSnapshot = snapshots[0];
      const firstSnapshot =
        snapshots.length > 1 ? snapshots[snapshots.length - 1] : snapshots[0];

      if (!firstSnapshot || !lastSnapshot) {
        throw new Error("Insufficient data: No valid snapshots found");
      }

      const actualStartDate = startDate || new Date(firstSnapshot.timestamp);
      const actualEndDate = endDate || new Date(lastSnapshot.timestamp);

      serviceLogger.debug(
        `[TWRCalculator] Using date range: ${actualStartDate.toISOString()} to ${actualEndDate.toISOString()}`,
      );

      // 2. Get transfers (may be empty - that's OK!)
      const transfers = await getAgentTransferHistory(
        agentId,
        competitionId,
        actualStartDate,
      );

      serviceLogger.debug(
        `[TWRCalculator] Found ${transfers.length} transfers for agent ${agentId}`,
      );

      // 3. Calculate TWR based on whether there are transfers
      let result: TWRResult;

      if (transfers.length === 0) {
        // No transfers - simple case, just one period
        result = this.calculateSimpleReturn(firstSnapshot, lastSnapshot);
      } else {
        // Has transfers - need to create periods and chain-link returns
        result = this.calculateTWRWithTransfers(
          firstSnapshot,
          lastSnapshot,
          transfers,
          actualStartDate,
          actualEndDate,
        );
      }

      serviceLogger.debug(
        `[TWRCalculator] Calculated TWR: ${(result.timeWeightedReturn * 100).toFixed(4)}% for agent ${agentId}`,
      );

      return result;
    } catch (error) {
      serviceLogger.error(
        `[TWRCalculator] Error calculating TWR for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate simple return when there are no transfers
   * This is the most common case - agent trades without deposits/withdrawals
   */
  private calculateSimpleReturn(
    startSnapshot: SelectPortfolioSnapshot,
    endSnapshot: SelectPortfolioSnapshot,
  ): TWRResult {
    const startValue = new Decimal(startSnapshot.totalValue);
    const endValue = new Decimal(endSnapshot.totalValue);

    // Handle invalid, zero, or negative starting value
    if (startValue.isNaN() || startValue.isZero() || startValue.isNegative()) {
      serviceLogger.warn(
        `[TWRCalculator] Starting equity is invalid, zero or negative: ${startValue}`,
      );
      return {
        timeWeightedReturn: 0,
        periods: [],
        transferCount: 0,
        snapshotCount: 2, // We only fetch 2 snapshots now
      };
    }

    // Also check if end value is NaN
    if (endValue.isNaN()) {
      serviceLogger.warn(
        `[TWRCalculator] Ending equity is invalid: ${endValue}`,
      );
      return {
        timeWeightedReturn: 0,
        periods: [],
        transferCount: 0,
        snapshotCount: 2,
      };
    }

    // Calculate simple return: (End - Start) / Start
    const simpleReturn = endValue.minus(startValue).div(startValue);

    const period: TWRPeriod = {
      periodStart: new Date(startSnapshot.timestamp),
      periodEnd: new Date(endSnapshot.timestamp),
      startingEquity: startValue.toNumber(),
      endingEquity: endValue.toNumber(),
      periodReturn: simpleReturn.toNumber(),
      sequenceNumber: 0,
    };

    return {
      timeWeightedReturn: simpleReturn.toNumber(),
      periods: [period],
      transferCount: 0,
      snapshotCount: 2, // We only fetch 2 snapshots now
    };
  }

  /**
   * Calculate TWR with transfers by creating periods and chain-linking returns
   * Uses equity values directly from transfers - no snapshot searching needed!
   */
  private calculateTWRWithTransfers(
    startSnapshot: SelectPortfolioSnapshot,
    endSnapshot: SelectPortfolioSnapshot,
    transfers: SelectPerpsTransferHistory[],
    startDate: Date,
    endDate: Date,
  ): TWRResult {
    // Sort transfers by timestamp
    const sortedTransfers = [...transfers].sort(
      (a, b) =>
        new Date(a.transferTimestamp).getTime() -
        new Date(b.transferTimestamp).getTime(),
    );

    // Filter transfers within our date range
    const relevantTransfers = sortedTransfers.filter((t) => {
      const transferTime = new Date(t.transferTimestamp);
      return transferTime > startDate && transferTime < endDate;
    });

    serviceLogger.debug(
      `[TWRCalculator] Using ${relevantTransfers.length} transfers within date range`,
    );

    // Create periods between transfers
    const periods: TWRPeriod[] = [];
    let periodStart = startDate;
    let sequenceNumber = 0;

    // Initial equity from start snapshot
    let currentEquity = Number(startSnapshot.totalValue);

    for (const transfer of relevantTransfers) {
      const transferTime = new Date(transfer.transferTimestamp);

      // Period ends just before this transfer
      // We have exact equity from transfer.equityBefore
      const endEquity = Number(transfer.equityBefore);

      const period = this.calculatePeriodReturn(
        periodStart,
        transferTime,
        currentEquity,
        endEquity,
        sequenceNumber++,
        transfer.id,
      );

      periods.push(period);

      // Next period starts after this transfer with post-transfer equity
      periodStart = transferTime;
      currentEquity = Number(transfer.equityAfter);
    }

    // Add final period from last transfer (or start) to end
    const finalEndEquity = Number(endSnapshot.totalValue);

    const finalPeriod = this.calculatePeriodReturn(
      periodStart,
      endDate,
      currentEquity, // Either post-transfer equity or initial equity if no transfers
      finalEndEquity,
      sequenceNumber++,
    );

    periods.push(finalPeriod);

    // Chain-link the returns
    const twr = this.chainLinkReturns(periods);

    return {
      timeWeightedReturn: twr,
      periods,
      transferCount: relevantTransfers.length,
      snapshotCount: 2, // We only fetch 2 snapshots now
    };
  }

  /**
   * Calculate return for a single period
   */
  private calculatePeriodReturn(
    periodStart: Date,
    periodEnd: Date,
    startingEquity: number,
    endingEquity: number,
    sequenceNumber: number,
    transferId?: string,
  ): TWRPeriod {
    const startValue = new Decimal(startingEquity);
    const endValue = new Decimal(endingEquity);

    // Handle invalid, zero, or negative starting equity
    if (startValue.isNaN() || startValue.isZero() || startValue.isNegative()) {
      serviceLogger.warn(
        `[TWRCalculator] Period ${sequenceNumber} has invalid, zero or negative starting equity: ${startValue}`,
      );
      return {
        periodStart,
        periodEnd,
        startingEquity,
        endingEquity,
        periodReturn: 0,
        sequenceNumber,
        transferId,
      };
    }

    // Also check if end value is NaN
    if (endValue.isNaN()) {
      serviceLogger.warn(
        `[TWRCalculator] Period ${sequenceNumber} has invalid ending equity: ${endValue}`,
      );
      return {
        periodStart,
        periodEnd,
        startingEquity,
        endingEquity,
        periodReturn: 0,
        sequenceNumber,
        transferId,
      };
    }

    // Calculate simple return for the period
    const periodReturn = endValue.minus(startValue).div(startValue);

    serviceLogger.debug(
      `[TWRCalculator] Period ${sequenceNumber}: ${startValue} -> ${endValue} = ${(periodReturn.toNumber() * 100).toFixed(2)}%`,
    );

    return {
      periodStart,
      periodEnd,
      startingEquity,
      endingEquity,
      periodReturn: periodReturn.toNumber(),
      sequenceNumber,
      transferId,
    };
  }

  /**
   * Chain-link period returns to get TWR
   * TWR = [(1 + r1) × (1 + r2) × ... × (1 + rn)] - 1
   */
  private chainLinkReturns(periods: TWRPeriod[]): number {
    if (periods.length === 0) {
      return 0;
    }

    // Start with 1 and multiply by (1 + return) for each period
    const product = periods.reduce((acc, period) => {
      return acc.mul(new Decimal(1).plus(period.periodReturn));
    }, new Decimal(1));

    // Subtract 1 to get the total return
    const twr = product.minus(1);

    return twr.toNumber();
  }

  /**
   * Convert TWR periods to database format for storage
   */
  formatPeriodsForStorage(
    periods: TWRPeriod[],
  ): Omit<InsertPerpsTwrPeriod, "id" | "metricsId">[] {
    return periods.map((period) => ({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodReturn: period.periodReturn.toString(),
      startingEquity: period.startingEquity.toString(),
      endingEquity: period.endingEquity.toString(),
      transferId: period.transferId || null,
      sequenceNumber: period.sequenceNumber,
    }));
  }
}
