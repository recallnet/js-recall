import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";

/**
 * Hook to create a new agent
 * @returns Mutation for creating an agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation(
    tanstackClient.user.createAgent.mutationOptions({
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: tanstackClient.user.getUserAgents.key(),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.leaderboard.getGlobal.key(),
        });
      },
    }),
  );
};
