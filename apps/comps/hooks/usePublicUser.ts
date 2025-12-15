import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { PagingParams } from "@recallnet/services/types";

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
 * Hook to fetch competitions for a user's agents (public, unauthenticated)
 * @param userId User ID
 * @param params Pagination parameters (limit, offset, sort)
 * @returns Query result with public user competitions data
 */
export const usePublicUserCompetitions = (
  userId?: string,
  params?: PagingParams,
): UseQueryResult<
  RouterOutputs["publicUser"]["getPublicCompetitions"],
  Error
> =>
  useQuery(
    tanstackClient.publicUser.getPublicCompetitions.queryOptions({
      input: userId ? { userId, params } : skipToken,
    }),
  );
