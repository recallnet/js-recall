import {
  UseInfiniteQueryResult,
  skipToken,
  useInfiniteQuery,
} from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";
import { CompetitionStatus } from "@/types/enums";
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
  competitionStatus?: CompetitionStatus,
): UseInfiniteQueryResult<
  RouterOutputs["boost"]["competitionBoosts"],
  Error
> => {
  const baseOptions = tanstackClient.boost.competitionBoosts.queryOptions({
    input: enabled
      ? {
          competitionId,
          limit,
          offset: 0,
        }
      : skipToken,
    staleTime: 60_000,
    refetchInterval: () => getCompetitionPollingInterval(competitionStatus),
  });

  return useInfiniteQuery({
    ...baseOptions,
    queryKey: [...baseOptions.queryKey, "infinite"],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) =>
      tanstackClient.boost.competitionBoosts.call({
        competitionId,
        limit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });
};
