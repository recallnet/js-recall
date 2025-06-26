import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { CreateAgentRequest } from "@/types";

/**
 * Hook to create a new agent
 * @returns Mutation for creating an agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAgentRequest) => {
      return apiClient.createAgent(data);
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};
