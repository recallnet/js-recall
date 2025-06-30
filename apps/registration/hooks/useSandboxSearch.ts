import { useState } from "react";

import {
  SandboxSearchParams,
  SandboxSearchResponse,
} from "@/lib/sandbox-types";

interface UseSandboxSearchState {
  data: SandboxSearchResponse | null;
  loading: boolean;
  error: string | null;
}

interface UseSandboxSearchReturn extends UseSandboxSearchState {
  search: (params: SandboxSearchParams) => Promise<void>;
  clearResults: () => void;
}

/**
 * Hook for searching users and agents in the sandbox environment
 * Uses the Next.js API route which handles admin authentication server-side
 */
export function useSandboxSearch(): UseSandboxSearchReturn {
  const [state, setState] = useState<UseSandboxSearchState>({
    data: null,
    loading: false,
    error: null,
  });

  const search = async (params: SandboxSearchParams) => {
    setState({ data: null, loading: true, error: null });

    try {
      // Build query string from params
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, String(value));
        }
      });

      const response = await fetch(
        `/api/sandbox/search?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const result = await response.json();

      if (result.success) {
        setState({
          data: result as SandboxSearchResponse,
          loading: false,
          error: null,
        });
      } else {
        setState({
          data: null,
          loading: false,
          error: result.error || "Failed to search",
        });
      }
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to search",
      });
    }
  };

  const clearResults = () => {
    setState({ data: null, loading: false, error: null });
  };

  return {
    ...state,
    search,
    clearResults,
  };
}
