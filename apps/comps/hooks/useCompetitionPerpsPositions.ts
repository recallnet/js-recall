import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { ApiClient } from "@/lib/api-client";
import {
  CompetitionPerpsPositionsResponse,
  GetCompetitionPerpsPositionsParams,
} from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch perps positions for a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition perps positions endpoint
 * @returns Query result with perps positions data
 */
export const useCompetitionPerpsPositions = (
  competitionId?: string,
  params: GetCompetitionPerpsPositionsParams = {},
  enabled: boolean = true,
) => {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: ["competition-perps-positions", competitionId, params],
    queryFn: async (): Promise<CompetitionPerpsPositionsResponse> => {
      if (!competitionId) throw new Error("Competition ID is required");
      return apiClient.getCompetitionPerpsPositions(competitionId, params);
    },
    enabled: !!competitionId && isAuthenticated && enabled,
    placeholderData: (prev) => prev,
  });
};
