import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";

interface LeaveCompetitionArgs {
  agentId: string;
  competitionId: string;
}

/**
 * Hook to leave a competition with an agent
 * @returns Mutation for leaving a competition
 */
export const useLeaveCompetition = () => {
  const queryClient = useQueryClient();

  return useMutation(
    tanstackClient.competitions.leave.mutationOptions({
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
          queryKey: ["agent-competitions", agentId],
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.competitions.listEnriched.key(),
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
