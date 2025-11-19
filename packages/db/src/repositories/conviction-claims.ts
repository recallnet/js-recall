import { and, desc, eq } from "drizzle-orm";
import { Logger } from "pino";

import {
  NewConvictionClaim,
  convictionClaims,
} from "../schema/conviction-claims/defs.js";
import { Database } from "../types.js";

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
        .where(eq(convictionClaims.account, normalizedAccount))
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
            eq(convictionClaims.account, normalizedAccount),
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
            ? eq(convictionClaims.account, normalizedAccounts[0]!)
            : and(
                ...normalizedAccounts.map((account) =>
                  eq(convictionClaims.account, account),
                ),
              ),
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

      const result = await this.#db
        .insert(convictionClaims)
        .values({
          ...claim,
          account: claim.account.toLowerCase(),
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
}
