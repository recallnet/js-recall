import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { UseInfiniteQueryResult } from "@tanstack/react-query";

import { CompetitionBoostsResult } from "@recallnet/services";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";
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
  competitionStatus?: RouterOutputs["competitions"]["getById"]["status"],
): UseInfiniteQueryResult<InfiniteData<CompetitionBoostsResult>, Error> => {
  const baseOptions = tanstackClient.boost.competitionBoosts.queryOptions({
    input: { competitionId, limit, offset: 0 },
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: () => getCompetitionPollingInterval(competitionStatus),
  });
  return useInfiniteQuery({
    ...baseOptions,
    queryKey: [...baseOptions.queryKey, "infinite"],
    queryFn: async ({ pageParam = 0 }) =>
      tanstackClient.boost.competitionBoosts.call({
        competitionId,
        limit,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });
};
