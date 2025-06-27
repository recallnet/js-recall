import { useSuspenseQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { AgentCompetitionResponse, GetCompetitionAgentsParams } from "@/types";

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
  useSuspenseQuery({
    queryKey: ["competition-agents", competitionId, params],
    queryFn: async (): Promise<AgentCompetitionResponse> => {
      if (!competitionId) throw new Error("Competition ID is required");
      return apiClient.getCompetitionAgents(competitionId, params);
    },
  });
