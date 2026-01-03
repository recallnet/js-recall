import * as Sentry from "@sentry/node";
import axios, { AxiosInstance } from "axios";
import { Logger } from "pino";

import {
  CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
} from "../../lib/circuit-breaker.js";
import {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
  Transfer,
} from "../../types/perps.js";

/**
 * Symphony API response types
 * Based on confirmed API contract (2025-01)
 */
export interface SymphonyPositionResponse {
  success: boolean; // Success responses still have this field
  data: {
    userAddress: string;
    accountSummary: {
      totalEquity: number;
      initialCapital: number;
      totalUnrealizedPnl: number;
      totalRealizedPnl: number;
      totalPnl: number;
      totalFeesPaid: number;
      availableBalance: number;
      marginUsed: number;
      totalVolume: number;
      totalTrades: number;
      accountStatus: string;
      openPositionsCount: number;
      closedPositionsCount: number;
      liquidatedPositionsCount: number;
      // Performance is ALWAYS present (never null), with 0 values for new accounts
      performance: {
        roi: number;
        roiPercent: number;
        totalTrades: number;
        averageTradeSize: number;
      };
    };
    openPositions: SymphonyPosition[];
    // Note: Symphony only returns openPositions, not closed or liquidated
    lastUpdated: string; // Format: "2025-09-12T20:49:15.000Z"
    cacheExpiresAt: string; // Format: "2025-09-12T20:49:15.000Z"
  };
  processingTime: number;
}

export interface SymphonyErrorResponse {
  status: "error";
  error: {
    message: string;
    details: string;
  };
}

export interface SymphonyPosition {
  protocolPositionHash: string;
  symphonyPositionHash: string;
  userAddress: string;
  isLong: boolean;
  leverage: number;
  positionSize: number;
  entryPrice: number;
  tpPrice?: number | null;
  slPrice?: number | null;
  currentPrice: number;
  liquidationPrice?: number | null;
  collateralAmount: number;
  pnlPercentage: number;
  pnlUSDValue: number;
  asset: string;
  createdTimeStamp: string;
  lastUpdatedTimestamp?: string;
  closedAt?: string;
  status: string;
}

export interface SymphonyTransferResponse {
  success: boolean;
  count: number;
  successful: number[];
  failed: number[];
  transfers: SymphonyTransfer[];
}

export interface SymphonyTransfer {
  type: "deposit" | "withdraw";
  amount: number;
  asset: string;
  from: string;
  to: string;
  timestamp: string;
  txHash: string;
  chainId: number;
  // Note: Equity snapshots not available from Symphony
  // Competition rules prohibit mid-competition transfers
}

/**
 * Symphony implementation of the perps data provider interface
 * This is an "all-in-one" provider that supplies complete data including:
 * - Position details with current prices
 * - Pre-calculated PnL
 * - Account equity calculations
 *
 * Note: Symphony API endpoints do not require authentication
 *
 * Rate Limiting:
 * - Symphony API has a 200 req/min limit
 * - We enforce 100ms between requests (max 600 req/min) to stay well below this
 * - Can request IP whitelisting from Symphony if needed
 *
 * Raw Data Storage Strategy (addressing high traffic bursts):
 * - Raw API responses are only stored for 1% of requests (via sampling)
 * - This prevents database bloat during high traffic periods
 * - The same sampling decision controls both raw data storage and Sentry reporting
 * - Sampled data provides debugging capability without overwhelming storage
 * - For production issues: Can be analyzed after the fact via stored samples
 */
export class SymphonyPerpsProvider implements IPerpsDataProvider {
  private readonly baseUrl: string;
  private readonly axiosInstance: AxiosInstance;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly SAMPLING_RATE = 0.01; // 1% of requests for both Sentry and raw data storage
  private logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(logger: Logger, apiUrl?: string) {
    this.logger = logger;
    // Use provided URL or fall back to config/environment
    this.baseUrl = apiUrl || "https://api.symphony.io";

    // Create axios instance with defaults
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.REQUEST_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize circuit breaker with rolling window for better resilience
    // Rolling window prevents single successes from resetting failure tracking
    this.circuitBreaker = createCircuitBreaker("symphony-api", {
      rollingWindowDuration: 30000, // 30 second window
      errorThresholdPercentage: 50, // Open if >50% requests fail in window
      failureThreshold: 5, // Also open after 5 consecutive failures
      resetTimeout: 15000, // Try again after 15 seconds
      successThreshold: 3, // Need 3 successful calls to close
      // Don't set requestTimeout - let axios handle timeouts (30s)
      // Circuit breaker should track failures, not enforce timeouts
      logger: this.logger,
      onStateChange: (from, to) => {
        this.logger.warn(
          { from, to },
          `[SymphonyProvider] Circuit breaker state changed`,
        );

        // Track in Sentry when circuit opens
        if (to === "open") {
          Sentry.captureMessage(
            `Symphony API circuit breaker opened`,
            "warning",
          );
        }
      },
    });

    this.logger.debug(
      `[SymphonyProvider] Initialized with base URL: ${this.baseUrl}`,
    );
  }

  /**
   * Mask wallet address for privacy in logs
   * Shows first 6 and last 4 characters: 0x1234...abcd
   * Keeps full address for debugging/traceability when needed
   */
  private maskWalletAddress(address: string): string {
    if (!address || address.length < 10) {
      return address; // Return as-is if invalid
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get provider name for logging
   */
  getName(): string {
    return "Symphony";
  }

  // Note: getClosedPositionFills is intentionally not implemented for Symphony.
  // Symphony's API does not provide historical fills, so positions that close
  // between syncs cannot be recovered. The data processor checks for method
  // availability before calling, so this limitation is handled gracefully.

  /**
   * Get circuit breaker health status
   */
  getHealthStatus() {
    const stats = this.circuitBreaker.getStats();
    return {
      provider: "Symphony",
      circuitBreaker: stats,
    };
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Since Symphony only provides data for registered addresses,
      // we check API availability by testing the endpoint exists
      // A 404 for an unknown address still indicates the API is healthy
      const response = await this.axiosInstance.get("/agent/user-performance", {
        params: { userAddress: "0x0000000000000000000000000000000000000001" },
        timeout: 5000,
        validateStatus: (status) => {
          // Accept any status that indicates the server is responding
          // 404 = address not found (expected for unregistered address)
          // 200 = success (unlikely for test address)
          // 400 = bad request (API is still working)
          return status < 500;
        },
      });

      // If we get any response from the server (not 5xx), it's healthy
      return response.status < 500;
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        `[SymphonyProvider] Health check failed`,
      );
      return false;
    }
  }

  /**
   * Rate limiting helper
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await this.delay(delay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Type guard to check if response is a Symphony error
   */
  private isSymphonyError(data: unknown): data is SymphonyErrorResponse {
    return (
      typeof data === "object" &&
      data !== null &&
      "status" in data &&
      (data as { status: unknown }).status === "error" &&
      "error" in data
    );
  }

  /**
   * Delay helper for retries
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get account summary - transforms Symphony response to generic format
   * @param walletAddress Wallet address to query
   * @param initialCapital Optional initial capital for validation (Symphony tracks this internally)
   */
  async getAccountSummary(
    walletAddress: string,
    initialCapital?: number,
  ): Promise<PerpsAccountSummary> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Log if initial capital is provided (for debugging provider compatibility)
    // Symphony tracks its own initial capital, so this parameter is ignored
    if (initialCapital !== undefined) {
      this.logger.debug(
        {
          address: maskedAddress,
          providedInitialCapital: initialCapital,
        },
        "[SymphonyProvider] Initial capital provided but will use Symphony's tracked value",
      );
    }

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "symphony.api",
      message: `Account summary request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
      },
    });

    try {
      await this.enforceRateLimit();

      this.logger.debug(
        {
          walletAddress: maskedAddress,
        },
        `[SymphonyProvider] Fetching account summary`,
      );

      const data = await this.fetchPositionData(walletAddress);

      // Validate and provide defaults for missing required fields
      const as = data.accountSummary;

      // Helper to check for missing fields in a type-safe way
      const isFieldMissing = (
        obj: Record<string, unknown>,
        field: string,
      ): boolean => {
        return obj[field] === undefined || obj[field] === null;
      };

      // Log warning if critical fields are missing
      const criticalFields = [
        "totalEquity",
        "initialCapital",
        "totalPnl",
      ] as const;
      const missingFields = criticalFields.filter((field) =>
        isFieldMissing(as, field),
      );

      if (missingFields.length > 0) {
        this.logger.warn(
          {
            address: this.maskWalletAddress(walletAddress),
            missingFields,
          },
          "[SymphonyProvider] Missing critical fields. Using 0 as default",
        );
      }

      const summary: PerpsAccountSummary = {
        // Core metrics - use 0 as default for missing numeric values
        totalEquity: as.totalEquity ?? 0,
        initialCapital: as.initialCapital ?? 0,
        availableBalance: as.availableBalance ?? 0,
        marginUsed: as.marginUsed ?? 0,

        // PnL metrics - use 0 as default
        totalPnl: as.totalPnl ?? 0,
        totalRealizedPnl: as.totalRealizedPnl ?? 0,
        totalUnrealizedPnl: as.totalUnrealizedPnl ?? 0,

        // Trading statistics - use 0 as default
        totalVolume: as.totalVolume ?? 0,
        totalTrades: as.totalTrades ?? 0,
        totalFeesPaid: as.totalFeesPaid ?? 0,

        // Position counts - use 0 as default
        openPositionsCount: as.openPositionsCount ?? 0,
        closedPositionsCount: as.closedPositionsCount ?? 0,
        liquidatedPositionsCount: as.liquidatedPositionsCount ?? 0,

        // Performance metrics - always present with 0 defaults for new accounts
        roi: as.performance.roi,
        roiPercent: as.performance.roiPercent,
        averageTradeSize: as.performance.averageTradeSize,

        // Status - use 'unknown' as default
        accountStatus: as.accountStatus ?? "unknown",

        // Raw data storage: Only store for sampled requests (1% by default)
        // This prevents overwhelming the database during high traffic bursts
        rawData: undefined,
      };

      // Combined sampling for both Sentry and raw data storage
      // This ensures we only store raw data when we're also sending to Sentry
      const shouldSample = Math.random() < this.SAMPLING_RATE;

      if (shouldSample) {
        // Store raw data in the response
        summary.rawData = data;

        // Also send to Sentry for monitoring
        Sentry.captureMessage("Symphony API Response Sample", {
          level: "debug",
          extra: {
            response: data,
            walletAddress: maskedAddress,
            processingTime: Date.now() - startTime,
          },
        });
      }

      this.logger.debug(
        {
          address: maskedAddress,
          processingTime: Date.now() - startTime,
        },
        "[SymphonyProvider] Fetched account summary",
      );

      return summary;
    } catch (error) {
      // Add error to Sentry with breadcrumb context
      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getAccountSummary",
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.error(
        {
          walletAddress: maskedAddress,
          error: error instanceof Error ? error.message : String(error),
        },
        `[SymphonyProvider] Error fetching account summary`,
      );
      throw error;
    }
  }

  /**
   * Get positions - transforms Symphony positions to generic format
   */
  async getPositions(walletAddress: string): Promise<PerpsPosition[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "symphony.api",
      message: `Positions request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
      },
    });

    try {
      await this.enforceRateLimit();

      this.logger.debug(
        { address: maskedAddress },
        "[SymphonyProvider] Fetching positions",
      );

      const data = await this.fetchPositionData(walletAddress);

      // Symphony only returns open positions in this endpoint
      // To get closed/liquidated positions, we'd need a different endpoint or historical data
      const positions = this.transformPositions(data.openPositions, "Open");

      this.logger.debug(
        {
          address: maskedAddress,
          positionCount: positions.length,
          processingTime: Date.now() - startTime,
        },
        "[SymphonyProvider] Fetched open positions",
      );

      return positions;
    } catch (error) {
      // Add error to Sentry with breadcrumb context
      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getPositions",
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.error(
        {
          walletAddress: maskedAddress,
          error: error instanceof Error ? error.message : String(error),
        },
        `[SymphonyProvider] Error fetching positions`,
      );
      throw error;
    }
  }

  /**
   * Get transfer history for self-funding detection
   */
  async getTransferHistory(
    walletAddress: string,
    since: Date,
  ): Promise<Transfer[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "symphony.api",
      message: `Transfer history request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        since: since.toISOString(),
      },
    });

    try {
      await this.enforceRateLimit();

      this.logger.debug(
        {
          address: maskedAddress,
          since: since.toISOString(),
        },
        "[SymphonyProvider] Fetching transfers",
      );

      const response = await this.makeRequest<SymphonyTransferResponse>(
        "/utils/transfers",
        {
          walletAddress,
          since: since.toISOString(),
        },
      );

      if (!response.success) {
        this.logger.warn(
          { address: maskedAddress },
          "[SymphonyProvider] Transfer fetch unsuccessful",
        );
        return [];
      }

      // Transform to generic transfer format
      // Note: Mid-competition transfers are now prohibited by competition rules
      const transfers: Transfer[] = response.transfers.map((t) => ({
        type: t.type,
        amount: t.amount,
        asset: t.asset,
        from: t.from,
        to: t.to,
        timestamp: new Date(t.timestamp),
        txHash: t.txHash,
        chainId: t.chainId,
      }));

      this.logger.debug(
        {
          address: maskedAddress,
          transferCount: transfers.length,
          processingTime: Date.now() - startTime,
        },
        "[SymphonyProvider] Fetched transfers",
      );

      return transfers;
    } catch (error) {
      // Add error to Sentry with breadcrumb context
      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getTransferHistory",
          since: since.toISOString(),
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.error(
        {
          walletAddress: maskedAddress,
          error: error instanceof Error ? error.message : String(error),
        },
        `[SymphonyProvider] Error fetching transfers`,
      );
      // Don't throw - transfer history is optional for self-funding detection
      return [];
    }
  }

  /**
   * Fetch position data from Symphony API with retries
   */
  private async fetchPositionData(
    walletAddress: string,
  ): Promise<SymphonyPositionResponse["data"]> {
    const response = await this.makeRequest<SymphonyPositionResponse>(
      "/agent/user-performance",
      { userAddress: walletAddress },
    );

    if (!response.success) {
      throw new Error(
        `Symphony API returned unsuccessful response for ${this.maskWalletAddress(walletAddress)}`,
      );
    }

    return response.data;
  }

  /**
   * Make HTTP request with circuit breaker protection
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T> {
    try {
      // Wrap the entire retry logic in the circuit breaker
      return await this.circuitBreaker.execute(async () => {
        return await this.makeRequestWithRetry<T>(endpoint, params);
      });
    } catch (error) {
      // Enhance circuit breaker errors with more context
      if (error instanceof CircuitOpenError) {
        this.logger.error(
          `[SymphonyProvider] Circuit breaker is open - too many failures`,
        );
        throw new Error(
          `Symphony API temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequestWithRetry<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.get<
          T | SymphonyErrorResponse
        >(endpoint, {
          params,
        });

        // Check if response is an error using Symphony's format
        const data = response.data as T | SymphonyErrorResponse;
        if (this.isSymphonyError(data)) {
          throw new Error(
            `Symphony API error: ${data.error.message} - ${data.error.details}`,
          );
        }

        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          // Don't retry on client errors (4xx)
          if (status && status >= 400 && status < 500) {
            // Check if the error response follows Symphony's error format
            const errorData = error.response?.data as
              | SymphonyErrorResponse
              | undefined;
            if (errorData?.status === "error") {
              this.logger.error(
                {
                  status,
                  error: errorData.error.message,
                  details: errorData.error.details,
                },
                `[SymphonyProvider] Client error (${status})`,
              );
            } else {
              this.logger.error(
                {
                  status,
                  data: error.response?.data,
                },
                `[SymphonyProvider] Client error (${status})`,
              );
            }
            throw error;
          }

          this.logger.warn(
            {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
            },
            `[SymphonyProvider] Request failed (attempt ${attempt}/${this.MAX_RETRIES})`,
          );
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt;
          this.logger.debug(
            { delay },
            "[SymphonyProvider] Retrying after delay",
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Transform Symphony positions to generic format
   */
  private transformPositions(
    positions: SymphonyPosition[],
    status: "Open" | "Closed" | "Liquidated",
  ): PerpsPosition[] {
    return positions.map((pos) => {
      // Validate and parse dates
      const openedAt = this.parseDate(pos.createdTimeStamp, "createdTimeStamp");
      if (!openedAt) {
        throw new Error(
          `Invalid createdTimeStamp for position ${pos.symphonyPositionHash}: ${pos.createdTimeStamp}`,
        );
      }

      const lastUpdatedAt = pos.lastUpdatedTimestamp
        ? this.parseDate(pos.lastUpdatedTimestamp, "lastUpdatedTimestamp")
        : undefined;

      const closedAt = pos.closedAt
        ? this.parseDate(pos.closedAt, "closedAt")
        : undefined;

      return {
        // Identifiers
        providerPositionId: pos.symphonyPositionHash,
        providerTradeId: pos.protocolPositionHash,

        // Position details
        symbol: pos.asset,
        side: pos.isLong ? ("long" as const) : ("short" as const),
        positionSizeUsd: pos.positionSize,
        leverage: pos.leverage,
        collateralAmount: pos.collateralAmount,

        // Prices
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        liquidationPrice: pos.liquidationPrice || undefined,

        // PnL
        pnlUsdValue: pos.pnlUSDValue,
        pnlPercentage: pos.pnlPercentage,

        // Status
        status,

        // Timestamps
        openedAt,
        lastUpdatedAt,
        closedAt,
      };
    });
  }

  /**
   * Safely parse a date string
   */
  private parseDate(
    dateStr: string | undefined | null,
    fieldName: string,
  ): Date | undefined {
    if (!dateStr) {
      return undefined;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      this.logger.warn(
        {
          fieldName,
          dateStr,
        },
        "[SymphonyProvider] Invalid date format",
      );
      return undefined;
    }

    return date;
  }
}
