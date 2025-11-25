import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

/**
 * Fetch leaderboard for NFL competition (overall or per-game)
 * @param competitionId Competition ID
 * @param gameId Optional game ID for game-specific leaderboard
 * @returns Query result with leaderboard data
 */
export function useNflLeaderboard(competitionId: string, gameId?: string) {
  return useQuery({
    queryKey: ["nfl", "leaderboard", competitionId, gameId],
    queryFn: () =>
      client.nfl.getLeaderboard({
        competitionId,
        gameId,
      }),
    staleTime: 10 * 1000, // 10 seconds
  });
}
