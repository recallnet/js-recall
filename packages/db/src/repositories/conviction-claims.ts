import { and, desc, eq, gte, inArray, lt, lte, sql, sum } from "drizzle-orm";
import { Logger } from "pino";

import { TxHashCoder } from "../coders/index.js";
import {
  NewConvictionClaim,
  convictionClaims,
} from "../schema/conviction-claims/defs.js";
import { Database, Transaction } from "../types.js";

export class ConvictionClaimsRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(db: Database, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Get all conviction claims for a specific account
   */
  async getClaimsByAccount(account: string) {
    try {
      const normalizedAccount = account.toLowerCase();

      const results = await this.#db
        .select()
        .from(convictionClaims)
        .where(eq(convictionClaims.walletAddress, normalizedAccount))
        .orderBy(desc(convictionClaims.blockTimestamp));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error fetching claims by account");
      throw error;
    }
  }

  /**
   * Get conviction claim for a specific account and season
   */
  async getClaimByAccountAndSeason(account: string, season: number) {
    try {
      const normalizedAccount = account.toLowerCase();

      const result = await this.#db
        .select()
        .from(convictionClaims)
        .where(
          and(
            eq(convictionClaims.walletAddress, normalizedAccount),
            eq(convictionClaims.season, season),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const claim = result[0]!;
      return {
        id: claim.id,
        account: claim.account,
        eligibleAmount: claim.eligibleAmount,
        claimedAmount: claim.claimedAmount,
        season: claim.season,
        duration: claim.duration,
        blockNumber: claim.blockNumber,
        blockTimestamp: claim.blockTimestamp,
        transactionHash: claim.transactionHash,
      };
    } catch (error) {
      this.#logger.error(
        { error },
        `Error fetching claim for account ${account} and season ${season}:`,
      );
      throw error;
    }
  }

  /**
   * Get all conviction claims for multiple accounts
   */
  async getClaimsByAccounts(accounts: string[]) {
    try {
      if (accounts.length === 0) {
        return [];
      }

      const normalizedAccounts = accounts.map((a) => a.toLowerCase());

      const results = await this.#db
        .select()
        .from(convictionClaims)
        .where(
          normalizedAccounts.length === 1
            ? eq(convictionClaims.walletAddress, normalizedAccounts[0]!)
            : inArray(convictionClaims.walletAddress, normalizedAccounts),
        )
        .orderBy(desc(convictionClaims.blockTimestamp));

      return results.map((claim) => ({
        id: claim.id,
        account: claim.account,
        eligibleAmount: claim.eligibleAmount,
        claimedAmount: claim.claimedAmount,
        season: claim.season,
        duration: claim.duration,
        blockNumber: claim.blockNumber,
        blockTimestamp: claim.blockTimestamp,
        transactionHash: claim.transactionHash,
      }));
    } catch (error) {
      this.#logger.error({ error }, "Error fetching claims by accounts");
      throw error;
    }
  }

  /**
   * Check if an account has claimed for a specific season
   */
  async hasClaimedForSeason(account: string, season: number): Promise<boolean> {
    try {
      const claim = await this.getClaimByAccountAndSeason(account, season);
      return claim !== null;
    } catch (error) {
      this.#logger.error(
        { error },
        `Error checking claim status for account ${account} and season ${season}:`,
      );
      throw error;
    }
  }

  /**
   * Get total claimed amount for an account across all seasons
   */
  async getTotalClaimedByAccount(account: string): Promise<bigint> {
    try {
      const claims = await this.getClaimsByAccount(account);
      return claims.reduce(
        (total, claim) => total + claim.claimedAmount,
        BigInt(0),
      );
    } catch (error) {
      this.#logger.error(
        { error },
        `Error getting total claimed for account ${account}:`,
      );
      throw error;
    }
  }

  /**
   * Insert a new conviction claim
   */
  async insertClaim(claim: NewConvictionClaim) {
    try {
      this.#logger.info(
        `Inserting conviction claim for account ${claim.account}, season ${claim.season}`,
      );

      const normalizedAccount = claim.account.toLowerCase();
      const result = await this.#db
        .insert(convictionClaims)
        .values({
          ...claim,
          account: normalizedAccount,
          walletAddress: normalizedAccount,
        })
        .returning();

      this.#logger.info(
        `Successfully inserted conviction claim with id ${result[0]!.id}`,
      );

      return result[0]!;
    } catch (error) {
      this.#logger.error({ error }, "Error inserting conviction claim");
      throw error;
    }
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
    params: Omit<NewConvictionClaim, "transactionHash"> & {
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
        walletAddress: account,
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

    const conditions = [eq(convictionClaims.walletAddress, normalizedAccount)];
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

    const conditions = [eq(convictionClaims.walletAddress, normalizedAccount)];
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
          eq(convictionClaims.walletAddress, normalizedAccount),
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

  /**
   * Get all accounts with active stakes for a given season.
   *
   * Active stakes are conviction claims where:
   * - duration >= 1 (actual stakes, not just claims)
   * - blockTimestamp <= seasonEndDate (claimed before season end)
   * - stake duration extends past the season end date
   *
   * @param seasonEndDate - The end date of the season
   * @param tx - Optional transaction
   * @returns Map of account addresses to their total active stake amounts
   */
  async getActiveStakesForSeason(
    seasonEndDate: Date,
    tx?: Transaction,
  ): Promise<Map<string, bigint>> {
    const executor = tx || this.#db;

    try {
      const results = await executor
        .select({
          account: convictionClaims.account,
          claimedAmount: convictionClaims.claimedAmount,
        })
        .from(convictionClaims)
        .where(
          and(
            gte(convictionClaims.duration, 1n),
            lte(convictionClaims.blockTimestamp, seasonEndDate),
            sql`${convictionClaims.blockTimestamp} + (${convictionClaims.duration} * interval '1 second') > ${seasonEndDate}`,
          ),
        );

      const accountStakes = new Map<string, bigint>();
      for (const stake of results) {
        const current = accountStakes.get(stake.account) || 0n;
        accountStakes.set(stake.account, current + stake.claimedAmount);
      }

      return accountStakes;
    } catch (error) {
      this.#logger.error({ error }, "Error fetching active stakes for season");
      throw error;
    }
  }

  /**
   * Get active stake amount for a specific account in a season.
   *
   * @param account - The account address to query
   * @param seasonEndDate - The end date of the season
   * @param tx - Optional transaction
   * @returns The total active stake amount for the account
   */
  async getActiveStakeForAccount(
    account: string,
    seasonEndDate: Date,
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;
    const normalizedAccount = account.toLowerCase();

    try {
      const results = await executor
        .select({
          claimedAmount: convictionClaims.claimedAmount,
        })
        .from(convictionClaims)
        .where(
          and(
            eq(convictionClaims.account, normalizedAccount),
            gte(convictionClaims.duration, 1n),
            lte(convictionClaims.blockTimestamp, seasonEndDate),
            sql`${convictionClaims.blockTimestamp} + (${convictionClaims.duration} * interval '1 second') > ${seasonEndDate}`,
          ),
        );

      return results.reduce((total, stake) => total + stake.claimedAmount, 0n);
    } catch (error) {
      this.#logger.error(
        { error },
        `Error fetching active stake for account ${account}`,
      );
      throw error;
    }
  }

  /**
   * Calculate total forfeited amount from all claims up to a given date.
   *
   * Forfeited amount = eligibleAmount - claimedAmount for each claim.
   *
   * @param endDate - Calculate forfeitures from claims up to this date
   * @param tx - Optional transaction
   * @returns Total forfeited amount
   */
  async getTotalForfeitedUpToDate(
    endDate: Date,
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;

    try {
      const results = await executor
        .select({
          eligibleAmount: convictionClaims.eligibleAmount,
          claimedAmount: convictionClaims.claimedAmount,
        })
        .from(convictionClaims)
        .where(lte(convictionClaims.blockTimestamp, endDate));

      return results.reduce(
        (total, claim) => total + (claim.eligibleAmount - claim.claimedAmount),
        0n,
      );
    } catch (error) {
      this.#logger.error({ error }, "Error calculating total forfeited amount");
      throw error;
    }
  }

  /**
   * Get total conviction rewards claimed across seasons.
   *
   * @param fromSeason - Start season (inclusive), corresponds to the app's concept of "airdrop number"
   * @param toSeason - End season (inclusive), corresponds  to the app's concept of "airdrop number"
   * @param tx - Optional transaction
   * @returns Total claimed amount from conviction reward seasons
   */
  async getTotalConvictionRewardsClaimedBySeason(
    fromSeason: number,
    toSeason: number,
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;

    try {
      const [result] = await executor
        .select({
          totalClaimed: sum(convictionClaims.claimedAmount),
        })
        .from(convictionClaims)
        .where(
          and(
            gte(convictionClaims.season, fromSeason),
            lte(convictionClaims.season, toSeason),
          ),
        );

      return BigInt(result?.totalClaimed || "0");
    } catch (error) {
      this.#logger.error(
        { error },
        `Error getting total conviction rewards claimed for seasons ${fromSeason}-${toSeason}`,
      );
      throw error;
    }
  }

  /**
   * Get total active stakes across all accounts for a season.
   *
   * @param seasonEndDate - The end date of the season
   * @param tx - Optional transaction
   * @returns Total active stakes amount
   */
  async getTotalActiveStakesForSeason(
    seasonEndDate: Date,
    tx?: Transaction,
  ): Promise<bigint> {
    const executor = tx || this.#db;

    try {
      const [result] = await executor
        .select({
          totalStakes: sum(convictionClaims.claimedAmount),
        })
        .from(convictionClaims)
        .where(
          and(
            gte(convictionClaims.duration, 1n),
            lte(convictionClaims.blockTimestamp, seasonEndDate),
            sql`${convictionClaims.blockTimestamp} + (${convictionClaims.duration} * interval '1 second') > ${seasonEndDate}`,
          ),
        );

      return BigInt(result?.totalStakes || "0");
    } catch (error) {
      this.#logger.error(
        { error },
        "Error fetching total active stakes for season",
      );
      throw error;
    }
  }
}
