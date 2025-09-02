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
   * Fetch trades from Envio GraphQL endpoint
   *
   * @param fromTimestamp Timestamp to fetch trades from (seconds since epoch)
   * @param limit Maximum number of trades to fetch
   * @param offset Offset for pagination
   * @returns Raw indexed trades from Envio
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

      return trades;
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
}
