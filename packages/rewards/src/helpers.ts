import Decimal from "decimal.js-light";

import type {
  BoostAllocationWindow,
  Interval,
  Leaderboard,
  PrizePoolSplit,
} from "./types.js";

// Set Decimal.js precision to 50
Decimal.set({ precision: 50 });

/** Milliseconds in a day */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Split the boost allocation window into daily intervals
 * @param boostAllocationWindow - The boost allocation window
 * @returns An array of intervals
 */
export function splitIntoDailyIntervals({
  start,
  end,
}: BoostAllocationWindow): Interval[] {
  const result: Interval[] = [];
  let current = new Date(start);

  while (current < end) {
    const next = new Date(current.getTime() + DAY_MS); // +1 day
    result.push([current, next < end ? next : end]);
    current = next;
  }

  return result;
}

/**
 * Split the prize pool into a proportional distribution based on the leaderboard
 * @param amount - The amount of the prize pool in WEI
 * @param leaderBoard - The leaderboard
 * @param r - The decay rate
 * @returns A record of the prize pool split for each competitor
 */
export function splitPrizePool(
  amount: bigint,
  leaderBoard: Leaderboard,
  r: number,
): PrizePoolSplit {
  const k = leaderBoard.length;
  const splits: PrizePoolSplit = {};
  const rDecimal = new Decimal(r);
  const amountDecimal = new Decimal(amount.toString());
  const denominator = new Decimal(1).minus(rDecimal.pow(k));

  // Group competitors by rank to handle ties
  const rankGroups = new Map<number, string[]>();
  for (const placement of leaderBoard) {
    if (!rankGroups.has(placement.rank)) {
      rankGroups.set(placement.rank, []);
    }
    rankGroups.get(placement.rank)!.push(placement.competitor);
  }

  // Calculate prize pool for each rank and distribute among tied competitors
  for (const [rank, competitors] of rankGroups) {
    let combinedPool = new Decimal(0);
    const numTiedCompetitors = competitors.length;

    for (let i = 0; i < numTiedCompetitors; i++) {
      const actualRank = rank + i;
      const weight = new Decimal(1)
        .minus(rDecimal)
        .times(rDecimal.pow(actualRank - 1))
        .div(denominator);

      const rankPool = weight.times(amountDecimal);
      combinedPool = combinedPool.plus(rankPool);
    }

    // Split the combined pool equally among tied competitors
    const splitPerCompetitor = combinedPool.div(numTiedCompetitors);

    for (const competitor of competitors) {
      splits[competitor] = splitPerCompetitor;
    }
  }

  return splits;
}

/**
 * Make a function that calculates the boost decay for a given timestamp
 * @param window - The boost allocation window
 * @param r - The decay rate
 * @returns A function that calculates the boost decay for a given timestamp
 * @throws {Error} If the boost allocation window is invalid
 */
export function makeBoostDecayFn(
  window: BoostAllocationWindow,
  r: number,
): (timestamp: Date) => Decimal {
  const intervals = splitIntoDailyIntervals(window);
  const rDecimal = new Decimal(r);
  return function (timestamp: Date): Decimal {
    const index = intervals.findIndex(
      ([start, end]) => timestamp >= start && timestamp < end,
    );
    if (index === -1) {
      return new Decimal(0);
    }
    return rDecimal.pow(index);
  };
}
