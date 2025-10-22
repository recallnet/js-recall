import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Hook to fetch a single agent by ID owned by the authenticated user
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useUserAgent = (
  id?: string,
): UseQueryResult<RouterOutputs["user"]["getUserAgent"], Error> =>
  useQuery(
    tanstackClient.user.getUserAgent.queryOptions({
      input: id ? { agentId: id } : skipToken,
    }),
  );

/**
 * Hook to fetch a single agent by ID (public, unauthenticated)
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useAgent = (
  id?: string,
): UseQueryResult<RouterOutputs["agent"]["getAgent"], Error> =>
  useQuery(
    tanstackClient.agent.getAgent.queryOptions({
      input: id ? { agentId: id } : skipToken,
    }),
  );
