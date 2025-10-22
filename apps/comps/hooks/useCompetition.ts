import {
  type UseQueryResult,
  skipToken,
  useQuery,
} from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Hook to fetch a single competition by ID
 * @param id Competition ID
 * @returns Query result with competition data
 */
export const useCompetition = (
  id?: string,
): UseQueryResult<RouterOutputs["competitions"]["getById"], Error> =>
  useQuery(
    tanstackClient.competitions.getById.queryOptions({
      input: id ? { id } : skipToken,
      staleTime: 30 * 1000, // 30 seconds - shorter cache for real-time updates
      refetchInterval: 60 * 1000, // Refetch every minute to keep data fresh
    }),
  );
