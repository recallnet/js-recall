import {
  UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { Agent, GetAgentsParams } from "@/types";

/**
 * Hook to fetch agents with pagination and filtering (public endpoint)
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useAgents = (
  params: GetAgentsParams = {},
): UseQueryResult<RouterOutputs["agent"]["listAgents"], Error> =>
  useQuery(
    tanstackClient.agent.listAgents.queryOptions({
      input: params,
      placeholderData: (prev) => prev,
    }),
  );

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
    tanstackClient.user.getUserAgents.queryOptions({
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
    tanstackClient.user.updateAgentProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: tanstackClient.user.getUserAgent.key(),
        });
      },
    }),
  );
};
