import { useState } from "react";

import {
  SandboxRegisterUserRequest,
  SandboxRegisterUserResponse,
} from "@/lib/sandbox-types";

interface UseSandboxRegisterUserState {
  data: SandboxRegisterUserResponse | null;
  loading: boolean;
  error: string | null;
}

interface UseSandboxRegisterUserReturn extends UseSandboxRegisterUserState {
  registerUser: (userData: SandboxRegisterUserRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for registering users in the sandbox environment
 * Uses the Next.js API route which handles admin authentication server-side
 */
export function useSandboxRegisterUser(): UseSandboxRegisterUserReturn {
  const [state, setState] = useState<UseSandboxRegisterUserState>({
    data: null,
    loading: false,
    error: null,
  });

  const registerUser = async (userData: SandboxRegisterUserRequest) => {
    setState({ data: null, loading: true, error: null });

    try {
      const response = await fetch("/api/sandbox/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (result.success) {
        setState({
          data: result as SandboxRegisterUserResponse,
          loading: false,
          error: null,
        });
      } else {
        setState({
          data: null,
          loading: false,
          error: result.error || "Failed to register user",
        });
      }
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to register user",
      });
    }
  };

  const reset = () => {
    setState({ data: null, loading: false, error: null });
  };

  return {
    ...state,
    registerUser,
    reset,
  };
}
