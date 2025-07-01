import { useEffect, useState } from "react";

import {
  SandboxAgent,
  SandboxErrorResponse,
  SandboxGetAgentApiKeyResponse,
  SandboxSearchResponse,
} from "@/lib/sandbox-types";

interface UseSandboxAgentApiKeyState {
  data: SandboxGetAgentApiKeyResponse | null;
  loading: boolean;
  error: string | null;
}

interface UseSandboxAgentApiKeyReturn extends UseSandboxAgentApiKeyState {
  refetch: () => void;
}

/**
 * Hook for getting an agent's API key from the sandbox environment
 * First searches for the agent by name, then retrieves its API key
 *
 * @param agentName - Name of the agent to get API key for
 * @returns Hook state and refetch function
 */
export function useSandboxAgentApiKey(
  agentName: string | undefined,
): UseSandboxAgentApiKeyReturn {
  const [state, setState] = useState<UseSandboxAgentApiKeyState>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchApiKey = async () => {
    if (!agentName) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState({ data: null, loading: true, error: null });

    try {
      // First, search for the agent in sandbox to get its ID using new structured search API
      const searchResponse = await fetch(
        `/api/sandbox/search?agent.name=${encodeURIComponent(agentName)}`,
      );
      if (!searchResponse.ok) {
        throw new Error("Failed to search for agent in sandbox");
      }

      const searchData: SandboxSearchResponse = await searchResponse.json();
      const sandboxAgent: SandboxAgent | undefined =
        searchData.results?.agents?.find(
          (agent: SandboxAgent) => agent.name === agentName,
        );

      if (!sandboxAgent) {
        setState({
          data: null,
          loading: false,
          error: "Agent not found in sandbox",
        });
        return;
      }

      // Get the agent's API key from sandbox
      const apiKeyResponse = await fetch(
        `/api/sandbox/agents/${sandboxAgent.id}/key`,
      );
      if (!apiKeyResponse.ok) {
        throw new Error("Failed to get agent API key from sandbox");
      }

      const apiKeyData: SandboxGetAgentApiKeyResponse | SandboxErrorResponse =
        await apiKeyResponse.json();

      if (!apiKeyData.success) {
        const errorData = apiKeyData as SandboxErrorResponse;
        throw new Error(errorData.error || "Failed to get API key");
      }

      setState({
        data: apiKeyData as SandboxGetAgentApiKeyResponse,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get sandbox agent API key",
      });
    }
  };

  useEffect(() => {
    fetchApiKey();
  }, [agentName]);

  const refetch = () => {
    fetchApiKey();
  };

  return {
    ...state,
    refetch,
  };
}
