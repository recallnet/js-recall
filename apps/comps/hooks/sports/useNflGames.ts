import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Fetch all games for an NFL competition
 * @param competitionId Competition ID
 * @returns Query result with games data
 */
export function useNflGames(
  competitionId: string | undefined,
): UseQueryResult<RouterOutputs["nfl"]["getGames"], Error> {
  return useQuery(
    tanstackClient.nfl.getGames.queryOptions({
      input: competitionId ? { competitionId } : skipToken,
      staleTime: 10 * 1000, // 10 seconds
    }),
  );
}
