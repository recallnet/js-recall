import { QueryResponse } from "@envio-dev/hypersync-client";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";
import { type Hex, decodeFunctionData } from "viem";

import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";

import { db } from "@/database/db.js";
import type { ConvictionClaimsRepository } from "@/indexing/conviction-claims.repository.js";

export { TransactionProcessor };

/**
 * TransactionProcessor
 *
 * Processes blockchain transactions to store data in db.
 *
 * Responsibilities:
 * - Decode transaction input data
 * - Update conviction_claims records with transaction information
 *
 * Guarantees:
 * - Only processes successful transactions
 * - Safely handles malformed or unexpected transaction data
 * - Updates are idempotent based on transaction hash
 */
class TransactionProcessor {
  readonly #convictionClaimsRepository: ConvictionClaimsRepository;
  readonly #logger: Logger;
  readonly #db: typeof db;

  // ABI for the claim function
  readonly #claimAbi = [
    {
      inputs: [
        { name: "_proof", type: "bytes32[]" },
        { name: "_to", type: "address" },
        { name: "_amount", type: "uint256" },
        { name: "_season", type: "uint8" },
        { name: "_duration", type: "uint256" },
        { name: "_signature", type: "bytes" },
      ],
      name: "claim",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ] as const;

  constructor(
    database: typeof db,
    convictionClaimsRepository: ConvictionClaimsRepository,
    logger: Logger,
  ) {
    this.#db = database;
    this.#convictionClaimsRepository = convictionClaimsRepository;
    this.#logger = logger;
  }

  /**
   * Process a QueryResponse from Hypersync containing transactions.
   * Similar to EventProcessor.process() but for transaction data.
   *
   * @param res - QueryResponse from Hypersync
   */
  async process(res: QueryResponse) {
    if (res.data && res.data.transactions && res.data.transactions.length > 0) {
      this.#logger.info(
        `Processing ${res.data.transactions.length} transactions from block ${
          res.data.transactions[0]?.blockNumber || "unknown"
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

      // Process each transaction
      let processed = 0;
      for (const tx of res.data.transactions) {
        // Skip if no input data
        if (!tx.input || tx.input === "0x") {
          continue;
        }

        // Enhance with block timestamp
        const blockNumber = tx.blockNumber?.toString() || "unknown";
        const blockTimestamp = blockTimestampMap.get(blockNumber);

        const wasProcessed = await this.processTransaction({
          hash: tx.hash || "",
          from: tx.from || "",
          to: tx.to || "",
          input: tx.input,
          blockNumber: BigInt(tx.blockNumber || 0),
          blockTimestamp: blockTimestamp
            ? new Date(blockTimestamp * 1000)
            : undefined,
        });

        if (wasProcessed) {
          processed++;
        }
      }

      if (processed > 0) {
        this.#logger.info(
          `Processed ${processed} claim transactions out of ${res.data.transactions.length} total transactions`,
        );
      }
    }
  }

  /**
   * Process a transaction that might contain claim data.
   *
   * @param transaction - Transaction data from Hypersync
   * @returns true if transaction was processed, false if skipped
   */
  async processTransaction(transaction: {
    hash: string;
    from: string;
    to: string;
    input: string;
    blockNumber: bigint;
    blockTimestamp?: Date;
  }): Promise<boolean> {
    try {
      // Check if this transaction has already been processed (to avoid reprocessing)
      const isAlreadyProcessed =
        await this.#convictionClaimsRepository.isConvictionClaimPresent(
          transaction.hash,
        );
      if (isAlreadyProcessed) {
        this.#logger.debug(
          `Transaction already processed, skipping: ${transaction.hash}`,
        );
        return false;
      }

      // Try to decode as a claim function call
      const claimData = this.decodeClaimFunction(transaction.input);
      if (!claimData) {
        return false;
      }

      this.#logger.debug(
        `Found claim transaction ${transaction.hash} with duration ${claimData.duration}`,
      );

      // Insert the conviction claim with the duration from transaction data
      await this.insertConvictionClaim(
        transaction.hash,
        claimData.to,
        claimData.amount,
        claimData.season,
        claimData.duration,
        transaction.blockNumber,
        transaction.blockTimestamp,
      );

      return true;
    } catch (error) {
      this.#logger.warn(
        `Failed to process transaction ${transaction.hash}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Decode claim function input data.
   *
   * @param input - Transaction input data (hex string)
   * @returns Decoded claim parameters or null if not a claim function
   */
  private decodeClaimFunction(input: string): {
    to: string;
    amount: bigint;
    season: number;
    duration: bigint;
  } | null {
    try {
      const decoded = decodeFunctionData({
        abi: this.#claimAbi,
        data: input as Hex,
      });

      if (decoded.functionName !== "claim") {
        return null;
      }

      // note: the first arg is `proof` and we don't need that.
      const [, to, amount, season, duration] = decoded.args;

      return {
        to: to.toLowerCase(),
        amount: BigInt(amount),
        season: Number(season),
        duration: BigInt(duration),
      };
    } catch (error) {
      // Not a claim function or malformed data
      this.#logger.debug(`Failed to decode claim function: ${error}`);
      return null;
    }
  }

  /**
   * Insert a new conviction claim record from transaction data.
   *
   * @param transactionHash - Transaction hash containing the claim
   * @param claimer - Address that received the claim
   * @param amount - Amount claimed
   * @param season - Season number
   * @param duration - Duration extracted from transaction
   * @param blockNumber - Block number
   * @param blockTimestamp - Block timestamp
   */
  private async insertConvictionClaim(
    transactionHash: string,
    claimer: string,
    amount: bigint,
    season: number,
    duration: bigint,
    blockNumber: bigint,
    blockTimestamp?: Date,
  ): Promise<void> {
    try {
      // Use the repository to save the conviction claim
      const saved = await this.#convictionClaimsRepository.saveConvictionClaim({
        account: claimer,
        amount: amount,
        claimedAmount: amount, // In a direct claim, amount and claimedAmount are typically the same
        season: season,
        duration: duration,
        blockNumber: blockNumber,
        blockHash: "", // We don't have blockHash from transaction data, would need to get from blocks
        blockTimestamp: blockTimestamp || new Date(),
        transactionHash: transactionHash,
      });

      if (saved) {
        this.#logger.info(
          `Inserted conviction claim: account=${claimer}, season=${season}, ` +
            `amount=${amount}, duration=${duration}s in tx ${transactionHash}`,
        );
      } else {
        this.#logger.debug(
          `Claim already exists for tx ${transactionHash} (idempotent)`,
        );
      }
    } catch (error) {
      this.#logger.error(
        `Failed to insert conviction claim for tx ${transactionHash}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process a batch of transactions.
   *
   * @param transactions - Array of transactions from Hypersync
   * @returns Number of transactions processed
   */
  async processBatch(
    transactions: Array<{
      hash: string;
      from: string;
      to: string;
      input: string;
      blockNumber: bigint;
      blockTimestamp?: Date;
    }>,
  ): Promise<number> {
    let processed = 0;

    for (const tx of transactions) {
      const wasProcessed = await this.processTransaction(tx);
      if (wasProcessed) {
        processed++;
      }
    }

    this.#logger.info(
      `Processed ${processed} claim transactions out of ${transactions.length}`,
    );

    return processed;
  }

  /**
   * Get statistics about processed transactions.
   *
   * @returns Statistics object
   */
  async getStats(): Promise<{
    totalClaimsWithDuration: number;
    totalClaimsWithoutDuration: number;
    averageDuration: number | null;
  }> {
    const stats = await this.#db
      .select({
        withDuration: sql`COUNT(*) FILTER (WHERE duration IS NOT NULL)`,
        withoutDuration: sql`COUNT(*) FILTER (WHERE duration IS NULL)`,
        avgDuration: sql`AVG(duration)`,
      })
      .from(convictionClaims)
      .execute();

    return {
      totalClaimsWithDuration: Number(stats[0]?.withDuration || 0),
      totalClaimsWithoutDuration: Number(stats[0]?.withoutDuration || 0),
      averageDuration: stats[0]?.avgDuration
        ? Number(stats[0].avgDuration)
        : null,
    };
  }

  /**
   * Highest block number already persisted to `conviction_claims`.
   *
   * Used by the indexing loop to set `fromBlock = lastBlock`
   * so we resume exactly where we left off after restarts.
   */
  lastBlockNumber(): Promise<bigint> {
    return this.#convictionClaimsRepository.lastBlockNumber();
  }
}
