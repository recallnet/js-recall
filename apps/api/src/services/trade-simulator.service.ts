import { v4 as uuidv4 } from "uuid";

import { config, features } from "@/config/index.js";
import {
  count,
  create as createTrade,
  getAgentTrades,
  getCompetitionTrades,
} from "@/database/repositories/trade-repository.js";
import { findByCompetitionId } from "@/database/repositories/trading-constraints-repository.js";
import { InsertTrade, SelectTrade } from "@/database/schema/trading/types.js";
import { serviceLogger } from "@/lib/logger.js";
import { EXEMPT_TOKENS, calculateSlippage } from "@/lib/trade-utils.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { BalanceManager } from "@/services/balance-manager.service.js";
import { PortfolioSnapshotter } from "@/services/index.js";
import { DexScreenerProvider } from "@/services/providers/dexscreener.provider.js";
import { BlockchainType, PriceReport, SpecificChain } from "@/types/index.js";

import { PriceTracker } from "./price-tracker.service.js";

const MIN_TRADE_AMOUNT = 0.000001;

// Interface for trading constraints
interface TradingConstraints {
  minimumPairAgeHours: number;
  minimum24hVolumeUsd: number;
  minimumLiquidityUsd: number;
  minimumFdvUsd: number;
}

// Define an interface for chain options
interface ChainOptions {
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

/**
 * Trade Simulator Service
 * Executes simulated trades between tokens
 */
export class TradeSimulator {
  private balanceManager: BalanceManager;
  private priceTracker: PriceTracker;
  // Cache of recent trades for performance (agentId -> trades)
  private tradeCache: Map<string, SelectTrade[]>;
  // Maximum trade percentage of portfolio value
  private maxTradePercentage: number;
  private portfolioSnapshotter: PortfolioSnapshotter;
  private dexScreenerProvider: DexScreenerProvider;
  // Cache of trading constraints per competition
  private constraintsCache: Map<string, TradingConstraints>;

  constructor(
    balanceManager: BalanceManager,
    priceTracker: PriceTracker,
    portfolioSnapshotter: PortfolioSnapshotter,
  ) {
    this.balanceManager = balanceManager;
    this.priceTracker = priceTracker;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.dexScreenerProvider = new DexScreenerProvider();
    this.tradeCache = new Map();
    this.constraintsCache = new Map();
    // Get the maximum trade percentage from config
    this.maxTradePercentage = config.maxTradePercentage;
  }

  /**
   * Execute a trade between two tokens
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   * @param slippageTolerance Optional slippage tolerance percentage
   * @param chainOptions Optional chain specification for performance optimization
   * @returns Trade object on success, throws ApiError on failure
   */
  async executeTrade(
    agentId: string,
    competitionId: string,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    reason: string,
    slippageTolerance?: number,
    chainOptions?: ChainOptions,
  ): Promise<SelectTrade> {
    try {
      serviceLogger.debug(`\n[TradeSimulator] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Validate basic trade inputs
      this.validateTradeInputs(fromToken, toToken, fromAmount, reason);

      // Resolve chain variables
      const chainInfo = this.resolveChainVariables(
        fromToken,
        toToken,
        chainOptions,
      );

      // Validate cross-chain trading rules
      this.validateCrossChainTrading(chainInfo);

      // Fetch and validate prices
      const { fromPrice, toPrice } = await this.fetchAndValidatePrices(
        fromToken,
        toToken,
        chainInfo,
        competitionId,
      );

      // Calculate the trade using USD values
      const fromValueUSD = fromAmount * fromPrice.price;

      // Get current balance for validation
      const currentBalance = await this.balanceManager.getBalance(
        agentId,
        fromToken,
      );

      // Validate balances and portfolio limits
      await this.validateBalancesAndPortfolio(
        agentId,
        fromToken,
        fromAmount,
        fromValueUSD,
        currentBalance,
      );

      // Calculate trade amounts and exchange rates
      const { toAmount, exchangeRate } = this.calculateTradeAmounts(
        fromAmount,
        fromValueUSD,
        toPrice.price,
        fromToken,
        toToken,
      );

      // Execute the trade and update database
      const result = await this.executeTradeAndUpdateDatabase(
        agentId,
        competitionId,
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        exchangeRate,
        fromValueUSD,
        fromPrice,
        toPrice,
        chainInfo,
        reason,
        currentBalance,
      );

      // Trigger a portfolio snapshot for the trading agent only
      // We run this asynchronously without awaiting to avoid delaying the trade response
      this.portfolioSnapshotter
        .takePortfolioSnapshotForAgent(competitionId, agentId)
        .catch((error) => {
          serviceLogger.error(
            `[TradeSimulator] Error taking portfolio snapshot for agent ${agentId} after trade: ${error.message}`,
          );
        });
      serviceLogger.debug(
        `[TradeSimulator] Portfolio snapshot triggered for agent ${agentId} in competition ${competitionId} after trade`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during trade";
      serviceLogger.error(
        `[TradeSimulator] Trade execution failed:`,
        errorMessage,
      );

      // If it's already an ApiError, re-throw it
      if (error instanceof ApiError) {
        throw error;
      }

      // Otherwise, wrap it in an ApiError
      throw new ApiError(400, errorMessage);
    }
  }

  /**
   * Validates basic trade input parameters
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   * @throws ApiError if validation fails
   */
  private validateTradeInputs(
    fromToken: string,
    toToken: string,
    fromAmount: number,
    reason: string,
  ): void {
    // Validate minimum trade amount
    if (fromAmount < MIN_TRADE_AMOUNT) {
      serviceLogger.debug(
        `[TradeSimulator] Trade amount too small: ${fromAmount}`,
      );
      throw new ApiError(400, "Trade amount too small (minimum: 0.000001)");
    }

    // Validate reason is provided
    if (!reason) {
      serviceLogger.debug(`[TradeSimulator] Trade reason is required`);
      throw new ApiError(400, "Trade reason is required");
    }

    // Prevent trading between identical tokens
    if (fromToken === toToken) {
      serviceLogger.debug(
        `[TradeSimulator] Cannot trade between identical tokens: ${fromToken}`,
      );
      throw new ApiError(400, "Cannot trade between identical tokens");
    }
  }

  /**
   * Get all trades for an agent
   * @param agentId The agent ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getAgentTrades(agentId: string, limit?: number, offset?: number) {
    try {
      // If limit is small and we have cache, use it
      if (
        limit &&
        limit <= 100 &&
        offset === undefined &&
        this.tradeCache.has(agentId)
      ) {
        const cachedTrades = this.tradeCache.get(agentId) || [];
        if (cachedTrades.length >= limit) {
          return cachedTrades.slice(0, limit);
        }
      }

      // Get from database
      const trades = await getAgentTrades(agentId, limit, offset);

      // Update cache if fetching recent trades
      if (!offset && (!limit || limit <= 100)) {
        this.tradeCache.set(agentId, [...trades]);
      }

      return trades;
    } catch (error) {
      serviceLogger.error(
        `[TradeSimulator] Error getting agent trades:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get all trades for a competition
   * @param competitionId The competition ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getCompetitionTrades(
    competitionId: string,
    limit?: number,
    offset?: number,
  ) {
    try {
      return await getCompetitionTrades(competitionId, limit, offset);
    } catch (error) {
      serviceLogger.error(
        `[TradeSimulator] Error getting competition trades:`,
        error,
      );
      return [];
    }
  }

  /**
   * Calculate an agent's portfolio value in USD
   * @param agentId The agent ID
   * @returns Total portfolio value in USD
   */
  async calculatePortfolioValue(agentId: string) {
    let totalValue = 0;
    const balances = await this.balanceManager.getAllBalances(agentId);

    for (const balance of balances) {
      const price = await this.priceTracker.getPrice(balance.tokenAddress);
      if (price) {
        totalValue += balance.amount * price.price;
      }
    }

    return totalValue;
  }

  /**
   * Calculate portfolio values for multiple agents in bulk
   * @param agentIds Array of agent IDs
   * @returns Map of agent ID to portfolio value in USD
   */
  async calculateBulkPortfolioValues(
    agentIds: string[],
  ): Promise<Map<string, number>> {
    serviceLogger.debug(
      `[TradeSimulator] Calculating bulk portfolio values for ${agentIds.length} agents`,
    );

    const portfolioValues = new Map<string, number>();

    if (agentIds.length === 0) {
      return portfolioValues;
    }

    try {
      // Step 1: Get all balances for all agents in one query
      const allBalances = await this.balanceManager.getBulkBalances(agentIds);

      // Step 2: Get unique token addresses
      const uniqueTokens = [
        ...new Set(allBalances.map((balance) => balance.tokenAddress)),
      ];

      // Step 3: Get all token prices USD in bulk
      const tokenInfoMap =
        await this.priceTracker.getBulkTokenInfo(uniqueTokens);

      // Step 4: Initialize portfolio values for all agents
      agentIds.forEach((agentId) => {
        portfolioValues.set(agentId, 0);
      });

      // Step 5: Calculate portfolio values efficiently
      allBalances.forEach((balance) => {
        const tokenInfo = tokenInfoMap.get(balance.tokenAddress);
        if (tokenInfo && tokenInfo.price) {
          const currentValue = portfolioValues.get(balance.agentId) || 0;
          const tokenValue = balance.amount * tokenInfo.price;
          portfolioValues.set(balance.agentId, currentValue + tokenValue);
        }
      });

      serviceLogger.debug(
        `[TradeSimulator] Successfully calculated ${portfolioValues.size} portfolio values using ${uniqueTokens.length} unique tokens`,
      );

      return portfolioValues;
    } catch (error) {
      serviceLogger.error(
        `[TradeSimulator] Error calculating bulk portfolio values:`,
        error,
      );

      // Fallback to individual calculations
      serviceLogger.debug(
        `[TradeSimulator] Falling back to individual portfolio calculations`,
      );
      for (const agentId of agentIds) {
        try {
          const value = await this.calculatePortfolioValue(agentId);
          portfolioValues.set(agentId, value);
        } catch (agentError) {
          serviceLogger.error(
            `[TradeSimulator] Error calculating portfolio for agent ${agentId}:`,
            agentError,
          );
          portfolioValues.set(agentId, 0);
        }
      }

      return portfolioValues;
    }
  }

  /**
   * Check if trade simulator is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await count();
      return true;
    } catch (error) {
      serviceLogger.error("[TradeSimulator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Gets trading constraints for a competition, using cache when possible
   * @param competitionId The competition ID
   * @returns Trading constraints for the competition
   */
  private async getTradingConstraints(
    competitionId: string,
  ): Promise<TradingConstraints> {
    // Check cache first
    if (this.constraintsCache.has(competitionId)) {
      return this.constraintsCache.get(competitionId)!;
    }

    // Try to get from database
    const dbConstraints = await findByCompetitionId(competitionId);

    let constraints: TradingConstraints;
    if (dbConstraints) {
      constraints = {
        minimumPairAgeHours: dbConstraints.minimumPairAgeHours,
        minimum24hVolumeUsd: dbConstraints.minimum24hVolumeUsd,
        minimumLiquidityUsd: dbConstraints.minimumLiquidityUsd,
        minimumFdvUsd: dbConstraints.minimumFdvUsd,
      };
    } else {
      // Fall back to default values
      constraints = {
        minimumPairAgeHours:
          config.tradingConstraints.defaultMinimumPairAgeHours,
        minimum24hVolumeUsd:
          config.tradingConstraints.defaultMinimum24hVolumeUsd,
        minimumLiquidityUsd:
          config.tradingConstraints.defaultMinimumLiquidityUsd,
        minimumFdvUsd: config.tradingConstraints.defaultMinimumFdvUsd,
      };
    }

    // Cache the result
    this.constraintsCache.set(competitionId, constraints);
    return constraints;
  }

  /**
   * Clears the trading constraints cache for a specific competition or all competitions
   * @param competitionId Optional competition ID to clear, if not provided clears all
   */
  public clearConstraintsCache(competitionId?: string): void {
    if (competitionId) {
      this.constraintsCache.delete(competitionId);
    } else {
      this.constraintsCache.clear();
    }
  }

  /**
   * Validates trading constraints for a token based on DexScreener data
   * @param priceData The price data containing DexScreener metadata
   * @param tokenAddress The token address being validated
   * @param constraints The trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateTradingConstraints(
    priceData: PriceReport,
    tokenAddress: string,
    constraints: TradingConstraints,
  ): void {
    // Check if token is a stablecoin - exempt from all constraints
    const isStablecoin = this.dexScreenerProvider.isStablecoin(
      tokenAddress,
      priceData.specificChain,
    );

    if (isStablecoin) {
      serviceLogger.debug(
        `[TradeSimulator] All trading constraints exempted for stablecoin: ${tokenAddress}`,
      );
      return;
    }

    const isExemptToken = EXEMPT_TOKENS.has(priceData.token);
    if (isExemptToken) {
      serviceLogger.debug(
        `[TradeSimulator] Constraint check exempted for major token: ${tokenAddress} (${priceData.specificChain})`,
      );
      return;
    }

    // Check pairCreatedAt constraint
    this.validatePairAgeConstraint(priceData, constraints);

    // Check 24h volume constraint
    this.validateVolumeConstraint(priceData, constraints);

    // Check liquidity constraint
    this.validateLiquidConstraint(priceData, constraints);

    // Check FDV constraint - exempt major tokens
    this.validateFdvConstraint(priceData, constraints);

    const isExemptFromFdvLogging = EXEMPT_TOKENS.has(priceData.token);
    serviceLogger.debug(`[TradeSimulator] Trading constraints validated for ${tokenAddress}:
      Pair Age: ${priceData.pairCreatedAt ? ((Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60)).toFixed(2) : "N/A"} hours
      24h Volume: $${priceData.volume?.h24?.toLocaleString() || "N/A"}
      Liquidity: $${priceData.liquidity?.usd?.toLocaleString() || "N/A"}
      FDV: ${isExemptFromFdvLogging ? "EXEMPTED (major token)" : `$${priceData.fdv?.toLocaleString() || "N/A"}`}
    `);
  }

  /**
   * Validates FDV (Fully Diluted Valuation) constraint for a token
   * @param priceData - Price data containing FDV information
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateFdvConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minimumFdvUsd === 0) {
      return;
    }
    if (!priceData.fdv && priceData.fdv !== 0) {
      throw new ApiError(400, `Cannot get token FDV`);
    }
    if (priceData.fdv < constraints.minimumFdvUsd) {
      serviceLogger.debug(
        `[TradeSimulator] Insufficient FDV: $${priceData.fdv.toLocaleString()} (minimum: $${constraints.minimumFdvUsd.toLocaleString()})`,
      );
      throw new ApiError(
        400,
        `Token has insufficient FDV ($${priceData.fdv.toLocaleString()}, minimum: $${constraints.minimumFdvUsd.toLocaleString()})`,
      );
    }
  }

  /**
   * Validates pair age constraint for a token
   * @param priceData - Price data containing pair creation time
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validatePairAgeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    // Setting to zero enables ignoring this constraint for this comp
    if (constraints.minimumPairAgeHours === 0) {
      return;
    }
    if (!priceData.pairCreatedAt) {
      throw new ApiError(
        400,
        `Cannot get token pair creation time, minimum age is: ${constraints.minimumPairAgeHours} hours`,
      );
    }
    const currentTime = Date.now();
    const pairAgeHours =
      (currentTime - priceData.pairCreatedAt) / (1000 * 60 * 60);
    if (pairAgeHours < constraints.minimumPairAgeHours) {
      serviceLogger.debug(
        `[TradeSimulator] Pair too young: ${pairAgeHours.toFixed(2)} hours (minimum: ${constraints.minimumPairAgeHours} hours)`,
      );
      throw new ApiError(
        400,
        `Token pair is too young (${pairAgeHours.toFixed(2)} hours old, minimum: ${constraints.minimumPairAgeHours} hours)`,
      );
    }
  }

  /**
   * Validates 24h volume constraint for a token
   * @param priceData - Price data containing volume information
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateVolumeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minimum24hVolumeUsd === 0) {
      return;
    }
    if (!priceData.volume?.h24 && priceData.volume?.h24 !== 0) {
      throw new ApiError(400, `Cannot get token 24h volume data`);
    }
    if (priceData.volume.h24 < constraints.minimum24hVolumeUsd) {
      serviceLogger.debug(
        `[TradeSimulator] Insufficient 24h volume: $${priceData.volume.h24.toLocaleString()} (minimum: $${constraints.minimum24hVolumeUsd.toLocaleString()})`,
      );
      throw new ApiError(
        400,
        `Token has insufficient 24h volume ($${priceData.volume.h24.toLocaleString()}, minimum: $${constraints.minimum24hVolumeUsd.toLocaleString()})`,
      );
    }
  }

  /**
   * Validates liquidity constraint for a token
   * @param priceData - Price data containing liquidity information
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateLiquidConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minimumLiquidityUsd === 0) {
      return;
    }
    if (!priceData.liquidity?.usd && priceData.liquidity?.usd !== 0) {
      throw new ApiError(400, `Cannot get token liquidity`);
    }
    if (priceData.liquidity.usd < constraints.minimumLiquidityUsd) {
      serviceLogger.debug(
        `[TradeSimulator] Insufficient liquidity: $${priceData.liquidity.usd.toLocaleString()} (minimum: $${constraints.minimumLiquidityUsd.toLocaleString()})`,
      );
      throw new ApiError(
        400,
        `Token has insufficient liquidity ($${priceData.liquidity.usd.toLocaleString()}, minimum: $${constraints.minimumLiquidityUsd.toLocaleString()})`,
      );
    }
  }

  /**
   * Validates cross-chain trading rules.
   * @param chainInfo The resolved chain and specific chain information.
   * @throws ApiError if cross-chain trading is not allowed.
   */
  private validateCrossChainTrading(chainInfo: ChainOptions): void {
    if (
      features.CROSS_CHAIN_TRADING_TYPE === "disallowXParent" &&
      chainInfo.fromChain !== chainInfo.toChain
    ) {
      serviceLogger.debug(
        `[TradeSimulator] Cross-parent chain trading is disabled. Cannot trade between ${chainInfo.fromChain} and ${chainInfo.toChain}`,
      );
      throw new ApiError(
        400,
        "Cross-parent chain trading is disabled. Both tokens must be on the same parent blockchain.",
      );
    }

    if (
      features.CROSS_CHAIN_TRADING_TYPE === "disallowAll" &&
      (chainInfo.fromChain !== chainInfo.toChain ||
        (chainInfo.fromSpecificChain &&
          chainInfo.toSpecificChain &&
          chainInfo.fromSpecificChain !== chainInfo.toSpecificChain))
    ) {
      serviceLogger.debug(
        `[TradeSimulator] Cross-chain trading is disabled. Cannot trade between ${chainInfo.fromChain}(${chainInfo.fromSpecificChain || "none"}) and ${chainInfo.toChain}(${chainInfo.toSpecificChain || "none"})`,
      );
      throw new ApiError(
        400,
        "Cross-chain trading is disabled. Both tokens must be on the same blockchain.",
      );
    }
  }

  /**
   * Resolves chain variables for price fetching.
   * Handles default chain detection and specific chain overrides.
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param chainOptions Optional chain specification for performance optimization
   * @returns An object containing resolved chain and specific chain variables.
   */
  private resolveChainVariables(
    fromToken: string,
    toToken: string,
    chainOptions?: ChainOptions,
  ): ChainOptions {
    let fromChain: BlockchainType, toChain: BlockchainType;
    let fromSpecificChain: SpecificChain | undefined,
      toSpecificChain: SpecificChain | undefined;

    // For the source token
    if (chainOptions?.fromChain) {
      fromChain = chainOptions.fromChain;
      fromSpecificChain = chainOptions.fromSpecificChain;
      serviceLogger.debug(
        `[TradeSimulator] Using provided chain for fromToken: ${fromChain}, specificChain: ${fromSpecificChain || "none"}`,
      );
    } else {
      fromChain = this.priceTracker.determineChain(fromToken);
      serviceLogger.debug(
        `[TradeSimulator] Detected chain for fromToken: ${fromChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.fromSpecificChain) {
      fromSpecificChain = chainOptions.fromSpecificChain;
      serviceLogger.debug(
        `[TradeSimulator] Using provided specific chain for fromToken: ${fromSpecificChain}`,
      );
    }

    // For the destination token
    if (chainOptions?.toChain) {
      toChain = chainOptions.toChain;
      toSpecificChain = chainOptions.toSpecificChain;
      serviceLogger.debug(
        `[TradeSimulator] Using provided chain for toToken: ${toChain}, specificChain: ${toSpecificChain || "none"}`,
      );
    } else {
      toChain = this.priceTracker.determineChain(toToken);
      serviceLogger.debug(
        `[TradeSimulator] Detected chain for toToken: ${toChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.toSpecificChain) {
      toSpecificChain = chainOptions.toSpecificChain;
      serviceLogger.debug(
        `[TradeSimulator] Using provided specific chain for toToken: ${toSpecificChain}`,
      );
    }

    return {
      fromChain,
      toChain,
      fromSpecificChain,
      toSpecificChain,
    };
  }

  /**
   * Fetches prices for both tokens and validates constraints.
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param chainInfo The resolved chain and specific chain information
   * @param competitionId The competition ID
   * @returns An object containing fromPrice and toPrice.
   * @throws ApiError if prices are missing or constraints are violated.
   */
  private async fetchAndValidatePrices(
    fromToken: string,
    toToken: string,
    chainInfo: ChainOptions,
    competitionId: string,
  ): Promise<{ fromPrice: PriceReport; toPrice: PriceReport }> {
    // Get prices with chain information for better performance
    const fromPrice = await this.priceTracker.getPrice(
      fromToken,
      chainInfo.fromChain,
      chainInfo.fromSpecificChain,
    );

    const toPrice = await this.priceTracker.getPrice(
      toToken,
      chainInfo.toChain,
      chainInfo.toSpecificChain,
    );

    serviceLogger.debug("[TradeSimulator] Got prices:");
    serviceLogger.debug(
      `  From Token (${fromToken}): ${JSON.stringify(fromPrice, null, 4)} (${chainInfo.fromChain})`,
    );
    serviceLogger.debug(
      `  To Token (${toToken}): ${JSON.stringify(toPrice, null, 4)} (${chainInfo.toChain})`,
    );

    if (
      !fromPrice ||
      !toPrice ||
      fromPrice.price == null ||
      toPrice.price == null
    ) {
      serviceLogger.debug(`[TradeSimulator] Missing price data:
            From Token Price: ${fromPrice}
            To Token Price: ${toPrice}
        `);
      throw new ApiError(400, "Unable to determine price for tokens");
    }

    // Validate trading constraints for non-burn tokens
    // Trading constraints validation (only for 'to' token)
    if (toPrice.price > 0) {
      const constraints = await this.getTradingConstraints(competitionId);
      this.validateTradingConstraints(toPrice, toToken, constraints);
    }

    if (!(fromPrice.specificChain !== null && toPrice.specificChain !== null)) {
      serviceLogger.debug(`[TradeSimulator] Missing specific chain data:
            From Token Specific Chain: ${fromPrice.specificChain}
            To Token Specific Chain: ${toPrice.specificChain}
        `);
      throw new ApiError(400, "Unable to determine specific chain for tokens");
    }

    return { fromPrice, toPrice };
  }

  /**
   * Validates balances and portfolio limits for a trade.
   * @param agentId The agent ID
   * @param fromToken The source token address
   * @param fromAmount The amount to trade
   * @param fromValueUSD The USD value of the trade
   * @param currentBalance The current balance of the agent's fromToken
   * @throws ApiError if validation fails
   */
  private async validateBalancesAndPortfolio(
    agentId: string,
    fromToken: string,
    fromAmount: number,
    fromValueUSD: number,
    currentBalance: number,
  ): Promise<void> {
    // Validate balances
    serviceLogger.debug(
      `[TradeSimulator] Current balance of ${fromToken}: ${currentBalance}`,
    );

    if (currentBalance < fromAmount) {
      serviceLogger.debug(
        `[TradeSimulator] Insufficient balance: ${currentBalance} < ${fromAmount}`,
      );
      throw new ApiError(400, "Insufficient balance");
    }

    // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
    const portfolioValue = await this.calculatePortfolioValue(agentId);
    // TODO: maxTradePercentage should probably be a setting per comp.
    const maxTradeValue = portfolioValue * (this.maxTradePercentage / 100);
    serviceLogger.debug(
      `[TradeSimulator] Portfolio value: $${portfolioValue}, Max trade value: $${maxTradeValue}, Attempted trade value: $${fromValueUSD}`,
    );

    if (fromValueUSD > maxTradeValue) {
      serviceLogger.debug(
        `[TradeSimulator] Trade exceeds maximum size: $${fromValueUSD} > $${maxTradeValue} (${this.maxTradePercentage}% of portfolio)`,
      );
      throw new ApiError(
        400,
        `Trade exceeds maximum size (${this.maxTradePercentage}% of portfolio value)`,
      );
    }
  }

  /**
   * Calculates the amount of tokens to receive and the exchange rate for a trade.
   * Handles slippage and burn address scenarios.
   * @param fromAmount The amount of tokens to send
   * @param fromValueUSD The USD value of the trade
   * @param toPrice The price of the token to receive
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @returns An object containing toAmount and exchangeRate.
   */
  private calculateTradeAmounts(
    fromAmount: number,
    fromValueUSD: number,
    toPrice: number,
    fromToken: string,
    toToken: string,
  ): { toAmount: number; exchangeRate: number } {
    let toAmount: number;
    let exchangeRate: number;
    let effectiveFromValueUSD: number;

    if (toPrice === 0) {
      // Burning tokens - toAmount is 0, no slippage calculation needed
      toAmount = 0;
      exchangeRate = 0;
      effectiveFromValueUSD = fromValueUSD; // For accounting purposes, record the full USD value burned
      serviceLogger.debug(`[TradeSimulator] Burn transaction detected - tokens will be burned (toAmount = 0):
          From Token (${fromToken}):
          - Amount: ${fromAmount}
          - USD Value: $${fromValueUSD.toFixed(6)}

          Burn Details:
          - To Token (${toToken}): BURN ADDRESS
          - Price: $${toPrice}
          - Amount Burned: ${toAmount}
          - USD Value Burned: $${effectiveFromValueUSD.toFixed(6)}

          Exchange Rate: 1 ${fromToken} = ${exchangeRate} ${toToken} (BURN)
      `);
    } else {
      // Normal trade with slippage
      const { effectiveFromValueUSD: calculatedEffectiveValue } =
        calculateSlippage(fromValueUSD);
      effectiveFromValueUSD = calculatedEffectiveValue;
      toAmount = effectiveFromValueUSD / toPrice;
      exchangeRate = toAmount / fromAmount;
      serviceLogger.debug(`[TradeSimulator] Trade calculation details:
          From Token (${fromToken}):
          - Amount: ${fromAmount}
          - USD Value: $${fromValueUSD.toFixed(6)}

          To Token (${toToken}):
          - Price: $${toPrice}
          - Calculated Amount: ${toAmount.toFixed(6)}

          Exchange Rate: 1 ${fromToken} = ${exchangeRate.toFixed(6)} ${toToken}
      `);
    }

    return { toAmount, exchangeRate };
  }

  /**
   * Executes a trade and updates the database.
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param toAmount The amount to receive
   * @param exchangeRate The exchange rate
   * @param fromValueUSD The USD value of the trade
   * @param fromPrice The price data for the source token
   * @param toPrice The price data for the destination token
   * @param chainInfo The resolved chain and specific chain information
   * @param reason The reason for the trade
   * @param currentBalance The current balance of the agent's fromToken
   * @returns The created trade record
   */
  private async executeTradeAndUpdateDatabase(
    agentId: string,
    competitionId: string,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number,
    exchangeRate: number,
    fromValueUSD: number,
    fromPrice: PriceReport,
    toPrice: PriceReport,
    chainInfo: ChainOptions,
    reason: string,
    currentBalance: number,
  ): Promise<SelectTrade> {
    // Execute the trade
    await this.balanceManager.subtractAmount(
      agentId,
      fromToken,
      fromAmount,
      fromPrice.specificChain as SpecificChain,
      fromPrice.symbol,
    );

    // Only add balance for non-burn addresses (toAmount > 0)
    if (toAmount > 0) {
      await this.balanceManager.addAmount(
        agentId,
        toToken,
        toAmount,
        toPrice.specificChain as SpecificChain,
        toPrice.symbol,
      );
    } else {
      serviceLogger.debug(
        `[TradeSimulator] Burn trade completed - no balance added for ${toToken}`,
      );
    }

    // Create trade record
    const trade: InsertTrade = {
      id: uuidv4(),
      timestamp: new Date(),
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      price: exchangeRate, // Exchange rate (0 for burns)
      toTokenSymbol: toPrice.symbol,
      fromTokenSymbol: fromPrice.symbol,
      tradeAmountUsd: fromValueUSD, // Store the USD value of the trade
      success: true,
      agentId,
      competitionId,
      reason,
      // Add chain information to the trade record
      fromChain: chainInfo.fromChain,
      toChain: chainInfo.toChain,
      fromSpecificChain: fromPrice.specificChain,
      toSpecificChain: toPrice.specificChain,
    };

    // Store the trade in database
    const result = await createTrade(trade);

    // Update cache
    const cachedTrades = this.tradeCache.get(agentId) || [];
    cachedTrades.unshift(result); // Add to beginning of array (newest first)
    // Limit cache size to 100 trades per agent
    if (cachedTrades.length > 100) {
      cachedTrades.pop();
    }
    this.tradeCache.set(agentId, cachedTrades);

    serviceLogger.debug(`[TradeSimulator] Trade executed successfully:
                Initial ${fromToken} Balance: ${currentBalance}
                New ${fromToken} Balance: ${await this.balanceManager.getBalance(agentId, fromToken)}
                New ${toToken} Balance: ${await this.balanceManager.getBalance(agentId, toToken)}
            `);

    return result;
  }
}
