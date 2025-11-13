import { randomUUID } from "crypto";
import { Logger } from "pino";

import { TradeRepository } from "@recallnet/db/repositories/trade";
import { InsertTrade, SelectTrade } from "@recallnet/db/schema/trading/types";

import { BalanceService } from "./balance.service.js";
import { CompetitionService } from "./competition.service.js";
import { EXEMPT_TOKENS, calculateSlippage } from "./lib/trade-utils.js";
import { PriceTrackerService } from "./price-tracker.service.js";
import { DexScreenerProvider } from "./providers/price/dexscreener.provider.js";
import { TradeSimulatorService } from "./trade-simulator.service.js";
import { TradingConstraintsService } from "./trading-constraints.service.js";
import {
  ApiError,
  BlockchainType,
  CrossChainTradingType,
  PriceReport,
  SpecificChain,
  SpecificChainTokens,
  TradingConstraints,
} from "./types/index.js";

const MIN_TRADE_AMOUNT = 0.000001;

/**
 * Interface for chain specification options
 */
interface ChainOptions {
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

/**
 * Interface for trade execution parameters
 */
interface ExecuteTradeParams {
  agentId: string;
  competitionId: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  reason: string;
  slippageTolerance?: number;
  chainOptions?: ChainOptions;
}

export interface SimulatedTradeExecutionServiceConfig {
  maxTradePercentage: number;
  specificChainTokens: SpecificChainTokens;
  tradingConstraints: {
    defaultMinimumPairAgeHours: number;
    defaultMinimum24hVolumeUsd: number;
    defaultMinimumLiquidityUsd: number;
    defaultMinimumFdvUsd: number;
  };
}

/**
 * Service for executing simulated trades with competition validation
 * Handles business logic for trade execution including competition checks
 */
export class SimulatedTradeExecutionService {
  private exemptTokens: Set<string>;

  constructor(
    private readonly competitionService: CompetitionService,
    private readonly tradeSimulatorService: TradeSimulatorService,
    private readonly balanceService: BalanceService,
    private readonly priceTrackerService: PriceTrackerService,
    private readonly tradeRepo: TradeRepository,
    private readonly tradingConstraintsService: TradingConstraintsService,
    private readonly dexScreenerProvider: DexScreenerProvider,
    private readonly config: SimulatedTradeExecutionServiceConfig,
    private readonly logger: Logger,
  ) {
    this.exemptTokens = EXEMPT_TOKENS(config.specificChainTokens);
  }

  /**
   * Execute a simulated trade between two tokens
   * @param params Trade execution parameters
   * @returns The executed trade result
   */
  async executeTrade(params: ExecuteTradeParams): Promise<SelectTrade> {
    const {
      agentId,
      competitionId,
      fromToken,
      toToken,
      fromAmount,
      reason,
      slippageTolerance,
      chainOptions,
    } = params;

    try {
      this.logger.debug(`\n[TradeSimulator] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Fetch the competition and check if end date has passed
      const competition =
        await this.competitionService.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, `Competition not found: ${competitionId}`);
      }

      // Check if this is a perps competition - trading endpoint is supported for paper trading competitions only
      if (competition.type === "perpetual_futures") {
        throw new ApiError(
          400,
          "This endpoint is not available for perpetual futures competitions. " +
            "Perpetual futures positions are managed through Symphony, not through this API.",
        );
      }

      // Check if competition has passed its end date
      const now = new Date();
      if (competition.endDate !== null && now > competition.endDate) {
        throw new ApiError(
          400,
          `Competition has ended. Trading is no longer allowed for competition: ${competition.name}`,
        );
      }

      // Check if agent is registered and active in the competition
      const isAgentActive =
        await this.competitionService.isAgentActiveInCompetition(
          competitionId,
          agentId,
        );
      if (!isAgentActive) {
        throw new ApiError(
          403,
          `Agent ${agentId} is not registered for competition ${competitionId}. Trading is not allowed.`,
        );
      }

      // Validate basic trade inputs
      this.validateTradeInputs(fromToken, toToken, fromAmount, reason);

      // Resolve chain variables
      const chainInfo = this.resolveChainVariables(
        fromToken,
        toToken,
        chainOptions,
      );

      // Validate cross-chain trading rules using competition-specific settings
      this.validateCrossChainTrading(
        chainInfo,
        competition.crossChainTradingType,
      );

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
      const currentBalance = await this.balanceService.getBalance(
        agentId,
        fromToken,
        competitionId,
      );

      // Validate balances and portfolio limits
      await this.validateBalancesAndPortfolio(
        agentId,
        competitionId,
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
      );

      // Log trade summary
      this.logger.debug(`[TradeSimulator] Trade executed successfully:
                Trade ID: ${result.trade.id}
                Agent: ${agentId}
                Competition: ${competitionId}
                Reason: ${reason}
                From Token: ${fromToken} (${fromPrice.symbol}) @ $${fromPrice.price.toFixed(6)}
                To Token: ${toToken} (${toPrice.symbol}) @ $${toPrice.price.toFixed(6)}
                Trade Amount: ${fromAmount} ${fromPrice.symbol} → ${toAmount} ${toPrice.symbol}
                Exchange Rate: 1 ${fromPrice.symbol} = ${exchangeRate.toFixed(6)} ${toPrice.symbol}
                USD Value: $${fromValueUSD.toFixed(2)}
                Chains: ${chainInfo.fromChain || "N/A"} → ${chainInfo.toChain || "N/A"}
                Initial ${fromToken} Balance: ${currentBalance}
                New ${fromToken} Balance: ${result.updatedBalances.fromTokenBalance}
                New ${toToken} Balance: ${result.updatedBalances.toTokenBalance ?? "N/A (burn)"}
            `);

      return result.trade;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during trade";
      this.logger.error(
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
      this.logger.debug(
        `[TradeSimulator] Trade amount too small: ${fromAmount}`,
      );
      throw new ApiError(400, "Trade amount too small (minimum: 0.000001)");
    }

    // Validate reason is provided
    if (!reason) {
      this.logger.debug(`[TradeSimulator] Trade reason is required`);
      throw new ApiError(400, "Trade reason is required");
    }

    // Prevent trading between identical tokens
    if (fromToken === toToken) {
      this.logger.debug(
        `[TradeSimulator] Cannot trade between identical tokens: ${fromToken}`,
      );
      throw new ApiError(400, "Cannot trade between identical tokens");
    }
  }

  /**
   * Gets trading constraints for a competition
   * @param competitionId The competition ID
   * @returns Trading constraints for the competition
   */
  private async getTradingConstraints(
    competitionId: string,
  ): Promise<TradingConstraints> {
    // Use TradingConstraintsService which handles caching and defaults
    return await this.tradingConstraintsService.getConstraintsWithDefaults(
      competitionId,
    );
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
      this.logger.debug(
        `[TradeSimulator] All trading constraints exempted for stablecoin: ${tokenAddress}`,
      );
      return;
    }

    const isExemptToken = this.exemptTokens.has(priceData.token);
    if (isExemptToken) {
      this.logger.debug(
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

    const isExemptFromFdvLogging = this.exemptTokens.has(priceData.token);
    this.logger
      .debug(`[TradeSimulator] Trading constraints validated for ${tokenAddress}:
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
      this.logger.debug(
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
      this.logger.debug(
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
      this.logger.debug(
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
      this.logger.debug(
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
   * @param crossChainTradingType The competition's cross-chain trading policy
   * @throws ApiError if cross-chain trading is not allowed.
   */
  private validateCrossChainTrading(
    chainInfo: ChainOptions,
    crossChainTradingType: CrossChainTradingType,
  ): void {
    if (
      crossChainTradingType === "disallowXParent" &&
      chainInfo.fromChain !== chainInfo.toChain
    ) {
      this.logger.debug(
        `[TradeSimulator] Cross-parent chain trading is disabled. Cannot trade between ${chainInfo.fromChain} and ${chainInfo.toChain}`,
      );
      throw new ApiError(
        400,
        "Cross-parent chain trading is disabled. Both tokens must be on the same parent blockchain.",
      );
    }

    if (
      crossChainTradingType === "disallowAll" &&
      (chainInfo.fromChain !== chainInfo.toChain ||
        (chainInfo.fromSpecificChain &&
          chainInfo.toSpecificChain &&
          chainInfo.fromSpecificChain !== chainInfo.toSpecificChain))
    ) {
      this.logger.debug(
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
      this.logger.debug(
        `[TradeSimulator] Using provided chain for fromToken: ${fromChain}, specificChain: ${fromSpecificChain || "none"}`,
      );
    } else {
      fromChain = this.priceTrackerService.determineChain(fromToken);
      this.logger.debug(
        `[TradeSimulator] Detected chain for fromToken: ${fromChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.fromSpecificChain) {
      fromSpecificChain = chainOptions.fromSpecificChain;
      this.logger.debug(
        `[TradeSimulator] Using provided specific chain for fromToken: ${fromSpecificChain}`,
      );
    }

    // For the destination token
    if (chainOptions?.toChain) {
      toChain = chainOptions.toChain;
      toSpecificChain = chainOptions.toSpecificChain;
      this.logger.debug(
        `[TradeSimulator] Using provided chain for toToken: ${toChain}, specificChain: ${toSpecificChain || "none"}`,
      );
    } else {
      toChain = this.priceTrackerService.determineChain(toToken);
      this.logger.debug(
        `[TradeSimulator] Detected chain for toToken: ${toChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.toSpecificChain) {
      toSpecificChain = chainOptions.toSpecificChain;
      this.logger.debug(
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
    const fromPrice = await this.priceTrackerService.getPrice(
      fromToken,
      chainInfo.fromChain,
      chainInfo.fromSpecificChain,
    );

    const toPrice = await this.priceTrackerService.getPrice(
      toToken,
      chainInfo.toChain,
      chainInfo.toSpecificChain,
    );

    this.logger.debug("[TradeSimulator] Got prices:");
    this.logger.debug(
      `  From Token (${fromToken}): ${JSON.stringify(fromPrice, null, 4)} (${chainInfo.fromChain})`,
    );
    this.logger.debug(
      `  To Token (${toToken}): ${JSON.stringify(toPrice, null, 4)} (${chainInfo.toChain})`,
    );

    if (
      !fromPrice ||
      !toPrice ||
      fromPrice.price == null ||
      toPrice.price == null
    ) {
      this.logger.debug(`[TradeSimulator] Missing price data:
            From Token Price: ${fromPrice ? fromPrice.price : "null"}
            To Token Price: ${toPrice ? toPrice.price : "null"}
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
      this.logger.debug(`[TradeSimulator] Missing specific chain data:
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
    competitionId: string,
    fromToken: string,
    fromAmount: number,
    fromValueUSD: number,
    currentBalance: number,
  ): Promise<void> {
    // Validate balances
    this.logger.debug(
      `[TradeSimulator] Current balance of ${fromToken}: ${currentBalance}`,
    );

    if (currentBalance < fromAmount) {
      this.logger.debug(
        `[TradeSimulator] Insufficient balance: ${currentBalance} < ${fromAmount}`,
      );
      throw new ApiError(400, "Insufficient balance");
    }

    // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
    const portfolioValue =
      await this.tradeSimulatorService.calculatePortfolioValue(
        agentId,
        competitionId,
      );
    // TODO: maxTradePercentage should probably be a setting per comp.
    const maxTradeValue =
      portfolioValue * (this.config.maxTradePercentage / 100);
    this.logger.debug(
      `[TradeSimulator] Portfolio value: $${portfolioValue}, Max trade value: $${maxTradeValue}, Attempted trade value: $${fromValueUSD}`,
    );

    if (fromValueUSD > maxTradeValue) {
      this.logger.debug(
        `[TradeSimulator] Trade exceeds maximum size: $${fromValueUSD} > $${maxTradeValue} (${this.config.maxTradePercentage}% of portfolio)`,
      );
      throw new ApiError(
        400,
        `Trade exceeds maximum size (${this.config.maxTradePercentage}% of portfolio value)`,
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
      this.logger
        .debug(`[TradeSimulator] Burn transaction detected - tokens will be burned (toAmount = 0):
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

      this.logger.debug(`[TradeSimulator] Trade calculation:
          From Token (${fromToken}):
          - Amount: ${fromAmount}
          - USD Value: $${fromValueUSD.toFixed(6)}

          Slippage Calculation:
          - Original USD Value: $${fromValueUSD.toFixed(6)}
          - Effective USD Value (after slippage): $${effectiveFromValueUSD.toFixed(6)}

          To Token (${toToken}):
          - Price: $${toPrice}
          - Amount: ${toAmount}

          Exchange Rate: 1 ${fromToken} = ${exchangeRate.toFixed(6)} ${toToken}
      `);
    }

    return { toAmount, exchangeRate };
  }

  /**
   * Executes the trade and updates the database with atomic balance changes
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param toAmount The amount to receive
   * @param exchangeRate The exchange rate
   * @param fromValueUSD The USD value of the trade
   * @param fromPrice The source token price data
   * @param toPrice The destination token price data
   * @param chainInfo The chain information
   * @param reason The reason for the trade
   * @returns Object containing the created trade record and updated balances
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
  ): Promise<{
    trade: SelectTrade;
    updatedBalances: {
      fromTokenBalance: number;
      toTokenBalance?: number;
    };
  }> {
    // Create trade record with atomic balance updates
    const trade: InsertTrade = {
      id: randomUUID(),
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

    // Execute the trade atomically (updates balances and creates trade record in one transaction)
    const result = await this.tradeRepo.createTradeWithBalances(trade);

    // Update balance cache with absolute values from the database
    this.balanceService.setBalanceCache(
      agentId,
      competitionId,
      fromToken,
      result.updatedBalances.fromTokenBalance,
    );
    if (result.updatedBalances.toTokenBalance !== undefined) {
      this.balanceService.setBalanceCache(
        agentId,
        competitionId,
        toToken,
        result.updatedBalances.toTokenBalance,
      );
    }

    // Update trade cache
    this.tradeSimulatorService.updateTradeCache(agentId, result.trade);

    return result;
  }
}
