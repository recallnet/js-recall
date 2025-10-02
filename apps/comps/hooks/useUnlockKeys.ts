import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@recallnet/ui2/components/toast";

import { sandboxClient } from "@/lib/sandbox-client";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { AdminAgentKeyResponse } from "@/types/admin";

export const useUnlockKeys = (
  agentHandle: string,
  agentId?: string,
  userWalletAddress?: string,
) => {
  const queryClient = useQueryClient();

  // Query for production agent API key
  const productionKeyQuery = useQuery(
    tanstackClient.agent.getAgentApiKey.queryOptions({
      input: { agentId: agentId! },
      enabled: !!agentId,
    }),
  );

  // Mutation to create sandbox agent if it doesn't exist
  const createSandboxAgentMutation = useMutation({
    mutationFn: async () => {
      if (!userWalletAddress) {
        throw new Error("Wallet address required to create sandbox agent");
      }

      const createResult = await sandboxClient.createAgent({
        user: {
          walletAddress: userWalletAddress,
        },
        agent: {
          handle: agentHandle,
          // Note: the name is technically required by the backend API, but all we need is the
          // agent handle since this is globally unique and used for querying the API key
          name: agentHandle,
        },
      });

      if (!createResult.success) {
        throw new Error("Failed to create sandbox agent");
      }

      return {
        success: true,
        agent: {
          id: createResult.agent.id,
          apiKey: createResult.agent.apiKey,
          name: createResult.agent.name,
        },
      } as AdminAgentKeyResponse;
    },
    onSuccess: (data) => {
      // Update the cache with the newly created agent data
      queryClient.setQueryData(["sandbox-agent-api-key", agentHandle], data);
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-api-key", agentHandle],
      });
      // Also invalidate sandbox competitions since we have a new agent
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-competitions"],
      });
    },
  });

  // Query for sandbox agent API key
  const sandboxKeyQuery = useQuery({
    queryKey: ["sandbox-agent-api-key", agentHandle],
    queryFn: async () => {
      try {
        // Note: the sandbox-specific API client uses the `handle` since it does additional lookups
        // to get the agent ID relative to the sandbox (the sandbox vs production agent IDs differ)
        return await sandboxClient.getAgentApiKey(agentHandle);
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
    enabled: !!agentHandle,
    retry: (failureCount, error) => {
      // Don't retry if it's just "agent not found" - the agent might not be created yet
      if (error instanceof Error && error.message.includes("Agent not found")) {
        return false;
      }
      // Retry other errors normally (max 3 times)
      return failureCount < 3;
    },
    // Refetch every 2 seconds if the result is null (agent not found)
    // This ensures we quickly detect when an agent is created
    refetchInterval: (data) => {
      return data === null ? 2000 : false;
    },
    // Consider data stale immediately if it's null
    staleTime: (data) => {
      return data === null ? 0 : 5 * 60 * 1000; // 5 minutes for valid data
    },
  });

  // Get sandbox agent id
  const sandboxAgentId = sandboxKeyQuery.data?.agent?.id;

  // Query for sandbox competitions - fetch when agent exists
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

  // Determine if keys are actually unlocked based on server data
  const hasSandboxKey = !!sandboxKeyQuery.data?.agent?.apiKey;
  const isInActiveSandboxCompetition =
    !!sandboxCompetitionsQuery.data?.competitions?.length;
  const isSandboxUnlocked = hasSandboxKey && isInActiveSandboxCompetition;

  const mutation = useMutation({
    mutationFn: async () => {
      let currentSandboxAgentId = sandboxAgentId;

      // If sandbox agent doesn't exist, create it first
      if (!currentSandboxAgentId) {
        // Check if we need to refetch first (in case the agent was created elsewhere)
        const refetchResult = await sandboxKeyQuery.refetch();
        if (refetchResult.data?.agent?.id) {
          currentSandboxAgentId = refetchResult.data.agent.id;
        } else {
          // Agent still doesn't exist, create it
          const createResult = await createSandboxAgentMutation.mutateAsync();
          currentSandboxAgentId = createResult.agent.id;

          // Wait a moment for the agent to be fully created
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Force refetch to get the latest data
          await sandboxKeyQuery.refetch();
        }
      }

      if (isInActiveSandboxCompetition) {
        return { alreadyJoined: true };
      }

      // Get active sandbox competitions
      const competitionsRes = await sandboxClient.getCompetitions();
      if (!competitionsRes.competitions[0]?.id) {
        // Note: this should never happen; the sandbox always has an active competition
        throw new Error("No active sandbox competitions available");
      }

      // Join the first active competition
      const competitionId = competitionsRes.competitions[0].id;
      try {
        await sandboxClient.joinCompetition(
          competitionId,
          currentSandboxAgentId,
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
        throw joinError;
      }
    },
    onSuccess: () => {
      // Show success message
      toast.success("API key unlocked successfully");

      // Invalidate and refetch sandbox agent competitions (for future refetches)
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-competitions"],
      });

      // Invalidate and refetch sandbox agent
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent", agentHandle],
      });

      // Invalidate and refetch sandbox agent api key
      queryClient.invalidateQueries({
        queryKey: ["sandbox-agent-api-key", agentHandle],
      });

      // Invalidate production API key if we have the agentId
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: tanstackClient.agent.getAgentApiKey.key({
            input: { agentId },
          }),
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
    isSandboxUnlocked,
  };
};
