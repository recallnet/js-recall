import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

/**
 * Fetch specific game information
 * @param competitionId Competition ID
 * @param gameId Game ID
 * @returns Query result with game info
 */
export function useNflGameInfo(
  competitionId: string | undefined,
  gameId: string | undefined,
) {
  return useQuery({
    queryKey: ["nfl", "game-info", competitionId, gameId],
    queryFn: () =>
      client.nfl.getGameInfo({
        competitionId: competitionId!,
        gameId: gameId!,
      }),
    enabled: !!competitionId && !!gameId,
    staleTime: 5 * 1000, // 5 seconds
  });
}
