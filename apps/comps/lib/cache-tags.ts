import { revalidateTag } from "next/cache";

/**
 * Cache tag generators for consistent tag naming across the application
 */
export const CacheTags = {
  /**
   * Cache tag for agent boost totals in a specific competition
   *
   * @param competitionId - The competition UUID
   * @returns Cache tag string
   */
  agentBoostTotals: (competitionId: string): string =>
    `agent-boost-totals:${competitionId}`,
} as const;

/**
 * Invalidates multiple cache tags
 *
 * @param tags - Array of cache tag strings to invalidate
 */
export function invalidateCacheTags(tags: string[]): void {
  for (const tag of tags) {
    revalidateTag(tag);
  }
}
