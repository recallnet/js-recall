import { useState } from "react";

import {
  SandboxRegisterAgentRequest,
  SandboxRegisterAgentResponse,
} from "@/lib/sandbox-types";

interface UseSandboxRegisterAgentState {
  data: SandboxRegisterAgentResponse | null;
  loading: boolean;
  error: string | null;
}

interface UseSandboxRegisterAgentReturn extends UseSandboxRegisterAgentState {
  registerAgent: (agentData: SandboxRegisterAgentRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for registering agents in the sandbox environment
 * Uses the Next.js API route which handles admin authentication server-side
 */
export function useSandboxRegisterAgent(): UseSandboxRegisterAgentReturn {
  const [state, setState] = useState<UseSandboxRegisterAgentState>({
    data: null,
    loading: false,
    error: null,
  });

  const registerAgent = async (agentData: SandboxRegisterAgentRequest) => {
    setState({ data: null, loading: true, error: null });

    try {
      const response = await fetch("/api/sandbox/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentData),
      });

      const result = await response.json();

      if (result.success) {
        setState({
          data: result as SandboxRegisterAgentResponse,
          loading: false,
          error: null,
        });
      } else {
        setState({
          data: null,
          loading: false,
          error: result.error || "Failed to register agent",
        });
      }
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to register agent",
      });
    }
  };

  const reset = () => {
    setState({ data: null, loading: false, error: null });
  };

  return {
    ...state,
    registerAgent,
    reset,
  };
}
