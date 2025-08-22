import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

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
      const response = await apiClient.joinCompetition(competitionId, agentId);
      return response;
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
      queryClient.invalidateQueries({
        queryKey: ["competition", competitionId],
      });
      queryClient.invalidateQueries({ queryKey: ["user-competitions"] });
    },
  });
};
