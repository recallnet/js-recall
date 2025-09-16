import { serviceLogger } from "@/lib/logger.js";

/**
 * Interface for Chainalysis API response
 */
interface ChainalysisIdentification {
  category: string;
  name: string | null;
  description: string | null;
  url: string | null;
}

interface ChainalysisResponse {
  identifications: ChainalysisIdentification[];
}

/**
 * Watchlist Service
 * Checks wallet addresses against Chainalysis sanctions list
 */
export class WatchlistService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "https://public.chainalysis.com/api/v1/address";
  private readonly requestTimeout = 10000; // 10 seconds

  constructor() {
    this.apiKey = process.env.CHAINALYSIS_API_KEY;

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
      if (!this.apiKey) {
        serviceLogger.debug(
          "[WatchlistService] API key not configured, allowing address:",
          address,
        );
        return false;
      }

      // Normalize address (Chainalysis API is case-sensitive)
      const normalizedAddress = address.toLowerCase();

      serviceLogger.debug(
        "[WatchlistService] Checking address:",
        normalizedAddress,
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
          serviceLogger.warn(
            `[WatchlistService] API returned ${response.status}: ${response.statusText} for address: ${normalizedAddress}`,
          );
          return false;
        }

        const data: ChainalysisResponse = await response.json();

        // Check if any identification has sanctions category
        const isSanctioned =
          data.identifications?.some(
            (identification) => identification.category === "sanctions",
          ) ?? false;

        if (isSanctioned) {
          serviceLogger.warn(
            "[WatchlistService] SANCTIONED ADDRESS DETECTED:",
            {
              address: normalizedAddress,
              identifications: data.identifications.filter(
                (id) => id.category === "sanctions",
              ),
            },
          );
        } else {
          serviceLogger.debug(
            "[WatchlistService] Address clean:",
            normalizedAddress,
          );
        }

        return isSanctioned;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      // Network errors, timeouts, etc. - fail-safe (allow access)
      serviceLogger.error(
        "[WatchlistService] Error checking address (failing safe):",
        {
          address,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return false;
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
