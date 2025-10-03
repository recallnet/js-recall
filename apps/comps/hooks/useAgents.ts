import {
  UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { apiClient } from "@/lib/api-client";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { Agent, AgentsResponse, GetAgentsParams } from "@/types";

/**
 * Hook to fetch agents with pagination and filtering (public endpoint)
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useAgents = (params: GetAgentsParams = {}) => {
  return useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getAgents(params);
    },
    placeholderData: (prev) => prev,
  });
};

/**
 * Hook to fetch user's owned agents with pagination
 * @param params Query parameters for agents endpoint
 * @returns Query result with user agents data

 */
export const useUserAgents = (
  params: GetAgentsParams = {},
): UseQueryResult<{ userId: string; agents: Agent[] }, Error> => {
  const { isAuthenticated } = useSession();

  return useQuery(
    tanstackClient.agent.getAgents.queryOptions({
      input: params,
      enabled: isAuthenticated,
      placeholderData: (prev) => prev,
    }),
  );
};

/**
 * Hook to update agents
 * @returns Mutation for updating an agent
 */
export const useUpdateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation(
    tanstackClient.agent.updateAgentProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: tanstackClient.agent.getAgent.key(),
        });
      },
    }),
  );
};
