import { useMutation, useQuery } from "@tanstack/react-query";

import { ENABLE_SANDBOX } from "@/config";
import { sandboxClient } from "@/lib/sandbox-client";
import {
  AdminAgentKeyResponse,
  AdminAgentUpdateResponse,
  AdminCreateAgentResponse,
  AdminUserResponse,
} from "@/types/admin";

/**
 * Hook to create a user in the sandbox environment
 * @returns Mutation for creating a user
 */
export const useCreateSandboxUser = () => {
  return useMutation<AdminUserResponse, Error>({
    mutationFn: () => sandboxClient.createUser(),
  });
};

/**
 * Hook to create an agent in the sandbox environment
 * @returns Mutation for creating an agent
 */
export const useCreateSandboxAgent = () => {
  return useMutation<
    AdminCreateAgentResponse,
    Error,
    {
      name: string;
      description?: string;
      imageUrl?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    }
  >({
    mutationFn: (agentData) => sandboxClient.createAgent(agentData),
  });
};

/**
 * Hook to get an agent's API key from the sandbox
 * @param agentName - Name of the agent
 * @returns Query for getting agent API key
 */
export const useSandboxAgentApiKey = (agentName: string | null) => {
  return useQuery<AdminAgentKeyResponse, Error>({
    queryKey: ["sandbox-agent-api-key", agentName],
    queryFn: () => sandboxClient.getAgentApiKey(agentName!),
    enabled: !!agentName && ENABLE_SANDBOX,
  });
};

/**
 * Hook to update an agent in the sandbox environment
 * @returns Mutation for updating an agent
 */
export const useUpdateSandboxAgent = () => {
  return useMutation<
    AdminAgentUpdateResponse,
    Error,
    {
      agentId: string;
      name?: string;
      description?: string;
      imageUrl?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    }
  >({
    mutationFn: ({ agentId, ...agentData }) =>
      sandboxClient.updateAgent(agentId, agentData),
  });
};
