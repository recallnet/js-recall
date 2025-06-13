import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { useUser } from "@/state/atoms";
import { AgentsResponse, GetAgentsParams } from "@/types";

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
  const { status } = useUser();

  return useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getUserAgents(params);
    },
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
};
