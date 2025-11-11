import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  skipToken,
  useInfiniteQuery,
} from "@tanstack/react-query";

import type { CompetitionStatus } from "@recallnet/db/repositories/types";

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
  competitionStatus?: CompetitionStatus,
): UseInfiniteQueryResult<
  InfiniteData<RouterOutputs["boost"]["competitionBoosts"]>,
  Error
> => {
  return useInfiniteQuery(
    tanstackClient.boost.competitionBoosts.infiniteOptions({
      input: enabled
        ? (pageParam: number) => ({
            competitionId,
            limit,
            offset: pageParam,
          })
        : skipToken,
      initialPageParam: 0,
      getNextPageParam: (lastPage) =>
        lastPage.pagination.hasMore
          ? lastPage.pagination.offset + lastPage.pagination.limit
          : undefined,
      staleTime: 60 * 1000,
      refetchInterval: () => getCompetitionPollingInterval(competitionStatus),
    }),
  );
};
