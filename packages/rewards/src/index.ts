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
/** Decay rate for competitor prize pool distribution */
export const CompetitorPrizePoolDecayRate = 0.5;

/**
 * Calculate rewards for users based on their boost allocations and the leaderboard
 * @param prizePool - The total prize pool amount to distribute in WEI
 * @param boostAllocations - Array of boost allocations from users
 * @param leaderBoard - List of placements
 * @param window - Time window for boost allocations
 * @param prizePoolDecayRate - Decay rate for prize pool distribution (defaults to PrizePoolDecayRate)
 * @param boostTimeDecayRate - Decay rate for boost time calculations (defaults to BoostTimeDecayRate)
 * @param hook - Optional function to be called to inspect the calculations
 * @returns Array of rewards to be distributed to users
 * @throws {Error} If the boost allocation window is invalid or the decay rates are invalid
 */
export function calculateRewardsForUsers(
  prizePool: bigint,
  boostAllocations: BoostAllocation[],
  leaderBoard: Leaderboard,
  window: BoostAllocationWindow,
  prizePoolDecayRate: number = PrizePoolDecayRate,
  boostTimeDecayRate?: number,
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

  if (prizePoolDecayRate < 0.1 || prizePoolDecayRate > 0.9) {
    throw new Error(
      `Invalid prize pool decay rate: ${prizePoolDecayRate}. Must be between 0 and 1.`,
    );
  }

  if (boostTimeDecayRate) {
    if (boostTimeDecayRate < 0.1 || boostTimeDecayRate > 0.9) {
      throw new Error(
        `Invalid boost time decay rate: ${boostTimeDecayRate}. Must be between 0 and 1.`,
      );
    }
  }

  const prizePoolSplits = splitPrizePool(
    prizePool,
    leaderBoard,
    prizePoolDecayRate,
  );
  hook({ prizePoolSplits: prizePoolSplits });

  /**
   * If boostTimeDecayRate is not set, use a boost decay function that always returns 1.
   * Otherwise, use the makeBoostDecayFn with the provided boostTimeDecayRate.
   */
  const boostDecayFn =
    boostTimeDecayRate === undefined
      ? (_timestamp: Date) => new Decimal(1) // eslint-disable-line @typescript-eslint/no-unused-vars
      : makeBoostDecayFn(window, boostTimeDecayRate);

  const competitorTotals: Record<string, Decimal> = {};
  const userTotals: Record<string, Record<string, Decimal>> = {};
  const userIds: Record<string, string> = {};

  for (const {
    user_wallet,
    user_id,
    competitor,
    boost,
    timestamp,
  } of boostAllocations) {
    if (!userTotals[user_wallet]) {
      userTotals[user_wallet] = {};
    }

    if (!userIds[user_wallet]) {
      userIds[user_wallet] = user_id;
    }

    const effectiveBoost = boostDecayFn(timestamp).times(
      new Decimal(boost.toString()),
    );

    competitorTotals[competitor] = (
      competitorTotals[competitor] || new Decimal(0)
    ).add(effectiveBoost);

    userTotals[user_wallet]![competitor] = (
      userTotals[user_wallet]![competitor] || new Decimal(0)
    ).add(effectiveBoost);
  }

  hook({ userTotals: userTotals });
  hook({ competitorTotals: competitorTotals });

  const rewards: Reward[] = [];
  for (const [user_wallet, competitors] of Object.entries(userTotals)) {
    let payoutSum = new Decimal(0);

    for (const [competitor, effectiveBoost] of Object.entries(competitors)) {
      if (effectiveBoost.gt(0)) {
        // This check is to avoid the case where an user has boosted to a competitor that is not in the leaderboard,
        // that can happen if the  competitor was disqualified or removed from competition or left the competition
        if (
          !(competitor in prizePoolSplits) ||
          !(competitor in competitorTotals)
        ) {
          continue;
        }

        const split = prizePoolSplits[competitor]!;
        const totalBoost = competitorTotals[competitor]!;
        const payout = split.times(effectiveBoost).div(totalBoost);
        payoutSum = payoutSum.plus(payout);
      }
    }

    if (payoutSum.gt(0)) {
      // Convert Decimal to bigint by rounding to nearest integer
      const payoutBigInt = BigInt(payoutSum.toFixed(0, Decimal.ROUND_DOWN));
      rewards.push({
        address: user_wallet,
        amount: payoutBigInt,
        owner: userIds[user_wallet]!,
      });
    }
  }
  hook({ rewards: rewards });

  return rewards;
}

/**
 * Calculate rewards for competitors based on the prize pool distribution
 * @param prizePool - The total prize pool amount to distribute in WEI
 * @param leaderBoard - List of placements
 * @param prizePoolDecayRate - Decay rate for prize pool distribution (defaults to CompetitorPrizePoolDecayRate)
 * @param hook - Optional function to be called to inspect the calculations
 * @returns Array of rewards to be distributed to competitors
 */
export function calculateRewardsForCompetitors(
  prizePool: bigint,
  leaderBoard: Leaderboard,
  prizePoolDecayRate: number = CompetitorPrizePoolDecayRate,
  hook: (data: Record<string, unknown>) => void = () => {},
): Reward[] {
  if (!leaderBoard || leaderBoard.length === 0 || prizePool === BigInt(0)) {
    return [];
  }

  if (prizePoolDecayRate <= 0.1 || prizePoolDecayRate >= 0.9) {
    throw new Error(
      `Invalid prize pool decay rate: ${prizePoolDecayRate}. Must be between 0 and 1.`,
    );
  }

  const prizePoolSplits = splitPrizePool(
    prizePool,
    leaderBoard,
    prizePoolDecayRate,
  );
  hook({ prizePoolSplits: prizePoolSplits });

  // Build competitor to wallet mapping from leaderboard
  const competitorToWalletMap: Record<string, string> = {};
  const competitorToOwnerMap: Record<string, string> = {};
  for (const placement of leaderBoard) {
    competitorToWalletMap[placement.competitor] = placement.wallet;
    competitorToOwnerMap[placement.competitor] = placement.owner;
  }

  const rewards: Reward[] = [];
  for (const [competitor, split] of Object.entries(prizePoolSplits)) {
    const owner = competitorToOwnerMap[competitor];
    /* c8 ignore start */
    if (!owner) {
      continue;
    }
    /* c8 ignore end */
    const walletAddress = competitorToWalletMap[competitor]!;
    rewards.push({
      address: walletAddress,
      amount: BigInt(split.toFixed(0, Decimal.ROUND_DOWN)),
      owner,
      competitor,
    });
  }
  hook({ rewards: rewards });

  return rewards;
}
