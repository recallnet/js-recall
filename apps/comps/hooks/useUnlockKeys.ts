import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {sandboxClient} from "@/lib/sandbox-client";
import {AgentCompetitionsResponse} from "@/types";

export const useUnlockKeys = (agentId: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      try {

        const res = await sandboxClient.getCompetitions()
        console.log('SANDBOX COMPETITIONS', res)
        //return await sandboxClient.joinCompetition('compId', agentId);
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

  //const query = useQuery({
  //queryKey: ["sandbox", "agent", agentId, "competitions"],
  //queryFn: async (): Promise<AgentCompetitionsResponse> => {
  //const response = await sandboxClient.getAgentCompetitions(agentId);
  //return response
  //},
  //});

  return {mutation};
  //return {mutation, query};
};
