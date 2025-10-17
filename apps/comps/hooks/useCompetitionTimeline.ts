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
): UseQueryResult<RouterOutputs["competitions"]["getTimeline"]> => {
  const options = tanstackClient.competitions.getTimeline.queryOptions({
    input: { competitionId: id, bucket: 180 }, // 3 hour buckets
  });

  return useQuery({
    ...options,
    queryFn: status !== "pending" ? options.queryFn : skipToken,
  });
};
