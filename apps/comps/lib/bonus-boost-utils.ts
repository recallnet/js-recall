/**
 * Format time remaining until expiration in human-readable format
 * @param expiresAt - ISO 8601 expiration date string
 * @returns Human-readable time remaining (e.g., "15 days", "2 hours", "30 minutes")
 */
export const formatTimeRemaining = (expiresAt: string): string => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Expired";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }

  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }

  return `${diffSeconds} second${diffSeconds === 1 ? "" : "s"}`;
};

/**
 * Get expiration warning level based on time remaining
 * @param expiresAt - ISO 8601 expiration date string
 * @returns Warning level: 'danger' (<7 days), 'warning' (<30 days), or 'normal' (>30 days)
 */
export const getExpirationWarningLevel = (
  expiresAt: string,
): "danger" | "warning" | "normal" => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return "danger";
  }

  if (diffDays < 30) {
    return "warning";
  }

  return "normal";
};

/**
 * Sum bonus boost amounts
 * @param boosts - Array of bonus boosts with amount as string
 * @returns Total amount across all bonus boosts as bigint
 */
export const sumBonusBoosts = (boosts: Array<{ amount: string }>): bigint => {
  return boosts.reduce((sum, boost) => sum + BigInt(boost.amount), 0n);
};

/**
 * Get CSS class name for expiration warning level
 * @param expiresAt - ISO 8601 expiration date string
 * @returns CSS class name for text color
 */
export const getExpirationWarningClass = (expiresAt: string): string => {
  const level = getExpirationWarningLevel(expiresAt);

  switch (level) {
    case "danger":
      return "text-red-500";
    case "warning":
      return "text-yellow-500";
    default:
      return "";
  }
};

/**
 * Aggregate bonus boosts by expiration date (ignoring time)
 * Groups boosts that expire on the same calendar day and sums their amounts
 * Uses the earliest expiration time for each date
 * @param boosts - Array of bonus boosts
 * @returns Array of aggregated boosts with unique expiration dates
 */
export const aggregateBonusBoostsByExpiration = <
  T extends { amount: string; expiresAt: string },
>(
  boosts: T[],
): Array<{ amount: string; expiresAt: string }> => {
  const aggregated = new Map<
    string,
    { amount: bigint; earliestExpiration: string }
  >();

  for (const boost of boosts) {
    // Get the date part only (YYYY-MM-DD) by using UTC to avoid timezone issues
    const dateKey = new Date(boost.expiresAt).toISOString().split("T")[0];
    if (!dateKey) continue;

    const existing = aggregated.get(dateKey);
    if (existing) {
      // Sum the amount and keep the earliest expiration time
      aggregated.set(dateKey, {
        amount: existing.amount + BigInt(boost.amount),
        earliestExpiration:
          boost.expiresAt < existing.earliestExpiration
            ? boost.expiresAt
            : existing.earliestExpiration,
      });
    } else {
      aggregated.set(dateKey, {
        amount: BigInt(boost.amount),
        earliestExpiration: boost.expiresAt,
      });
    }
  }

  return Array.from(aggregated.values()).map((entry) => ({
    expiresAt: entry.earliestExpiration,
    amount: entry.amount.toString(),
  }));
};
