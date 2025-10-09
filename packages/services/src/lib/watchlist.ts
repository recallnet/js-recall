import { Logger } from "pino";

import {
  DEFAULT_RETRY_CONFIG,
  MaybeHttpError,
  RetryConfig,
  withRetry,
} from "./retry-helper.js";

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

export interface WalletWatchlistConfig {
  watchlist: {
    chainalysisApiKey: string;
  };
}

/**
 * Wallet Address Watchlist
 * Checks wallet addresses against Chainalysis sanctions list
 */
export class WalletWatchlist {
  private readonly apiKey: string;
  private readonly baseUrl = "https://public.chainalysis.com/api/v1/address";
  private readonly requestTimeout = 10_000;
  private logger: Logger;

  constructor(
    config: WalletWatchlistConfig,
    logger: Logger,
    readonly retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  ) {
    this.apiKey = config.watchlist.chainalysisApiKey;
    this.logger = logger;
    // Note: Chainalysis throws a 403 upon rate limiting
    const isRetryable = (error: unknown) => {
      const err = error as MaybeHttpError;
      return err.response?.status === 403;
    };
    this.retryConfig = { ...retryConfig, isRetryable };

    if (!this.apiKey) {
      this.logger.warn(
        "CHAINALYSIS_API_KEY not configured - watchlist checks will be skipped",
      );
    }
  }

  /**
   * Fetch sanction status for a normalized address from Chainalysis API
   * @param normalizedAddress The normalized (lowercase) wallet address
   * @returns Promise<boolean> - true if sanctioned, false if clean
   * @throws Error with response metadata for retry logic
   */
  private async fetchAddressSanctionStatus(
    normalizedAddress: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.baseUrl}/${normalizedAddress}`, {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(
          {
            address: normalizedAddress,
            status: response.status,
            statusText: response.statusText,
          },
          "Chainalysis API error",
        );
        const error = new Error(
          `Chainalysis API error: ${response.statusText}`,
        ) as MaybeHttpError;
        error.response = {
          status: response.status,
          headers: response.headers,
        };
        throw error;
      }

      const data: ChainalysisResponse = await response.json();
      const isSanctioned =
        data.identifications?.some(checkIsSanctioned) ?? false;
      if (isSanctioned) {
        this.logger.warn(
          {
            address: normalizedAddress,
            identifications: data.identifications.filter(checkIsSanctioned),
          },
          "SANCTIONED ADDRESS DETECTED",
        );
      }

      return isSanctioned;
    } finally {
      clearTimeout(timeoutId);
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
      if (!this.isConfigured()) {
        this.logger.debug(
          {
            address,
          },
          "API key not configured, allowing address",
        );
        return false;
      }

      // Normalize address (Note: Chainalysis API docs state this is case-sensitive, but in
      // practice it is case-insensitive)
      const normalizedAddress = address.toLowerCase();
      this.logger.debug(
        {
          address: normalizedAddress,
        },
        `Checking address`,
      );
      return await withRetry(
        () => this.fetchAddressSanctionStatus(normalizedAddress),
        this.retryConfig,
      );
    } catch (error) {
      // Do not allow access in case of network errors, timeouts, etc.
      this.logger.error(
        {
          address,
          error,
        },
        `Error checking address after retries - failing closed for security`,
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
