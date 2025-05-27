import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";

const apiClient = new ApiClient();

interface JoinCompetitionArgs {
  agentId: string;
  competitionId: string;
}

/**
 * Hook to join a competition with an agent
 * @returns Mutation for joining a competition
 */
export const useJoinCompetition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, competitionId }: JoinCompetitionArgs) => {
      await apiClient.joinCompetition(competitionId, agentId);
      return { success: true };
    },
    onSuccess: (_data, { agentId, competitionId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
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
