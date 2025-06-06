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
