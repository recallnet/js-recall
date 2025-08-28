import Decimal from "decimal.js-light";

import { makeBoostDecayFn, splitPrizePool } from "./helpers.js";
import type {
  BoostAllocation,
  BoostAllocationWindow,
  Leaderboard,
  Reward,
} from "./types.js";

Decimal.set({ precision: 50 });

// Re-export types for convenience
export type { BoostAllocation, BoostAllocationWindow, Reward, Leaderboard };

/** Decay rate for boost time calculations */
export const BoostTimeDecayRate = 0.5;
/** Decay rate for prize pool distribution */
export const PrizePoolDecayRate = 0.5;

/**
 * Calculate rewards for users based on their boost allocations and the leaderboard
 * @param prizePool - The total prize pool amount to distribute in WEI
 * @param boostAllocations - Array of boost allocations from users
 * @param leaderBoard - Ordered list of competitors (winner first)
 * @param window - Time window for boost allocations
 * @param prizePoolDecayRate - Decay rate for prize pool distribution (defaults to PrizePoolDecayRate)
 * @param boostTimeDecayRate - Decay rate for boost time calculations (defaults to BoostTimeDecayRate)
 * @param hook - Optional function to be called to inspect the calculations
 * @returns Array of rewards to be distributed to users
 * @throws {Error} If the boost allocation window is invalid or the decay rates are invalid
 */
export function calculateRewards(
  prizePool: bigint,
  boostAllocations: BoostAllocation[],
  leaderBoard: Leaderboard,
  window: BoostAllocationWindow,
  prizePoolDecayRate: number = PrizePoolDecayRate,
  boostTimeDecayRate: number = BoostTimeDecayRate,
  hook: (data: Record<string, unknown>) => void = () => {},
): Reward[] {
  if (
    !leaderBoard ||
    leaderBoard.length === 0 ||
    prizePool === BigInt(0) ||
    boostAllocations.length === 0
  ) {
    return [];
  }

  if (window.end <= window.start) {
    throw new Error(
      `Invalid boost allocation window: end date (${window.end.toISOString()}) must be greater than start date (${window.start.toISOString()})`,
    );
  }

  if (prizePoolDecayRate <= 0 || prizePoolDecayRate >= 1) {
    throw new Error(
      `Invalid prize pool decay rate: ${prizePoolDecayRate}. Must be between 0 and 1.`,
    );
  }

  if (boostTimeDecayRate <= 0 || boostTimeDecayRate >= 1) {
    throw new Error(
      `Invalid boost time decay rate: ${boostTimeDecayRate}. Must be between 0 and 1.`,
    );
  }

  const prizePoolSplits = splitPrizePool(
    prizePool,
    leaderBoard,
    prizePoolDecayRate,
  );
  hook({ prizePoolSplits: prizePoolSplits });

  const boostDecayFn = makeBoostDecayFn(window, boostTimeDecayRate);

  const competitorTotals: Record<string, Decimal> = {};
  const userTotals: Record<string, Record<string, Decimal>> = {};

  for (const { user, competitor, boost, timestamp } of boostAllocations) {
    competitorTotals[competitor] = (
      competitorTotals[competitor] || new Decimal(0)
    ).add(boost);

    if (!userTotals[user]) {
      userTotals[user] = {};
    }

    const effectiveBoost = boostDecayFn(timestamp).times(boost);

    userTotals[user]![competitor] = (
      userTotals[user]![competitor] || new Decimal(0)
    ).add(effectiveBoost);
  }

  hook({ userTotals: userTotals });
  hook({ competitorTotals: competitorTotals });

  const rewards: Reward[] = [];
  for (const [user, competitors] of Object.entries(userTotals)) {
    let payoutSum = new Decimal(0);

    for (const [competitor, effectiveBoost] of Object.entries(competitors)) {
      if (effectiveBoost.gt(0)) {
        const split = prizePoolSplits[competitor]!;
        const totalBoost = competitorTotals[competitor]!;
        const payout = split.times(effectiveBoost).div(totalBoost);
        payoutSum = payoutSum.plus(payout);
      }
    }

    if (payoutSum.gt(0)) {
      // Convert Decimal to bigint by rounding to nearest integer
      const payoutBigInt = BigInt(payoutSum.toFixed(0, Decimal.ROUND_DOWN));
      rewards.push({ address: user, amount: payoutBigInt });
    }
  }
  hook({ rewards: rewards });

  return rewards;
}
