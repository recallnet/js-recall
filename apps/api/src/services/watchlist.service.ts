import { config } from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";

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
 * @returns boolean - true if sanctioned, false if clean or on error (fail-safe)
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

  constructor() {
    this.apiKey = config.watchlist.chainalysisApiKey;

    if (!this.apiKey) {
      serviceLogger.warn(
        "[WatchlistService] CHAINALYSIS_API_KEY not configured - watchlist checks will be skipped",
      );
    }
  }

  /**
   * Check if a wallet address is sanctioned
   * @param address The wallet address to check (case-insensitive)
   * @returns Promise<boolean> - true if sanctioned, false if clean or on error (fail-safe)
   */
  async isAddressSanctioned(address: string): Promise<boolean> {
    try {
      // Skip check if API key not configured (fail-safe)
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

        // If API is down or returns error, fail-safe (allow access)
        if (!response.ok) {
          serviceLogger.error(
            {
              address: normalizedAddress,
              status: response.status,
              statusText: response.statusText,
            },
            "[WatchlistService] Chainalysis API error",
          );
          throw new Error(`Chainalysis API error: ${response.statusText}`);
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
        throw error;
      }
    } catch (error) {
      // Do not allow access in case of network errors, timeouts, etc.
      serviceLogger.error(
        {
          address,
          error,
        },
        `[WatchlistService] Error checking address`,
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
