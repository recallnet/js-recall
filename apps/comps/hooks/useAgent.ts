import { UseQueryResult, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { Agent, AgentWithOwnerResponse } from "@/types";

/**
 * Hook to fetch a single agent by ID owned by the authenticated user
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useUserAgent = (id?: string): UseQueryResult<Agent, Error> => {
  return useQuery(
    tanstackClient.agent.getAgent.queryOptions({
      input: { agentId: id! },
      enabled: !!id,
    }),
  );
};

/**
 * Hook to fetch a single agent by ID (unauthenticated)
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useAgent = (id?: string) => {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: async (): Promise<AgentWithOwnerResponse> => {
      if (!id) throw new Error("Agent ID is required");
      const response = await apiClient.getAgent(id);

      if (!response.success) throw new Error("Error when querying agent");

      return response;
    },
    enabled: !!id,
  });
};
