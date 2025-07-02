import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import {
  SandboxAgent,
  SandboxGetAgentApiKeyResponse,
  SandboxSearchResponse,
} from "@/lib/sandbox-types";
import { useUser } from "@/state/atoms";

import {
  AgentApiKeyResponse,
  AgentsResponse,
  GetAgentsParams,
  UpdateAgentRequest,
} from "../types";

const apiClient = new ApiClient();

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useAgents = (params: GetAgentsParams = {}) =>
  useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getAgents(params);
    },
    placeholderData: (prev) => prev,
  });

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useUserAgents = (params: GetAgentsParams = {}) => {
  const { status } = useUser();

  return useQuery({
    queryKey: ["agents", params],
    queryFn: async (): Promise<AgentsResponse> => {
      return apiClient.getUserAgents(params);
    },
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
};

/**
 * Hook to fetch agents with pagination and filtering
 * @param params Query parameters for agents endpoint
 * @returns Query result with agents data
 */
export const useAgentApiKey = (agentId: string) =>
  useQuery({
    queryKey: ["agent", "api-key", agentId],
    queryFn: async (): Promise<AgentApiKeyResponse> => {
      return apiClient.getAgentApiKey(agentId);
    },
    placeholderData: (prev) => prev,
  });

/**
 * Hook to update agents
 * Also syncs profile updates to the sandbox environment as a background operation
 * @returns Mutation for updating an agent
 */
export const useUpdateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAgentRequest) => {
      return apiClient.updateAgent(data);
    },
    onSuccess: async (response, variables) => {
      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({ queryKey: ["agent"] });

      // Background: Sync agent profile update to sandbox
      try {
        // First, find the agent in sandbox to get its ID using new structured search API
        const searchResponse = await fetch(
          `/api/sandbox/search?agent.name=${encodeURIComponent(response.agent.name)}`,
        );
        if (!searchResponse.ok) {
          throw new Error("Failed to search for agent in sandbox");
        }

        const searchData: SandboxSearchResponse = await searchResponse.json();
        const sandboxAgent: SandboxAgent | undefined =
          searchData.results?.agents?.find(
            (agent: SandboxAgent) => agent.name === response.agent.name,
          );

        if (!sandboxAgent) {
          console.warn("Agent not found in sandbox, skipping profile sync");
          return;
        }

        // Get the agent's API key from sandbox
        const apiKeyResponse = await fetch(
          `/api/sandbox/agents/${sandboxAgent.id}/key`,
        );
        if (!apiKeyResponse.ok) {
          throw new Error("Failed to get agent API key from sandbox");
        }

        const apiKeyData: SandboxGetAgentApiKeyResponse =
          await apiKeyResponse.json();
        if (!apiKeyData.success || !apiKeyData.agent?.apiKey) {
          throw new Error("Invalid API key response from sandbox");
        }

        // Prepare sandbox update data (only fields that sandbox agent profile accepts)
        const sandboxUpdateData: {
          name?: string;
          description?: string;
          imageUrl?: string;
        } = {};

        if (variables.params.name !== undefined) {
          sandboxUpdateData.name = variables.params.name;
        }
        if (variables.params.description !== undefined) {
          sandboxUpdateData.description = variables.params.description;
        }
        if (variables.params.imageUrl !== undefined) {
          sandboxUpdateData.imageUrl = variables.params.imageUrl;
        }

        // Only make the sandbox call if there are fields to update
        if (Object.keys(sandboxUpdateData).length > 0) {
          // Make direct call to sandbox agent profile update endpoint
          const sandboxResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_SANDBOX_URL}/agent/profile`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKeyData.agent.apiKey}`,
              },
              body: JSON.stringify(sandboxUpdateData),
            },
          );

          if (!sandboxResponse.ok) {
            console.warn("Failed to sync agent profile update to sandbox:", {
              status: sandboxResponse.status,
              statusText: sandboxResponse.statusText,
            });
          }
        }
      } catch (error) {
        console.warn("Failed to sync agent profile update to sandbox:", error);
        // Silently fail - this shouldn't impact the main agent update
      }
    },
  });
};
