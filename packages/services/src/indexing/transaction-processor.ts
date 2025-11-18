import { QueryResponse } from "@envio-dev/hypersync-client";
import type { Logger } from "pino";
import { type Hex, decodeFunctionData } from "viem";

import type { ConvictionClaimsRepository } from "@/indexing/conviction-claims.repository.js";

export { TransactionProcessor };

export const STAKING_DURATIONS = [
  {
    durationSeconds: 0n,
    penaltyNumerator: 1n,
    penaltyDenominator: 10n, // 10% of total allocation
  },
  {
    durationSeconds: 2592000n, // 1 month in seconds (contract value)
    penaltyNumerator: 1n,
    penaltyDenominator: 5n, // 20% of total allocation
  },
  {
    durationSeconds: 7776000n, // 3 months in seconds (contract value)
    penaltyNumerator: 2n,
    penaltyDenominator: 5n, // 40% of total allocation
  },
  {
    durationSeconds: 15552000n, // 6 months in seconds (contract value)
    penaltyNumerator: 3n,
    penaltyDenominator: 5n, // 60% of total allocation
  },
  {
    durationSeconds: 31536000n, // 12 months in seconds (contract value)
    penaltyNumerator: 1n,
    penaltyDenominator: 1n, // 100% of total allocation
  },
];

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
    convictionClaimsRepository: ConvictionClaimsRepository,
    logger: Logger,
  ) {
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

        if (!blockTimestamp) {
          this.#logger.error(
            `Missing block timestamp for transaction ${tx.hash} in block ${blockNumber}, skipping transaction`,
          );
          continue;
        }
        const wasProcessed = await this.processTransaction({
          hash: tx.hash || "",
          from: tx.from || "",
          to: tx.to || "",
          input: tx.input,
          blockNumber: BigInt(tx.blockNumber || 0),
          blockTimestamp: new Date(blockTimestamp * 1000),
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
    blockTimestamp?: Date | undefined;
  }): Promise<boolean> {
    try {
      if (!transaction.blockTimestamp) return false;

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
        transaction.hash, // must be unique, which avoids double insert
        claimData.to,
        claimData.amount, // total eligible amount
        claimData.season,
        claimData.duration, // duration will be used to calc amount claimed
        transaction.blockNumber,
        transaction.blockTimestamp,
      );
      return true;
    } catch (error) {
      this.#logger.error(
        { error },
        `Failed to process transaction ${transaction.hash}`,
      );
      return false;
    }
  }

  /**
   * Calculate the maximum eligible amount based on claim amount and duration
   *
   * @param claimedAmount - the amount being claimed
   * @param duration - the time duration of the stake
   */
  private calculateClaimed(eligibleAmount: bigint, duration: bigint) {
    for (const d of STAKING_DURATIONS) {
      if (duration !== d.durationSeconds) continue;

      // Because we are using integers we need to multply by a percentage
      // numerator befor dividing by percentage denominator. The contract
      // formula in solidity is below for comparison.
      // Notes:
      // - `_amount` is total amount the address is eligible for.
      // - The contract enforces that PERCENTAGE_DENOMINATOR is always larger
      //   than forfeitPercent.
      // uint256 forfeitAmount = (_amount * forfeitPercentage) /
      //                 PERCENTAGE_DENOMINATOR;
      // uint256 amountToClaim = _amount - forfeitAmount;

      return (eligibleAmount * d.penaltyNumerator) / d.penaltyDenominator;
    }
    throw new Error("invalid duration, cannot calculate eligible");
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

      // Extract the parameters from the decoded function call
      // The claim function has 6 parameters: proof, to, amount, season, duration, signature
      // We only need to, amount, season, and duration
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
   * @param eligibleAmount - Amount eligible to claim
   * @param season - Season number
   * @param duration - Duration extracted from transaction
   * @param blockNumber - Block number
   * @param blockTimestamp - Block timestamp
   */
  private async insertConvictionClaim(
    transactionHash: string,
    claimer: string,
    eligibleAmount: bigint,
    season: number,
    duration: bigint,
    blockNumber: bigint,
    blockTimestamp: Date,
  ): Promise<void> {
    try {
      const claimedAmount = this.calculateClaimed(eligibleAmount, duration);

      // Use the repository to save the conviction claim
      const saved = await this.#convictionClaimsRepository.saveConvictionClaim({
        account: claimer,
        eligibleAmount,
        claimedAmount,
        season: season,
        duration: duration,
        blockNumber: blockNumber,
        blockTimestamp: blockTimestamp,
        transactionHash: transactionHash,
      });

      if (saved) {
        this.#logger.info(
          `Inserted conviction claim: account=${claimer}, season=${season}, ` +
            `claimed_amount=${claimedAmount}, eligible_amount=${eligibleAmount}, ` +
            `duration=${duration}s, block=${blockNumber} in tx ${transactionHash}`,
        );
      } else {
        this.#logger.debug(
          `Claim already exists for tx ${transactionHash} (idempotent)`,
        );
      }
    } catch (error) {
      this.#logger.error(
        { error },
        `Failed to insert conviction claim for tx ${transactionHash}`,
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
      blockTimestamp?: Date | undefined;
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
   * Highest block number already persisted to `conviction_claims`.
   *
   * Used by the indexing loop to set `fromBlock = lastBlock`
   * so we resume exactly where we left off after restarts.
   */
  lastBlockNumber(): Promise<bigint> {
    return this.#convictionClaimsRepository.lastBlockNumber();
  }
}
