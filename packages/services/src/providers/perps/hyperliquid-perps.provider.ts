import * as Sentry from "@sentry/node";
import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { Decimal } from "decimal.js";
import { Logger } from "pino";

import {
  CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
} from "../../lib/circuit-breaker.js";
import {
  ClosedPositionFill,
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
  Transfer,
} from "../../types/perps.js";

/**
 * Hyperliquid API response types
 */
interface HyperliquidClearinghouseState {
  assetPositions: Array<{
    position: {
      coin: string;
      szi: string;
      entryPx: string;
      leverage: {
        type: "isolated" | "cross";
        value: number;
      };
      marginUsed: string;
      maxLeverage: number;
      liquidationPx: string | null;
      positionValue: string;
      returnOnEquity: string;
      unrealizedPnl: string;
      cumFunding: {
        allTime: string;
        sinceOpen: string;
        sinceChange: string;
      };
    };
    type: "oneWay";
  }>;
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  time: number;
}

interface HyperliquidUserFill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
  builderFee: string | null; // Always present, null if 0
  cloid: string | null;
  twapId?: string | null;
}

interface HyperliquidLedgerUpdate {
  time: number;
  hash: string;
  delta: {
    type:
      | "deposit"
      | "withdraw"
      | "subAccountTransfer"
      | "liquidation"
      | "vaultCreate"
      | "vaultDisbursement";
    // Either usdc (for USDC) or amount + token (for other assets)
    usdc?: string; // For USDC transactions
    amount?: string; // For non-USDC assets
    token?: string; // Asset name when amount is used (e.g., "BTC", "ETH", "SOL")
    user?: string; // For transfers: the other party
    destination?: string; // For transfers: where funds went
    fee?: string; // Withdrawal fee
    nonce?: number; // Withdrawal transaction nonce
    toPerp?: boolean; // SubAccountTransfer: whether transfer is to perp account
  };
}

/**
 * API request types for Hyperliquid
 */
interface HyperliquidApiRequest {
  type: string;
  user?: string;
  startTime?: number;
  endTime?: number;
}

interface AllMidsResponse {
  [coin: string]: string;
}

/**
 * Hyperliquid implementation of the perps data provider interface
 *
 * Key characteristics:
 * - DEX (decentralized exchange) running on custom L1 blockchain
 * - All data is on-chain with sub-second finality
 * - Requires calculation of some metrics from raw data
 * - Uses POST requests to single /info endpoint
 * - No authentication required for read operations
 *
 * Known Limitations:
 * - Position open timestamps are not provided by the Hyperliquid API
 *   (clearinghouseState only returns current state without historical timestamps)
 *   Our system tracks when we first discovered each position instead
 * - Hyperliquid only provides net positions per asset (not individual position lifecycles)
 * - Position IDs are deterministically generated from wallet-coin-side-entryPrice combination
 *   Entry price is rounded to nearest dollar to handle minor weighted average fluctuations
 *   Positions reopened at similar prices may reuse the same ID
 * - These limitations do NOT affect competition scoring (which uses portfolio value, not positions)
 */
export class HyperliquidPerpsProvider implements IPerpsDataProvider {
  private readonly baseUrl: string;
  private readonly axiosInstance: AxiosInstance;
  private readonly logger: Logger;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly SAMPLING_RATE = 0.01; // 1% of requests for raw data storage
  private readonly circuitBreaker: CircuitBreaker;

  constructor(logger: Logger, apiUrl?: string) {
    this.logger = logger;
    this.baseUrl = apiUrl || "https://api.hyperliquid.xyz";

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.REQUEST_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize circuit breaker with rolling window for better resilience
    // Rolling window prevents single successes from resetting failure tracking
    this.circuitBreaker = createCircuitBreaker("hyperliquid-api", {
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
          `[HyperliquidProvider] Circuit breaker state changed`,
        );

        // Track in Sentry when circuit opens
        if (to === "open") {
          Sentry.captureMessage(
            `Hyperliquid API circuit breaker opened`,
            "warning",
          );
        }
      },
    });

    this.logger.debug(
      `[HyperliquidProvider] Initialized with base URL: ${this.baseUrl}`,
    );
  }

  /**
   * Get provider name for logging
   */
  getName(): string {
    return "Hyperliquid";
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus() {
    const stats = this.circuitBreaker.getStats();
    return {
      provider: "Hyperliquid",
      circuitBreaker: stats,
    };
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Test with a simple allMids request
      const response = await this.makeRequest<AllMidsResponse>({
        type: "allMids",
      });

      return (
        response !== null &&
        response !== undefined &&
        Object.keys(response).length > 0
      );
    } catch (error) {
      this.logger.warn({ error }, "[HyperliquidProvider] Health check failed");
      return false;
    }
  }

  /**
   * Get account summary - transforms Hyperliquid clearinghouse state to generic format
   * @param walletAddress Wallet address to query
   * @param initialCapital Optional initial capital (used since Hyperliquid doesn't track it)
   */
  async getAccountSummary(
    walletAddress: string,
    initialCapital?: number,
  ): Promise<PerpsAccountSummary> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "hyperliquid.api",
      message: `Account summary request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        hasInitialCapital: initialCapital !== undefined,
      },
    });

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching account summary for ${maskedAddress}`,
      );

      // Fetch clearinghouse state
      const clearinghouseState =
        await this.getClearinghouseState(walletAddress);

      // Delegate to internal method that works with clearinghouse state
      return await this.buildAccountSummaryFromState(
        clearinghouseState,
        walletAddress,
        initialCapital,
      );
    } catch (error) {
      const endTime = Date.now() - startTime;

      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getAccountSummary",
          processingTime: endTime,
        },
      });

      this.logger.error(
        {
          error,
          address: maskedAddress,
        },
        "[HyperliquidProvider] Error fetching account summary",
      );
      throw error;
    }
  }

  /**
   * Internal method to build account summary from clearinghouse state
   * This allows reuse when we already have the clearinghouse state
   */
  private async buildAccountSummaryFromState(
    clearinghouseState: HyperliquidClearinghouseState,
    walletAddress: string,
    initialCapital?: number,
  ): Promise<PerpsAccountSummary> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Fetch recent fills to calculate volume and trade counts
    const recentFills = await this.getRecentFills(walletAddress);

    // Calculate metrics from raw data
    const accountValue = new Decimal(
      clearinghouseState.marginSummary.accountValue,
    );
    const totalMarginUsed = new Decimal(
      clearinghouseState.marginSummary.totalMarginUsed,
    );
    const totalRawUsd = new Decimal(
      clearinghouseState.marginSummary.totalRawUsd,
    );

    // Calculate PnL from positions
    let totalUnrealizedPnl = new Decimal(0);
    let totalPositionValue = new Decimal(0);
    let openPositionsCount = 0;

    for (const asset of clearinghouseState.assetPositions) {
      if (asset.position && asset.position.szi !== "0") {
        openPositionsCount++;
        totalUnrealizedPnl = totalUnrealizedPnl.plus(
          asset.position.unrealizedPnl || 0,
        );
        totalPositionValue = totalPositionValue.plus(
          asset.position.positionValue || 0,
        );
      }
    }

    // Calculate volume and fees from recent fills
    const { totalVolume, totalFees, tradeCount, closedPnl } =
      this.calculateTradingStats(recentFills);

    // Use provided initial capital or default to current equity
    // Hyperliquid doesn't track initial capital, so we rely on the caller to provide it
    const totalEquityValue = accountValue.toNumber();
    const effectiveInitialCapital = initialCapital ?? totalEquityValue;

    const summary: PerpsAccountSummary = {
      // Core metrics
      totalEquity: totalEquityValue,
      initialCapital: effectiveInitialCapital,
      availableBalance: totalRawUsd.toNumber(),
      marginUsed: totalMarginUsed.toNumber(),

      // PnL metrics
      totalPnl: totalUnrealizedPnl.plus(closedPnl).toNumber(),
      totalRealizedPnl: closedPnl.toNumber(),
      totalUnrealizedPnl: totalUnrealizedPnl.toNumber(),

      // Trading statistics
      totalVolume: totalVolume.toNumber(),
      totalTrades: tradeCount,
      totalFeesPaid: totalFees.toNumber(),

      // Position counts
      openPositionsCount,
      closedPositionsCount: 0, // Would need historical data
      liquidatedPositionsCount: 0, // Would need to track liquidation events

      // Performance metrics
      // Calculate ROI based on provided initial capital
      roi:
        effectiveInitialCapital > 0
          ? ((totalEquityValue - effectiveInitialCapital) /
              effectiveInitialCapital) *
            100
          : 0,
      roiPercent:
        effectiveInitialCapital > 0
          ? ((totalEquityValue - effectiveInitialCapital) /
              effectiveInitialCapital) *
            100
          : 0,
      averageTradeSize:
        tradeCount > 0 ? totalVolume.dividedBy(tradeCount).toNumber() : 0,

      // Status
      accountStatus: openPositionsCount > 0 ? "active" : "inactive",

      // Raw data storage: Only store for sampled requests (1% by default)
      rawData: undefined,
    };

    // Sampling for raw data storage
    const shouldSample = Math.random() < this.SAMPLING_RATE;

    if (shouldSample) {
      // Store raw data for debugging
      summary.rawData = { clearinghouseState, recentFills };

      // Also send to Sentry for monitoring
      Sentry.captureMessage("Hyperliquid API Response Sample", {
        level: "debug",
        extra: {
          response: { clearinghouseState, recentFills },
          walletAddress: maskedAddress,
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.debug(
        `[HyperliquidProvider] Sampled request - storing raw data for ${maskedAddress}`,
      );
    }

    this.logger.debug(
      `[HyperliquidProvider] Fetched account summary for ${maskedAddress} in ${Date.now() - startTime}ms`,
    );

    return summary;
  }

  /**
   * Get positions - transforms Hyperliquid positions to generic format
   */
  async getPositions(walletAddress: string): Promise<PerpsPosition[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "hyperliquid.api",
      message: `Positions request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
      },
    });

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching positions for ${maskedAddress}`,
      );

      const clearinghouseState =
        await this.getClearinghouseState(walletAddress);

      // Delegate to internal method that works with clearinghouse state
      return await this.buildPositionsFromState(
        clearinghouseState,
        walletAddress,
      );
    } catch (error) {
      const endTime = Date.now() - startTime;

      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getPositions",
          processingTime: endTime,
        },
      });

      this.logger.error(
        {
          error,
          address: maskedAddress,
        },
        "[HyperliquidProvider] Error fetching positions",
      );
      throw error;
    }
  }

  /**
   * Internal method to build positions from clearinghouse state
   * This allows reuse when we already have the clearinghouse state
   */
  private async buildPositionsFromState(
    clearinghouseState: HyperliquidClearinghouseState,
    walletAddress: string,
  ): Promise<PerpsPosition[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Fetch current market prices for all assets
    const marketPrices = await this.getMarketPrices();

    const positions: PerpsPosition[] = [];

    for (const asset of clearinghouseState.assetPositions) {
      const pos = asset.position;

      // Skip if no position (size is 0)
      if (!pos || pos.szi === "0") {
        continue;
      }

      const size = new Decimal(pos.szi);
      const isLong = size.isPositive();

      // Get current price from market data or calculate from position data
      const currentPrice = this.getCurrentPrice(pos, marketPrices);

      // Generate a deterministic ID based on wallet, coin, side, and entry price
      // Round entry price to nearest dollar to handle minor price variations
      // This helps distinguish between different position entries while avoiding duplicates
      // from minor price fluctuations in the weighted average
      const entryPriceRounded = Math.round(new Decimal(pos.entryPx).toNumber());
      const positionIdentifier = `${walletAddress.toLowerCase()}-${pos.coin}-${isLong ? "long" : "short"}-${entryPriceRounded}`;

      // Create a shorter, more readable hash
      const positionId = crypto
        .createHash("sha256")
        .update(positionIdentifier)
        .digest("hex")
        .substring(0, 16); // Use first 16 chars for readability

      positions.push({
        // Identifiers (deterministic based on wallet-coin-side combination)
        providerPositionId: positionId,
        providerTradeId: undefined,

        // Position details
        symbol: pos.coin,
        side: isLong ? "long" : "short",
        positionSizeUsd: new Decimal(pos.positionValue).abs().toNumber(),
        leverage: pos.leverage.value,
        collateralAmount: new Decimal(pos.marginUsed).toNumber(),

        // Prices
        entryPrice: new Decimal(pos.entryPx).toNumber(),
        currentPrice,
        liquidationPrice: pos.liquidationPx
          ? new Decimal(pos.liquidationPx).toNumber()
          : undefined,

        // PnL
        pnlUsdValue: new Decimal(pos.unrealizedPnl).toNumber(),
        pnlPercentage: new Decimal(pos.returnOnEquity).times(100).toNumber(),

        // Status (Hyperliquid only returns open positions in clearinghouse state)
        status: "Open",

        // Timestamps (see class-level JSDoc for limitation details)
        openedAt: undefined, // Hyperliquid API doesn't provide position open time
        lastUpdatedAt: new Date(),
        closedAt: undefined,
      });
    }

    this.logger.debug(
      `[HyperliquidProvider] Fetched ${positions.length} positions for ${maskedAddress} in ${Date.now() - startTime}ms`,
    );

    return positions;
  }

  /**
   * Batch fetch account summary and positions with a single clearinghouse state call
   * Avoids duplicate API calls
   */
  async getAccountDataBatch(
    walletAddress: string,
    initialCapital?: number,
  ): Promise<{
    accountSummary: PerpsAccountSummary;
    positions: PerpsPosition[];
  }> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "hyperliquid.api",
      message: `Account data batch request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        hasInitialCapital: initialCapital !== undefined,
      },
    });

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching account data batch for ${maskedAddress}`,
      );

      // Fetch clearinghouse state once
      const clearinghouseState =
        await this.getClearinghouseState(walletAddress);

      // Build both account summary and positions from the same state
      const [accountSummary, positions] = await Promise.all([
        this.buildAccountSummaryFromState(
          clearinghouseState,
          walletAddress,
          initialCapital,
        ),
        this.buildPositionsFromState(clearinghouseState, walletAddress),
      ]);

      this.logger.debug(
        `[HyperliquidProvider] Fetched account data batch for ${maskedAddress} in ${Date.now() - startTime}ms`,
      );

      return { accountSummary, positions };
    } catch (error) {
      const endTime = Date.now() - startTime;

      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getAccountDataBatch",
          processingTime: endTime,
        },
      });

      this.logger.error(
        {
          error,
          address: maskedAddress,
        },
        "[HyperliquidProvider] Error fetching account data batch",
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
      category: "hyperliquid.api",
      message: `Transfer history request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        since: since.toISOString(),
      },
    });

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching transfers for ${maskedAddress} since ${since.toISOString()}`,
      );

      const response = await this.makeRequest<HyperliquidLedgerUpdate[]>({
        type: "userNonFundingLedgerUpdates",
        user: walletAddress,
        startTime: since.getTime(),
        endTime: Date.now(),
      });

      if (!response || !Array.isArray(response)) {
        return [];
      }

      // Transform to generic transfer format
      const transfers: Transfer[] = [];

      for (const update of response) {
        const { type } = update.delta;

        // Track only deposits and withdrawals (skip subAccountTransfers as they're internal)
        if (type === "deposit" || type === "withdraw") {
          // Determine amount and asset based on field presence
          let amount: number;
          let asset: string;

          if (update.delta.usdc !== undefined) {
            // USDC transfer
            amount = Math.abs(new Decimal(update.delta.usdc).toNumber());
            asset = "USDC";
          } else if (
            update.delta.amount !== undefined &&
            update.delta.token !== undefined
          ) {
            // Other asset transfer (BTC, ETH, SOL, etc.)
            amount = Math.abs(new Decimal(update.delta.amount).toNumber());
            asset = update.delta.token;
          } else {
            // Unknown format, skip
            this.logger.warn(
              `[HyperliquidProvider] Unknown transfer format: ${JSON.stringify(update.delta)}`,
            );
            continue;
          }

          transfers.push({
            type: type,
            amount: amount,
            asset: asset,
            from: type === "deposit" ? "external" : walletAddress,
            to: type === "withdraw" ? "external" : walletAddress,
            timestamp: new Date(update.time),
            txHash: update.hash,
            chainId: 1, // Hyperliquid L1
          });
        }
        // Note: We skip subAccountTransfer as they are internal transfers
        // between sub-accounts and not relevant for self-funding detection
      }

      this.logger.debug(
        `[HyperliquidProvider] Fetched ${transfers.length} transfers for ${maskedAddress} in ${Date.now() - startTime}ms`,
      );

      return transfers;
    } catch (error) {
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
          error,
          address: maskedAddress,
        },
        "[HyperliquidProvider] Error fetching transfers",
      );
      // Don't throw - transfer history is optional for self-funding detection
      return [];
    }
  }

  /**
   * Fetch clearinghouse state from Hyperliquid API
   */
  private async getClearinghouseState(
    walletAddress: string,
  ): Promise<HyperliquidClearinghouseState> {
    return this.makeRequest<HyperliquidClearinghouseState>({
      type: "clearinghouseState",
      user: walletAddress,
    });
  }

  /**
   * Fetch current market prices for all assets
   */
  private async getMarketPrices(): Promise<Map<string, number>> {
    try {
      const response = await this.makeRequest<Record<string, string>>({
        type: "allMids",
      });

      const priceMap = new Map<string, number>();

      if (response) {
        for (const [coin, price] of Object.entries(response)) {
          priceMap.set(coin, new Decimal(price).toNumber());
        }
      }

      return priceMap;
    } catch (error) {
      this.logger.warn(
        { error },
        "[HyperliquidProvider] Failed to fetch market prices",
      );
      return new Map();
    }
  }

  /**
   * Get current price for a position
   * Uses market data if available, otherwise calculates from position data
   */
  private getCurrentPrice(
    position: HyperliquidClearinghouseState["assetPositions"][0]["position"],
    marketPrices: Map<string, number>,
  ): number {
    // First try to get from market data (allMids endpoint)
    const marketPrice = marketPrices.get(position.coin);
    if (marketPrice) {
      return marketPrice;
    }

    // Fallback: Estimate from position data
    const entryPrice = new Decimal(position.entryPx);
    const unrealizedPnl = new Decimal(position.unrealizedPnl || 0);
    const size = new Decimal(position.szi).abs();

    if (size.isZero()) {
      return entryPrice.toNumber();
    }

    // Calculate implied current price from P&L
    // For long: currentPrice = entryPrice + (pnl / size)
    // For short: currentPrice = entryPrice - (pnl / size)
    const isLong = new Decimal(position.szi).isPositive();
    const pnlPerUnit = unrealizedPnl.dividedBy(size);

    const currentPrice = isLong
      ? entryPrice.plus(pnlPerUnit)
      : entryPrice.minus(pnlPerUnit);

    this.logger.warn(
      `[HyperliquidProvider] Using estimated price for ${position.coin}: ${currentPrice.toFixed(2)}`,
    );

    return currentPrice.toNumber();
  }

  /**
   * Fetch recent fills for volume calculation
   */
  private async getRecentFills(
    walletAddress: string,
  ): Promise<HyperliquidUserFill[]> {
    // Get fills from last 7 days for volume calculation
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const response = await this.makeRequest<HyperliquidUserFill[]>({
      type: "userFillsByTime",
      user: walletAddress,
      startTime: sevenDaysAgo,
    });

    return response || [];
  }

  /**
   * Calculate trading statistics from fills
   */
  private calculateTradingStats(fills: HyperliquidUserFill[]): {
    totalVolume: Decimal;
    totalFees: Decimal;
    tradeCount: number;
    closedPnl: Decimal;
  } {
    let totalVolume = new Decimal(0);
    let totalFees = new Decimal(0);
    let closedPnl = new Decimal(0);

    for (const fill of fills) {
      const price = new Decimal(fill.px);
      const size = new Decimal(fill.sz);
      const volume = price.times(size);

      totalVolume = totalVolume.plus(volume);
      totalFees = totalFees.plus(fill.fee || 0);
      closedPnl = closedPnl.plus(fill.closedPnl || 0);
    }

    return {
      totalVolume,
      totalFees,
      tradeCount: fills.length,
      closedPnl,
    };
  }

  /**
   * Make HTTP request to Hyperliquid API with circuit breaker protection
   */
  private async makeRequest<T>(body: HyperliquidApiRequest): Promise<T> {
    try {
      // Wrap the entire retry logic in the circuit breaker
      return await this.circuitBreaker.execute(async () => {
        return await this.makeRequestWithRetry<T>(body);
      });
    } catch (error) {
      // Enhance circuit breaker errors with more context
      if (error instanceof CircuitOpenError) {
        this.logger.error(
          `[HyperliquidProvider] Circuit breaker is open - too many failures`,
        );
        throw new Error(
          `Hyperliquid API temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequestWithRetry<T>(
    body: HyperliquidApiRequest,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.post<T>("/info", body);
        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          // Don't retry on client errors (4xx)
          if (status && status >= 400 && status < 500) {
            this.logger.error(
              {
                status,
                data: error.response?.data,
              },
              "[HyperliquidProvider] Client error",
            );
            throw error;
          }

          this.logger.warn(
            {
              attempt,
              maxRetries: this.MAX_RETRIES,
              message: error.message,
            },
            "[HyperliquidProvider] Request failed",
          );
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt;
          this.logger.debug(
            `[HyperliquidProvider] Retrying after ${delay}ms...`,
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Get closed position fills within a time range
   * Fetches fills with non-zero closedPnl which represent position closures
   * @param walletAddress Wallet address to query
   * @param since Start of time range (inclusive)
   * @param until End of time range (inclusive)
   * @returns Array of closed position fills
   */
  async getClosedPositionFills(
    walletAddress: string,
    since: Date,
    until: Date,
  ): Promise<ClosedPositionFill[]> {
    const maskedAddress = this.maskWalletAddress(walletAddress);
    this.logger.debug(
      `[HyperliquidProvider] Fetching closed fills for ${maskedAddress} from ${since.toISOString()} to ${until.toISOString()}`,
    );

    const startTime = since.getTime();
    const endTime = until.getTime();

    const response = await this.makeRequest<HyperliquidUserFill[]>({
      type: "userFillsByTime",
      user: walletAddress,
      startTime,
      endTime,
    });

    if (!response || response.length === 0) {
      this.logger.debug(
        `[HyperliquidProvider] No fills found for ${maskedAddress}`,
      );
      return [];
    }

    // Filter to fills with non-zero closedPnl (position closures)
    const closedFills = response.filter((fill) => {
      const closedPnl = parseFloat(fill.closedPnl);
      return closedPnl !== 0;
    });

    this.logger.debug(
      `[HyperliquidProvider] Found ${closedFills.length} closed fills out of ${response.length} total fills`,
    );

    // Transform to ClosedPositionFill format
    return closedFills.map((fill): ClosedPositionFill => {
      // Parse direction from fill.dir (e.g., "Close Short", "Close Long")
      const isLong = fill.dir.toLowerCase().includes("long");
      const side: "long" | "short" = isLong ? "long" : "short";

      // Calculate USD value: native size * close price
      const nativeSize = new Decimal(fill.sz).abs();
      const closePrice = new Decimal(fill.px);
      const positionSizeUsd = nativeSize.times(closePrice).toNumber();

      return {
        providerFillId: `${fill.hash}-${fill.tid}`,
        symbol: fill.coin,
        side,
        positionSizeUsd,
        closePrice: closePrice.toNumber(),
        closedPnl: new Decimal(fill.closedPnl).toNumber(),
        closedAt: new Date(fill.time),
        fee: fill.fee ? new Decimal(fill.fee).toNumber() : undefined,
      };
    });
  }

  /**
   * Mask wallet address for privacy in logs
   */
  private maskWalletAddress(address: string): string {
    if (!address || address.length < 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Delay helper for retries
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
