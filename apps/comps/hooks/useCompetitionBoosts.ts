import { useInfiniteQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";
import { getCompetitionPollingInterval } from "@/utils/competition-utils";

/**
 * Hook to fetch paginated boost allocations for a competition
 * @param competitionId Competition ID
 * @param limit Number of items per page
 * @param enabled Whether the query is enabled
 * @param competitionStatus Competition status for determining polling behavior
 * @returns Infinite query result with boosts data and loadMore function
 */
export const useCompetitionBoosts = (
  competitionId: string,
  limit: number = 25,
  enabled: boolean = true,
  competitionStatus?: "active" | "pending" | "ending" | "ended",
) => {
  return useInfiniteQuery({
    queryKey: ["competition", "boosts", competitionId, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await client.boost.competitionBoosts({
        competitionId,
        limit,
        offset: pageParam,
      });
      return result;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.offset + lastPage.pagination.limit;
      }
      return undefined;
    },
    enabled,
    staleTime: 60 * 1000, // Consider data stale after 60 seconds
    refetchInterval: () => getCompetitionPollingInterval(competitionStatus),
  });
};
