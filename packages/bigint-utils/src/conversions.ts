import * as dn from "dnum";

import { CREDIT_RECALL_RATE, ONE_GB_MONTH } from "./constants.js";

const blockTime = 1;

export function gbMonthsToCredits(gbMonths: number | string) {
  const res = dn.multiply(gbMonths, ONE_GB_MONTH);
  return BigInt(dn.toString(res));
}

export function crazyCreditsToCredits(crazyCredits: bigint | string) {
  const res = dn.multiply(crazyCredits, 1e-18);
  return BigInt(dn.toString(res));
}

export function creditsToRecall(credits: bigint | string) {
  const res = dn.multiply(credits, CREDIT_RECALL_RATE);
  return BigInt(dn.toString(res));
}

export function creditsToGbMonths(credits: bigint | string) {
  const res = dn.divide(credits, ONE_GB_MONTH, 2);
  return dn.toNumber(res);
}

export function crazyCreditsToGbMonths(credits: bigint | string) {
  const res = dn.divide(dn.multiply(credits, 1e-18), ONE_GB_MONTH, 2);
  return dn.toNumber(res);
}

export function gbMonthsToRecall(gbMonths: number | string) {
  const credits = dn.multiply(gbMonths, ONE_GB_MONTH);
  const recall = dn.multiply(credits, CREDIT_RECALL_RATE);
  return BigInt(dn.toString(recall));
}

export function recallToDisplay(recall: bigint | string, decimals: number = 4) {
  const displayRecall = dn.multiply(recall, 1e-18, decimals);
  return dn.format(displayRecall, decimals);
}

export function displayToRecall(display: bigint | string) {
  const recall = dn.multiply(display, 1e18);
  return BigInt(dn.toString(recall));
}

export function hoursToNumBlocks(hours: number | string) {
  const res = dn.multiply(hours, (60 * 60) / blockTime);
  return BigInt(dn.toString(res));
}

export function numBlocksToSeconds(numBlocks: bigint | number | string) {
  const res = dn.multiply(numBlocks, blockTime);
  return BigInt(dn.toString(res));
}
