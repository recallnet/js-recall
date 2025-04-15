import * as dn from "dnum";

import { ONE_GB_MONTH_TO_CREDITS, RECALL_TO_CREDIT_RATE } from "./constants.js";

/** The time between blocks in seconds */
const blockTime = 1;

/**
 * Converts gigabyte-months to credits.
 *
 * @example
 * ```typescript
 * // Convert 1 GB-month to credits
 * gbMonthsToCredits(1)
 * // Returns: 2592000000000000n (2.592e15)
 * ```
 *
 * @param gbMonths - The number of gigabyte-months to convert
 * @returns The equivalent amount of credits as a BigInt
 * @throws Will throw if the input is not a valid number
 */
export function gbMonthsToCredits(gbMonths: dn.Numberish) {
  const res = dn.multiply(gbMonths, ONE_GB_MONTH_TO_CREDITS);
  return BigInt(dn.toString(res));
}

/**
 * Converts atto-credits to gigabyte-months.
 *
 * @example
 * ```typescript
 * // Convert 2.592e15 atto-credits to GB-months
 * attoCreditsToGbMonths("2592000000000000")
 * // Returns: 1
 * ```
 *
 * @param attoCredits - The number of atto-credits to convert
 * @returns The equivalent amount of gigabyte-months as a number with 4 decimal places
 */
export function attoCreditsToGbMonths(attoCredits: dn.Numberish) {
  const res = dn.divide(
    dn.multiply(attoCredits, 1e-18),
    ONE_GB_MONTH_TO_CREDITS,
    4,
  );
  return dn.toNumber(res);
}

/**
 * Converts gigabyte-months to atto-RECALL tokens.
 *
 * @example
 * ```typescript
 * // Convert 1 GB-month to atto-RECALL
 * gbMonthsToAttoRecall(1)
 * // Returns: 2592000000000000000000000000000000n (2.592e33)
 * ```
 *
 * @param gbMonths - The number of gigabyte-months to convert
 * @returns The equivalent amount of atto-RECALL tokens as a BigInt
 */
export function gbMonthsToAttoRecall(gbMonths: dn.Numberish) {
  const credits = dn.multiply(gbMonths, ONE_GB_MONTH_TO_CREDITS);
  const recall = dn.divide(credits, RECALL_TO_CREDIT_RATE, { decimals: 18 });
  const attoRecall = dn.multiply(recall, 1e18);
  return BigInt(dn.toString(attoRecall));
}

/**
 * Converts atto-RECALL tokens to a human-readable RECALL token amount.
 *
 * @example
 * ```typescript
 * // Convert 1.5 RECALL worth of atto-RECALL to display format
 * attoRecallToRecallDisplay("1500000000000000000")
 * // Returns: "1.5000"
 *
 * // With custom decimal places
 * attoRecallToRecallDisplay("1500000000000000000", 2)
 * // Returns: "1.50"
 * ```
 *
 * @param recall - The amount of atto-RECALL tokens
 * @param decimals - The number of decimal places to display (default: 4)
 * @returns A formatted string representation of the RECALL token amount
 */
export function attoRecallToRecallDisplay(
  recall: bigint | string,
  decimals: number = 4,
) {
  const displayRecall = dn.multiply(recall, 1e-18, decimals);
  return dn.format(displayRecall, decimals);
}

/**
 * Converts RECALL tokens to atto-RECALL tokens.
 *
 * @example
 * ```typescript
 * // Convert 1.5 RECALL to atto-RECALL
 * recallToAttoRecall(1.5)
 * // Returns: 1500000000000000000n
 * ```
 *
 * @param recall - The amount of RECALL tokens to convert
 * @returns The equivalent amount of atto-RECALL tokens as a BigInt
 */
export function recallToAttoRecall(recall: dn.Numberish) {
  const attoRecall = dn.multiply(recall, 1e18);
  return BigInt(dn.toString(attoRecall));
}

/**
 * Converts hours to the equivalent number of blocks.
 *
 * @example
 * ```typescript
 * // Convert 1 hour to blocks (assuming 1 block per second)
 * hoursToNumBlocks(1)
 * // Returns: 3600n
 * ```
 *
 * @param hours - The number of hours to convert
 * @returns The equivalent number of blocks as a BigInt
 */
export function hoursToNumBlocks(hours: number | string) {
  const res = dn.multiply(hours, (60 * 60) / blockTime);
  return BigInt(dn.toString(res));
}

/**
 * Converts a number of blocks to seconds.
 *
 * @example
 * ```typescript
 * // Convert 3600 blocks to seconds (assuming 1 block per second)
 * numBlocksToSeconds(3600)
 * // Returns: 3600n
 * ```
 *
 * @param numBlocks - The number of blocks to convert
 * @returns The equivalent number of seconds as a BigInt
 */
export function numBlocksToSeconds(numBlocks: bigint | number | string) {
  const res = dn.multiply(numBlocks, blockTime);
  return BigInt(dn.toString(res));
}
