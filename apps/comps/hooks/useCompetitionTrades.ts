import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { GetCompetitionTradesParams } from "@/types";
import { getCompetitionPollingInterval } from "@/utils/competition-utils";

/**
 * Hook to fetch trades for a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition trades endpoint
 * @param enabled Whether the query is enabled
 * @param competitionStatus Competition status for determining polling behavior
 * @returns Query result with trades data
 */
export const useCompetitionTrades = (
  competitionId: string,
  params: GetCompetitionTradesParams = {},
  enabled: boolean = true,
  competitionStatus?: "active" | "pending" | "ending" | "ended",
): UseQueryResult<RouterOutputs["competitions"]["getTrades"], Error> => {
  return useQuery({
    ...tanstackClient.competitions.getTrades.queryOptions({
      input: enabled
        ? {
            competitionId,
            paging: {
              limit: params.limit,
              offset: params.offset,
            },
          }
        : skipToken,
      placeholderData: (prev) => prev,
    }),
    staleTime: 60 * 1000, // Consider data stale after 60 seconds
    refetchInterval: () => getCompetitionPollingInterval(competitionStatus),
  });
};
