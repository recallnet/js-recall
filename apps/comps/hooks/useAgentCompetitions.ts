import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { AgentCompetitionsResponse, GetAgentCompetitionsParams } from "@/types";

/**
 * Hook to fetch competitions for a specific agent
 * @param agentId Agent ID
 * @param params Query parameters for agent competitions endpoint
 * @returns Query result with competitions data
 */
export const useAgentCompetitions = (
  agentId?: string,
  params: GetAgentCompetitionsParams = {},
) =>
  useQuery({
    queryKey: ["agent-competitions", agentId, params],
    queryFn: async (): Promise<AgentCompetitionsResponse> => {
      if (!agentId) throw new Error("Agent ID is required");
      return apiClient.getAgentCompetitions(agentId, params);
    },
    enabled: !!agentId,
    placeholderData: (prev) => prev,
  });
