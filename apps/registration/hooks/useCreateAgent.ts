import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useProfile } from "@/hooks/useProfile";
import { ApiClient } from "@/lib/api-client";

import { CreateAgentRequest } from "../types";

const apiClient = new ApiClient();

/**
 * Hook to create a new agent using admin API
 * @returns Mutation for creating an agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (data: CreateAgentRequest) => {
      if (!profile?.walletAddress) {
        throw new Error("User wallet address is required");
      }
      return apiClient.createAgentAdmin(data, profile.walletAddress);
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};
