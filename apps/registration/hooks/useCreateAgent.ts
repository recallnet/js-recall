import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";

import { CreateAgentRequest } from "../types";
import { useUserSession } from "./useAuth";
import { useSandboxRegisterAgent } from "./useSandboxRegisterAgent";

const apiClient = new ApiClient();

/**
 * Hook to create a new agent for the authenticated user
 * Also registers the agent in sandbox environment as a background operation
 * @returns Mutation for creating an agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  const userSession = useUserSession();
  const { registerAgent } = useSandboxRegisterAgent();

  return useMutation({
    mutationFn: async (data: CreateAgentRequest) => {
      return apiClient.createAgent(data);
    },
    onSuccess: (response, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });

      // Background: Also register the agent in sandbox if user session is available
      if (
        userSession.isInitialized &&
        userSession.isAuthenticated &&
        userSession.user
      ) {
        const sandboxAgentData = {
          user: {
            walletAddress: userSession.user.walletAddress,
          },
          agent: {
            name: variables.name,
            email: variables.email,
            description: variables.description,
            imageUrl: variables.imageUrl,
            metadata: variables.metadata,
          },
        };

        // Register in sandbox as background operation - don't await or handle errors
        // This is a "best effort" sync that shouldn't affect the main flow
        registerAgent(sandboxAgentData).catch((error) => {
          console.warn("Failed to sync agent to sandbox:", error);
          // Silently fail - this shouldn't impact the main agent creation
        });
      }
    },
  });
};
