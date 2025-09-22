import { SelectTrade } from "@recallnet/db/schema/trading/types";

import { serviceLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { CompetitionService } from "@/services/competition.service.js";
import { DexScreenerProvider } from "@/services/providers/dexscreener.provider.js";
import { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

// Define an interface for chain options
interface ChainOptions {
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

// Interface for getTradeQuote parameters
interface GetQuoteParams {
  fromToken: string;
  toToken: string;
  amount: number;
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

// Interface for trade quote result
interface TradeQuoteResult {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  slippage: number;
  tradeAmountUsd: number;
  prices: {
    fromToken: number;
    toToken: number;
  };
  symbols: {
    fromTokenSymbol: string;
    toTokenSymbol: string;
  };
  chains: {
    fromChain: string;
    toChain: string;
  };
}

/**
 * Trade Execution Service
 * Handles trade execution with competition validation and constraints
 */
export class TradeExecutionService {
  private competitionService: CompetitionService;
  private tradeSimulatorService: TradeSimulatorService;
  private dexScreenerProvider: DexScreenerProvider;

  constructor(
    competitionService: CompetitionService,
    tradeSimulatorService: TradeSimulatorService,
  ) {
    this.competitionService = competitionService;
    this.tradeSimulatorService = tradeSimulatorService;
    this.dexScreenerProvider = new DexScreenerProvider();
  }

  /**
   * Execute a trade between two tokens with competition validation
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   * @param slippageTolerance Optional slippage tolerance
   * @param chainOptions Optional chain specification
   * @returns The executed trade details
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
      serviceLogger.debug(`\n[TradeExecution] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Validate competition existence and status
      const competition =
        await this.competitionService.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, `Competition not found: ${competitionId}`);
      }

      // Check if competition has ended
      const now = new Date();
      if (competition.endDate !== null && now > competition.endDate) {
        throw new ApiError(
          400,
          `Competition has ended. Trading is no longer allowed for competition: ${competition.name}`,
        );
      }

      // Check if agent is registered and active
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

      // Delegate the actual trade execution to TradeSimulatorService
      return await this.tradeSimulatorService.executeTradeInternal(
        agentId,
        competitionId,
        fromToken,
        toToken,
        fromAmount,
        reason,
        slippageTolerance,
        chainOptions,
      );
    } catch (error) {
      serviceLogger.error(`[TradeExecution] Error executing trade:`, error);
      throw error;
    }
  }

  /**
   * Get a quote for a trade between two tokens
   * @param params The quote parameters
   * @returns Trade quote result with prices, amounts, and exchange rates
   */
  async getTradeQuote(params: GetQuoteParams): Promise<TradeQuoteResult> {
    // Delegate to TradeSimulatorService
    return await this.tradeSimulatorService.getTradeQuote(params);
  }
}
