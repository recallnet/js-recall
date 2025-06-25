/**
 * Internal API client for Next.js API routes only
 * Separate from the main backend API client
 */

// Response types for internal APIs
interface InternalApiResponse<T = any> {
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

/**
 * Internal API client class for handling Next.js API route calls
 */
export class InternalApiClient {
  /**
   * Check if a wallet address has trading verification
   *
   * @param walletAddress - The wallet address to check
   * @returns Promise with trading verification status
   */
  async checkTradingVerification(
    walletAddress: string,
  ): Promise<TradingVerificationResponse> {
    try {
      const response = await fetch(
        `/api/trade-verification-check?walletAddress=${encodeURIComponent(walletAddress)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking trading verification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        hasTraded: false,
      };
    }
  }

  /**
   * Update trading verification status for a wallet address
   *
   * @param walletAddress - The wallet address to update
   * @returns Promise with update result
   */
  async updateTradingVerification(
    walletAddress: string,
  ): Promise<InternalApiResponse> {
    try {
      const response = await fetch("/api/trade-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
        } as TradingVerificationUpdateRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error updating trading verification:", error);
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
};
