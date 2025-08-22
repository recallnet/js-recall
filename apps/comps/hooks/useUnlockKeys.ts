import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@recallnet/ui2/components/toast";

import { apiClient } from "@/lib/api-client";
import { sandboxClient } from "@/lib/sandbox-client";

export const useUnlockKeys = (agentName: string, agentId?: string) => {
  const queryClient = useQueryClient();

  // Query for production API key - fetch when agent exists
  const productionKeyQuery = useQuery({
    queryKey: ["agent-api-key", agentId],
    queryFn: async () => {
      if (!agentId) throw new Error("Agent ID required");
      return await apiClient.getAgentApiKey(agentId);
    },
    enabled: !!agentId,
  });

  // Query for sandbox agent - fetch when agent exists
  const sandboxAgentQuery = useQuery({
    queryKey: ["sandbox-agent", agentName],
    queryFn: async () => {
      return await sandboxClient.getAgentApiKey(agentName);
    },
    enabled: !!agentName,
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
    enabled: !!sandboxAgentId,
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
    enabled: !!agentName,
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
  // We unlock when all keys exists *and* the agent is in an active sandbox competition
  const isUnlocked =
    hasProductionKey && hasSandboxKey && isInActiveSandboxCompetition;

  const mutation = useMutation({
    mutationFn: async () => {
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
    sandboxKey: sandboxKeyQuery.data?.agent?.apiKey,
    sandboxCompetitions: sandboxCompetitionsQuery.data?.competitions,
    isLoadingKeys:
      productionKeyQuery.isLoading ||
      sandboxKeyQuery.isLoading ||
      sandboxCompetitionsQuery.isLoading,
    isUnlocked,
  };
};
