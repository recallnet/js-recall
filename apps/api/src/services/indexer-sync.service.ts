import config from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
import {
  IndexedTrade,
  IndexedTransfer,
  IndexerGraphQLResponse,
} from "@/types/live-trading.js";

/**
 * Indexer Sync Service
 * Fetches on-chain data from blockchain indexers (Envio)
 *
 * @remarks
 * This service follows the Single Responsibility Principle:
 * - ONLY fetches data from the Envio GraphQL endpoint
 * - NO business logic, filtering, or data transformation
 * - NO database operations
 * - Returns raw indexed data for processing by other services
 */
export class IndexerSyncService {
  private readonly graphqlEndpoint: string;

  constructor() {
    this.graphqlEndpoint = config.envio.graphqlEndpoint;
  }

  /**
   * Enrich trades with token addresses by matching transfers
   * Uses the same logic as EventHandlers but at read time
   */
  private enrichTradesWithTokens(
    trades: IndexedTrade[],
    transfersByTx: Map<string, IndexedTransfer[]>,
  ): IndexedTrade[] {
    const debugStats = {
      totalTrades: trades.length,
      alreadyComplete: 0,
      noTransfers: 0,
      exactMatch: 0,
      fuzzyMatch: 0,
      stillUnknown: 0,
      byProtocol: {} as Record<string, { total: number; complete: number }>,
    };

    const enrichedTrades = trades.map((trade) => {
      // Track protocol stats
      const protocol = trade.protocol;
      if (!debugStats.byProtocol[protocol]) {
        debugStats.byProtocol[protocol] = { total: 0, complete: 0 };
      }
      debugStats.byProtocol[protocol]!.total++;

      // Skip if already has both tokens
      if (trade.tokenIn !== "unknown" && trade.tokenOut !== "unknown") {
        debugStats.alreadyComplete++;
        debugStats.byProtocol[protocol]!.complete++;
        return trade;
      }

      const transfers = transfersByTx.get(trade.transactionHash) || [];
      if (transfers.length === 0) {
        debugStats.noTransfers++;
        return trade; // No transfers to match
      }

      // Sort transfers by logIndex for correct ordering
      const sortedTransfers = [...transfers].sort((a, b) => {
        // Parse logIndex from the id format: "chainId_txHash_logIndex"
        const aIndex = parseInt(a.id.split("_")[2] || "0");
        const bIndex = parseInt(b.id.split("_")[2] || "0");
        return aIndex - bIndex;
      });

      let tokenIn = trade.tokenIn;
      let tokenOut = trade.tokenOut;

      // For all DEX protocols: Match by amounts with fuzzy matching
      // Supports: Uniswap V2/V3, Curve, Balancer V1/V2, Bancor
      const supportedProtocols = [
        "uniswap",
        "uniswap-v3",
        "curve",
        "balancer-v1",
        "balancer-v2",
        "bancor",
      ];

      if (
        supportedProtocols.includes(trade.protocol) ||
        trade.protocol !== "unknown"
      ) {
        // Find transfer matching amountIn (with tolerance for fees/precision)
        if (tokenIn === "unknown" && trade.amountIn) {
          // First try exact match
          let inTransfer = sortedTransfers.find(
            (t) => t.value === trade.amountIn,
          );

          // If no exact match, try fuzzy match (within 0.1% tolerance)
          if (!inTransfer) {
            const targetAmount = BigInt(trade.amountIn);
            const tolerance = targetAmount / BigInt(1000); // 0.1% tolerance

            inTransfer = sortedTransfers.find((t) => {
              const transferAmount = BigInt(t.value);
              const diff =
                transferAmount > targetAmount
                  ? transferAmount - targetAmount
                  : targetAmount - transferAmount;
              return diff <= tolerance;
            });
          }

          if (inTransfer) {
            tokenIn = inTransfer.token;
          }
        }

        // Find transfer matching amountOut with fuzzy matching
        if (tokenOut === "unknown" && trade.amountOut) {
          // First try exact match
          let outTransfer = sortedTransfers.find(
            (t) => t.value === trade.amountOut && t.token !== tokenIn,
          );

          // If no exact match, try fuzzy match (within 0.1% tolerance)
          if (!outTransfer) {
            const targetAmount = BigInt(trade.amountOut);
            const tolerance = targetAmount / BigInt(1000); // 0.1% tolerance

            outTransfer = sortedTransfers.find((t) => {
              if (t.token === tokenIn) return false; // Skip same token
              const transferAmount = BigInt(t.value);
              const diff =
                transferAmount > targetAmount
                  ? transferAmount - targetAmount
                  : targetAmount - transferAmount;
              return diff <= tolerance;
            });
          }

          if (outTransfer) {
            tokenOut = outTransfer.token;
          }
        }
      }

      // Track statistics
      const wasEnriched = tokenIn !== "unknown" && tokenOut !== "unknown";
      if (wasEnriched) {
        debugStats.byProtocol[protocol]!.complete++;
        if (tokenIn === trade.tokenIn && tokenOut === trade.tokenOut) {
          // This shouldn't happen since we already checked at the beginning
        } else {
          debugStats.exactMatch++;
        }
      } else if (tokenIn !== trade.tokenIn || tokenOut !== trade.tokenOut) {
        debugStats.fuzzyMatch++;
      } else {
        debugStats.stillUnknown++;
      }

      return {
        ...trade,
        tokenIn,
        tokenOut,
      };
    });

    // Log summary enrichment statistics
    const totalEnriched = debugStats.exactMatch + debugStats.fuzzyMatch;
    const enrichmentRate =
      debugStats.totalTrades > 0
        ? (
            ((debugStats.totalTrades - debugStats.stillUnknown) /
              debugStats.totalTrades) *
            100
          ).toFixed(1)
        : 100;

    serviceLogger.info(
      `[IndexerSyncService] Enriched ${totalEnriched} trades (${enrichmentRate}% coverage). ` +
        `Already complete: ${debugStats.alreadyComplete}, Still unknown: ${debugStats.stillUnknown}`,
    );

    return enrichedTrades;
  }

  /**
   * Fetch trades from Envio GraphQL endpoint
   *
   * @param fromTimestamp Timestamp to fetch trades from (seconds since epoch)
   * @param limit Maximum number of trades to fetch
   * @param offset Offset for pagination
   * @returns Enriched indexed trades from Envio with token addresses
   */
  async fetchTrades(
    fromTimestamp: number,
    limit: number,
    offset: number,
  ): Promise<IndexedTrade[]> {
    const query = `
      query GetTrades($fromTimestamp: numeric!, $limit: Int!, $offset: Int!) {
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

    try {
      serviceLogger.debug(
        `[IndexerSyncService] Fetching trades from Envio: timestamp>${fromTimestamp}, limit=${limit}, offset=${offset}`,
      );

      const response = await fetch(this.graphqlEndpoint, {
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

      const result: IndexerGraphQLResponse<IndexedTrade> =
        await response.json();

      if (result.errors) {
        throw new Error(
          `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`,
        );
      }

      const trades = result.data?.Trade || [];

      serviceLogger.debug(
        `[IndexerSyncService] Fetched ${trades.length} trades from Envio`,
      );

      // Check if any trades have unknown tokens
      const tradesWithUnknown = trades.filter(
        (t) => t.tokenIn === "unknown" || t.tokenOut === "unknown",
      );

      if (tradesWithUnknown.length === 0) {
        // All trades already have tokens, no enrichment needed
        return trades;
      }

      // Get unique transaction hashes that need enrichment
      const txHashes = [
        ...new Set(tradesWithUnknown.map((t) => t.transactionHash)),
      ];

      serviceLogger.debug(
        `[IndexerSyncService] Enriching ${tradesWithUnknown.length} trades with unknown tokens from ${txHashes.length} transactions`,
      );

      // Fetch transfers for these transactions in batches
      const transfersByTx = new Map<string, IndexedTransfer[]>();
      const batchSize = 10; // Process 10 tx hashes at a time

      for (let i = 0; i < txHashes.length; i += batchSize) {
        const batch = txHashes.slice(i, i + batchSize);
        const batchTransfers = await Promise.all(
          batch.map((txHash) => this.fetchTransfersByTxHash(txHash)),
        );

        // Organize transfers by transaction hash
        batch.forEach((txHash, index) => {
          transfersByTx.set(txHash, batchTransfers[index] || []);
        });
      }

      // Enrich trades with token addresses
      const enrichedTrades = this.enrichTradesWithTokens(trades, transfersByTx);

      const stillUnknown = enrichedTrades.filter(
        (t) => t.tokenIn === "unknown" || t.tokenOut === "unknown",
      );

      serviceLogger.info(
        `[IndexerSyncService] Trade enrichment complete: ${tradesWithUnknown.length} → ${stillUnknown.length} trades with unknown tokens`,
      );

      return enrichedTrades;
    } catch (error) {
      serviceLogger.error("[IndexerSyncService] Error fetching trades:", error);
      throw error;
    }
  }

  /**
   * Fetch transfers from Envio GraphQL endpoint
   *
   * @param fromTimestamp Timestamp to fetch transfers from (seconds since epoch)
   * @param limit Maximum number of transfers to fetch
   * @param offset Offset for pagination
   * @returns Raw indexed transfers from Envio
   */
  async fetchTransfers(
    fromTimestamp: number,
    limit: number,
    offset: number,
  ): Promise<IndexedTransfer[]> {
    const query = `
      query GetTransfers($fromTimestamp: numeric!, $limit: Int!, $offset: Int!) {
        Transfer(
          where: { timestamp: { _gt: $fromTimestamp } }
          order_by: { timestamp: asc }
          limit: $limit
          offset: $offset
        ) {
          id
          from
          to
          chain
          transactionHash
          blockNumber
          timestamp
          token
          value
        }
      }
    `;

    try {
      serviceLogger.debug(
        `[IndexerSyncService] Fetching transfers from Envio: timestamp>${fromTimestamp}, limit=${limit}, offset=${offset}`,
      );

      const response = await fetch(this.graphqlEndpoint, {
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

      const result: IndexerGraphQLResponse<IndexedTransfer> =
        await response.json();

      if (result.errors) {
        throw new Error(
          `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`,
        );
      }

      const transfers = result.data?.Transfer || [];

      serviceLogger.debug(
        `[IndexerSyncService] Fetched ${transfers.length} transfers from Envio`,
      );

      return transfers;
    } catch (error) {
      serviceLogger.error(
        "[IndexerSyncService] Error fetching transfers:",
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch all trades in batches since a given timestamp
   *
   * @param fromTimestamp Timestamp to fetch trades from (seconds since epoch)
   * @param maxTrades Maximum total trades to fetch (safety limit)
   * @returns All trades since the given timestamp
   */
  async fetchAllTradesSince(
    fromTimestamp: number,
    maxTrades: number = 10000,
  ): Promise<IndexedTrade[]> {
    const batchSize = config.envio.syncBatchSize;
    let allTrades: IndexedTrade[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allTrades.length < maxTrades) {
      const trades = await this.fetchTrades(fromTimestamp, batchSize, offset);

      if (trades.length === 0) {
        hasMore = false;
        break;
      }

      allTrades = allTrades.concat(trades);
      offset += batchSize;

      // If we got less than batch size, we're done
      if (trades.length < batchSize) {
        hasMore = false;
      }

      serviceLogger.debug(
        `[IndexerSyncService] Fetched batch: ${trades.length} trades, total: ${allTrades.length}`,
      );
    }

    if (allTrades.length >= maxTrades) {
      serviceLogger.warn(
        `[IndexerSyncService] Hit max trades limit of ${maxTrades}`,
      );
    }

    return allTrades;
  }

  /**
   * Fetch all transfers in batches since a given timestamp
   *
   * @param fromTimestamp Timestamp to fetch transfers from (seconds since epoch)
   * @param maxTransfers Maximum total transfers to fetch (safety limit)
   * @returns All transfers since the given timestamp
   */
  async fetchAllTransfersSince(
    fromTimestamp: number,
    maxTransfers: number = 10000,
  ): Promise<IndexedTransfer[]> {
    const batchSize = config.envio.syncBatchSize;
    let allTransfers: IndexedTransfer[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allTransfers.length < maxTransfers) {
      const transfers = await this.fetchTransfers(
        fromTimestamp,
        batchSize,
        offset,
      );

      if (transfers.length === 0) {
        hasMore = false;
        break;
      }

      allTransfers = allTransfers.concat(transfers);
      offset += batchSize;

      // If we got less than batch size, we're done
      if (transfers.length < batchSize) {
        hasMore = false;
      }

      serviceLogger.debug(
        `[IndexerSyncService] Fetched batch: ${transfers.length} transfers, total: ${allTransfers.length}`,
      );
    }

    if (allTransfers.length >= maxTransfers) {
      serviceLogger.warn(
        `[IndexerSyncService] Hit max transfers limit of ${maxTransfers}`,
      );
    }

    return allTransfers;
  }

  /**
   * Get the latest timestamp from a set of trades
   *
   * @param trades Array of indexed trades
   * @returns Latest timestamp in seconds, or 0 if no trades
   */
  getLatestTradeTimestamp(trades: IndexedTrade[]): number {
    if (trades.length === 0) {
      return 0;
    }

    return Math.max(...trades.map((t) => parseInt(t.timestamp)));
  }

  /**
   * Get the latest timestamp from a set of transfers
   *
   * @param transfers Array of indexed transfers
   * @returns Latest timestamp in seconds, or 0 if no transfers
   */
  getLatestTransferTimestamp(transfers: IndexedTransfer[]): number {
    if (transfers.length === 0) {
      return 0;
    }

    return Math.max(...transfers.map((t) => parseInt(t.timestamp)));
  }

  /**
   * Fetch transfers by transaction hash
   * Useful for enriching trades with token information
   *
   * @param txHash Transaction hash to fetch transfers for
   * @returns All transfers in the given transaction
   */
  async fetchTransfersByTxHash(txHash: string): Promise<IndexedTransfer[]> {
    const query = `
      query GetTransfersByTxHash($txHash: String!) {
        Transfer(
          where: { transactionHash: { _eq: $txHash } }
          order_by: { id: asc }
        ) {
          id
          from
          to
          chain
          transactionHash
          blockNumber
          timestamp
          token
          value
        }
      }
    `;

    try {
      serviceLogger.debug(
        `[IndexerSyncService] Fetching transfers for tx: ${txHash}`,
      );

      const response = await fetch(this.graphqlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            txHash,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Envio GraphQL error: ${response.status} ${response.statusText}`,
        );
      }

      const result: IndexerGraphQLResponse<IndexedTransfer> =
        await response.json();

      if (result.errors) {
        throw new Error(
          `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`,
        );
      }

      const transfers = result.data?.Transfer || [];

      serviceLogger.debug(
        `[IndexerSyncService] Fetched ${transfers.length} transfers for tx ${txHash}`,
      );

      return transfers;
    } catch (error) {
      serviceLogger.error(
        `[IndexerSyncService] Error fetching transfers for tx ${txHash}:`,
        error,
      );
      throw error;
    }
  }
}
