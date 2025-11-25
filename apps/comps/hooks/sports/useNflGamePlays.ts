import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

/**
 * Fetch play-by-play data for a game
 * @param competitionId Competition ID
 * @param gameId Game ID
 * @param options Query options (limit, offset, latest)
 * @returns Query result with plays data
 */
export function useNflGamePlays(
  competitionId: string | undefined,
  gameId: string | undefined,
  options?: {
    limit?: number;
    offset?: number;
    latest?: boolean;
  },
) {
  return useQuery({
    queryKey: [
      "nfl",
      "game-plays",
      competitionId,
      gameId,
      options?.limit,
      options?.offset,
      options?.latest,
    ],
    queryFn: () =>
      client.nfl.getGamePlays({
        competitionId: competitionId!,
        gameId: gameId!,
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
        latest: options?.latest ?? false,
      }),
    enabled: !!competitionId && !!gameId,
    staleTime: 3 * 1000, // 3 seconds - very fresh for live play-by-play
  });
}
