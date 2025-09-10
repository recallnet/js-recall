import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { apiClient } from "@/lib/api-client";
import { AgentsResponse, GetAgentsParams, UpdateAgentRequest } from "@/types";

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useAgents = (params: GetAgentsParams = {}) => {
  return useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getAgents(params);
    },
    placeholderData: (prev) => prev,
  });
};

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useUserAgents = (params: GetAgentsParams = {}) => {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getUserAgents(params);
    },
    enabled: isAuthenticated,
    placeholderData: (prev) => prev,
  });
};

/**
 * Hook to update agents
 * @param body Body fields to update
 * @returns
 */
export const useUpdateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAgentRequest) => {
      return apiClient.updateAgent(data);
    },
    onSuccess: () => {
      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({ queryKey: ["agent"] });
    },
  });
};
