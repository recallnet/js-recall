import { Logger } from "pino";

import type { SanctionedWalletRepository } from "@recallnet/db/repositories/sanctioned-wallet";

import { WalletWatchlistMode } from "../types/index.js";
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
    mode: WalletWatchlistMode;
    apiUrl: string;
    apiKey: string;
  };
}

/**
 * Wallet Address Watchlist
 * Checks wallet addresses against sanctions list using database, external API, hybrid mode, or no checks
 */
export class WalletWatchlist {
  private readonly mode: WalletWatchlistMode;
  private readonly apiKey: string;
  private baseUrl: string = "https://public.chainalysis.com/api/v1/address";
  private readonly requestTimeout = 10_000;
  private readonly logger: Logger;
  private readonly dbRepository?: SanctionedWalletRepository;

  constructor(
    config: WalletWatchlistConfig,
    logger: Logger,
    dbRepository?: SanctionedWalletRepository,
    readonly retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  ) {
    this.mode = config.watchlist.mode;
    this.apiKey = config.watchlist.apiKey;
    this.baseUrl = config.watchlist.apiUrl;
    this.logger = logger;
    this.dbRepository = dbRepository;

    // Note: Chainalysis throws a 403 upon rate limiting
    const isRetryable = (error: unknown) => {
      const err = error as MaybeHttpError;
      return err.response?.status === 403;
    };
    this.retryConfig = { ...retryConfig, isRetryable };

    this.logger.info(
      {
        mode: this.mode,
        baseUrl: this.baseUrl,
        apiConfigured: this.isApiConfigured(),
        dbConfigured: !!this.dbRepository,
      },
      "WalletWatchlist initialized",
    );

    switch (this.mode) {
      case "none":
        this.logger.info("Watchlist checks disabled (mode: none)");
        break;

      case "api":
        if (!this.isApiConfigured()) {
          throw new Error(
            "Watchlist API mode requires apiKey to be configured",
          );
        }
        break;

      case "database":
        if (!this.dbRepository) {
          throw new Error(
            "Watchlist database mode requires dbRepository to be provided",
          );
        }
        break;

      // Note: hybrid needs at least one of: external API or database queries
      case "hybrid":
        if (!this.isApiConfigured() && !this.dbRepository) {
          throw new Error(
            "Watchlist hybrid mode requires API key or database connection",
          );
        }
        if (!this.isApiConfigured()) {
          this.logger.warn(
            "Watchlist hybrid mode: API not configured, using database only",
          );
        }
        if (!this.dbRepository) {
          this.logger.warn(
            "Watchlist hybrid mode: Database not configured, using API only",
          );
        }
        break;

      default: {
        const _exhaustive: never = this.mode;
        throw new Error(`Unhandled watchlist mode: ${_exhaustive}`);
      }
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
            source: "api",
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
   * Check address against database
   * @param normalizedAddress The normalized (lowercase) wallet address
   * @returns Promise<boolean> - true if sanctioned, false if not found
   */
  private async checkDatabase(normalizedAddress: string): Promise<boolean> {
    if (!this.dbRepository) {
      this.logger.warn("Watchlist database repository not configured");
      return false;
    }

    try {
      const isSanctioned =
        await this.dbRepository.isSanctioned(normalizedAddress);
      if (isSanctioned) {
        this.logger.warn(
          {
            address: normalizedAddress,
            source: "database",
          },
          "SANCTIONED ADDRESS DETECTED",
        );
      }
      return isSanctioned;
    } catch (error) {
      this.logger.error(
        {
          address: normalizedAddress,
          error,
        },
        "Error checking watchlist in database",
      );
      throw error;
    }
  }

  /**
   * Check address against external API
   * @param normalizedAddress The normalized (lowercase) wallet address
   * @returns Promise<boolean> - true if sanctioned, false if clean
   * @throws Error if API is unavailable or network issues
   */
  private async checkApi(normalizedAddress: string): Promise<boolean> {
    if (!this.isApiConfigured()) {
      throw new Error("Watchlist API key not configured");
    }

    return await withRetry(
      () => this.fetchAddressSanctionStatus(normalizedAddress),
      this.retryConfig,
    );
  }

  /**
   * Check if a wallet address is sanctioned
   * @param address The wallet address to check (case-insensitive)
   * @returns Promise<boolean> - true if sanctioned, false if clean (or if checks are disabled)
   * @throws Error if check fails and cannot be satisfied (fail closed for security)
   */
  async isAddressSanctioned(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();
    this.logger.debug(
      {
        address: normalizedAddress,
        mode: this.mode,
      },
      "Watchlist checking address",
    );

    try {
      switch (this.mode) {
        case "none":
          this.logger.debug(
            {
              address: normalizedAddress,
            },
            "Watchlist checks disabled - allowing address",
          );
          return false;

        case "database":
          return await this.checkDatabase(normalizedAddress);

        case "api":
          return await this.checkApi(normalizedAddress);

        // Try API first, and then fallback to database if it fails
        case "hybrid":
          if (this.isApiConfigured()) {
            try {
              return await this.checkApi(normalizedAddress);
            } catch (apiError) {
              this.logger.warn(
                {
                  address: normalizedAddress,
                  error: apiError,
                },
                "Watchlist API check failed, falling back to database",
              );

              return await this.checkDatabase(normalizedAddress);
            }
          } else {
            // API not configured; use database only
            this.logger.debug(
              "Watchlist API not configured in hybrid mode, using database",
            );
            return await this.checkDatabase(normalizedAddress);
          }
      }
    } catch (error) {
      // Fail closed for security
      this.logger.error(
        {
          address: normalizedAddress,
          mode: this.mode,
          error,
        },
        "Error checking address - failing closed for security",
      );
      throw error;
    }
  }

  /**
   * Check if the service is properly configured
   * @returns boolean - true if API key is configured
   */
  isApiConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get service status for health checks
   * @returns object with configuration status
   */
  getStatus() {
    return {
      mode: this.mode,
      apiConfigured: this.isApiConfigured(),
      databaseConfigured: !!this.dbRepository,
      baseUrl: this.baseUrl,
      timeout: this.requestTimeout,
    };
  }
}
