import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {sandboxClient} from "@/lib/sandbox-client";
import {AgentCompetitionsResponse, Competition} from "@/types";

export const useUnlockKeys = (agentId: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await sandboxClient.getCompetitions()

        if (res.competitions?.length == 0)
          throw new Error('No sandbox competitions')

        return await sandboxClient.joinCompetition((res.competitions[0] as Competition).id, agentId);
      } catch (err) {
        console.log('SANDBOX ERR', err)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sandbox", "agent", agentId, "competitions"]
      });
    },
  });

  const query = useQuery({
    queryKey: ["sandbox", "agent", agentId, "competitions"],
    queryFn: async (): Promise<AgentCompetitionsResponse> => {
      const response = await sandboxClient.getAgentCompetitions(agentId);
      return response
    },
  });

  return {mutation, query};
};
