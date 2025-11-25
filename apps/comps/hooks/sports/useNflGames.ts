import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

/**
 * Fetch all games for an NFL competition
 * @param competitionId Competition ID
 * @returns Query result with games data
 */
export function useNflGames(competitionId: string | undefined) {
  return useQuery({
    queryKey: ["nfl", "games", competitionId],
    queryFn: () => client.nfl.getGames({ competitionId: competitionId! }),
    enabled: !!competitionId,
    staleTime: 10 * 1000, // 10 seconds
  });
}
