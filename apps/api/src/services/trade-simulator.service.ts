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
import { EXEMPT_TOKENS, calculateSlippage } from "@/lib/trade-utils.js";
import { BalanceManager } from "@/services/balance-manager.service.js";
import { PortfolioSnapshotter } from "@/services/index.js";
import { DexScreenerProvider } from "@/services/providers/dexscreener.provider.js";
import { BlockchainType, PriceReport, SpecificChain } from "@/types/index.js";

import { PriceTracker } from "./price-tracker.service.js";

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
   * @returns TradeResult object with success status and trade details
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
  ): Promise<{ success: boolean; trade?: SelectTrade; error?: string }> {
    try {
      console.log(`\n[TradeSimulator] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Validate minimum trade amount
      if (fromAmount < 0.000001) {
        console.log(`[TradeSimulator] Trade amount too small: ${fromAmount}`);
        return {
          success: false,
          error: "Trade amount too small (minimum: 0.000001)",
        };
      }

      // Validate reason is provided
      if (!reason) {
        console.log(`[TradeSimulator] Trade reason is required`);
        return {
          success: false,
          error: "Trade reason is required",
        };
      }

      // Prevent trading between identical tokens
      if (fromToken === toToken) {
        console.log(
          `[TradeSimulator] Cannot trade between identical tokens: ${fromToken}`,
        );
        return {
          success: false,
          error: "Cannot trade between identical tokens",
        };
      }

      // Get prices with chain information for better performance
      let fromTokenChain: BlockchainType, toTokenChain: BlockchainType;
      let fromTokenSpecificChain: SpecificChain | undefined,
        toTokenSpecificChain: SpecificChain | undefined;

      // For the source token
      if (chainOptions?.fromChain) {
        fromTokenChain = chainOptions.fromChain;
        fromTokenSpecificChain = chainOptions.fromSpecificChain;
        console.log(
          `[TradeSimulator] Using provided chain for fromToken: ${fromTokenChain}, specificChain: ${fromTokenSpecificChain || "none"}`,
        );
      } else {
        fromTokenChain = this.priceTracker.determineChain(fromToken);
        console.log(
          `[TradeSimulator] Detected chain for fromToken: ${fromTokenChain}`,
        );
      }

      // assign the specific chain if provided
      if (chainOptions?.fromSpecificChain) {
        fromTokenSpecificChain = chainOptions.fromSpecificChain;
        console.log(
          `[TradeSimulator] Using provided specific chain for fromToken: ${fromTokenSpecificChain}`,
        );
      }

      // For the destination token
      if (chainOptions?.toChain) {
        toTokenChain = chainOptions.toChain;
        toTokenSpecificChain = chainOptions.toSpecificChain;
        console.log(
          `[TradeSimulator] Using provided chain for toToken: ${toTokenChain}, specificChain: ${toTokenSpecificChain || "none"}`,
        );
      } else {
        toTokenChain = this.priceTracker.determineChain(toToken);
        console.log(
          `[TradeSimulator] Detected chain for toToken: ${toTokenChain}`,
        );
      }

      // assign the specific chain if provided
      if (chainOptions?.toSpecificChain) {
        toTokenSpecificChain = chainOptions.toSpecificChain;
        console.log(
          `[TradeSimulator] Using provided specific chain for toToken: ${toTokenSpecificChain}`,
        );
      }

      // Get prices with chain information for better performance
      const fromPrice = await this.priceTracker.getPrice(
        fromToken,
        fromTokenChain,
        fromTokenSpecificChain,
      );

      const toPrice = await this.priceTracker.getPrice(
        toToken,
        toTokenChain,
        toTokenSpecificChain,
      );

      console.log("[TradeSimulator] Got prices:");
      console.log(
        `  From Token (${fromToken}): ${JSON.stringify(fromPrice, null, 4)} (${fromTokenChain})`,
      );
      console.log(
        `  To Token (${toToken}): ${JSON.stringify(toPrice, null, 4)} (${toTokenChain})`,
      );

      if (
        !fromPrice ||
        !toPrice ||
        fromPrice.price == null ||
        toPrice.price == null
      ) {
        console.log(`[TradeSimulator] Missing price data:
            From Token Price: ${fromPrice}
            To Token Price: ${toPrice}
        `);
        return {
          success: false,
          error: "Unable to determine price for tokens",
        };
      }

      // Validate trading constraints for non-burn tokens
      // Trading constraints validation (only for 'to' token)
      if (toPrice.price > 0) {
        const constraints = await this.getTradingConstraints(competitionId);
        const constraintResult = this.validateTradingConstraints(
          toPrice,
          toToken,
          constraints,
        );
        if (!constraintResult.success) {
          return constraintResult;
        }
      }

      if (
        !(fromPrice.specificChain !== null && toPrice.specificChain !== null)
      ) {
        console.log(`[TradeSimulator] Missing specific chain data:
            From Token Specific Chain: ${fromPrice.specificChain}
            To Token Specific Chain: ${toPrice.specificChain}
        `);
        return {
          success: false,
          error: "Unable to determine specific chain for tokens",
        };
      }

      switch (features.CROSS_CHAIN_TRADING_TYPE) {
        case "disallowXParent":
          // Check if the tokens are on the same chain
          if (fromTokenChain !== toTokenChain) {
            console.log(
              `[TradeSimulator] Cross-parent chain trading is disabled. Cannot trade between ${fromTokenChain} and ${toTokenChain}`,
            );
            return {
              success: false,
              error:
                "Cross-parent chain trading is disabled. Both tokens must be on the same parent blockchain.",
            };
          }
          break;
        case "disallowAll":
          // Check if the tokens are on the same chain
          if (
            fromTokenChain !== toTokenChain ||
            (fromTokenSpecificChain &&
              toTokenSpecificChain &&
              fromTokenSpecificChain !== toTokenSpecificChain)
          ) {
            console.log(
              `[TradeSimulator] Cross-chain trading is disabled. Cannot trade between ${fromTokenChain}(${fromTokenSpecificChain || "none"}) and ${toTokenChain}(${toTokenSpecificChain || "none"})`,
            );
            return {
              success: false,
              error:
                "Cross-chain trading is disabled. Both tokens must be on the same blockchain.",
            };
          }
          break;
      }

      // Calculate the trade using USD values
      const fromValueUSD = fromAmount * fromPrice.price;

      // Validate balances
      const currentBalance = await this.balanceManager.getBalance(
        agentId,
        fromToken,
      );
      console.log(
        `[TradeSimulator] Current balance of ${fromToken}: ${currentBalance}`,
      );

      if (currentBalance < fromAmount) {
        console.log(
          `[TradeSimulator] Insufficient balance: ${currentBalance} < ${fromAmount}`,
        );
        return {
          success: false,
          error: "Insufficient balance",
        };
      }

      // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
      const portfolioValue = await this.calculatePortfolioValue(agentId);
      // TODO: maxTradePercentage should probably be a setting per comp.
      const maxTradeValue = portfolioValue * (this.maxTradePercentage / 100);
      console.log(
        `[TradeSimulator] Portfolio value: $${portfolioValue}, Max trade value: $${maxTradeValue}, Attempted trade value: $${fromValueUSD}`,
      );

      if (fromValueUSD > maxTradeValue) {
        console.log(
          `[TradeSimulator] Trade exceeds maximum size: $${fromValueUSD} > $${maxTradeValue} (${this.maxTradePercentage}% of portfolio)`,
        );
        return {
          success: false,
          error: `Trade exceeds maximum size (${this.maxTradePercentage}% of portfolio value)`,
        };
      }

      // Handle burn address (price = 0) specially
      let toAmount: number;
      let exchangeRate: number;
      let effectiveFromValueUSD: number;

      if (toPrice.price === 0) {
        // Burning tokens - toAmount is 0, no slippage calculation needed
        toAmount = 0;
        exchangeRate = 0;
        effectiveFromValueUSD = fromValueUSD; // For accounting purposes, record the full USD value burned
        console.log(
          `[TradeSimulator] Burn transaction detected - tokens will be burned (toAmount = 0)`,
        );
      } else {
        // Normal trade with slippage
        const { effectiveFromValueUSD: calculatedEffectiveValue } =
          calculateSlippage(fromValueUSD);
        effectiveFromValueUSD = calculatedEffectiveValue;
        toAmount = effectiveFromValueUSD / toPrice.price;
        exchangeRate = toAmount / fromAmount;
      }

      // Debug logging for price calculations
      if (toPrice.price === 0) {
        console.log(`[TradeSimulator] Burn trade calculation details:
                From Token (${fromToken}):
                - Amount: ${fromAmount}
                - Price: $${fromPrice.price}
                - USD Value: $${fromValueUSD.toFixed(6)}

                Burn Details:
                - To Token (${toToken}): BURN ADDRESS
                - Price: $${toPrice.price}
                - Amount Burned: ${toAmount}
                - USD Value Burned: $${effectiveFromValueUSD.toFixed(6)}

                Exchange Rate: 1 ${fromToken} = ${exchangeRate} ${toToken} (BURN)
            `);
      } else {
        console.log(`[TradeSimulator] Trade calculation details:
                From Token (${fromToken}):
                - Amount: ${fromAmount}
                - Price: $${fromPrice.price}
                - USD Value: $${fromValueUSD.toFixed(6)}

                To Token (${toToken}):
                - Price: $${toPrice.price}
                - Calculated Amount: ${toAmount.toFixed(6)}

                Exchange Rate: 1 ${fromToken} = ${exchangeRate.toFixed(6)} ${toToken}
            `);
      }

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
        console.log(
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
        fromChain: fromTokenChain,
        toChain: toTokenChain,
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

      console.log(`[TradeSimulator] Trade executed successfully:
                Initial ${fromToken} Balance: ${currentBalance}
                New ${fromToken} Balance: ${await this.balanceManager.getBalance(agentId, fromToken)}
                New ${toToken} Balance: ${await this.balanceManager.getBalance(agentId, toToken)}
            `);

      // Trigger a portfolio snapshot for the trading agent only
      // We run this asynchronously without awaiting to avoid delaying the trade response
      this.portfolioSnapshotter
        .takePortfolioSnapshotForAgent(competitionId, agentId)
        .catch((error) => {
          console.error(
            `[TradeSimulator] Error taking portfolio snapshot for agent ${agentId} after trade: ${error.message}`,
          );
        });
      console.log(
        `[TradeSimulator] Portfolio snapshot triggered for agent ${agentId} in competition ${competitionId} after trade`,
      );

      return {
        success: true,
        trade: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during trade";
      console.error(`[TradeSimulator] Trade execution failed:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
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
      console.error(`[TradeSimulator] Error getting agent trades:`, error);
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
      console.error(
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
    console.log(
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

      console.log(
        `[TradeSimulator] Successfully calculated ${portfolioValues.size} portfolio values using ${uniqueTokens.length} unique tokens`,
      );

      return portfolioValues;
    } catch (error) {
      console.error(
        `[TradeSimulator] Error calculating bulk portfolio values:`,
        error,
      );

      // Fallback to individual calculations
      console.log(
        `[TradeSimulator] Falling back to individual portfolio calculations`,
      );
      for (const agentId of agentIds) {
        try {
          const value = await this.calculatePortfolioValue(agentId);
          portfolioValues.set(agentId, value);
        } catch (agentError) {
          console.error(
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
      console.error("[TradeSimulator] Health check failed:", error);
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
   * @returns Object indicating success/failure and error message if applicable
   */
  private validateTradingConstraints(
    priceData: PriceReport,
    tokenAddress: string,
    constraints: TradingConstraints,
  ): { success: boolean; error?: string } {
    // Check if token is a stablecoin - exempt from all constraints
    const isStablecoin = this.dexScreenerProvider.isStablecoin(
      tokenAddress,
      priceData.specificChain,
    );

    if (isStablecoin) {
      console.log(
        `[TradeSimulator] All trading constraints exempted for stablecoin: ${tokenAddress}`,
      );
      return { success: true };
    }

    const isExemptToken = EXEMPT_TOKENS.has(priceData.token);
    if (isExemptToken) {
      console.log(
        `[TradeSimulator] Constraint check exempted for major token: ${tokenAddress} (${priceData.specificChain})`,
      );
      return { success: true };
    }

    // Check pairCreatedAt constraint
    const pairAgeValidationResult = this.validatePairAgeConstraint(
      priceData,
      constraints,
    );
    if (!pairAgeValidationResult.success) {
      return pairAgeValidationResult;
    }

    // Check 24h volume constraint
    const volumeValidationResult = this.validateVolumeConstraint(
      priceData,
      constraints,
    );
    if (!volumeValidationResult.success) {
      return volumeValidationResult;
    }

    // Check liquidity constraint
    const liquidityValidationResult = this.validateLiquidConstraint(
      priceData,
      constraints,
    );
    if (!liquidityValidationResult.success) {
      return liquidityValidationResult;
    }

    // Check FDV constraint - exempt major tokens
    const fdvValidationResult = this.validateFdvConstraint(
      priceData,
      constraints,
    );
    if (!fdvValidationResult.success) {
      return fdvValidationResult;
    }

    const isExemptFromFdvLogging = EXEMPT_TOKENS.has(priceData.token);
    console.log(`[TradeSimulator] Trading constraints validated for ${tokenAddress}:
      Pair Age: ${priceData.pairCreatedAt ? ((Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60)).toFixed(2) : "N/A"} hours
      24h Volume: $${priceData.volume?.h24?.toLocaleString() || "N/A"}
      Liquidity: $${priceData.liquidity?.usd?.toLocaleString() || "N/A"}
      FDV: ${isExemptFromFdvLogging ? "EXEMPTED (major token)" : `$${priceData.fdv?.toLocaleString() || "N/A"}`}
    `);

    return { success: true };
  }

  /**
   * Validates FDV (Fully Diluted Valuation) constraint for a token
   * @param priceData - Price data containing FDV information
   * @param tokenAddress - Token address for logging purposes
   * @returns Object indicating success/failure and error message if applicable
   */
  private validateFdvConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): {
    success: boolean;
    error?: string;
  } {
    if (constraints.minimumFdvUsd === 0) {
      return { success: true };
    }
    if (!priceData.fdv && priceData.fdv !== 0) {
      return {
        success: false,
        error: `Cannot get token FDV`,
      };
    }
    if (priceData.fdv < constraints.minimumFdvUsd) {
      console.log(
        `[TradeSimulator] Insufficient FDV: $${priceData.fdv.toLocaleString()} (minimum: $${constraints.minimumFdvUsd.toLocaleString()})`,
      );
      return {
        success: false,
        error: `Token has insufficient FDV ($${priceData.fdv.toLocaleString()}, minimum: $${constraints.minimumFdvUsd.toLocaleString()})`,
      };
    }

    return { success: true };
  }

  /**
   * Validates pair age constraint for a token
   * @param priceData - Price data containing pair creation time
   * @param tokenAddress - Token address for logging purposes
   * @returns Object indicating success/failure and error message if applicable
   */
  private validatePairAgeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): {
    success: boolean;
    error?: string;
  } {
    // Setting to zero enables ignoring this constraint for this comp
    if (constraints.minimumPairAgeHours === 0) {
      return { success: true };
    }
    if (!priceData.pairCreatedAt) {
      return {
        success: false,
        error: `Cannot get token pair creation time, minimum age is: ${constraints.minimumPairAgeHours} hours`,
      };
    }
    const currentTime = Date.now();
    const pairAgeHours =
      (currentTime - priceData.pairCreatedAt) / (1000 * 60 * 60);
    if (pairAgeHours < constraints.minimumPairAgeHours) {
      console.log(
        `[TradeSimulator] Pair too young: ${pairAgeHours.toFixed(2)} hours (minimum: ${constraints.minimumPairAgeHours} hours)`,
      );
      return {
        success: false,
        error: `Token pair is too young (${pairAgeHours.toFixed(2)} hours old, minimum: ${constraints.minimumPairAgeHours} hours)`,
      };
    }

    return { success: true };
  }

  /**
   * Validates 24h volume constraint for a token
   * @param priceData - Price data containing volume information
   * @param tokenAddress - Token address for logging purposes
   * @returns Object indicating success/failure and error message if applicable
   */
  private validateVolumeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): {
    success: boolean;
    error?: string;
  } {
    if (constraints.minimum24hVolumeUsd === 0) {
      return { success: true };
    }
    if (!priceData.volume?.h24 && priceData.volume?.h24 !== 0) {
      return {
        success: false,
        error: `Cannot get token 24h volume data`,
      };
    }
    if (priceData.volume.h24 < constraints.minimum24hVolumeUsd) {
      console.log(
        `[TradeSimulator] Insufficient 24h volume: $${priceData.volume.h24.toLocaleString()} (minimum: $${constraints.minimum24hVolumeUsd.toLocaleString()})`,
      );
      return {
        success: false,
        error: `Token has insufficient 24h volume ($${priceData.volume.h24.toLocaleString()}, minimum: $${constraints.minimum24hVolumeUsd.toLocaleString()})`,
      };
    }

    return { success: true };
  }

  /**
   * Validates liquidity constraint for a token
   * @param priceData - Price data containing liquidity information
   * @param tokenAddress - Token address for logging purposes
   * @returns Object indicating success/failure and error message if applicable
   */
  private validateLiquidConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): {
    success: boolean;
    error?: string;
  } {
    if (constraints.minimumLiquidityUsd === 0) {
      return { success: true };
    }
    if (!priceData.liquidity?.usd && priceData.liquidity?.usd !== 0) {
      return {
        success: false,
        error: `Cannot get token liquidity`,
      };
    }
    if (priceData.liquidity.usd < constraints.minimumLiquidityUsd) {
      console.log(
        `[TradeSimulator] Insufficient liquidity: $${priceData.liquidity.usd.toLocaleString()} (minimum: $${constraints.minimumLiquidityUsd.toLocaleString()})`,
      );
      return {
        success: false,
        error: `Token has insufficient liquidity ($${priceData.liquidity.usd.toLocaleString()}, minimum: $${constraints.minimumLiquidityUsd.toLocaleString()})`,
      };
    }

    return { success: true };
  }
}
