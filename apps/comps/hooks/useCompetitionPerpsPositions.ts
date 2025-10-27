import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { GetCompetitionPerpsPositionsParams } from "@/types";

/**
 * Hook to fetch perps positions for a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition perps positions endpoint
 * @returns Query result with perps positions data
 */
export const useCompetitionPerpsPositions = (
  competitionId: string,
  params: GetCompetitionPerpsPositionsParams = {},
  enabled: boolean = true,
): UseQueryResult<
  RouterOutputs["competitions"]["getPerpsPositions"],
  Error
> => {
  return useQuery(
    tanstackClient.competitions.getPerpsPositions.queryOptions({
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
  );
};
