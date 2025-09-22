import { config } from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
import {
  DEFAULT_RETRY_CONFIG,
  NonRetryableError,
  RetryConfig,
  RetryableError,
  withRetry,
} from "@/lib/retry-helper.js";

/**
 * Category of the identification. Only "sanctions" designates a sanctioned address, and other
 * categories are informational.
 */
type Category = "sanctions" | string | null;

/**
 * Interface for Chainalysis API response
 */
interface ChainalysisIdentification {
  category: Category;
  name: string | null;
  description: string | null;
  url: string | null;
}

/**
 * Interface for Chainalysis API response
 */
interface ChainalysisResponse {
  identifications: ChainalysisIdentification[];
}

/**
 * Check if an identification is sanctioned
 * @param identification The identification to check
 * @returns boolean - true if sanctioned, false if clean
 */
function checkIsSanctioned(identification: ChainalysisIdentification): boolean {
  const category = identification.category;
  return category === "sanctions";
}

/**
 * Watchlist Service
 * Checks wallet addresses against Chainalysis sanctions list
 */
export class WatchlistService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://public.chainalysis.com/api/v1/address";
  private readonly requestTimeout = 10_000;

  constructor(readonly retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.apiKey = config.watchlist.chainalysisApiKey;
    this.retryConfig = retryConfig;

    if (!this.apiKey) {
      serviceLogger.warn(
        "[WatchlistService] CHAINALYSIS_API_KEY not configured - watchlist checks will be skipped",
      );
    }
  }

  /**
   * Check if a wallet address is sanctioned
   * @param address The wallet address to check (case-insensitive)
   * @returns Promise<boolean> - true if sanctioned, false if clean
   * @throws Error if API is unavailable or network issues (fail closed for security)
   */
  async isAddressSanctioned(address: string): Promise<boolean> {
    try {
      // Skip check if API key not configured (fail-safe - only exception)
      if (!this.isConfigured()) {
        serviceLogger.debug(
          {
            address,
          },
          "[WatchlistService] API key not configured, allowing address",
        );
        return false;
      }

      // Normalize address (Chainalysis API is case-sensitive)
      const normalizedAddress = address.toLowerCase();
      serviceLogger.debug(
        {
          address: normalizedAddress,
        },
        `[WatchlistService] Checking address`,
      );

      // Use retry logic for API calls with exponential backoff
      return await withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.requestTimeout,
        );

        try {
          const response = await fetch(`${this.baseUrl}/${normalizedAddress}`, {
            method: "GET",
            headers: {
              "X-API-Key": this.apiKey,
              Accept: "application/json",
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          // Handle API errors
          if (!response.ok) {
            const errorMessage = `Chainalysis API error: ${response.statusText}`;
            serviceLogger.error(
              {
                address: normalizedAddress,
                status: response.status,
                statusText: response.statusText,
              },
              "[WatchlistService] Chainalysis API error",
            );

            // Determine if error is retryable
            if (response.status >= 500 || response.status === 429) {
              // Server errors and rate limiting are retryable
              throw new RetryableError(errorMessage);
            } else {
              // Other client errors (400, 404, etc.) are generally not retryable
              throw new NonRetryableError(errorMessage);
            }
          }

          // Check if any identification has sanctions category
          const data: ChainalysisResponse = await response.json();
          const isSanctioned =
            data.identifications?.some(checkIsSanctioned) ?? false;
          if (isSanctioned) {
            serviceLogger.warn(
              {
                address: normalizedAddress,
                identifications: data.identifications.filter(checkIsSanctioned),
              },
              "[WatchlistService] SANCTIONED ADDRESS DETECTED",
            );
          }

          return isSanctioned;
        } catch (error) {
          clearTimeout(timeoutId);

          // Handle network errors and timeouts as retryable
          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (
              message.includes("abort") ||
              message.includes("timeout") ||
              message.includes("network") ||
              message.includes("fetch")
            ) {
              throw new RetryableError(
                `Network error: ${error.message}`,
                error,
              );
            }
          }

          // Re-throw other errors as-is (may be RetryableError or NonRetryableError)
          throw error;
        }
      }, this.retryConfig);
    } catch (error) {
      // Fail closed: Do not allow access in case of network errors, timeouts, etc.
      serviceLogger.error(
        {
          address,
          error,
        },
        `[WatchlistService] Error checking address after retries - failing closed for security`,
      );
      throw error;
    }
  }

  /**
   * Check if the service is properly configured
   * @returns boolean - true if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get service status for health checks
   * @returns object with configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      baseUrl: this.baseUrl,
      timeout: this.requestTimeout,
    };
  }
}
