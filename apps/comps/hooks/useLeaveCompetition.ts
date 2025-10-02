import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
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

  return useMutation({
    mutationFn: async ({ agentId, competitionId }: LeaveCompetitionArgs) => {
      await apiClient.leaveCompetition(competitionId, agentId);
      return { success: true };
    },
    onSuccess: (_data, { agentId, competitionId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: tanstackClient.agent.getAgent.key({ input: { agentId } }),
      });
      queryClient.invalidateQueries({
        queryKey: ["competition-agents", competitionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["agent-competitions", agentId],
      });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
  });
};
