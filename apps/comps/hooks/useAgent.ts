import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { AgentResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch a single agent by ID
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useAgent = (id?: string) =>
  useQuery({
    queryKey: ["agent", id],
    queryFn: async (): Promise<AgentResponse> => {
      if (!id) throw new Error("Agent ID is required");
      return apiClient.getAgent(id);
    },
    enabled: !!id,
  });
