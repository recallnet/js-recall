import { UseQueryResult, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Hook to get unified leaderboard data combining benchmark models + trading agents
 */
export const useUnifiedLeaderboard = (): UseQueryResult<
  RouterOutputs["leaderboard"]["getUnified"]
> => {
  return useQuery(
    tanstackClient.leaderboard.getUnified.queryOptions({
      staleTime: 5 * 60 * 1000, // 5 minutes (static data changes less frequently)
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),
  );
};
