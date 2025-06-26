/**
 * Internal API client for Next.js API routes only
 * Separate from the main backend API client
 */

// Response types for internal APIs
interface InternalApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

interface TradingVerificationResponse extends InternalApiResponse {
  walletAddress?: string;
  hasTraded?: boolean;
}

interface TradingVerificationUpdateRequest {
  walletAddress: string;
}

interface LoopsUserData {
  id: string;
  email: string;
  firstName?: string;
  verified?: boolean;
  userGroup?: string;
  source?: string;
  [key: string]: unknown;
}

interface LoopsGetResponse extends InternalApiResponse {
  user?: LoopsUserData | null;
}

interface LoopsUpdateRequest {
  email: string;
  name: string;
  verified?: boolean;
}

/**
 * Internal API client class for handling Next.js API route calls
 */
export class InternalApiClient {
  /**
   * Get user data from Loops by email
   *
   * @param email - The email address to search for
   * @returns Promise with user data from Loops
   */
  async getLoopsUser(email: string): Promise<LoopsGetResponse> {
    try {
      const response = await fetch(
        `/api/loops-get?email=${encodeURIComponent(email)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching user from Loops:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        user: null,
      };
    }
  }

  /**
   * Update user data in Loops
   *
   * @param userData - The user data to update in Loops
   * @returns Promise with update result
   */
  async updateLoopsUser(
    userData: LoopsUpdateRequest,
  ): Promise<InternalApiResponse> {
    try {
      const response = await fetch("/api/loops-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error updating user in Loops:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Add more internal API methods here as needed
  // Example:
  // async getInternalUserData(userId: string): Promise<InternalUserResponse> { ... }
  // async updateInternalSettings(settings: Settings): Promise<InternalApiResponse> { ... }
}

// Export a default instance
export const internalApi = new InternalApiClient();

// Export types for use in components
export type {
  InternalApiResponse,
  TradingVerificationResponse,
  TradingVerificationUpdateRequest,
  LoopsUserData,
  LoopsGetResponse,
  LoopsUpdateRequest,
};
