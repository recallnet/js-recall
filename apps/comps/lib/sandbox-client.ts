import {
  AgentCompetitionsResponse,
  CompetitionsResponse,
  GetAgentCompetitionsParams,
  JoinCompetitionResponse,
} from "@/types";
import {
  AdminAgentKeyResponse,
  AdminCreateAgentResponse,
  AdminUserResponse,
} from "@/types/admin";

const SANDBOX_API_BASE = "/api/sandbox";

/**
 * Client for interacting with sandbox API endpoints
 */
export class SandboxClient {
  /**
   * Create a user in the sandbox environment
   * @returns User creation response
   */
  async createUser(): Promise<AdminUserResponse> {
    const response = await fetch(`${SANDBOX_API_BASE}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create user in sandbox");
    }

    return response.json();
  }

  /**
   * Create an agent in the sandbox environment
   * @param agentData - Agent creation data
   * @returns Agent creation response
   */
  async createAgent(agentData: {
    name: string;
    description?: string;
    imageUrl?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AdminCreateAgentResponse> {
    const response = await fetch(`${SANDBOX_API_BASE}/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
      body: JSON.stringify(agentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create agent in sandbox");
    }

    return response.json();
  }

  /**
   * Get an agent's API key from the sandbox
   * @param agentName - Name of the agent
   * @returns Agent API key response
   */
  async getAgentApiKey(agentName: string): Promise<AdminAgentKeyResponse> {
    const response = await fetch(
      `${SANDBOX_API_BASE}/api-key?name=${encodeURIComponent(agentName)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get agent API key");
    }

    return response.json();
  }

  /**
   * Get competitions
   */
  async getCompetitions(): Promise<CompetitionsResponse> {
    const response = await fetch(`${SANDBOX_API_BASE}/competitions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || "Failed to get agent competitions in sandbox",
      );
    }

    return response.json();
  }

  /**
   * Join a competition
   * @param competitionId - Competition ID
   * @param agentId - Agent ID
   */
  async joinCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<JoinCompetitionResponse> {
    const response = await fetch(
      `${SANDBOX_API_BASE}/competitions/${competitionId}/agents/${agentId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to join competition in sandbox");
    }

    return response.json();
  }

  /**
   * Get competitions for an agent
   * @param agentId - Agent ID
   * @param params - Query parameters
   * @returns Agent competitions response
   */
  async getAgentCompetitions(
    agentId: string,
    params: GetAgentCompetitionsParams = {},
  ): Promise<AgentCompetitionsResponse> {
    const queryParams = this.formatQueryParams(params);
    const response = await fetch(
      `${SANDBOX_API_BASE}/agents/${agentId}/competitions${queryParams}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || "Failed to get agent competitions in sandbox",
      );
    }

    return response.json();
  }

  /**
   * Format query parameters for URL
   * @param params - Object containing query parameters
   * @returns Formatted query string
   */
  private formatQueryParams<T extends object>(params: T): string {
    const validParams = Object.entries(params as Record<string, unknown>)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      )
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");

    return validParams ? `?${validParams}` : "";
  }
}

// Export a singleton instance
export const sandboxClient = new SandboxClient();
