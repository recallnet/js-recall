import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../lib/api-client";
import { AgentsResponse, GetCompetitionAgentsParams } from "../types";

const apiClient = new ApiClient();

/**
 * Hook to fetch agents participating in a competition
 * @param competitionId Competition ID
 * @param params Query parameters for competition agents endpoint
 * @returns Query result with agents data
 */
export const useCompetitionAgents = (
  competitionId?: string,
  params: GetCompetitionAgentsParams = {},
) =>
  useQuery({
    queryKey: ["competition-agents", competitionId, params],
    queryFn: async (): Promise<AgentsResponse> => {
      if (!competitionId) throw new Error("Competition ID is required");
      return apiClient.getCompetitionAgents(competitionId, params);
    },
    enabled: !!competitionId,
    placeholderData: (prev) => prev,
  });
