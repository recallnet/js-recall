import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { AgentApiKeyResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useApiKey = (agentId: string) =>
  useQuery({
    queryKey: ["agent", "api-key", agentId],
    queryFn: async (): Promise<AgentApiKeyResponse> => {
      return apiClient.getAgentApiKey(agentId);
    },
    placeholderData: (prev) => prev,
  });

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useSandboxApiKey = (agentId: string) =>
  useQuery({
    queryKey: ["agent", "sandbox-api-key", agentId],
    queryFn: async (): Promise<AgentApiKeyResponse> => {
      return apiClient.getAgentSandboxApiKey(agentId);
    },
    placeholderData: (prev) => prev,
  });
