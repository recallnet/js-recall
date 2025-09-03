import { v4 as uuidv4 } from "uuid";

import { config } from "@/config/index.js";
import { findByCompetition } from "@/database/repositories/agent-repository.js";
import { batchCreateOnChainTradesWithBalances } from "@/database/repositories/trade-repository.js";
import { InsertTrade, SelectTrade } from "@/database/schema/trading/types.js";
import { serviceLogger } from "@/lib/logger.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";
import { IndexedTrade, IndexedTransfer } from "@/types/live-trading.js";

import { BalanceManager } from "./balance-manager.service.js";
import { CompetitionManager } from "./competition-manager.service.js";
import { PriceTracker } from "./price-tracker.service.js";

/**
 * Enriched trade with calculated values and metadata
 */
interface EnrichedTrade extends IndexedTrade {
  fromAmountDecimal: number;
  toAmountDecimal: number;
  tradeAmountUsd: number;
  gasCostUsd: number;
  fromTokenSymbol: string;
  toTokenSymbol: string;
}

/**
 * Result of detecting self-funding or chain exits
 */
interface DetectionResult {
  alerts: SelfFundingAlert[];
  processed: number;
}

/**
 * Self-funding alert data
 */
interface SelfFundingAlert {
  agentId: string;
  competitionId: string;
  chain: string;
  tokenAddress: string;
  amountIncreased: number;
  valueUsd: number;
  txHash: string;
  detectedAt: Date;
  reviewNote: string;
}

/**
 * Get the WETH (Wrapped ETH) address for a specific chain
 * Used to fetch ETH price for gas calculations
 * Note: We use WETH price as a proxy for ETH price (1:1 pegged)
 *
 * @param chain - The chain name from Envio (e.g., "ethereum", "polygon")
 * @returns The WETH contract address for that chain
 */
function getWethAddress(chain: string): string {
  // Map Envio chain names to our config chain names
  // Only include chains that are configured in our system
  const chainMap: Record<string, keyof typeof config.specificChainTokens> = {
    ethereum: "eth",
    polygon: "polygon",
    arbitrum: "arbitrum",
    optimism: "optimism",
    base: "base",
  };

  const specificChain = chainMap[chain.toLowerCase()];

  if (!specificChain) {
    // Default to Ethereum WETH if chain not found
    return config.specificChainTokens.eth.eth;
  }

  // Return the WETH address for the specific chain
  // Note: In our config, "eth" token on each chain is actually WETH
  // For Solana (svm), we return SOL address
  if (specificChain === "svm") {
    return config.specificChainTokens.svm.sol;
  }

  return config.specificChainTokens[specificChain].eth;
}

// Chain name mappings
const CHAIN_NAME_MAP: Record<string, SpecificChain> = {
  ethereum: "eth",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  // Add more mappings as needed
};

/**
 * Live Trade Processor Service
 * Handles business logic for processing on-chain trades from indexers
 * Follows same architectural pattern as TradeSimulator but for live trades
 *
 * @remarks
 * This service is responsible for:
 * - Filtering trades by competition participants
 * - Enriching trades with price data
 * - Calculating USD values
 * - Mapping to database schema
 * - Coordinating balance updates with trade creation
 */
export class LiveTradeProcessor {
  private readonly priceTracker: PriceTracker;
  private readonly competitionManager: CompetitionManager;
  private readonly balanceManager: BalanceManager;

  constructor(
    priceTracker: PriceTracker,
    competitionManager: CompetitionManager,
    balanceManager: BalanceManager,
  ) {
    this.priceTracker = priceTracker;
    this.competitionManager = competitionManager;
    this.balanceManager = balanceManager;
  }

  /**
   * Process raw indexed trades for a competition
   * Handles validation, enrichment, persistence with atomic balance updates
   *
   * @param competitionId Competition ID to process trades for
   * @param indexedTrades Raw trades from the indexer
   * @returns Object containing persisted trades and balance update summary
   */
  async processCompetitionTrades(
    competitionId: string,
    indexedTrades: IndexedTrade[],
  ): Promise<{
    trades: SelectTrade[];
    balanceUpdates: {
      totalUpdated: number;
      byAgent: Map<string, { fromTokens: Set<string>; toTokens: Set<string> }>;
    };
  }> {
    const startTime = Date.now();

    try {
      serviceLogger.info(
        `[LiveTradeProcessor] Processing ${indexedTrades.length} trades for competition ${competitionId}`,
      );

      // 1. Get competition agents and build lookup map
      const agents = await this.getCompetitionAgentsWithWallets(competitionId);
      const agentsByWallet = new Map(
        agents.map((a) => [a.walletAddress!.toLowerCase(), a]),
      );

      serviceLogger.debug(
        `[LiveTradeProcessor] Found ${agents.length} agents with wallets in competition`,
      );

      // 2. Filter trades by competition participants AND supported chains
      const relevantTrades = indexedTrades.filter((trade) => {
        // Check if trade involves a competition participant
        const hasParticipant =
          agentsByWallet.has(trade.sender.toLowerCase()) ||
          agentsByWallet.has(trade.recipient.toLowerCase());

        // Check if trade is on a supported chain
        const isSupportedChain =
          CHAIN_NAME_MAP[trade.chain.toLowerCase()] !== undefined;

        if (!isSupportedChain && hasParticipant) {
          serviceLogger.debug(
            `[LiveTradeProcessor] Skipping trade ${trade.id} on unsupported chain: ${trade.chain}`,
          );
        }

        return hasParticipant && isSupportedChain;
      });

      if (relevantTrades.length === 0) {
        serviceLogger.info(
          `[LiveTradeProcessor] No relevant trades found for competition ${competitionId}`,
        );
        return {
          trades: [],
          balanceUpdates: {
            totalUpdated: 0,
            byAgent: new Map(),
          },
        };
      }

      // 3. Check for trades with unknown tokens (should be rare with enrichment)
      const tradesWithUnknown = relevantTrades.filter(
        (trade) => trade.tokenIn === "unknown" || trade.tokenOut === "unknown",
      );

      if (tradesWithUnknown.length > 0) {
        serviceLogger.warn(
          `[LiveTradeProcessor] Found ${tradesWithUnknown.length}/${relevantTrades.length} trades still with unknown tokens after enrichment`,
        );

        // Log a sample of problematic trades for debugging
        tradesWithUnknown.slice(0, 3).forEach((trade) => {
          serviceLogger.debug(
            `[LiveTradeProcessor] Unknown tokens in trade ${trade.id}: tokenIn=${trade.tokenIn}, tokenOut=${trade.tokenOut}, protocol=${trade.protocol}`,
          );
        });
      }

      // Filter to only process complete trades
      const completeTradesOnly = relevantTrades.filter(
        (trade) => trade.tokenIn !== "unknown" && trade.tokenOut !== "unknown",
      );

      serviceLogger.info(
        `[LiveTradeProcessor] Processing ${completeTradesOnly.length}/${relevantTrades.length} trades (${(
          (completeTradesOnly.length / relevantTrades.length) *
          100
        ).toFixed(1)}% complete)`,
      );

      // 4. Enrich trades with prices and calculate USD values
      const enrichedTrades =
        await this.enrichTradesWithPrices(completeTradesOnly);

      // 5. Filter out trades without price data from DexScreener
      // NOTE: At this point, all trades have valid token addresses (not "unknown"),
      // but DexScreener may not have price data for all tokens.
      // TODO: In production, consider using additional price providers (CoinGecko, CoinMarketCap, etc.)
      // to improve coverage for tokens not listed on DexScreener.
      const tradesWithPrices = enrichedTrades.filter((trade) => {
        // Must have valid price data to calculate USD values
        const hasValidPrices = trade.tradeAmountUsd > 0;

        if (!hasValidPrices) {
          serviceLogger.warn(
            `[LiveTradeProcessor] Skipping trade - no price data from DexScreener: ` +
              `${trade.tokenIn} -> ${trade.tokenOut} on ${trade.chain}`,
          );
        }

        return hasValidPrices;
      });

      if (tradesWithPrices.length < enrichedTrades.length) {
        serviceLogger.info(
          `[LiveTradeProcessor] Filtered out ${enrichedTrades.length - tradesWithPrices.length} trades ` +
            `without DexScreener price data. Processing ${tradesWithPrices.length}/${enrichedTrades.length} trades.`,
        );
      }

      // 6. Map to database schema
      const mappedTrades = this.mapToDbSchema(
        tradesWithPrices,
        competitionId,
        agentsByWallet,
      );

      // 7. CRITICAL: Persist trades with atomic balance updates
      // This is what makes live trading competitions work!
      const result = await batchCreateOnChainTradesWithBalances(mappedTrades);

      const duration = Date.now() - startTime;
      serviceLogger.info(
        `[LiveTradeProcessor] Processed ${mappedTrades.length} trades in ${duration}ms. ` +
          `Persisted ${result.trades.length} trades with ${result.balanceUpdates.totalUpdated} balance updates`,
      );

      return result;
    } catch (error) {
      serviceLogger.error(
        `[LiveTradeProcessor] Error processing trades for competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process transfers to detect self-funding or chain exits
   *
   * @param competitionId Competition ID
   * @param transfers Raw transfers from the indexer
   * @returns Detection results with any alerts
   */
  async detectSelfFunding(
    competitionId: string,
    transfers: IndexedTransfer[],
  ): Promise<DetectionResult> {
    try {
      serviceLogger.debug(
        `[LiveTradeProcessor] Detecting self-funding from ${transfers.length} transfers`,
      );

      const agents = await this.getCompetitionAgentsWithWallets(competitionId);
      const agentsByWallet = new Map(
        agents.map((a) => [a.walletAddress!.toLowerCase(), a]),
      );

      // Collect all unique tokens from transfers for bulk price fetching
      const uniqueTokens = new Set<string>();
      transfers.forEach((transfer) => {
        uniqueTokens.add(transfer.token.toLowerCase());
      });

      // Bulk fetch all token prices at once
      const priceReports = await this.priceTracker.getBulkPrices(
        Array.from(uniqueTokens),
      );

      // Convert to a map for easy lookup
      const tokenPrices = new Map<
        string,
        { price: number; decimals: number }
      >();
      priceReports.forEach((report, token) => {
        if (report) {
          tokenPrices.set(token.toLowerCase(), {
            price: report.price,
            decimals: 18, // Default decimals
          });
        }
      });

      const alerts: SelfFundingAlert[] = [];

      for (const transfer of transfers) {
        const fromAgent = agentsByWallet.get(transfer.from.toLowerCase());
        const toAgent = agentsByWallet.get(transfer.to.toLowerCase());
        const tokenPrice = tokenPrices.get(transfer.token.toLowerCase());

        // Self-funding: non-agent sends to agent
        if (!fromAgent && toAgent) {
          const amountDecimal =
            Number(transfer.value) / Math.pow(10, tokenPrice?.decimals || 18);
          const valueUsd = amountDecimal * (tokenPrice?.price || 0);

          alerts.push({
            agentId: toAgent.id,
            competitionId,
            chain: transfer.chain,
            tokenAddress: transfer.token,
            amountIncreased: amountDecimal,
            valueUsd,
            txHash: transfer.transactionHash,
            detectedAt: new Date(),
            reviewNote:
              "Potential self-funding detected - incoming transfer from non-competition address",
          });

          serviceLogger.warn(
            `[LiveTradeProcessor] Self-funding alert: Agent ${toAgent.id} received ${amountDecimal} tokens worth $${valueUsd.toFixed(2)}`,
          );
        }

        // Chain exit: agent sends to non-agent
        if (fromAgent && !toAgent) {
          const amountDecimal =
            Number(transfer.value) / Math.pow(10, tokenPrice?.decimals || 18);
          const valueUsd = amountDecimal * (tokenPrice?.price || 0);

          alerts.push({
            agentId: fromAgent.id,
            competitionId,
            chain: transfer.chain,
            tokenAddress: transfer.token,
            amountIncreased: -amountDecimal, // Negative for exit
            valueUsd: -valueUsd,
            txHash: transfer.transactionHash,
            detectedAt: new Date(),
            reviewNote:
              "Potential chain exit detected - outgoing transfer to non-competition address",
          });

          serviceLogger.warn(
            `[LiveTradeProcessor] Chain exit alert: Agent ${fromAgent.id} sent ${amountDecimal} tokens worth $${valueUsd.toFixed(2)}`,
          );
        }
      }

      return {
        alerts,
        processed: transfers.length,
      };
    } catch (error) {
      serviceLogger.error(
        `[LiveTradeProcessor] Error detecting self-funding:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition agents with verified wallet addresses
   * Uses efficient single-query method from repository
   *
   * @param competitionId Competition ID
   * @returns Agents with wallet addresses
   */
  private async getCompetitionAgentsWithWallets(
    competitionId: string,
  ): Promise<Array<{ id: string; walletAddress: string }>> {
    // Use the efficient repository method that gets all agent details in one query
    const { agents } = await findByCompetition(competitionId, {
      filter: undefined,
      sort: undefined,
      limit: 10000, // High limit to get all agents
      offset: 0,
    });

    // Filter to only agents with verified wallet addresses
    return agents
      .filter((agent) => agent.walletAddress !== null)
      .map((agent) => ({
        id: agent.id,
        walletAddress: agent.walletAddress!,
      }));
  }

  /**
   * Enrich trades with price data and calculate USD values
   *
   * @param trades Raw indexed trades
   * @returns Enriched trades with prices and USD values
   */
  private async enrichTradesWithPrices(
    trades: IndexedTrade[],
  ): Promise<EnrichedTrade[]> {
    // Get unique tokens
    const tokens = new Set<string>();
    trades.forEach((trade) => {
      tokens.add(trade.tokenIn.toLowerCase());
      tokens.add(trade.tokenOut.toLowerCase());
    });

    // Add WETH addresses for each chain (for gas calculations)
    // We need ETH price for each chain that has trades
    const chains = new Set(trades.map((t) => t.chain));
    chains.forEach((chain) => {
      const wethAddress = getWethAddress(chain);
      tokens.add(wethAddress.toLowerCase());
    });

    serviceLogger.debug(
      `[LiveTradeProcessor] Fetching prices for ${tokens.size} unique tokens`,
    );

    // Use the efficient bulk price fetching method from PriceTracker
    const priceReports = await this.priceTracker.getBulkPrices(
      Array.from(tokens),
    );

    // Convert PriceReports to our internal price format
    const priceMap = new Map<
      string,
      { price: number; symbol: string; decimals: number } | null
    >();

    priceReports.forEach((report, token) => {
      if (report) {
        const priceData = {
          price: report.price,
          symbol: report.symbol,
          decimals: 18, // Default decimals, could be enhanced later
        };
        priceMap.set(token.toLowerCase(), priceData);
      } else {
        priceMap.set(token.toLowerCase(), null);
      }
    });

    // Enrich each trade
    return trades.map((trade) => {
      const fromPrice = priceMap.get(trade.tokenIn.toLowerCase());
      const toPrice = priceMap.get(trade.tokenOut.toLowerCase());

      // Get decimals (default to 18 if unknown)
      const fromDecimals = fromPrice?.decimals || 18;
      const toDecimals = toPrice?.decimals || 18;

      // Calculate amounts with proper decimals
      const fromAmountDecimal =
        Number(trade.amountIn) / Math.pow(10, fromDecimals);
      const toAmountDecimal =
        Number(trade.amountOut) / Math.pow(10, toDecimals);
      const tradeAmountUsd = fromAmountDecimal * (fromPrice?.price || 0);

      // Calculate gas cost in USD
      // Get the WETH price for this specific chain
      const wethAddress = getWethAddress(trade.chain);
      const ethPriceData = priceMap.get(wethAddress.toLowerCase());
      const ethPrice = ethPriceData?.price || 0;

      const gasUsed = Number(trade.gasUsed);
      const gasPrice = Number(trade.gasPrice);
      const gasCostEth = (gasUsed * gasPrice) / 1e18; // Convert wei to ETH
      const gasCostUsd = gasCostEth * ethPrice;

      return {
        ...trade,
        fromAmountDecimal,
        toAmountDecimal,
        tradeAmountUsd,
        gasCostUsd,
        fromTokenSymbol: fromPrice?.symbol || "UNKNOWN",
        toTokenSymbol: toPrice?.symbol || "UNKNOWN",
      };
    });
  }

  /**
   * Map enriched trades to database schema
   *
   * @param trades Enriched trades
   * @param competitionId Competition ID
   * @param agentsByWallet Map of wallet addresses to agents
   * @returns Trades mapped to database schema
   */
  private mapToDbSchema(
    trades: EnrichedTrade[],
    competitionId: string,
    agentsByWallet: Map<string, { id: string; walletAddress: string }>,
  ): InsertTrade[] {
    return trades
      .map((trade) => {
        // Determine which agent executed the trade
        const agent =
          agentsByWallet.get(trade.sender.toLowerCase()) ||
          agentsByWallet.get(trade.recipient.toLowerCase());

        if (!agent) {
          // This shouldn't happen due to our filtering, but log it
          serviceLogger.warn(
            `[LiveTradeProcessor] Trade ${trade.id} has no matching agent, skipping`,
          );
          return null;
        }

        const specificChain = this.mapChainName(trade.chain);
        const blockchainType = this.getBlockchainType(specificChain);

        return {
          id: uuidv4(),
          agentId: agent.id,
          competitionId,
          fromToken: trade.tokenIn,
          toToken: trade.tokenOut,
          fromAmount: trade.fromAmountDecimal,
          toAmount: trade.toAmountDecimal,
          price: trade.toAmountDecimal / trade.fromAmountDecimal,
          tradeAmountUsd: trade.tradeAmountUsd,
          fromTokenSymbol: trade.fromTokenSymbol,
          toTokenSymbol: trade.toTokenSymbol,
          success: true,
          reason: `Live trade via ${trade.protocol}`,
          timestamp: new Date(parseInt(trade.timestamp) * 1000),
          fromChain: blockchainType,
          toChain: blockchainType,
          fromSpecificChain: specificChain,
          toSpecificChain: specificChain,
          tradeType: "on_chain" as const,
          onChainTxHash: trade.transactionHash,
          blockNumber: parseInt(trade.blockNumber),
          gasUsed: Number(trade.gasUsed),
          gasPrice: Number(trade.gasPrice),
          gasCostUsd: trade.gasCostUsd,
          indexedAt: new Date(),
        };
      })
      .filter((trade): trade is NonNullable<typeof trade> => trade !== null);
  }

  /**
   * Map Envio chain names to our SpecificChain type
   *
   * @param envioChain Chain name from Envio
   * @returns SpecificChain enum value
   * @throws Error if chain is not supported
   */
  private mapChainName(envioChain: string): SpecificChain {
    const mappedChain = CHAIN_NAME_MAP[envioChain.toLowerCase()];
    if (!mappedChain) {
      throw new Error(
        `Unsupported chain: ${envioChain}. Supported chains: ${Object.keys(CHAIN_NAME_MAP).join(", ")}`,
      );
    }
    return mappedChain;
  }

  /**
   * Get blockchain type from specific chain
   *
   * @param specificChain Specific chain
   * @returns Blockchain type (EVM or SVM)
   */
  private getBlockchainType(specificChain: SpecificChain): BlockchainType {
    if (specificChain === "svm") {
      return BlockchainType.SVM;
    }
    return BlockchainType.EVM;
  }
}
