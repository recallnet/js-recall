import * as dn from "dnum";

import { ONE_GB_MONTH_TO_CREDITS, RECALL_TO_CREDIT_RATE } from "./constants.js";

const blockTime = 1;

// TODO: Validate this input should is an integer.
export function gbMonthsToCredits(gbMonths: dn.Numberish) {
  const res = dn.multiply(gbMonths, ONE_GB_MONTH_TO_CREDITS);
  return BigInt(dn.toString(res));
}

export function attoCreditsToGbMonths(attoCredits: dn.Numberish) {
  const res = dn.divide(
    dn.multiply(attoCredits, 1e-18),
    ONE_GB_MONTH_TO_CREDITS,
    4,
  );
  return dn.toNumber(res);
}

export function gbMonthsToAttoRecall(gbMonths: dn.Numberish) {
  const credits = dn.multiply(gbMonths, ONE_GB_MONTH_TO_CREDITS);
  const recall = dn.divide(credits, RECALL_TO_CREDIT_RATE, { decimals: 18 });
  const attoRecall = dn.multiply(recall, 1e18);
  return BigInt(dn.toString(attoRecall));
}

export function attoRecallToRecallDisplay(
  recall: bigint | string,
  decimals: number = 4,
) {
  const displayRecall = dn.multiply(recall, 1e-18, decimals);
  return dn.format(displayRecall, decimals);
}

export function recallToAttoRecall(recall: dn.Numberish) {
  const attoRecall = dn.multiply(recall, 1e18);
  return BigInt(dn.toString(attoRecall));
}

export function hoursToNumBlocks(hours: number | string) {
  const res = dn.multiply(hours, (60 * 60) / blockTime);
  return BigInt(dn.toString(res));
}

export function numBlocksToSeconds(numBlocks: bigint | number | string) {
  const res = dn.multiply(numBlocks, blockTime);
  return BigInt(dn.toString(res));
}
