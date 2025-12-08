import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import type { LeaderboardParams } from "@recallnet/services/types";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router/index";

/**
 * Hook to fetch leaderboards data
 * @param params Query parameters for leaderboard endpoint
 * @param enabled Whether the query should be enabled
 * @returns Query result with leaderboard data
 */
export function useLeaderboards(
  params: Partial<LeaderboardParams> = {},
  enabled = true,
): UseQueryResult<RouterOutputs["leaderboard"]["getGlobal"]> {
  return useQuery(
    tanstackClient.leaderboard.getGlobal.queryOptions({
      input: enabled ? params : skipToken,
      placeholderData: (prev) => prev,
    }),
  );
}
