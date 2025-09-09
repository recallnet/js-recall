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

/**
 * IndexingService
 *
 * The main long-running process that pulls on-chain logs via Hypersync and
 * feeds them into our persistence pipeline.
 *
 * Responsibilities:
 * - Manage Hypersync client connection and polling loop.
 * - Resume from the last processed block (via EventProcessor.lastBlockNumber()).
 * - Normalize logs into `EventData` and delegate to EventProcessor
 *   (which writes into `indexing_events`, `stakes`, and `stake_changes`).
 *
 * Lifecycle:
 * - start(): begins the indexing loop (no-op if indexing disabled in config).
 * - loop(): pulls batches from Hypersync until stopped; applies backoff (delayMs).
 * - processLog(): wraps a single raw log → `EventData` → EventProcessor.
 * - close(): stops the loop gracefully (abort + await outstanding work).
 *
 * Guarantees:
 * - At-most-once application of chain events is enforced downstream by DB
 *   uniqueness on (tx_hash, log_index).
 * - AbortError is silenced for clean shutdown; all other errors bubble up.
 */
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

  /**
   * Whether the service is currently running.
   *
   * True if an AbortController has been created (i.e. start() was called
   * and not yet closed). False otherwise.
   */
  get isRunning(): boolean {
    return Boolean(this.#abortController);
  }

  /**
   * Start the indexing loop.
   *
   * - No-op if indexing is disabled via config or if already running.
   * - Creates an AbortController for lifecycle control.
   * - Spawns the main loop() as a background task.
   *
   * Side effects:
   * - Logs startup messages.
   * - Will resume from last processed block number on first iteration.
   */
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

  /**
   * Main indexing loop (long-running).
   *
   * - Streams logs from Hypersync starting at `fromBlock`.
   * - Resumes from last known block number (`eventProcessor.lastBlockNumber()`).
   * - Enhances logs with block timestamps (blocks[].timestamp → logs).
   * - For each log, calls processLog().
   * - Advances fromBlock using `res.nextBlock`.
   *
   * Loop behavior:
   * - Sleeps `delayMs` between iterations.
   * - If tip of chain reached → sleeps, then retries.
   * - Stops gracefully on AbortError (thrown when closed).
   * - All other errors are logged and re-thrown.
   *
   * @internal
   */
  async loop(query: HypersyncQuery): Promise<void> {
    const effectiveQuery = {
      ...query,
    };
    const lastBlockNumber = await this.#eventProcessor.lastBlockNumber();
    effectiveQuery.fromBlock = Number(lastBlockNumber);
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

  /**
   * Handle a single raw log from Hypersync.
   *
   * - Extracts `topic0` and maps it to a known event name via EVENT_HASH_NAMES.
   * - Skips unknown events.
   * - Builds an EventData record (createEventData).
   * - Delegates to EventProcessor.processEvent() to persist into DB.
   *
   * Logging:
   * - Debug logs show event name, block number, tx hash.
   *
   * @internal
   */
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
      const event = createEventData(eventName, rawLog);

      this.#logger.debug("Preparing to store raw event with metadata:", {
        eventName,
        blockNumber: event.blockNumber.toString(),
        transactionHash: event.transactionHash,
      });

      await this.#eventProcessor.processEvent(event, eventName);
    } else {
      this.#logger.debug(`Skipped non-relevant event type: ${eventName}`);
    }
  }

  /**
   * Stop the indexing loop gracefully.
   *
   * - Aborts the AbortController.
   * - Waits for the current loop iteration to complete via #deferStop.
   * - Resets internal state so isRunning becomes false.
   *
   * After close() resolves, start() can be called again to restart indexing.
   */
  async close(): Promise<void> {
    this.#abortController?.abort();
    await this.#deferStop?.promise;
    this.#deferStop = undefined;
    this.#abortController = undefined;
  }
}

/**
 * Helper: normalize a raw blockchain log into our internal `EventData` format.
 *
 * - Copies chain metadata (block number, hash, tx hash, log index).
 * - Converts blockTimestamp (seconds → JS Date).
 * - Preserves raw payload (topics + data + address) for replay/audit.
 * - Classifies into EventType using EVENTS config; defaults to "unknown".
 */
export function createEventData(eventName: string, rawLog: RawLog): EventData {
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
