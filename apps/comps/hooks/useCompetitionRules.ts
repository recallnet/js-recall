import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { CompetitionRulesResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch competition rules for a specific competition
 * @param competitionId - The ID of the competition
 * @returns Query result with competition rules data
 */
export const useCompetitionRules = (competitionId: string) =>
  useQuery({
    queryKey: ["competition-rules", competitionId],
    queryFn: async (): Promise<CompetitionRulesResponse["rules"]> => {
      return (await apiClient.getCompetitionRules(competitionId)).rules;
    },
    // Only fetch if competitionId is provided
    enabled: !!competitionId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once if it fails
  });
