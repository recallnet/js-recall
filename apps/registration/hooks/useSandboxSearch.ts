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
  searchUserByWallet: (walletAddress: string) => Promise<void>;
  searchAgentByName: (agentName: string) => Promise<void>;
  searchUserAgents: (
    walletAddress: string,
    agentName?: string,
  ) => Promise<void>;
  findUserAgent: (walletAddress: string, agentName: string) => Promise<void>;
  clearResults: () => void;
}

/**
 * Hook for searching users and agents in the sandbox environment
 * Uses the Next.js API route which handles admin authentication server-side
 *
 * Supports new structured search patterns:
 * - user.walletAddress, agent.name, etc.
 * - join parameter for left joins
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
        if (value !== undefined && value !== null && String(value) !== "") {
          // Handle boolean values (like join)
          if (typeof value === "boolean") {
            if (value) {
              queryParams.append(key, "true");
            }
          } else {
            queryParams.append(key, String(value));
          }
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

  /**
   * Search for a user by wallet address using the new structured API
   */
  const searchUserByWallet = async (walletAddress: string) => {
    await search({ "user.walletAddress": walletAddress });
  };

  /**
   * Search for an agent by name using the new structured API
   */
  const searchAgentByName = async (agentName: string) => {
    await search({ "agent.name": agentName });
  };

  /**
   * Search for a user's agents using the new join functionality
   * This will get the user with that wallet address and their agents in one call
   */
  const searchUserAgents = async (
    walletAddress: string,
    agentName?: string,
  ) => {
    const params: SandboxSearchParams = {
      "user.walletAddress": walletAddress,
      join: true,
    };

    if (agentName) {
      params["agent.name"] = agentName;
    }

    await search(params);
  };

  /**
   * Find a specific agent owned by a user in a single efficient call
   * This uses the new join functionality to get both user and agent data at once
   * Perfect for cases where you need to verify ownership and get agent details
   */
  const findUserAgent = async (walletAddress: string, agentName: string) => {
    await search({
      "user.walletAddress": walletAddress,
      "agent.name": agentName,
      join: true,
    });
  };

  const clearResults = () => {
    setState({ data: null, loading: false, error: null });
  };

  return {
    ...state,
    search,
    searchUserByWallet,
    searchAgentByName,
    searchUserAgents,
    findUserAgent,
    clearResults,
  };
}
