import { HypersyncClient } from "@envio-dev/hypersync-client";
import type { Logger } from "pino";

import config from "@/config/index.js";
import {
  EVENTS,
  EVENT_HASH_NAMES,
  HypersyncQuery,
  INDEXING_HYPERSYNC_QUERY,
} from "@/indexing/blockchain-events-config.js";
import type { EventData, RawLog } from "@/indexing/blockchain-types.js";
import { EventProcessor } from "@/indexing/event-processor.js";
import { EventsRepository } from "@/indexing/events.repository.js";
import { StakesRepository } from "@/indexing/stakes.repository.js";
import { type Defer, defer } from "@/lib/defer.js";
import { delay } from "@/lib/delay.js";

export class IndexingService {
  readonly #indexingQuery: HypersyncQuery | undefined;
  readonly #client: HypersyncClient;
  readonly #delayMs: number;
  readonly #logger: Logger;
  readonly #eventHashNames: Record<string, string>;
  readonly #eventProcessor: EventProcessor;

  #deferStop: Defer<void> | undefined;
  #abortController: AbortController | undefined;

  constructor(
    logger: Logger,
    indexingQuery: HypersyncQuery | undefined = INDEXING_HYPERSYNC_QUERY,
    eventHashNames = EVENT_HASH_NAMES,
  ) {
    this.#indexingQuery = indexingQuery;
    this.#client = HypersyncClient.new({
      url: config.stakingIndex.hypersyncUrl,
      bearerToken: config.stakingIndex.hypersyncBearerToken,
    });
    this.#delayMs = indexingQuery?.delayMs || 3000;
    this.#logger = logger;
    this.#eventHashNames = eventHashNames;

    const eventsRepository = new EventsRepository();
    const stakesRepository = new StakesRepository();
    this.#eventProcessor = new EventProcessor(
      eventsRepository,
      stakesRepository,
      logger,
    );

    this.#deferStop = undefined;
    this.#abortController = undefined;
  }

  get isRunning(): boolean {
    return Boolean(this.#abortController);
  }

  start(): void {
    const query = this.#indexingQuery;
    if (!query) {
      // no work to do
      this.#logger.info("Indexing is not enabled");
      return;
    }
    this.#logger.info("Starting blockchain indexing");
    if (this.isRunning) return;
    this.#abortController = new AbortController();
    this.#deferStop = defer();
    void this.loop(query);
  }

  async loop(query: HypersyncQuery): Promise<void> {
    const effectiveQuery = {
      ...query,
    };
    const lastBlockNumber = await this.#eventProcessor.lastBlockNumber();
    effectiveQuery.fromBlock = Number(lastBlockNumber) + 1;
    this.#logger.info(
      `Starting indexing from block ${effectiveQuery.fromBlock}`,
    );
    while (this.isRunning && !this.#abortController?.signal.aborted) {
      try {
        const stream = await this.#client.stream(effectiveQuery, {});
        const res = await stream.recv();
        if (!res) {
          this.#logger.info(
            "Reached the tip of the blockchain - waiting for new events",
          );
          await delay(this.#delayMs, this.#abortController?.signal);
          continue;
        }

        if (res.data && res.data.logs && res.data.logs.length > 0) {
          this.#logger.info(
            `Processing ${res.data.logs.length} logs from block ${
              res.data.logs[0]?.blockNumber || "unknown"
            }`,
          );

          // Create a map of block number to block timestamp from the returned block data
          const blockTimestampMap = new Map<string, number>();
          if (res.data.blocks && res.data.blocks.length > 0) {
            for (const block of res.data.blocks) {
              if (block.number && block.timestamp) {
                blockTimestampMap.set(
                  block.number.toString(),
                  Number(block.timestamp),
                );
              }
            }
          }

          // Enhance logs with block timestamp before processing
          const enhancedLogs = res.data.logs.map((log) => {
            const blockNumber = log.blockNumber?.toString() || "unknown";
            const blockTimestamp = blockTimestampMap.get(blockNumber!);
            return {
              ...log,
              blockTimestamp: blockTimestamp,
            } as RawLog;
          });
          for (const log of enhancedLogs) {
            await this.processLog(log);
          }
        }

        // Update query for next batch
        if (res.nextBlock) {
          effectiveQuery.fromBlock = res.nextBlock;
        }
        await delay(this.#delayMs, this.#abortController?.signal);
      } catch (e) {
        if (
          e &&
          typeof e === "object" &&
          "name" in e &&
          e.name === "AbortError"
        ) {
          // Silence when AbortError is thrown, just stop the loop
          break;
        } else {
          this.#logger.error("Error in indexing loop:", e);
          throw e;
        }
      }
    }
    this.#deferStop?.resolve();
  }

  async processLog(rawLog: RawLog): Promise<void> {
    const eventHash = rawLog.topics ? rawLog.topics[0] : null;
    if (!eventHash) {
      return;
    }

    const eventName = this.#eventHashNames[eventHash] || "Unknown";
    const tokenAddress = rawLog.address;

    this.#logger.debug(
      `Processing log (${eventName}) from token ${tokenAddress}`,
    );

    // Only process relevant events
    if (eventHash in this.#eventHashNames) {
      // Create raw event data
      const rawEventData = createRawEventData(eventName, rawLog);

      this.#logger.debug("Preparing to store raw event with metadata:", {
        eventName,
        blockNumber: rawEventData.blockNumber.toString(),
        transactionHash: rawEventData.transactionHash,
      });

      await this.#eventProcessor.processEvent(rawEventData, eventName);
    } else {
      this.#logger.debug(`Skipped non-relevant event type: ${eventName}`);
    }
  }

  async close(): Promise<void> {
    this.#abortController?.abort();
    await this.#deferStop?.promise;
    this.#deferStop = undefined;
    this.#abortController = undefined;
  }
}

/**
 * Create raw event data from log - only store raw data
 */
export function createRawEventData(
  eventName: string,
  rawLog: RawLog,
): EventData {
  const eventConfig = EVENTS[eventName as keyof typeof EVENTS];

  const blockTimestamp =
    rawLog.blockTimestamp && typeof rawLog.blockTimestamp === "number"
      ? rawLog.blockTimestamp * 1000
      : undefined;

  return {
    // Blockchain metadata
    blockNumber: BigInt(rawLog.blockNumber || 0),
    blockHash: rawLog.blockHash || "",
    blockTimestamp: blockTimestamp ? new Date(blockTimestamp) : new Date(),
    transactionHash: rawLog.transactionHash || "",
    logIndex: rawLog.logIndex || 0,

    // Raw event payload
    raw: {
      topics: rawLog.topics,
      data: rawLog.data,
      address: rawLog.address,
    },
    type: eventConfig?.type || "unknown",
    // Indexer metadata
    createdAt: new Date(),
  };
}
