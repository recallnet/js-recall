import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

import {ApiClient} from "@/lib/api-client";
import {useUser} from "@/state/atoms";
import {
  AgentsResponse,
  GetAgentsParams,
  UpdateAgentRequest,
} from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useAgents = (params: GetAgentsParams = {}) =>
  useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getAgents(params);
    },
    placeholderData: (prev) => prev,
  });

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useUserAgents = (params: GetAgentsParams = {}) => {
  const {status} = useUser();

  return useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getUserAgents(params);
    },
    enabled: status === "authenticated",
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
      queryClient.invalidateQueries({queryKey: ["agent"]});
    },
  });
};
