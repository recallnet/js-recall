import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";

import { useAnalytics } from "./usePostHog";

/**
 * Hook to create a new agent
 * @returns Mutation for creating an agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();

  return useMutation(
    tanstackClient.agent.createAgent.mutationOptions({
      onSuccess: (response, variables) => {
        trackEvent("UserSuccessfullyCreatedAgent", {
          agent_id: response.agent.id,
          agent_name: variables.name,
          agent_handle: variables.handle,
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: tanstackClient.agent.getAgents.key(),
        });
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      },
    }),
  );
};
