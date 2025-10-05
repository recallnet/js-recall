import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

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
      queryClient.invalidateQueries({
        queryKey: tanstackClient.user.getUserAgent.key({ input: { agentId } }),
      });
      queryClient.invalidateQueries({
        queryKey: tanstackClient.competitions.getAgents.key({
          input: { competitionId },
        }),
      });
      queryClient.invalidateQueries({
        queryKey: ["agent-competitions", agentId],
      });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
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
  });
};
