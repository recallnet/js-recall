import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

import { TeamRegistrationRequest } from "./api";

/**
 * Team API client for server-side operations
 * This client should only be used within API routes, never in client-side code
 */
export class TeamApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string | undefined;
  private baseUrl: string;

  /**
   * Create a new API client
   *
   * @param baseUrl Base URL for the API
   * @param apiKey API key for authentication (optional)
   */
  constructor(baseUrl: string, apiKey?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add interceptor to add authentication header
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Set authentication header if API key is available
        if (this.apiKey) {
          config.headers = config.headers || {};
          config.headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        return config;
      },
    );
  }

  /**
   * Helper method to handle API errors consistently
   */
  private handleApiError(
    error: unknown,
    operation: string,
  ): { success: false; error: string; status: number } {
    console.error(`Failed to ${operation}:`, error);

    // Extract the detailed error message from the axios error response
    if (axios.isAxiosError(error) && error.response?.data) {
      return {
        success: false,
        error:
          error.response.data.error ||
          error.response.data.message ||
          error.message,
        status: error.response.status,
      };
    }

    // Fallback to the generic error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage, status: 500 };
  }

  /**
   * Get all teams (requires admin API key)
   */
  async getAllTeams() {
    try {
      // The full path should include the /api prefix
      const response = await this.axiosInstance.get("/api/admin/teams");
      return response.data.teams;
    } catch (error) {
      throw this.handleApiError(error, "get all teams");
    }
  }

  /**
   * Register a new team (public endpoint, no API key required)
   */
  async registerTeam(data: TeamRegistrationRequest) {
    try {
      // Use a direct axios instance without the auth interceptor for this public endpoint
      // The full path should include the /api prefix
      const response = await axios.post(
        `${this.baseUrl}/api/public/teams/register`,
        data,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.data.team;
    } catch (error) {
      throw this.handleApiError(error, "register team");
    }
  }
}
