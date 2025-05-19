import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

import { Agent, TeamRegistrationRequest } from "./api";

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
    // Normalize the base URL to ensure there's no trailing slash
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
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
      const response = await this.axiosInstance.get("/api/admin/teams");
      return response.data.teams;
    } catch (error) {
      throw this.handleApiError(error, "get all teams");
    }
  }

  /**
   * Register a new team (requires admin API key)
   */
  async registerTeam(data: TeamRegistrationRequest) {
    try {
      // Use the authenticated axiosInstance to call the admin-restricted endpoint
      const response = await this.axiosInstance.post(
        `/api/admin/teams/register`,
        data,
      );
      return response.data.team;
    } catch (error) {
      throw this.handleApiError(error, "register team");
    }
  }

  /**
   * Search for teams based on various criteria (requires admin API key)
   *
   * @param searchParams Search parameters like email, name, walletAddress, etc.
   * @returns Array of teams matching the criteria
   */
  async searchTeams(searchParams: {
    email?: string;
    name?: string;
    walletAddress?: string;
    contactPerson?: string;
    active?: boolean;
    includeAdmins?: boolean;
  }) {
    try {
      // Convert search parameters to query string
      const queryParams = new URLSearchParams();
      console.log("searchParams", searchParams);
      if (searchParams.email) queryParams.append("email", searchParams.email);
      if (searchParams.name) queryParams.append("name", searchParams.name);
      if (searchParams.walletAddress)
        queryParams.append("walletAddress", searchParams.walletAddress);
      if (searchParams.contactPerson)
        queryParams.append("contactPerson", searchParams.contactPerson);

      if (searchParams.active !== undefined) {
        queryParams.append("active", searchParams.active.toString());
      }

      if (searchParams.includeAdmins !== undefined) {
        queryParams.append(
          "includeAdmins",
          searchParams.includeAdmins.toString(),
        );
      }

      // Make the request
      const response = await this.axiosInstance.get(
        `/api/admin/teams/search?${queryParams}`,
      );
      return response.data.teams;
    } catch (error) {
      throw this.handleApiError(error, "search teams");
    }
  }

  /**
   * Get a team's API key (requires admin API key)
   *
   * @param teamId The ID of the team whose API key should be retrieved
   * @returns Object containing team details and API key
   */
  async getTeamApiKey(
    teamId: string,
  ): Promise<{ id: string; name: string; apiKey: string }> {
    try {
      const response = await this.axiosInstance.get(
        `/api/admin/teams/${teamId}/key`,
      );
      return response.data.team;
    } catch (error) {
      throw this.handleApiError(error, "get team API key");
    }
  }

  /**
   * Get upcoming competitions (competitions with status=PENDING)
   *
   * @returns Array of upcoming competitions
   */
  async getUpcomingCompetitions() {
    try {
      console.log("getUpcomingCompetitions");
      const response = await this.axiosInstance.get(
        "/api/competition/upcoming",
      );
      return response.data.competitions;
    } catch (error) {
      throw this.handleApiError(error, "get upcoming competitions");
    }
  }

  /**
   * Update team profile including metadata (agents)
   *
   * @param profileData The updated profile data
   * @returns Updated team data
   */
  async updateTeamProfile(profileData: {
    contactPerson?: string;
    metadata?: Agent[];
    imageUrl?: string;
  }) {
    try {
      const endpoint = `/api/account/profile`;

      const response = await this.axiosInstance.put(endpoint, profileData);
      return response.data.team;
    } catch (error) {
      throw this.handleApiError(error, "update team profile");
    }
  }

  /**
   * Get team's trade history
   *
   * @param filters Optional filters for the trades query
   * @returns Trade history data
   */
  async getTeamTrades(filters?: {
    fromToken?: string;
    toToken?: string;
    fromChain?: string;
    toChain?: string;
    fromSpecificChain?: string;
    toSpecificChain?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      // Convert filters to query parameters if provided
      let endpoint = "/api/account/trades";
      if (filters) {
        const queryParams = new URLSearchParams();

        // Add each filter to query params if defined
        if (filters.fromToken)
          queryParams.append("fromToken", filters.fromToken);
        if (filters.toToken) queryParams.append("toToken", filters.toToken);
        if (filters.fromChain)
          queryParams.append("fromChain", filters.fromChain);
        if (filters.toChain) queryParams.append("toChain", filters.toChain);
        if (filters.fromSpecificChain)
          queryParams.append("fromSpecificChain", filters.fromSpecificChain);
        if (filters.toSpecificChain)
          queryParams.append("toSpecificChain", filters.toSpecificChain);
        if (filters.limit !== undefined)
          queryParams.append("limit", filters.limit.toString());
        if (filters.offset !== undefined)
          queryParams.append("offset", filters.offset.toString());

        // Add query string to endpoint if we have parameters
        const queryString = queryParams.toString();
        if (queryString) {
          endpoint += `?${queryString}`;
        }
      }

      const response = await this.axiosInstance.get(endpoint);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, "get team trade history");
    }
  }
}
