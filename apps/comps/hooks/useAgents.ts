import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
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
