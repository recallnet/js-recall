import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Hook to fetch a public user profile by ID (unauthenticated)
 * Returns sanitized user data without PII (name, email)
 * @param userId User ID
 * @returns Query result with public user profile data
 */
export const usePublicUserProfile = (
  userId?: string,
): UseQueryResult<RouterOutputs["publicUser"]["getPublicProfile"], Error> =>
  useQuery(
    tanstackClient.publicUser.getPublicProfile.queryOptions({
      input: userId ? { userId } : skipToken,
    }),
  );

/**
 * Hook to fetch agents owned by a user (public, unauthenticated)
 * @param userId User ID
 * @returns Query result with public user agents data
 */
export const usePublicUserAgents = (
  userId?: string,
): UseQueryResult<RouterOutputs["publicUser"]["getPublicAgents"], Error> =>
  useQuery(
    tanstackClient.publicUser.getPublicAgents.queryOptions({
      input: userId ? { userId } : skipToken,
    }),
  );

/**
 * Pagination parameters for public user competitions
 */
interface PublicUserCompetitionsParams {
  limit: number;
  offset: number;
  sort: string;
}

/**
 * Hook to fetch competitions for a user's agents (public, unauthenticated)
 * @param userId User ID
 * @param params Pagination parameters (limit, offset, sort)
 * @returns Query result with public user competitions data
 */
export const usePublicUserCompetitions = (
  userId: string | undefined,
  params: PublicUserCompetitionsParams,
): UseQueryResult<
  RouterOutputs["publicUser"]["getPublicCompetitions"],
  Error
> =>
  useQuery({
    ...tanstackClient.publicUser.getPublicCompetitions.queryOptions({
      input: userId ? { userId, params } : skipToken,
    }),
    placeholderData: (prev) => prev,
  });
