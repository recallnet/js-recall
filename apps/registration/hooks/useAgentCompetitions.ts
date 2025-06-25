import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { AgentCompetitionsResponse, GetAgentCompetitionsParams } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch competitions for a specific agent
 * @param agentId Agent ID
 * @param apiKey Agent API key for authentication
 * @param params Query parameters for agent competitions endpoint
 * @returns Query result with agent competitions data
 */
export const useAgentCompetitions = (
  agentId?: string,
  apiKey?: string,
  params: GetAgentCompetitionsParams = {},
) =>
  useQuery({
    queryKey: ["agent-competitions", agentId, params],
    queryFn: async (): Promise<AgentCompetitionsResponse> => {
      if (!agentId) throw new Error("Agent ID is required");
      if (!apiKey) throw new Error("Agent API key is required");

      return apiClient.getAgentCompetitions(agentId, params, apiKey);
    },
    enabled: !!agentId && !!apiKey,
  });
