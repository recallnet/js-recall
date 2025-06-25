import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";

import { AgentWithOwnerResponse } from "../types";

const apiClient = new ApiClient();

/**
 * Hook to fetch a single agent by ID owned by the authenticated user
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useUserAgent = (id?: string) =>
  useQuery({
    queryKey: ["agent", id],
    queryFn: async () => {
      if (!id) throw new Error("Agent ID is required");
      const response = await apiClient.getUserAgent(id);

      if (!response.success) throw new Error("Error when querying agent");

      return response.agent;
    },
    enabled: !!id,
  });

/**
 * Hook to fetch a single agent by ID (unauthenticated)
 * @param id Agent ID
 * @returns Query result with agent data
 */
export const useAgent = (id?: string) =>
  useQuery({
    queryKey: ["agent", id],
    queryFn: async (): Promise<AgentWithOwnerResponse> => {
      if (!id) throw new Error("Agent ID is required");
      const response = await apiClient.getAgent(id);

      if (!response.success) throw new Error("Error when querying agent");

      return response;
    },
    enabled: !!id,
  });
