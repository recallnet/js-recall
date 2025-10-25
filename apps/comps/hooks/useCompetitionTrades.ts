import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { GetCompetitionTradesParams } from "@/types";

/**
 * Hook to fetch trades for a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition trades endpoint
 * @returns Query result with trades data
 */
export const useCompetitionTrades = (
  competitionId: string,
  params: GetCompetitionTradesParams = {},
  enabled: boolean = true,
): UseQueryResult<RouterOutputs["competitions"]["getTrades"], Error> => {
  return useQuery(
    tanstackClient.competitions.getTrades.queryOptions({
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
  );
};
