import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { toast } from "@recallnet/ui2/components/toast";

import { SANDBOX_FULLY_CONFIGURED } from "@/config";
import { ApiClient } from "@/lib/api-client";
import { sandboxClient } from "@/lib/sandbox-client";

import { useProfile } from "./useProfile";

const apiClient = new ApiClient();

// Generate fake sandbox key for local development (same format as real key)
const FAKE_SANDBOX_KEY = "fakesandboxkey01_fakesandboxkey02";

export const useUnlockKeys = (agentName: string, agentId?: string) => {
  const queryClient = useQueryClient();
  const { data: user } = useProfile();
  const isEmailVerified = user?.isEmailVerified;

  // Track when unlock was successful with sandbox skipped (for local dev)
  const [sandboxSkippedUnlocked, setSandboxSkippedUnlocked] = useState(false);

  // Query for production API key - fetch when email verified and agent exists
  const productionKeyQuery = useQuery({
    queryKey: ["agent-api-key", agentId],
    queryFn: async () => {
      if (!agentId) throw new Error("Agent ID required");
      return await apiClient.getAgentApiKey(agentId);
    },
    enabled: !!agentId && !!isEmailVerified,
  });

  // Query for sandbox agent - fetch when email verified and agent exists
  const sandboxAgentQuery = useQuery({
    queryKey: ["sandbox-agent", agentName],
    queryFn: async () => {
      return await sandboxClient.getAgentApiKey(agentName);
    },
    enabled: !!agentName && !!isEmailVerified && SANDBOX_FULLY_CONFIGURED,
  });

  // Get sandbox agent id
  const sandboxAgentId = sandboxAgentQuery.data?.agent?.id;

  // Query for sandbox competitions - fetch when email verified and agent exists
  const sandboxCompetitionsQuery = useQuery({
    queryKey: ["sandbox-agent-competitions", sandboxAgentId],
    queryFn: async () => {
      if (!sandboxAgentId) throw new Error("Sandbox agent ID required");
      return await sandboxClient.getAgentCompetitions(sandboxAgentId, {
        status: "active",
      });
    },
    enabled: !!sandboxAgentId && !!isEmailVerified && SANDBOX_FULLY_CONFIGURED,
    staleTime: 0, // Always consider data stale
    refetchOnMount: "always", // Always refetch when component mounts
  });

  // Query for sandbox API key - fetch when email verified and agent exists in sandbox
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
    enabled: !!agentName && !!isEmailVerified && SANDBOX_FULLY_CONFIGURED,
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
  const isInActiveSandboxCompetition =
    !!sandboxCompetitionsQuery.data?.competitions?.length;

  // Original unlock logic, but account for sandbox being skipped in local dev
  const sandboxRequirementsMet = SANDBOX_FULLY_CONFIGURED
    ? hasSandboxKey && isInActiveSandboxCompetition
    : sandboxSkippedUnlocked;

  const isUnlocked = hasProductionKey && sandboxRequirementsMet;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isEmailVerified) {
        throw new Error(
          "Email verification required to access agent API keys and join sandbox competitions",
        );
      }

      // When sandbox is not configured, skip sandbox operations but still require unlock
      if (!SANDBOX_FULLY_CONFIGURED) {
        console.log(
          "[useUnlockKeys] Sandbox not configured - skipping sandbox operations for local development",
        );
        return { alreadyJoined: true, sandboxSkipped: true };
      }

      if (!sandboxAgentId) {
        throw new Error("Unable to find sandbox agent");
      }
      if (isInActiveSandboxCompetition) {
        return { alreadyJoined: true };
      }

      // Get active sandbox competitions
      const competitionsRes = await sandboxClient.getCompetitions();
      if (
        !competitionsRes.competitions ||
        competitionsRes.competitions.length === 0
      ) {
        throw new Error("No active sandbox competitions available");
      }

      // Join the first active competition
      const competitionId = competitionsRes.competitions[0]?.id;
      if (!competitionId) {
        throw new Error("No valid competition found");
      }

      try {
        await sandboxClient.joinCompetition(competitionId, sandboxAgentId);
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
        throw joinError;
      }
    },
    onSuccess: (result) => {
      // Track successful unlock when sandbox was skipped
      if (result?.sandboxSkipped) {
        setSandboxSkippedUnlocked(true);
      }

      // Show success message
      if (result?.alreadyJoined) {
        toast.success("API Keys are now accessible");
      } else {
        toast.success("API Keys unlocked successfully");
      }

      // Invalidate and refetch queries
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-competitions"],
      });

      // Invalidate and refetch sandbox agent
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent", agentName],
      });

      // Invalidate and refetch sandbox agent api key
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-api-key", agentName],
      });

      // Invalidate production API key if we have the agentId
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: ["agent-api-key", agentId],
        });
      }
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
    sandboxKey: SANDBOX_FULLY_CONFIGURED
      ? sandboxKeyQuery.data?.agent?.apiKey
      : isUnlocked
        ? FAKE_SANDBOX_KEY
        : undefined,
    sandboxCompetitions: sandboxCompetitionsQuery.data?.competitions,
    isLoadingKeys:
      productionKeyQuery.isLoading ||
      sandboxKeyQuery.isLoading ||
      sandboxCompetitionsQuery.isLoading,
    isUnlocked,
  };
};
