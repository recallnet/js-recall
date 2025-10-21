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

  /**
   * Cache tag for competitions that a specific agent is participating in
   *
   * @param agentId - The agent UUID
   * @returns Cache tag string
   */
  agentCompetitions: (agentId: string): string =>
    `agent-competitions:${agentId}`,

  /**
   * Cache tag for a specific agent's profile and details
   *
   * @param agentId - The agent UUID
   * @returns Cache tag string
   */
  agent: (agentId: string): string => `agent:${agentId}`,

  /**
   * Cache tag for the global agent list
   *
   * Invalidating this tag will invalidate all paginated agent list queries
   *
   * @returns Cache tag string
   */
  agentList: (): string => `agent-list`,

  /**
   * Cache tag for a specific competition by ID
   *
   * @param competitionId - The competition UUID
   * @returns Cache tag string
   */
  competition: (competitionId: string): string =>
    `competition:${competitionId}`,

  /**
   * Cache tag for all competition lists
   *
   * Invalidating this tag will invalidate all paginated competition list queries across all statuses
   *
   * @returns Cache tag string
   */
  competitionList: (): string => `competition-list`,
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
