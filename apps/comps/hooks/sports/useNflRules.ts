import { UseQueryResult, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Fetch competition rules for NFL competition
 * @param competitionId Competition ID
 * @returns Query result with rules data
 */
export function useNflRules(
  competitionId: string,
): UseQueryResult<RouterOutputs["nfl"]["getRules"], Error> {
  return useQuery(
    tanstackClient.nfl.getRules.queryOptions({
      input: { competitionId },
      staleTime: 24 * 60 * 60 * 1000, // Note: the rules don't change
      gcTime: 24 * 60 * 60 * 1000,
    }),
  );
}
