import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { AgentApiKeyResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch an agent api key
 * @param agentId agent id
 * @returns Query result
 */
export const useApiKey = (agentId: string) =>
  useQuery({
    queryKey: ["agent", "api-key", "live", agentId],
    queryFn: async (): Promise<AgentApiKeyResponse> => {
      return apiClient.getAgentApiKey(agentId);
    },
    placeholderData: (prev) => prev,
  });

