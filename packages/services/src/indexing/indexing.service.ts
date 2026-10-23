import {
  HypersyncClient,
  type QueryResponse,
} from "@envio-dev/hypersync-client";
import { createHash } from "node:crypto";
import type { Logger } from "pino";

import type { IndexingStateRepository } from "@recallnet/db/repositories/indexing-state";

import { delay } from "../lib/delay.js";
import { EventProcessor } from "./event-processor.js";
import {
  HypersyncQuery,
  HypersyncQueryProvider,
  IndexingConfig,
} from "./hypersync-query.js";
import { IndexingDeadlineError } from "./processing-context.js";
import { TransactionProcessor } from "./transaction-processor.js";

/** Limits for a scheduled invocation. */
export interface IndexingRunOptions {
  maxDurationMs?: number;
  maxBatches?: number;
}

/** Committed progress, suitable for cron responses and monitoring. */
export interface IndexingRunResult {
  status: "caught_up" | "limited" | "locked";
  indexer: string;
  fromBlock: number | null;
  nextBlock: number | null;
  archiveHeight: number | null;
  lagBlocks: number | null;
  batches: number;
  recordsProcessed: number;
  durationMs: number;
}

/** Result of one fully processed block range. */
interface BatchResult {
  fromBlock: number;
  nextBlock: number;
  archiveHeight: number;
  recordsProcessed: number;
}

/**
 * Runs bounded blockchain scans and commits each batch with its checkpoint.
 * Both scheduled invocations and continuous workers use the same database lock.
 */
export class IndexingService {
  readonly #client: HypersyncClient;
  readonly #key: string;
  #abortController: AbortController | undefined;
  #loopPromise: Promise<void> | undefined;

  /** Construct an indexer for staking and competition reward events. */
  static createEventsIndexingService(
    logger: Logger,
    processor: EventProcessor,
    config: IndexingConfig,
    state: IndexingStateRepository,
  ): IndexingService {
    return new IndexingService(
      logger,
      processor,
      HypersyncQueryProvider.getEventsQuery(config),
      config,
      state,
    );
  }

  /** Construct an indexer for direct airdrop claim transactions. */
  static createTransactionsIndexingService(
    logger: Logger,
    processor: TransactionProcessor,
    config: IndexingConfig,
    state: IndexingStateRepository,
  ): IndexingService {
    return new IndexingService(
      logger,
      processor,
      HypersyncQueryProvider.getTransactionsQuery(config),
      config,
      state,
    );
  }

  constructor(
    private readonly logger: Logger,
    private readonly processor: EventProcessor | TransactionProcessor,
    private readonly query: HypersyncQuery,
    config: IndexingConfig,
    private readonly state: IndexingStateRepository,
  ) {
    this.#client = HypersyncClient.new({
      url: config.hypersyncUrl,
      bearerToken: config.hypersyncBearerToken,
      httpReqTimeoutMillis: 10_000,
      maxNumRetries: 0,
    });
    // Identity excludes credentials and bootstrap bounds, which do not change the feed.
    this.#key = createHash("sha256")
      .update(
        JSON.stringify({
          source: config.hypersyncUrl.replace(/\/$/, ""),
          logs: query.logs,
          transactions: query.transactions,
        }).toLowerCase(),
      )
      .digest("hex");
  }

  /** Whether the continuous worker is active. */
  get isRunning(): boolean {
    return this.#abortController !== undefined;
  }

  /** Start a continuous worker that retries failed passes after the polling delay. */
  start(): void {
    if (this.isRunning) return;
    this.#abortController = new AbortController();
    this.#loopPromise = this.loop();
  }

  /** Run passes until close is requested, retaining only committed scan progress. */
  async loop(): Promise<void> {
    const signal = this.#abortController?.signal;
    while (signal && !signal.aborted) {
      try {
        await this.runOnce();
      } catch (error) {
        this.logger.error(
          { error, indexer: this.#key },
          "Indexing pass failed",
        );
      }
      try {
        await delay(this.query.delayMs || 3000, signal);
      } catch (error) {
        if (!signal.aborted) throw error;
      }
    }
  }

  /**
   * Scan until caught up or the invocation budget is exhausted.
   * Each batch holds a transaction-scoped lock and commits domain writes together
   * with its next block. A failed or interrupted batch remains eligible for retry.
   */
  async runOnce(options: IndexingRunOptions = {}): Promise<IndexingRunResult> {
    const maxDurationMs = options.maxDurationMs ?? 45_000;
    const maxBatches = options.maxBatches ?? 20;
    if (
      !Number.isSafeInteger(maxDurationMs) ||
      maxDurationMs <= 0 ||
      maxDurationMs > 45_000 ||
      !Number.isSafeInteger(maxBatches) ||
      maxBatches <= 0
    ) {
      throw new Error("Invalid indexing run limits");
    }
    const started = Date.now();
    const deadline = started + maxDurationMs;
    const result: IndexingRunResult = {
      status: "limited",
      indexer: this.#key,
      fromBlock: null,
      nextBlock: null,
      archiveHeight: null,
      lagBlocks: null,
      batches: 0,
      recordsProcessed: 0,
      durationMs: 0,
    };
    const checkDeadline = (): void => {
      if (Date.now() >= deadline || this.#abortController?.signal.aborted) {
        throw new IndexingDeadlineError();
      }
    };
    try {
      while (result.batches < maxBatches) {
        checkDeadline();
        const batch = await this.state.runBatch(
          this.#key,
          async (tx, checkpoint) => {
            checkDeadline();
            const fromBlock =
              checkpoint ??
              Math.max(
                this.query.fromBlock,
                Number((await this.processor.lastBlockNumber(tx)) ?? 0n),
              );
            const response = await this.fetchBatch(fromBlock, deadline);
            checkDeadline();
            if (
              !Number.isSafeInteger(response.nextBlock) ||
              response.nextBlock < fromBlock ||
              response.nextBlock > fromBlock + 10_000 ||
              response.archiveHeight === undefined ||
              !Number.isSafeInteger(response.archiveHeight) ||
              response.archiveHeight < 0 ||
              (response.nextBlock === fromBlock &&
                fromBlock < response.archiveHeight)
            ) {
              throw new Error("HyperSync returned invalid scan progress");
            }
            await this.processor.process(response, { tx, checkDeadline });
            checkDeadline();
            return {
              fromBlock,
              nextBlock: response.nextBlock,
              archiveHeight: response.archiveHeight,
              recordsProcessed: this.query.transactions
                ? response.data.transactions.length
                : response.data.logs.length,
            } satisfies BatchResult;
          },
        );
        if (!batch) {
          result.status = "locked";
          break;
        }
        result.fromBlock ??= batch.fromBlock;
        result.nextBlock = batch.nextBlock;
        result.archiveHeight = batch.archiveHeight;
        result.lagBlocks = Math.max(0, batch.archiveHeight - batch.nextBlock);
        result.batches++;
        result.recordsProcessed += batch.recordsProcessed;
        if (result.lagBlocks === 0) {
          result.status = "caught_up";
          break;
        }
      }
    } catch (error) {
      if (!(error instanceof IndexingDeadlineError)) {
        this.logger.error({ error, ...result }, "Indexing pass failed");
        throw error;
      }
    }
    result.durationMs = Date.now() - started;
    this.logger.info(result, "Indexing pass finished");
    return result;
  }

  /** Fetch a bounded range; timed-out requests cannot perform database writes. */
  private async fetchBatch(
    fromBlock: number,
    deadline: number,
  ): Promise<QueryResponse> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.#client.get({
          ...this.query,
          fromBlock,
          toBlock: fromBlock + 10_000,
          maxNumLogs: 100,
          maxNumTransactions: 100,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("HyperSync request timed out")),
            Math.max(1, Math.min(10_000, deadline - Date.now())),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Wait for the current batch to finish or roll back and stop polling. */
  async close(): Promise<void> {
    this.#abortController?.abort();
    await this.#loopPromise;
    this.#abortController = undefined;
    this.#loopPromise = undefined;
  }
}
