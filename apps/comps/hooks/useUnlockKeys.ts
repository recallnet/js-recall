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
      console.log(
        "[useUnlockKeys] Fetching production key for agent:",
        agentId,
      );
      return await apiClient.getAgentApiKey(agentId);
    },
    enabled: !!agentId && !!isEmailVerified && hasTriggeredUnlock,
  });

  // Query for sandbox API key - fetch when email verified and unlock triggered
  const sandboxKeyQuery = useQuery({
    queryKey: ["sandbox-agent-api-key", agentName],
    queryFn: async () => {
      console.log("[useUnlockKeys] Fetching sandbox key for agent:", agentName);
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

  console.log("[useUnlockKeys] State:", {
    isEmailVerified,
    hasTriggeredUnlock,
    isUnlocked,
    hasProductionKey,
    hasSandboxKey,
    productionKeyData: productionKeyQuery.data,
    sandboxKeyData: sandboxKeyQuery.data,
    agentName,
    agentId,
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

      // Try to get the agent's API key from sandbox first
      // If this succeeds, the agent is already set up and we don't need to join
      try {
        const agentApiKeyRes = await sandboxClient.getAgentApiKey(agentName);
        console.log(
          "[useUnlockKeys] Agent already has sandbox access:",
          agentApiKeyRes,
        );
        return { alreadyJoined: true };
      } catch (error) {
        // If agent doesn't have access yet, we need to join a competition
        console.log("[useUnlockKeys] Agent needs to join competition:", error);
      }

      // Get sandbox competitions
      const competitionsRes = await sandboxClient.getCompetitions();

      if (competitionsRes.competitions?.length === 0) {
        throw new Error("No sandbox competitions");
      }

      // Create/get the agent in sandbox and join the competition
      try {
        // This might fail if agent doesn't exist in sandbox yet, but that's handled by the API
        const agentApiKeyRes = await sandboxClient.getAgentApiKey(agentName);
        const sandboxAgentId = agentApiKeyRes.agent.id;

        // Join the competition using the sandbox agent ID
        await sandboxClient.joinCompetition(
          (competitionsRes.competitions[0] as Competition).id,
          sandboxAgentId,
        );

        return { alreadyJoined: false };
      } catch (joinError) {
        // If joining fails, it might be because the agent is already in the competition
        console.log(
          "[useUnlockKeys] Join competition failed (might be already joined):",
          joinError,
        );

        // Try to get the keys anyway - if this works, the agent has access
        try {
          await sandboxClient.getAgentApiKey(agentName);
          return { alreadyJoined: true };
        } catch {
          // If we can't get keys either, then there's a real problem
          throw new Error(
            "Failed to join competition and unable to access agent keys",
          );
        }
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
      console.error("[useUnlockKeys] Unlock failed:", error);
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
