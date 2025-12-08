import { format, isValid, parseISO } from "date-fns";
import { cmp, format as formatBigint } from "dnum";

/**
 * Formats a number as a percentage string.
 * Calculates percentage as (value / total) * 100 to match legacy callers.
 * @param value - The value to convert to percentage
 * @param total - The total value to calculate percentage from (defaults to 100—i.e., assume it's already a percentage)
 * @param maxDecimals - Maximum decimal places in the output (defaults to 0)
 * @returns A formatted percentage string (e.g. "50%", "12.34%")
 */
export const formatPercentage = (
  value: number,
  total: number = 100,
  maxDecimals: number = 0,
): string => {
  if (total === 0) return "0%";
  const pct = (value / total) * 100;
  return `${formatAmount(pct, maxDecimals, true)}%`;
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

/**
 * Formats a date into a human-readable string (e.g. "June 1st, 2025")
 * @param date - The date to format
 * @param year - Whether to include the year in the formatted date
 * @returns A formatted date string
 */
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

/**
 * Format date to "Month dayth" style (e.g., "Jun 1st", "May 23rd")
 * @param dateStr - The date to format.
 * @param includeTime - Whether to include the time in the formatted date.
 * @returns A formatted date string.
 * @example
 * ```typescript
 * formatDateShort("2025-06-01T00:00:00Z") // "Jun 1st"
 * formatDateShort("2025-06-01T00:00:00Z", true) // "Jun 1st 12:00 AM"
 * ```
 */
export const formatDateShort = (
  dateStr: string | Date,
  includeTime?: boolean,
): string => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();

  // Add ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  let result = `${month} ${day}${getOrdinalSuffix(day)}`;

  if (includeTime) {
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
    result += ` ${time}`;
  }

  return result;
};

/**
 * Format date as relative time (e.g., "2h ago", "3 days ago", "just now")
 * @param dateStr - The date to format
 * @returns A relative time string
 * @example
 * ```typescript
 * formatRelativeTime(new Date()) // "just now"
 * formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000)) // "2h ago"
 * formatRelativeTime(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // "3d ago"
 * ```
 */
export const formatRelativeTime = (dateStr: string | Date): string => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  } else {
    // Fall back to date format for older dates
    return formatDateShort(date);
  }
};
