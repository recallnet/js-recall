import { v4 as uuidv4 } from "uuid";

import { config, features } from "../config";
import { repositories } from "../database";
import { BlockchainType, SpecificChain, Trade, TradeResult } from "../types";
import { BalanceManager } from "./balance-manager.service";
import { services } from "./index";
import { PriceTracker } from "./price-tracker.service";

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
  // Cache of recent trades for performance (teamId -> trades)
  private tradeCache: Map<string, Trade[]>;
  // Maximum trade percentage of portfolio value
  private maxTradePercentage: number;

  constructor(balanceManager: BalanceManager, priceTracker: PriceTracker) {
    this.balanceManager = balanceManager;
    this.priceTracker = priceTracker;
    this.tradeCache = new Map();
    // Get the maximum trade percentage from config
    this.maxTradePercentage = config.maxTradePercentage;
  }

  /**
   * Execute a trade between two tokens
   * @param teamId The team ID
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
    teamId: string,
    competitionId: string,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    reason: string,
    slippageTolerance?: number,
    chainOptions?: ChainOptions,
  ): Promise<TradeResult> {
    try {
      console.log(`\n[TradeSimulator] Starting trade execution:
                Team: ${teamId}
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

      console.log(`[TradeSimulator] Got prices:
        From Token (${fromToken}): $${fromPrice} (${fromTokenChain})
        To Token (${toToken}): $${toPrice} (${toTokenChain})
    `);

      if (!fromPrice || !toPrice) {
        console.log(`[TradeSimulator] Missing price data:
            From Token Price: ${fromPrice}
            To Token Price: ${toPrice}
        `);
        return {
          success: false,
          error: "Unable to determine price for tokens",
        };
      }

      // Check for cross-chain trades if not allowed
      if (
        !features.ALLOW_CROSS_CHAIN_TRADING &&
        (fromTokenChain !== toTokenChain ||
          (fromTokenSpecificChain &&
            toTokenSpecificChain &&
            fromTokenSpecificChain !== toTokenSpecificChain))
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

      // Calculate the trade using USD values
      const fromValueUSD = fromAmount * fromPrice.price;

      // Validate balances
      const currentBalance = await this.balanceManager.getBalance(
        teamId,
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

      // Check for cross-chain trades if not allowed (this appears to be a duplicate check, keeping for safety)
      if (
        !features.ALLOW_CROSS_CHAIN_TRADING &&
        (fromTokenChain !== toTokenChain ||
          (fromTokenSpecificChain &&
            toTokenSpecificChain &&
            fromTokenSpecificChain !== toTokenSpecificChain))
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

      // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
      const portfolioValue = await this.calculatePortfolioValue(teamId);
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

      let effectiveFromValueUSD = fromValueUSD;
      let crossChainFeePercentage = 0;
      let crossChainFixedFeeUSD = 0;

      // Check if this is a cross-chain trade and apply appropriate fees
      const isCrossChainTrade =
        fromTokenChain !== toTokenChain ||
        fromTokenSpecificChain !== toTokenSpecificChain;

      if (isCrossChainTrade) {
        const { feePercentage, fixedFeeUSD, totalFeeUSD, effectiveValueUSD } =
          this.calculateCrossChainFees(
            fromValueUSD,
            fromTokenChain,
            toTokenChain,
            fromTokenSpecificChain,
            toTokenSpecificChain,
          );

        crossChainFeePercentage = feePercentage;
        crossChainFixedFeeUSD = fixedFeeUSD;
        effectiveFromValueUSD = effectiveValueUSD;

        console.log(`[TradeSimulator] Cross-chain fees applied:
                Cross-Chain Fee: ${feePercentage.toFixed(4)}% + $${fixedFeeUSD.toFixed(2)} fixed fee
                Total Fee Amount: $${totalFeeUSD.toFixed(6)}
                Effective Value After Cross-Chain Fees: $${effectiveValueUSD.toFixed(6)}
        `);
      }

      // Calculate slippage
      const slippageResult = this.calculateSlippage(effectiveFromValueUSD);
      const slippagePercentage = slippageResult.slippagePercentage;
      const effectiveFromValueAfterSlippage = slippageResult.effectiveValueAfterSlippage;
      const toAmount = effectiveFromValueAfterSlippage / toPrice.price;

      // Debug logging for price calculations
      console.log(`[TradeSimulator] Trade calculation details:
                From Token (${fromToken}):
                - Amount: ${fromAmount}
                - Price: $${fromPrice.price}
                - USD Value: $${fromValueUSD.toFixed(6)}
                
                ${isCrossChainTrade
          ? `Cross-Chain Fees:
                - Percentage Fee: ${crossChainFeePercentage.toFixed(4)}%
                - Fixed Fee: $${crossChainFixedFeeUSD.toFixed(2)}
                - Effective USD Value After Fees: $${effectiveFromValueUSD.toFixed(6)}`
          : ""
        }
                
                Slippage:
                - Percentage: ${slippagePercentage.toFixed(4)}%
                - Effective USD Value After Slippage: ${effectiveFromValueAfterSlippage.toFixed(6)}

                To Token (${toToken}):
                - Price: $${toPrice.price}
                - Calculated Amount: ${toAmount.toFixed(6)}

                Exchange Rate: 1 ${fromToken} = ${(toAmount / fromAmount).toFixed(6)} ${toToken}
            `);

      // Execute the trade
      await this.balanceManager.subtractAmount(teamId, fromToken, fromAmount);
      await this.balanceManager.addAmount(teamId, toToken, toAmount);

      // Create trade record
      const trade: Trade = {
        id: uuidv4(),
        timestamp: new Date(),
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        price: toAmount / fromAmount, // Exchange rate
        success: true,
        teamId,
        competitionId,
        reason,
        // Add chain information to the trade record
        fromChain: fromTokenChain,
        toChain: toTokenChain,
        fromSpecificChain: fromPrice.specificChain,
        toSpecificChain: toPrice.specificChain,
        // Add cross-chain fee information if applicable
        crossChainFee: isCrossChainTrade
          ? {
            percentage: crossChainFeePercentage,
            fixedFeeUSD: crossChainFixedFeeUSD,
          }
          : undefined,
      };

      // Store the trade in database
      await repositories.tradeRepository.create(trade);

      // Update cache
      const cachedTrades = this.tradeCache.get(teamId) || [];
      cachedTrades.unshift(trade); // Add to beginning of array (newest first)
      // Limit cache size to 100 trades per team
      if (cachedTrades.length > 100) {
        cachedTrades.pop();
      }
      this.tradeCache.set(teamId, cachedTrades);

      console.log(`[TradeSimulator] Trade executed successfully:
                Initial ${fromToken} Balance: ${currentBalance}
                New ${fromToken} Balance: ${await this.balanceManager.getBalance(teamId, fromToken)}
                New ${toToken} Balance: ${await this.balanceManager.getBalance(teamId, toToken)}
            `);

      // Trigger a portfolio snapshot after successful trade execution
      // We run this asynchronously without awaiting to avoid delaying the trade response
      services.competitionManager
        .takePortfolioSnapshots(competitionId)
        .catch((error) => {
          console.error(
            `[TradeSimulator] Error taking portfolio snapshot after trade: ${error.message}`,
          );
        });
      console.log(
        `[TradeSimulator] Portfolio snapshot triggered for competition ${competitionId} after trade`,
      );

      return {
        success: true,
        trade,
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
   * Get all trades for a team
   * @param teamId The team ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getTeamTrades(
    teamId: string,
    limit?: number,
    offset?: number,
  ): Promise<Trade[]> {
    try {
      // If limit is small and we have cache, use it
      if (
        limit &&
        limit <= 100 &&
        offset === undefined &&
        this.tradeCache.has(teamId)
      ) {
        const cachedTrades = this.tradeCache.get(teamId) || [];
        if (cachedTrades.length >= limit) {
          return cachedTrades.slice(0, limit);
        }
      }

      // Get from database
      const trades = await repositories.tradeRepository.getTeamTrades(
        teamId,
        limit,
        offset,
      );

      // Update cache if fetching recent trades
      if (!offset && (!limit || limit <= 100)) {
        this.tradeCache.set(teamId, [...trades]);
      }

      return trades;
    } catch (error) {
      console.error(`[TradeSimulator] Error getting team trades:`, error);
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
  ): Promise<Trade[]> {
    try {
      return await repositories.tradeRepository.getCompetitionTrades(
        competitionId,
        limit,
        offset,
      );
    } catch (error) {
      console.error(
        `[TradeSimulator] Error getting competition trades:`,
        error,
      );
      return [];
    }
  }

  /**
   * Calculate a team's portfolio value in USD
   * @param teamId The team ID
   * @returns Total portfolio value in USD
   */
  async calculatePortfolioValue(teamId: string): Promise<number> {
    let totalValue = 0;
    const balances = await this.balanceManager.getAllBalances(teamId);

    for (const balance of balances) {
      const price = await this.priceTracker.getPrice(balance.token);
      if (price) {
        totalValue += balance.amount * price.price;
      }
    }

    return totalValue;
  }

  /**
   * Check if trade simulator is healthy
   * For system health check use
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Simple check to see if we can connect to the database
      await repositories.tradeRepository.count();
      return true;
    } catch (error) {
      console.error("[TradeSimulator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Calculate cross-chain fees for trading between different blockchains
   * Public method that can be used by controllers to get fee estimates
   * 
   * @param valueUSD The USD value being transferred
   * @param fromChain The source blockchain
   * @param toChain The destination blockchain
   * @param fromSpecificChain Optional specific source chain
   * @param toSpecificChain Optional specific destination chain
   * @returns Fee details and effective USD value after fees
   */
  getCrossChainFees(
    valueUSD: number,
    fromChain: BlockchainType,
    toChain: BlockchainType,
    fromSpecificChain?: SpecificChain,
    toSpecificChain?: SpecificChain,
  ): {
    feePercentage: number;
    fixedFeeUSD: number;
    totalFeeUSD: number;
    effectiveValueUSD: number;
  } {
    return this.calculateCrossChainFees(
      valueUSD,
      fromChain,
      toChain,
      fromSpecificChain,
      toSpecificChain
    );
  }

  /**
   * Calculate slippage for a trade based on its USD value
   * 
   * @param valueUSD The USD value of the trade after any fees
   * @returns Slippage percentage and effective value after slippage
   */
  calculateSlippage(valueUSD: number): {
    slippagePercentage: number;
    effectiveValueAfterSlippage: number;
  } {
    // Apply slippage based on trade size
    const baseSlippage = (valueUSD / 10000) * 0.05; // 0.05% per $10,000
    const actualSlippage = baseSlippage * (0.9 + Math.random() * 0.2); // ±10% randomness
    const slippagePercentage = actualSlippage * 100;

    // Calculate value after slippage
    const effectiveValueAfterSlippage = valueUSD * (1 - actualSlippage);

    return {
      slippagePercentage,
      effectiveValueAfterSlippage
    };
  }

  /**
   * Calculate cross-chain fees for trades between different blockchains
   * This simulates the cost of bridging assets between chains and/or using CEX intermediaries
   *
   * @param valueUSD The USD value being transferred
   * @param fromChain The source blockchain
   * @param toChain The destination blockchain
   * @param fromSpecificChain Optional specific source chain
   * @param toSpecificChain Optional specific destination chain
   * @returns Fee details and effective USD value after fees
   */
  private calculateCrossChainFees(
    valueUSD: number,
    fromChain: BlockchainType,
    toChain: BlockchainType,
    fromSpecificChain?: SpecificChain,
    toSpecificChain?: SpecificChain,
  ): {
    feePercentage: number;
    fixedFeeUSD: number;
    totalFeeUSD: number;
    effectiveValueUSD: number;
  } {
    // Base percentage fee for cross-chain transactions (0.3% base)
    let baseFeePercentage = 0.3;

    // Base fixed fee in USD (fairly conservative)
    let baseFixedFeeUSD = 2.5;

    // Different blockchain combinations have different fee structures

    // 1. EVM-to-EVM transfers (different EVM chains)
    if (
      fromChain === "evm" &&
      toChain === "evm" &&
      fromSpecificChain &&
      toSpecificChain &&
      fromSpecificChain !== toSpecificChain
    ) {
      // Apply fees based on specific chains
      // Higher gas chains get higher fees

      // High gas chains: eth only - 0.15% additional fee
      const highGasChains = ["eth"];

      // Medium gas chains: arbitrum, optimism, base - 0.05% additional fee
      const mediumGasChains = ["arbitrum", "optimism", "base"];

      // Low gas chains: polygon, bsc, avalanche, linea - no additional fee

      // Additional fees based on source chain
      if (highGasChains.includes(fromSpecificChain)) {
        baseFeePercentage += 0.15;
        baseFixedFeeUSD += 3; // Higher fixed costs for Ethereum transactions (reduced from $5 to $3)
      } else if (mediumGasChains.includes(fromSpecificChain)) {
        baseFeePercentage += 0.05;
        baseFixedFeeUSD += 1.5; // Reduced from $2 to $1.50
      }

      // Additional fees based on destination chain
      if (highGasChains.includes(toSpecificChain)) {
        baseFeePercentage += 0.15;
        baseFixedFeeUSD += 3; // Reduced from $5 to $3
      } else if (mediumGasChains.includes(toSpecificChain)) {
        baseFeePercentage += 0.05;
        baseFixedFeeUSD += 1.5; // Reduced from $2 to $1.50
      }
    }
    // 2. SVM-to-EVM or EVM-to-SVM transfers (cross-ecosystem)
    else if (
      (fromChain === "svm" && toChain === "evm") ||
      (fromChain === "evm" && toChain === "svm")
    ) {
      // Cross-ecosystem transfers are more expensive
      baseFeePercentage += 0.3; // Additional 0.3% fee
      baseFixedFeeUSD += 3; // Higher fixed cost (reduced from $5 to $3)

      // Define gas classifications for specific chains
      const mediumGasChains = ["arbitrum", "optimism", "base"];

      // If transferring to or from high-gas chain (Ethereum), add more cost
      if (fromSpecificChain === "eth" || toSpecificChain === "eth") {
        baseFeePercentage += 0.15; // Additional 0.15% fee
        baseFixedFeeUSD += 2.5; // Additional fixed cost (reduced from $4 to $2.50)
      } else if (
        mediumGasChains.includes(fromSpecificChain as SpecificChain) ||
        mediumGasChains.includes(toSpecificChain as SpecificChain)
      ) {
        // Medium gas chains get a smaller additional fee
        baseFeePercentage += 0.05;
        baseFixedFeeUSD += 1.5; // Reduced from $2 to $1.50
      }
    }

    // Apply scale-based fee adjustment for transaction size
    let percentageScaleFactor = 1.0;
    let fixedFeeScaleFactor = 1.0;

    if (valueUSD > 50000) {
      percentageScaleFactor = 0.7; // 30% discount for very large transfers
      fixedFeeScaleFactor = 0.5; // Fixed fee reduced by half
    } else if (valueUSD > 10000) {
      percentageScaleFactor = 0.8; // 20% discount for large transfers
      fixedFeeScaleFactor = 0.6; // 40% off fixed fee
    } else if (valueUSD > 5000) {
      percentageScaleFactor = 0.9; // 10% discount for medium transfers
      fixedFeeScaleFactor = 0.7; // 30% off fixed fee
    } else if (valueUSD < 100) {
      // For small transactions, reduce fixed fees significantly
      fixedFeeScaleFactor = Math.max(0.1, valueUSD / 100); // Fixed fee scales down to 10% for very small transactions
    }

    // Apply final fee calculation with scale factors
    const finalFeePercentage = baseFeePercentage * percentageScaleFactor;
    let finalFixedFeeUSD = baseFixedFeeUSD * fixedFeeScaleFactor;

    // Apply small random variation to make fees more realistic (±10%)
    const randomFactor = 0.9 + Math.random() * 0.2; // Between 0.9 and 1.1
    const actualFeePercentage = finalFeePercentage * randomFactor;

    // Calculate total fee amount
    let percentageFeeUSD = valueUSD * (actualFeePercentage / 100);
    let totalFeeUSD = percentageFeeUSD + finalFixedFeeUSD;

    // Cap the fee at 80% of the transaction value to prevent negative balances
    // This ensures trades are always possible, but small trades remain expensive
    if (totalFeeUSD > valueUSD * 0.8) {
      totalFeeUSD = valueUSD * 0.8;
      // Adjust the percentage fee for display purposes when capped
      percentageFeeUSD = totalFeeUSD - finalFixedFeeUSD;
      if (percentageFeeUSD < 0) {
        // If fixed fee would be too high, adjust both components
        finalFixedFeeUSD = totalFeeUSD * 0.5;
        percentageFeeUSD = totalFeeUSD * 0.5;
      }
    }

    // Calculate effective value after fees
    const effectiveValueUSD = valueUSD - totalFeeUSD;

    // Recalculate actual percentage for display (total percentage minus fixed fee)
    const displayFeePercentage = (percentageFeeUSD / valueUSD) * 100;

    return {
      feePercentage: displayFeePercentage,
      fixedFeeUSD: finalFixedFeeUSD,
      totalFeeUSD,
      effectiveValueUSD,
    };
  }
}
