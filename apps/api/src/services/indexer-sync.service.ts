import { v4 as uuidv4 } from "uuid";

import config from "@/config/index.js";
import {
  getLastSync,
  updateSyncProgress,
} from "@/database/repositories/indexer-sync-progress-repository.js";
import { batchCreateOnChainTrades } from "@/database/repositories/trade-repository.js";
import { InsertTrade } from "@/database/schema/trading/types.js";
import { serviceLogger } from "@/lib/logger.js";
import { AgentManager } from "@/services/agent-manager.service.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { SpecificChain } from "@/types/index.js";
import {
  BatchSyncResult,
  IndexedTrade,
  IndexerGraphQLResponse,
} from "@/types/live-trading.js";

/**
 * Indexer Sync Service
 * Manages synchronization of on-chain trade data from blockchain indexers
 * Implements batch processing, competition-aware filtering, and progress tracking
 *
 * @remarks
 * This service is responsible for:
 * - Syncing trades from the Envio GraphQL endpoint
 * - Filtering trades by competition participants
 * - Tracking sync progress to avoid duplicate processing
 * - Managing efficient batch operations to prevent N+1 queries
 */

// Minimal agent interface for what we need in this service
interface CachedAgent {
  id: string;
  walletAddress: string | null;
}

export class IndexerSyncService {
  // Cache for agent data to avoid repeated queries
  private agentCache: Map<string, { agent: CachedAgent; expiry: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly competitionManager: CompetitionManager,
    private readonly agentManager: AgentManager,
  ) {
    this.agentCache = new Map();
  }

  /**
   * Get agents with caching to avoid repeated queries
   * @param agentIds - Array of agent IDs to fetch
   * @returns Array of agents
   */
  private async getCachedAgents(agentIds: string[]): Promise<CachedAgent[]> {
    const now = Date.now();
    const agents: CachedAgent[] = [];
    const uncachedIds: string[] = [];

    // Check cache first
    for (const agentId of agentIds) {
      const cached = this.agentCache.get(agentId);
      if (cached && cached.expiry > now) {
        agents.push(cached.agent);
      } else {
        uncachedIds.push(agentId);
      }
    }

    // Bulk fetch uncached agents
    if (uncachedIds.length > 0) {
      // TODO: When AgentManager supports bulk fetch, use it here
      // For now, we still need to fetch individually but at least we cache them
      const fetchedAgents = await Promise.all(
        uncachedIds.map(async (agentId) => {
          const agent = await this.agentManager.getAgent(agentId);
          if (agent && agent.walletAddress !== undefined) {
            // Cache only what we need
            const cachedAgent: CachedAgent = {
              id: agent.id,
              walletAddress: agent.walletAddress,
            };
            this.agentCache.set(agentId, {
              agent: cachedAgent,
              expiry: now + this.CACHE_TTL,
            });
            return cachedAgent;
          }
          return null;
        }),
      );

      agents.push(...fetchedAgents.filter((a): a is CachedAgent => a !== null));
    }

    return agents;
  }

  /**
   * Sync trades for a specific competition from Envio.
   * @param competitionId - Competition to sync trades for
   * @returns Number of trades synced
   */
  async syncCompetitionTrades(competitionId: string): Promise<number> {
    const startTime = Date.now();

    try {
      serviceLogger.info(
        `[IndexerSyncService] Starting trade sync for competition ${competitionId}`,
      );

      // Get last sync timestamp
      const lastSync = await getLastSync(competitionId);
      const fromTimestamp = lastSync?.lastSyncedTimestamp || 0;

      // Get all agent addresses for this competition
      const agentIds =
        await this.competitionManager.getAllCompetitionAgents(competitionId);

      if (agentIds.length === 0) {
        serviceLogger.info(
          `[IndexerSyncService] No agents in competition ${competitionId}`,
        );
        return 0;
      }

      // Get agent details using cache
      const agents = await this.getCachedAgents(agentIds);

      const agentAddresses = new Set(
        agents
          .filter((a) => a.walletAddress !== null)
          .map((a) => a.walletAddress!.toLowerCase()),
      );

      let allTrades: IndexedTrade[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = config.envio.syncBatchSize;

      // Query Envio in batches
      while (hasMore) {
        const trades = await this.queryEnvioTrades(
          fromTimestamp,
          batchSize,
          offset,
        );

        if (trades.length === 0) {
          hasMore = false;
          break;
        }

        // Filter trades by competition participants
        const relevantTrades = trades.filter(
          (trade) =>
            agentAddresses.has(trade.sender.toLowerCase()) ||
            agentAddresses.has(trade.recipient.toLowerCase()),
        );

        allTrades = allTrades.concat(relevantTrades);
        offset += batchSize;

        // Stop if we've hit our sync limit to prevent memory issues
        if (allTrades.length > 10000) {
          serviceLogger.warn(
            `[IndexerSyncService] Hit sync limit of 10000 trades for competition ${competitionId}`,
          );
          break;
        }

        // If we got less than batch size, we're done
        if (trades.length < batchSize) {
          hasMore = false;
        }
      }

      if (allTrades.length === 0) {
        serviceLogger.info(
          `[IndexerSyncService] No new trades found for competition ${competitionId}`,
        );
        // Update sync progress even if no trades found
        if (allTrades.length === 0 && offset === 0) {
          // Use current timestamp if no trades were found
          await updateSyncProgress(
            competitionId,
            BigInt(Math.floor(Date.now() / 1000)),
          );
        }
        return 0;
      }

      // Map trades to our schema and insert
      const mappedTrades = this.mapEnvioTradesToDb(
        allTrades,
        competitionId,
        agents
          .filter((a) => a.walletAddress !== null)
          .map((a) => ({ id: a.id, walletAddress: a.walletAddress! })),
      );

      await batchCreateOnChainTrades(mappedTrades);

      // Update sync progress with latest timestamp
      const latestTimestamp = Math.max(
        ...allTrades.map((t) => parseInt(t.timestamp)),
      );
      await updateSyncProgress(competitionId, BigInt(latestTimestamp));

      const duration = Date.now() - startTime;
      serviceLogger.info(
        `[IndexerSyncService] Synced ${mappedTrades.length} trades for competition ${competitionId} in ${duration}ms`,
      );

      return mappedTrades.length;
    } catch (error) {
      serviceLogger.error(
        `[IndexerSyncService] Error syncing trades for competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Sync all active competitions in parallel with concurrency limit.
   */
  async syncAllActiveCompetitions(): Promise<BatchSyncResult> {
    try {
      const activeCompetition =
        await this.competitionManager.getActiveCompetition();
      const activeCompetitions = activeCompetition ? [activeCompetition] : [];

      if (activeCompetitions.length === 0) {
        serviceLogger.info(
          "[IndexerSyncService] No active competitions to sync",
        );
        return { synced: 0, errors: 0 };
      }

      serviceLogger.info(
        `[IndexerSyncService] Syncing ${activeCompetitions.length} active competitions`,
      );

      // Process in batches to respect concurrency limit
      const results = await this.processInBatches(
        activeCompetitions,
        async (competition) => {
          try {
            const tradeCount = await this.syncCompetitionTrades(competition.id);
            return { success: true, tradeCount };
          } catch (error) {
            serviceLogger.error(
              `[IndexerSyncService] Error syncing competition ${competition.id}:`,
              error,
            );
            return { success: false, error };
          }
        },
        config.envio.maxConcurrentSyncs,
      );

      const synced = results.filter((r) => r.success).length;
      const errors = results.filter((r) => !r.success).length;

      serviceLogger.info(
        `[IndexerSyncService] Sync complete: ${synced} succeeded, ${errors} failed`,
      );

      return { synced, errors };
    } catch (error) {
      serviceLogger.error(
        "[IndexerSyncService] Error in syncAllActiveCompetitions:",
        error,
      );
      throw error;
    }
  }

  /**
   * Query Envio GraphQL endpoint for trades.
   */
  private async queryEnvioTrades(
    fromTimestamp: number,
    limit: number,
    offset: number,
  ): Promise<IndexedTrade[]> {
    const query = `
      query GetTrades($fromTimestamp: BigInt!, $limit: Int!, $offset: Int!) {
        Trade(
          where: { timestamp: { _gt: $fromTimestamp } }
          order_by: { timestamp: asc }
          limit: $limit
          offset: $offset
        ) {
          id
          sender
          recipient
          chain
          transactionHash
          blockNumber
          timestamp
          tokenIn
          tokenOut
          amountIn
          amountOut
          gasUsed
          gasPrice
          protocol
        }
      }
    `;

    const response = await fetch(config.envio.graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          fromTimestamp: fromTimestamp.toString(),
          limit,
          offset,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Envio GraphQL error: ${response.status} ${response.statusText}`,
      );
    }

    const result: IndexerGraphQLResponse<IndexedTrade> = await response.json();

    if (result.errors) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`,
      );
    }

    return result.data?.Trade || [];
  }

  /**
   * Map Envio trades to our database schema.
   */
  private mapEnvioTradesToDb(
    trades: IndexedTrade[],
    competitionId: string,
    agents: Array<{ id: string; walletAddress: string }>,
  ): InsertTrade[] {
    const agentMap = new Map(
      agents.map((a) => [a.walletAddress.toLowerCase(), a.id]),
    );

    return trades
      .map((trade) => {
        // Determine which agent made the trade
        const agentId =
          agentMap.get(trade.sender.toLowerCase()) ||
          agentMap.get(trade.recipient.toLowerCase());

        if (!agentId) {
          // This shouldn't happen due to our filtering, but log it
          serviceLogger.warn(
            `[IndexerSyncService] Trade ${trade.id} has no matching agent`,
          );
          return null;
        }

        const chain = this.mapChainName(trade.chain);

        return {
          id: uuidv4(),
          agentId,
          competitionId,
          fromToken: trade.tokenIn,
          toToken: trade.tokenOut,
          fromAmount: Number(trade.amountIn) / 1e18, // Assuming 18 decimals, adjust as needed
          toAmount: Number(trade.amountOut) / 1e18,
          price: Number(trade.amountOut) / Number(trade.amountIn),
          tradeAmountUsd: 0, // TODO: Calculate USD value
          toTokenSymbol: "UNKNOWN", // TODO: Resolve symbols
          fromTokenSymbol: "UNKNOWN",
          success: true,
          reason: `Indexed from ${trade.protocol}`,
          timestamp: new Date(parseInt(trade.timestamp) * 1000),
          fromChain: chain.includes("svm") ? "svm" : "evm",
          toChain: chain.includes("svm") ? "svm" : "evm",
          fromSpecificChain: chain,
          toSpecificChain: chain,
          tradeType: "on_chain" as const,
          onChainTxHash: trade.transactionHash,
          blockNumber: parseInt(trade.blockNumber),
          gasUsed: Number(trade.gasUsed),
          gasPrice: Number(trade.gasPrice),
          gasCostUsd: 0, // TODO: Calculate gas cost in USD
          indexedAt: new Date(),
        };
      })
      .filter((trade): trade is NonNullable<typeof trade> => trade !== null);
  }

  /**
   * Map Envio chain names to our SpecificChain type.
   */
  private mapChainName(envioChain: string): SpecificChain {
    const chainMap: Record<string, SpecificChain> = {
      ethereum: "eth",
      polygon: "polygon",
      arbitrum: "arbitrum",
      optimism: "optimism",
      base: "base",
      // Add more mappings as needed
    };

    return chainMap[envioChain.toLowerCase()] || ("eth" as SpecificChain);
  }

  /**
   * Process items in batches with concurrency limit.
   */
  private async processInBatches<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }

    return results;
  }
}
