import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { ApiClient } from "@/lib/api-client";
import { CompetitionTradesResponse, GetCompetitionTradesParams } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch trades for a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition trades endpoint
 * @returns Query result with trades data
 */
export const useCompetitionTrades = (
  competitionId?: string,
  params: GetCompetitionTradesParams = {},
) => {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: ["competition-trades", competitionId, params],
    queryFn: async (): Promise<CompetitionTradesResponse> => {
      if (!competitionId) throw new Error("Competition ID is required");
      return apiClient.getCompetitionTrades(competitionId, params);
    },
    enabled: !!competitionId && isAuthenticated,
    placeholderData: (prev) => prev,
  });
};
