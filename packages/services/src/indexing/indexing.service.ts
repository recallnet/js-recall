import { HypersyncClient } from "@envio-dev/hypersync-client";
import type { Logger } from "pino";

import { type Defer, defer } from "@/lib/defer.js";
import { delay } from "@/lib/delay.js";

import { EventProcessor } from "./event-processor.js";
import {
  HypersyncQuery,
  HypersyncQueryProvider,
  IndexingConfig,
} from "./hypersync-query.js";
import { TransactionProcessor } from "./transaction-processor.js";

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
  readonly #indexingQuery: HypersyncQuery;
  readonly #client: HypersyncClient;
  readonly #delayMs: number;
  readonly #logger: Logger;
  // readonly #eventHashNames: Record<string, string>;
  readonly #indexingProcessor: EventProcessor | TransactionProcessor;
  readonly #eventStartBlock: number;

  #deferStop: Defer<void> | undefined;
  #abortController: AbortController | undefined;

  static createEventsIndexingService(
    logger: Logger,
    eventProcessor: EventProcessor,
    config: IndexingConfig,
  ): IndexingService {
    return new IndexingService(
      logger,
      eventProcessor,
      HypersyncQueryProvider.getEventsQuery(config),
      config,
    );
  }

  static createTransactionsIndexingService(
    logger: Logger,
    eventProcessor: TransactionProcessor,
    config: IndexingConfig,
  ): IndexingService {
    return new IndexingService(
      logger,
      eventProcessor,
      HypersyncQueryProvider.getTransactionsQuery(config),
      config,
    );
  }

  constructor(
    logger: Logger,
    indexingProcessor: EventProcessor | TransactionProcessor,
    indexingQuery: HypersyncQuery,
    config: IndexingConfig,
  ) {
    // Hypersync query is distinct to this instance, the query
    // might be indexing events or blocks or transactions
    this.#indexingQuery = indexingQuery;
    this.#client = HypersyncClient.new({
      url: config.hypersyncUrl,
      bearerToken: config.hypersyncBearerToken,
    });
    this.#delayMs = indexingQuery?.delayMs || 3000;
    this.#logger = logger;
    this.#indexingProcessor = indexingProcessor;
    this.#deferStop = undefined;
    this.#abortController = undefined;
    this.#eventStartBlock = config.eventStartBlock;
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
    const effectiveQuery = await this.#initQuery(query);
    while (this.isRunning && !this.#abortController?.signal.aborted) {
      await this.#runUntilTip(effectiveQuery);
      this.#logger.info("Waiting for new events");
      await delay(this.#delayMs, this.#abortController?.signal);
    }
    this.#deferStop?.resolve();
  }

  /**
   * Run a single indexing pass until reaching the tip of the blockchain.
   *
   * - Initializes the query with the last processed block number.
   * - Processes all available blockchain data until the tip is reached.
   * - Does not loop or wait for new events (unlike `start()`).
   * - Useful for one-time indexing tasks or testing.
   *
   * Usage:
   * - Call this method when you want to index once without starting a long-running process.
   * - The method returns when all available data has been processed.
   */
  async runOnce(): Promise<void> {
    const effectiveQuery = await this.#initQuery(this.#indexingQuery);
    await this.#runUntilTip(effectiveQuery);
  }

  /**
   * Process blockchain data until reaching the tip.
   *
   * - Continuously streams and processes batches from Hypersync.
   * - Updates `effectiveQuery.fromBlock` after each successful batch.
   * - Returns when the tip of the blockchain is reached (no more data available).
   * - Returns immediately on AbortError without throwing.
   * - Re-throws all other errors after logging.
   *
   * @param effectiveQuery - The query object (mutated to update fromBlock)
   *
   * @internal
   */
  async #runUntilTip(effectiveQuery: HypersyncQuery): Promise<void> {
    this.#logger.info(
      `Starting indexing from block ${effectiveQuery.fromBlock}`,
    );
    while (true) {
      try {
        const stream = await this.#client.stream(effectiveQuery, {});
        const res = await stream.recv();
        if (!res) {
          this.#logger.info("Reached the tip of the blockchain");
          return;
        }

        await this.#indexingProcessor.process(res);

        // Update query for next batch
        if (res.nextBlock) {
          effectiveQuery.fromBlock = res.nextBlock;
        }

        if (res.data.blocks?.length ?? 0 == 0) {
          this.#logger.debug("no more blocks -> done");
          return;
        }
      } catch (e) {
        if (
          e &&
          typeof e === "object" &&
          "name" in e &&
          e.name === "AbortError"
        ) {
          // Silence when AbortError is thrown, just return
          return;
        } else {
          this.#logger.error({ error: e }, "Error in runUntilTip");
          throw e;
        }
      }
    }
  }

  /**
   * Initialize the query with the starting block number.
   *
   * - Creates a copy of the provided query.
   * - Retrieves the last processed block number from the indexing processor.
   * - Falls back to the configured event start block if no events exist.
   * - Sets the fromBlock to resume indexing from the correct position.
   *
   * @param query - The base query configuration
   * @returns The initialized query with fromBlock set
   *
   * @internal
   */
  async #initQuery(query: HypersyncQuery): Promise<HypersyncQuery> {
    const effectiveQuery = {
      ...query,
    };
    const lastBlockNumber =
      (await this.#indexingProcessor.lastBlockNumber()) ??
      this.#eventStartBlock;
    effectiveQuery.fromBlock = Number(lastBlockNumber);
    return effectiveQuery;
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
