import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

/**
 * Fetch competition rules for NFL competition
 * @param competitionId Competition ID
 * @returns Query result with rules data
 */
export function useNflRules(competitionId: string) {
  return useQuery({
    queryKey: ["nfl", "rules", competitionId],
    queryFn: () => client.nfl.getRules({ competitionId }),
    staleTime: 24 * 60 * 60 * 1000, // Note: the rules don't change
    gcTime: 24 * 60 * 60 * 1000,
  });
}
