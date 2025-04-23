import { v4 as uuidv4 } from 'uuid';
import { Trade, TradeResult, BlockchainType, SpecificChain } from '../types';
import { BalanceManager } from './balance-manager.service';
import { PriceTracker } from './price-tracker.service';
import { repositories } from '../database';
import { config, features } from '../config';
import { services } from './index';

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
  // Whether to allow cross-chain trading
  private allowCrossChainTrading: boolean;
  // Maximum trade percentage of portfolio value
  private maxTradePercentage: number;

  constructor(balanceManager: BalanceManager, priceTracker: PriceTracker) {
    this.balanceManager = balanceManager;
    this.priceTracker = priceTracker;
    this.tradeCache = new Map();
    // Use features config instead of directly accessing environment variable
    this.allowCrossChainTrading = features.ALLOW_CROSS_CHAIN_TRADING;
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
                Slippage Tolerance: ${slippageTolerance || 'default'}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : 'none'}
            `);

      // Validate minimum trade amount
      if (fromAmount < 0.000001) {
        console.log(`[TradeSimulator] Trade amount too small: ${fromAmount}`);
        return {
          success: false,
          error: 'Trade amount too small (minimum: 0.000001)',
        };
      }

      // Validate reason is provided
      if (!reason) {
        console.log(`[TradeSimulator] Trade reason is required`);
        return {
          success: false,
          error: 'Trade reason is required',
        };
      }

      // Prevent trading between identical tokens
      if (fromToken === toToken) {
        console.log(`[TradeSimulator] Cannot trade between identical tokens: ${fromToken}`);
        return {
          success: false,
          error: 'Cannot trade between identical tokens',
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
          `[TradeSimulator] Using provided chain for fromToken: ${fromTokenChain}, specificChain: ${fromTokenSpecificChain || 'none'}`,
        );
      } else {
        fromTokenChain = this.priceTracker.determineChain(fromToken);
        console.log(`[TradeSimulator] Detected chain for fromToken: ${fromTokenChain}`);
      }

      // For the destination token
      if (chainOptions?.toChain) {
        toTokenChain = chainOptions.toChain;
        toTokenSpecificChain = chainOptions.toSpecificChain;
        console.log(
          `[TradeSimulator] Using provided chain for toToken: ${toTokenChain}, specificChain: ${toTokenSpecificChain || 'none'}`,
        );
      } else {
        toTokenChain = this.priceTracker.determineChain(toToken);
        console.log(`[TradeSimulator] Detected chain for toToken: ${toTokenChain}`);
      }

      // Get prices with chain information for better performance
      const fromPrice = await this.priceTracker.getPrice(
        fromToken,
        fromTokenChain,
        fromTokenSpecificChain,
      );
      const toPrice = await this.priceTracker.getPrice(toToken, toTokenChain, toTokenSpecificChain);

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
          error: 'Unable to determine price for tokens',
        };
      }

      // Check for cross-chain trades if not allowed
      if (
        !this.allowCrossChainTrading &&
        (fromTokenChain !== toTokenChain ||
          (fromTokenSpecificChain &&
            toTokenSpecificChain &&
            fromTokenSpecificChain !== toTokenSpecificChain))
      ) {
        console.log(
          `[TradeSimulator] Cross-chain trading is disabled. Cannot trade between ${fromTokenChain}(${fromTokenSpecificChain || 'none'}) and ${toTokenChain}(${toTokenSpecificChain || 'none'})`,
        );
        return {
          success: false,
          error: 'Cross-chain trading is disabled. Both tokens must be on the same blockchain.',
        };
      }

      // Calculate the trade using USD values
      const fromValueUSD = fromAmount * fromPrice.price;

      // Validate balances
      const currentBalance = await this.balanceManager.getBalance(teamId, fromToken);
      console.log(`[TradeSimulator] Current balance of ${fromToken}: ${currentBalance}`);

      if (currentBalance < fromAmount) {
        console.log(`[TradeSimulator] Insufficient balance: ${currentBalance} < ${fromAmount}`);
        return {
          success: false,
          error: 'Insufficient balance',
        };
      }

      // Check for cross-chain trades if not allowed
      if (
        !this.allowCrossChainTrading &&
        (fromTokenChain !== toTokenChain ||
          (fromTokenSpecificChain &&
            toTokenSpecificChain &&
            fromTokenSpecificChain !== toTokenSpecificChain))
      ) {
        console.log(
          `[TradeSimulator] Cross-chain trading is disabled. Cannot trade between ${fromTokenChain}(${fromTokenSpecificChain || 'none'}) and ${toTokenChain}(${toTokenSpecificChain || 'none'})`,
        );
        return {
          success: false,
          error: 'Cross-chain trading is disabled. Both tokens must be on the same blockchain.',
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

      // Apply slippage based on trade size
      const baseSlippage = (fromValueUSD / 10000) * 0.05; // 0.05% per $10,000 (10x lower than before)
      const actualSlippage = baseSlippage * (0.9 + Math.random() * 0.2); // ±10% randomness (reduced from ±20%)
      const slippagePercentage = actualSlippage * 100;

      // Calculate final amount with slippage
      const effectiveFromValueUSD = fromValueUSD * (1 - actualSlippage);
      const toAmount = effectiveFromValueUSD / toPrice.price;

      // Debug logging for price calculations
      console.log(`[TradeSimulator] Trade calculation details:
                From Token (${fromToken}):
                - Amount: ${fromAmount}
                - Price: $${fromPrice.price}
                - USD Value: $${fromValueUSD.toFixed(6)}
                
                Slippage:
                - Base: ${(baseSlippage * 100).toFixed(4)}%
                - Actual: ${slippagePercentage.toFixed(4)}%
                - Effective USD Value: $${effectiveFromValueUSD.toFixed(6)}

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
      services.competitionManager.takePortfolioSnapshots(competitionId).catch((error) => {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during trade';
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
  async getTeamTrades(teamId: string, limit?: number, offset?: number): Promise<Trade[]> {
    try {
      // If limit is small and we have cache, use it
      if (limit && limit <= 100 && offset === undefined && this.tradeCache.has(teamId)) {
        const cachedTrades = this.tradeCache.get(teamId) || [];
        if (cachedTrades.length >= limit) {
          return cachedTrades.slice(0, limit);
        }
      }

      // Get from database
      const trades = await repositories.tradeRepository.getTeamTrades(teamId, limit, offset);

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
      return await repositories.tradeRepository.getCompetitionTrades(competitionId, limit, offset);
    } catch (error) {
      console.error(`[TradeSimulator] Error getting competition trades:`, error);
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
      console.error('[TradeSimulator] Health check failed:', error);
      return false;
    }
  }
}
