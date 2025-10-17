import { UseQueryResult, skipToken, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Hook to fetch competition rules for a specific competition
 * @param competitionId - The ID of the competition (required)
 * @returns Query result with competition rules data
 */
export const useCompetitionRules = (
  competitionId: string,
): UseQueryResult<RouterOutputs["competitions"]["getRules"], Error> =>
  useQuery(
    tanstackClient.competitions.getRules.queryOptions({
      input: competitionId ? { competitionId } : skipToken,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: 1, // Only retry once if it fails
    }),
  );
