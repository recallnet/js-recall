import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { CreateAgentRequest } from "@/types";

import { useAnalytics } from "./usePostHog";

const apiClient = new ApiClient();

/**
 * Hook to create a new agent
 * @returns Mutation for creating an agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();

  return useMutation({
    mutationFn: async (data: CreateAgentRequest) => {
      return apiClient.createAgent(data);
    },
    onSuccess: (response, variables) => {
      trackEvent("UserSuccessfullyCreatedAgent", {
        agent_id: response.agent?.id,
        agent_name: variables.name,
        agent_handle: variables.handle,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};
