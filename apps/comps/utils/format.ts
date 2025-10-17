import { format, isValid, parseISO } from "date-fns";
import { cmp, format as formatBigint } from "dnum";

/**
 * Formats a number as a percentage string
 * @param value - The value to convert to percentage
 * @param total - The total value to calculate percentage from
 * @returns A formatted percentage string (e.g. "50%")
 */
export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
};

/**
 * Converts a number to its ordinal form (1st, 2nd, 3rd, etc.) using Intl.PluralRules
 * @param n The number to convert
 * @returns The ordinal form of the number
 */
export function toOrdinal(n: number): string {
  const rules = new Intl.PluralRules("en-US", { type: "ordinal" });
  const suffixes = new Map([
    ["one", "st"],
    ["two", "nd"],
    ["few", "rd"],
    ["other", "th"],
  ]);

  const rule = rules.select(n);
  const suffix = suffixes.get(rule);
  return `${n}${suffix}`;
}

/**
 * Formats a number into a compact form (e.g. 2.4K, 1.2M, etc.)
 * @param value - The number to format
 * @returns A formatted compact number string
 */
export const formatCompactNumber = (value: number): string => {
  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  });
  return formatter.format(value);
};

export const formatDate = (
  date: Date | string,
  year: boolean = false,
): string => {
  let parsedDate: Date;

  if (date instanceof Date) {
    parsedDate = date;
  } else if (typeof date === "string") {
    parsedDate = parseISO(date);
  } else {
    return "Invalid Date";
  }

  if (!isValid(parsedDate)) {
    return "Invalid Date";
  }

  return format(parsedDate, `MMMM do${year ? " yyyy" : ""}`);
};

/**
 * Formats a number for display, showing up to a specified number of decimal places
 * without adding unnecessary trailing zeros.
 * @param amount - The number to format.
 * @param maxDecimals - The maximum number of decimal places to show (default: 2).
 * @param thousandsSeparator - Whether to use a thousands separator (default: false).
 * @returns A formatted number string.
 * @example
 * ```typescript
 * formatAmount(1000) // Returns "1,000"
 * formatAmount(1000, 0, true) // Returns "1,000"
 * formatAmount(1000, 2, true) // Returns "1,000.00"
 * ```
 */
export const formatAmount = (
  amount: number,
  maxDecimals: number = 2,
  thousandsSeparator: boolean = false,
): string => {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxDecimals,
    useGrouping: thousandsSeparator,
  }).format(amount);
};

/**
 * Checks if a bigint amount should be displayed in compact format through comparison.
 * @param n - The bigint amount to check.
 * @param decimals - The number of decimals of the amount (e.g., 18 for RECALL).
 * @param compareTo - If the value is greater than this value, the amount should be displayed in compact format (default: 1_000_000n).
 * @returns True if the amount should be displayed in compact format.
 */
export const shouldShowCompact = (
  amount: bigint,
  decimals: number = 18,
  compareTo: bigint = 1_000n,
): boolean => cmp([amount, decimals], compareTo) === 1;

/**
 * Formats a bigint amount for display, showing up to a specified number of decimal places
 * without adding unnecessary trailing zeros.
 * @param amount - The bigint amount to format.
 * @param decimals - The number of decimals of the amount (e.g., 18 for RECALL).
 * @param maxDecimals - The maximum number of decimal places to show (default: 2).
 * @param thousandsSeparator - Whether to use a thousands separator (default: false).
 * @returns A formatted bigint amount string.
 */
export const formatBigintAmount = (
  amount: bigint,
  decimals: number = 18,
  compact: boolean = true,
  maxDecimals: number = 2,
): string => {
  return formatBigint([amount, decimals], {
    compact,
    decimalsRounding: "ROUND_DOWN",
    trailingZeros: false,
    digits: maxDecimals,
  });
};
