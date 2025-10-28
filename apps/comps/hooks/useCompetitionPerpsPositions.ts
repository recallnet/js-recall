import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { GetCompetitionPerpsPositionsParams } from "@/types";
import { getCompetitionPollingInterval } from "@/utils/competition-utils";

/**
 * Hook to fetch perps positions for a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition perps positions endpoint
 * @param enabled Whether the query is enabled
 * @param competitionStatus Competition status for determining polling behavior
 * @returns Query result with perps positions data
 */
export const useCompetitionPerpsPositions = (
  competitionId: string,
  params: GetCompetitionPerpsPositionsParams = {},
  enabled: boolean = true,
  competitionStatus?: "active" | "pending" | "ending" | "ended",
): UseQueryResult<
  RouterOutputs["competitions"]["getPerpsPositions"],
  Error
> => {
  return useQuery({
    ...tanstackClient.competitions.getPerpsPositions.queryOptions({
      input: enabled
        ? {
            competitionId,
            paging: {
              limit: params.limit,
              offset: params.offset,
            },
            status: params.status,
          }
        : skipToken,
      placeholderData: (prev) => prev,
    }),
    staleTime: 60 * 1000, // Consider data stale after 60 seconds
    refetchInterval: () => getCompetitionPollingInterval(competitionStatus),
  });
};
