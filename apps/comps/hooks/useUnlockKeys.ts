import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@recallnet/ui2/components/toast";

import { ApiClient } from "@/lib/api-client";
import { sandboxClient } from "@/lib/sandbox-client";
import { Competition } from "@/types";

import { useProfile } from "./useProfile";

const apiClient = new ApiClient();

export const useUnlockKeys = (agentName: string, agentId?: string) => {
  const queryClient = useQueryClient();
  const { data: user } = useProfile();
  const isEmailVerified = user?.isEmailVerified;

  // Query for production API key
  const productionKeyQuery = useQuery({
    queryKey: ["agent-api-key", agentId],
    queryFn: async () => {
      if (!agentId) throw new Error("Agent ID required");
      return await apiClient.getAgentApiKey(agentId);
    },
    enabled: !!agentId && !!isEmailVerified,
  });

  // Query for sandbox API key with defensive error handling
  const sandboxKeyQuery = useQuery({
    queryKey: ["sandbox-agent-api-key", agentName],
    queryFn: async () => {
      try {
        return await sandboxClient.getAgentApiKey(agentName);
      } catch (error) {
        // If agent doesn't exist in sandbox yet, return null instead of failing
        if (
          error instanceof Error &&
          error.message.includes("Agent not found")
        ) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!agentName && !!isEmailVerified,
    retry: (failureCount, error) => {
      // Don't retry if it's just "agent not found" - the agent might not be created yet
      if (error instanceof Error && error.message.includes("Agent not found")) {
        return false;
      }
      // Retry other errors normally (max 3 times)
      return failureCount < 3;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      // First, check if user's email is verified in production
      const profileRes = await apiClient.getProfile();

      if (!profileRes.success) {
        throw new Error("Failed to get user profile");
      }

      if (!profileRes.user.isEmailVerified) {
        throw new Error(
          "Email verification required to access agent API keys and join sandbox competitions",
        );
      }

      // Get sandbox competitions
      const competitionsRes = await sandboxClient.getCompetitions();

      if (competitionsRes.competitions?.length === 0) {
        throw new Error("No sandbox competitions");
      }

      // Get the agent's data from sandbox (including sandbox agent ID)
      const agentApiKeyRes = await sandboxClient.getAgentApiKey(agentName);
      const sandboxAgentId = agentApiKeyRes.agent.id;

      // Join the competition using the sandbox agent ID
      return await sandboxClient.joinCompetition(
        (competitionsRes.competitions[0] as Competition).id,
        sandboxAgentId,
      );
    },
    onSuccess: () => {
      // Show success message
      toast.success("API Keys unlocked successfully");

      // Invalidate queries for both production and sandbox keys
      queryClient.invalidateQueries({
        queryKey: ["agent-api-key", agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-api-key", agentName],
      });
    },
    onError: (error) => {
      // Show error message
      toast.error("Failed to unlock keys", {
        description: error.message,
      });
    },
  });

  return {
    mutation,
    productionKey: productionKeyQuery.data?.apiKey,
    sandboxKey: sandboxKeyQuery.data?.agent?.apiKey,
    isLoadingKeys: productionKeyQuery.isLoading || sandboxKeyQuery.isLoading,
  };
};
