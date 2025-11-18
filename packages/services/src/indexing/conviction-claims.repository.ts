import { and, desc, eq } from "drizzle-orm";

import { TxHashCoder } from "@recallnet/db/coders";
import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";
import { Transaction } from "@recallnet/db/types";
import type { Database } from "@recallnet/db/types";

/**
 * ConvictionClaimsRepository
 *
 * Persistence layer for the conviction_claims table.
 * This repository handles storage and retrieval of claim events from the conviction claims contract.
 *
 * Responsibilities:
 * - Store claim events with idempotency checks
 * - Query claims by account, season, or both
 * - Track total claimed amounts per account
 *
 * Relationships:
 * - Called by TransactionProcessor to store decoded claim transactions
 * - Writes to `conviction_claims` table with blockchain metadata
 *
 * Conventions:
 * - All addresses are stored lowercase
 * - Transaction and block hashes are stored as bytea
 * - Amounts are stored as bigint
 */
export class ConvictionClaimsRepository {
  readonly #db: Database;

  constructor(database: Database) {
    this.#db = database;
  }

  /**
   * Check if a claim event has already been recorded.
   *
   * Idempotency key: transaction_hash
   *
   * Returns:
   * - true  → already present (caller should skip processing)
   * - false → new event (caller may proceed)
   */
  async isConvictionClaimPresent(
    transactionHash: string,
    tx?: Transaction,
  ): Promise<boolean> {
    const executor = tx || this.#db;
    const txHash = TxHashCoder.encode(transactionHash);
    const rows = await executor
      .select({ id: convictionClaims.id })
      .from(convictionClaims)
      .where(eq(convictionClaims.transactionHash, txHash))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Save a new claim transaction to the database.
   *
   * Parameters:
   * - account: The address that made the claim
   * - eligible_amount: The total amount eligible to claim
   * - claimedAmount: The amount actually claimed
   * - season: The season number
   * - duration: The stake duration
   * - Chain metadata: block number, hashes, timestamps, etc.
   *
   * Returns:
   * - true  → row inserted (first time we see this claim)
   * - false → insert was skipped by the unique constraint (already present)
   *
   * Notes:
   * - Uses onConflictDoNothing() for race-proof idempotency
   * - All addresses and hashes are normalized to lowercase
   */
  async saveConvictionClaim(
    params: {
      account: string;
      eligibleAmount: bigint;
      claimedAmount: bigint;
      season: number;
      duration: bigint;
      blockNumber: bigint;
      blockTimestamp: Date;
      transactionHash: string;
    },
    tx?: Transaction,
  ): Promise<boolean> {
    const executor = tx || this.#db;

    const account = params.account.toLowerCase();
    const txHash = TxHashCoder.encode(params.transactionHash);

    const rows = await executor
      .insert(convictionClaims)
      .values({
        id: crypto.randomUUID(),
        account,
        eligibleAmount: params.eligibleAmount,
        claimedAmount: params.claimedAmount,
        season: params.season,
        duration: params.duration,
        blockNumber: params.blockNumber,
        blockTimestamp: params.blockTimestamp,
        transactionHash: txHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: convictionClaims.id });

    return rows.length > 0;
  }

  /**
   * Get all conviction claims for a specific account.
   *
   * Parameters:
   * - account: The address to query (will be normalized)
   * - season: Optional season filter
   *
   * Returns:
   * - Array of claim records, ordered by block number desc
   */
  async getConvictionClaimsByAccount(
    account: string,
    season?: number,
    tx?: Transaction,
  ): Promise<Array<typeof convictionClaims.$inferSelect>> {
    const executor = tx || this.#db;
    const normalizedAccount = account.toLowerCase();

    const conditions = [eq(convictionClaims.account, normalizedAccount)];
    if (season !== undefined) {
      conditions.push(eq(convictionClaims.season, season));
    }

    return await executor
      .select()
      .from(convictionClaims)
      .where(and(...conditions))
      .orderBy(desc(convictionClaims.blockNumber));
  }

  /**
   * Get total conviction claimed amount for an account.
   *
   * Parameters:
   * - account: The address to query
   * - season: Optional season filter
   *
   * Returns:
   * - Total claimed amount as bigint
   */
  async getTotalConvictionClaimedByAccount(
    account: string,
    season?: number,
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;
    const normalizedAccount = account.toLowerCase();

    const conditions = [eq(convictionClaims.account, normalizedAccount)];
    if (season !== undefined) {
      conditions.push(eq(convictionClaims.season, season));
    }

    const rows = await executor
      .select({
        total: convictionClaims.claimedAmount,
      })
      .from(convictionClaims)
      .where(and(...conditions));

    return rows.reduce((sum, row) => sum + row.total, 0n);
  }

  /**
   * Get all conviction claims for a specific season.
   *
   * Parameters:
   * - season: The season number to query
   * - limit: Optional limit for pagination
   * - offset: Optional offset for pagination
   *
   * Returns:
   * - Array of claim records
   */
  async getConvictionClaimsBySeason(
    season: number,
    limit?: number,
    offset?: number,
    tx?: Transaction,
  ): Promise<Array<typeof convictionClaims.$inferSelect>> {
    const executor = tx || this.#db;

    let query = executor
      .select()
      .from(convictionClaims)
      .where(eq(convictionClaims.season, season))
      .orderBy(desc(convictionClaims.blockNumber))
      .$dynamic();

    if (limit !== undefined) {
      query = query.limit(limit);
    }
    if (offset !== undefined) {
      query = query.offset(offset);
    }

    return await query;
  }

  /**
   * Get the latest conviction claim for an account in a specific season.
   *
   * Parameters:
   * - account: The address to query
   * - season: The season number
   *
   * Returns:
   * - The most recent claim record, or null if none exists
   */
  async getLatestConvictionClaim(
    account: string,
    season: number,
    tx?: Transaction,
  ): Promise<typeof convictionClaims.$inferSelect | null> {
    const executor = tx || this.#db;
    const normalizedAccount = account.toLowerCase();

    const [row] = await executor
      .select()
      .from(convictionClaims)
      .where(
        and(
          eq(convictionClaims.account, normalizedAccount),
          eq(convictionClaims.season, season),
        ),
      )
      .orderBy(desc(convictionClaims.blockNumber))
      .limit(1);

    return row ?? null;
  }

  /**
   * Get the highest block number from all conviction claims.
   *
   * Used by the indexing loop to set `fromBlock = lastBlock`
   * so we resume exactly where we left off after restarts.
   *
   * Returns:
   * - The highest block number, or 0n if no claims exist
   */
  async lastBlockNumber(tx?: Transaction): Promise<bigint> {
    const executor = tx || this.#db;

    const [row] = await executor
      .select({ maxBlock: convictionClaims.blockNumber })
      .from(convictionClaims)
      .orderBy(desc(convictionClaims.blockNumber))
      .limit(1);

    return row?.maxBlock ?? 0n;
  }
}
