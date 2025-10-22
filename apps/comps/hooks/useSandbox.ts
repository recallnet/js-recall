import { skipToken, useMutation, useQuery } from "@tanstack/react-query";

import { config } from "@/config/public";
import { sandboxClient } from "@/lib/sandbox-client";
import {
  AdminAgentKeyResponse,
  AdminAgentUpdateResponse,
  AdminCreateAgentRequest,
  AdminCreateAgentResponse,
  AdminCreateUserRequest,
  AdminUpdateAgentRequest,
  AdminUserResponse,
} from "@/types/admin";

/**
 * Hook to create a user in the sandbox environment
 * @returns Mutation for creating a user
 */
export const useCreateSandboxUser = () => {
  return useMutation<AdminUserResponse, Error, AdminCreateUserRequest>({
    mutationFn: (userData) => sandboxClient.createUser(userData),
  });
};

/**
 * Hook to create an agent in the sandbox environment
 * @returns Mutation for creating an agent
 */
export const useCreateSandboxAgent = () => {
  return useMutation<AdminCreateAgentResponse, Error, AdminCreateAgentRequest>({
    mutationFn: (data) => sandboxClient.createAgent(data),
  });
};

/**
 * Hook to get an agent's API key from the sandbox
 * @param agentName - Name of the agent
 * @returns Query for getting agent API key
 */
export const useSandboxAgentApiKey = (agentHandle: string | null) => {
  return useQuery<AdminAgentKeyResponse, Error>({
    queryKey: ["sandbox-agent-api-key", agentHandle],
    queryFn:
      agentHandle && config.publicFlags.enableSandbox
        ? () => sandboxClient.getAgentApiKey(agentHandle)
        : skipToken,
  });
};

/**
 * Hook to update an agent in the sandbox environment
 * @returns Mutation for updating an agent
 */
export const useUpdateSandboxAgent = () => {
  return useMutation<AdminAgentUpdateResponse, Error, AdminUpdateAgentRequest>({
    mutationFn: (data) => sandboxClient.updateAgent(data),
  });
};
