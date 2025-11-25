import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

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
): UseQueryResult<RouterOutputs["nfl"]["getGamePlays"], Error> {
  return useQuery(
    tanstackClient.nfl.getGamePlays.queryOptions({
      input:
        competitionId && gameId
          ? {
              competitionId,
              gameId,
              limit: options?.limit ?? 50,
              offset: options?.offset ?? 0,
              latest: options?.latest ?? false,
            }
          : skipToken,
      staleTime: 3 * 1000,
    }),
  );
}
