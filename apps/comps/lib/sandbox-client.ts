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
}

// Export a singleton instance
export const sandboxClient = new SandboxClient();
