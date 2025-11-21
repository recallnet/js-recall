import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

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
) {
  return useQuery({
    queryKey: ["nfl", "predictions", competitionId, gameId, agentId],
    queryFn: () =>
      client.nfl.getPredictions({
        competitionId: competitionId!,
        gameId: gameId!,
        agentId,
      }),
    enabled: !!competitionId && !!gameId,
    staleTime: 5 * 1000, // 5 seconds
  });
}
