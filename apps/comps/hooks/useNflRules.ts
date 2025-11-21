import { useQuery } from "@tanstack/react-query";

import { client } from "@/rpc/clients/client-side";

/**
 * Fetch competition rules for NFL competition
 * @param competitionId Competition ID
 * @returns Query result with rules data
 */
export function useNflRules(competitionId: string | undefined) {
  return useQuery({
    queryKey: ["nfl", "rules", competitionId],
    queryFn: () => client.nfl.getRules({ competitionId: competitionId! }),
    enabled: !!competitionId,
    staleTime: 5 * 60 * 1000, // 5 minutes - rules don't change
  });
}
