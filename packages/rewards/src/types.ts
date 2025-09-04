import { Decimal } from "decimal.js-light";

/**
 * Represents a boost allocation for a user supporting a specific competitor
 * at a given timestamp
 */
export type BoostAllocation = {
  /** The user's address or identifier */
  user: string;
  /** The competitor's address or identifier */
  competitor: string;
  /** The amount of boost allocated */
  boost: number;
  /** The timestamp when the boost was allocated */
  timestamp: Date;
};

/**
 * Represents a time window for boost allocations
 */
export type BoostAllocationWindow = {
  /** The start date of the allocation window */
  start: Date;
  /** The end date of the allocation window */
  end: Date;
};

/**
 * Represents the split of a prize pool among competitors
 * Maps competitor identifiers to their allocated amounts
 */
export type PrizePoolSplit = Record<string, Decimal>;

/**
 * Represents a time interval with start and end dates
 */
export type Interval = [Date, Date];

/**
 * Represents a reward payout to a user
 */
export type Reward = {
  /** The user's address */
  address: string;
  /** The amount of the reward in WEI */
  amount: bigint;
};

/**
 * Represents a leaderboard as an ordered list of competitor identifiers
 * The first element is the winner, second is runner-up, etc.
 */

export type Placement = {
  /** The competitor's identifier */
  competitor: string;
  /** The rank of the competitor */
  rank: number;
};

/**
 * Represents a leaderboard as an ordered list of placements
 */
export type Leaderboard = Placement[];
