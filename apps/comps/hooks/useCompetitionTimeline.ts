import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";

/**
 * Hook to fetch competition timeline data
 * @param id Competition ID
 * @param status Competition status (optional) - will skip fetch if status is pending
 * @returns Query result with timeline data
 */
export const useCompetitionTimeline = (
  id: string,
  status?: RouterOutputs["competitions"]["getById"]["status"],
): UseQueryResult<RouterOutputs["competitions"]["getTimeline"]> =>
  useQuery(
    tanstackClient.competitions.getTimeline.queryOptions({
      input:
        status !== "pending"
          ? {
              competitionId: id,
              bucket: 30, // 30 minute buckets
            }
          : skipToken,
    }),
  );
