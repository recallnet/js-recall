import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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

  // Track whether user has manually triggered unlock (for UI flow)
  const [hasTriggeredUnlock, setHasTriggeredUnlock] = useState(false);

  // Query for production API key - fetch when email verified and unlock triggered
  const productionKeyQuery = useQuery({
    queryKey: ["agent-api-key", agentId],
    queryFn: async () => {
      if (!agentId) throw new Error("Agent ID required");
      return await apiClient.getAgentApiKey(agentId);
    },
    enabled: !!agentId && !!isEmailVerified && hasTriggeredUnlock,
  });

  // Query for sandbox API key - fetch when email verified and unlock triggered
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
    enabled: !!agentName && !!isEmailVerified && hasTriggeredUnlock,
    retry: (failureCount, error) => {
      // Don't retry if it's just "agent not found" - the agent might not be created yet
      if (error instanceof Error && error.message.includes("Agent not found")) {
        return false;
      }
      // Retry other errors normally (max 3 times)
      return failureCount < 3;
    },
  });

  // Determine if keys are actually unlocked based on server data
  const hasProductionKey = !!productionKeyQuery.data?.apiKey;
  const hasSandboxKey = !!sandboxKeyQuery.data?.agent?.apiKey;
  const isUnlocked = hasProductionKey || hasSandboxKey;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isEmailVerified) {
        throw new Error(
          "Email verification required to access agent API keys and join sandbox competitions",
        );
      }

      // Get sandbox competitions
      const competitionsRes = await sandboxClient.getCompetitions();

      if (competitionsRes.competitions?.length === 0) {
        throw new Error("No sandbox competitions");
      }

      // Get the agent from sandbox and join the competition
      try {
        const agentApiKeyRes = await sandboxClient.getAgentApiKey(agentName);
        const sandboxAgentId = agentApiKeyRes.agent.id;

        // Join the competition using the sandbox agent ID
        await sandboxClient.joinCompetition(
          (competitionsRes.competitions[0] as Competition).id,
          sandboxAgentId,
        );

        return { alreadyJoined: false };
      } catch (joinError) {
        // Check if the error is because agent is already in competition
        if (
          joinError instanceof Error &&
          (joinError.message.includes("already actively registered") ||
            joinError.message.includes("already participating"))
        ) {
          return { alreadyJoined: true };
        }

        // For other errors, re-throw
        throw joinError;
      }
    },
    onSuccess: (result) => {
      // Show success message
      if (result?.alreadyJoined) {
        toast.success("API Keys are now accessible");
      } else {
        toast.success("API Keys unlocked successfully");
      }

      // Set triggered state to enable key fetching
      setHasTriggeredUnlock(true);

      // Wait for state update, then refetch the queries
      setTimeout(() => {
        if (agentId) {
          queryClient.refetchQueries({
            queryKey: ["agent-api-key", agentId],
          });
        }
        if (agentName) {
          queryClient.refetchQueries({
            queryKey: ["sandbox-agent-api-key", agentName],
          });
        }
      }, 100);
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
    isUnlocked,
  };
};
