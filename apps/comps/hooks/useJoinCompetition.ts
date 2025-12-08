import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";

/**
 * Hook to join a competition with an agent
 * @returns Mutation for joining a competition
 */
export const useJoinCompetition = () => {
  const queryClient = useQueryClient();

  return useMutation(
    tanstackClient.competitions.join.mutationOptions({
      onSuccess: (_data, { agentId, competitionId }) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: tanstackClient.user.getUserAgent.key({
            input: { agentId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.competitions.getAgents.key({
            input: { competitionId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.agent.getCompetitions.key({
            input: { agentId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.leaderboard.getGlobal.key(),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.competitions.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.competitions.getById.key({
            input: { id: competitionId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.user.getCompetitions.key(),
        });
      },
    }),
  );
};
