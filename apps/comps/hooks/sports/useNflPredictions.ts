import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Fetch predictions for a game
 * @param competitionId Competition ID
 * @param gameId Game ID
 * @param agentId Optional agent ID to filter predictions
 * @returns Query result with predictions data
 */
export function useNflPredictions(
  competitionId: string | undefined,
  gameId: string | undefined,
  agentId?: string,
): UseQueryResult<RouterOutputs["nfl"]["getPredictions"], Error> {
  return useQuery(
    tanstackClient.nfl.getPredictions.queryOptions({
      input:
        competitionId && gameId
          ? { competitionId, gameId, agentId }
          : skipToken,
      staleTime: 5 * 1000,
    }),
  );
}
