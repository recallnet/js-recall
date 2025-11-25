import { UseQueryResult, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Fetch leaderboard for NFL competition (overall or per-game)
 * @param competitionId Competition ID
 * @param gameId Optional game ID for game-specific leaderboard
 * @returns Query result with leaderboard data
 */
export function useNflLeaderboard(
  competitionId: string,
  gameId?: string,
): UseQueryResult<RouterOutputs["nfl"]["getLeaderboard"], Error> {
  return useQuery(
    tanstackClient.nfl.getLeaderboard.queryOptions({
      input: { competitionId, gameId },
      staleTime: 10 * 1000,
    }),
  );
}
