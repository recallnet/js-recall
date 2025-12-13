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

  /**
   * Cache tag for a specific arena by ID
   *
   * @param arenaId - The arena ID
   * @returns Cache tag string
   */
  arena: (arenaId: string): string => `arena:${arenaId}`,

  /**
   * Cache tag for the global arena list
   *
   * Invalidating this tag will invalidate all paginated arena list queries
   *
   * @returns Cache tag string
   */
  arenaList: (): string => `arena-list`,

  /**
   * Cache tag for a public user profile
   *
   * @param userId - The user UUID
   * @returns Cache tag string
   */
  publicUser: (userId: string): string => `public-user:${userId}`,

  /**
   * Cache tag for a public user's agents list
   *
   * @param userId - The user UUID
   * @returns Cache tag string
   */
  publicUserAgents: (userId: string): string => `public-user-agents:${userId}`,

  /**
   * Cache tag for a public user's competitions list
   *
   * @param userId - The user UUID
   * @returns Cache tag string
   */
  publicUserCompetitions: (userId: string): string =>
    `public-user-competitions:${userId}`,
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
