import { randomUUID } from "crypto";
import { and, count as drizzleCount, eq, ilike, ne, sql } from "drizzle-orm";
import { Logger } from "pino";

import { users } from "../schema/core/defs.js";
import { InsertUser, SelectUser } from "../schema/core/types.js";
import { Transaction } from "../types.js";
import { Database } from "../types.js";
import { UserSearchParams } from "./types/index.js";
import { PartialExcept } from "./util/types.js";

/**
 * User Repository
 * Handles database operations for users
 */
export class UserRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Create a new user
   * @param user User to create
   */
  async create(user: InsertUser): Promise<SelectUser> {
    try {
      const now = new Date();
      const normalizedWalletAddress = user.walletAddress?.toLowerCase();
      const normalizedEmbeddedWalletAddress =
        user.embeddedWalletAddress?.toLowerCase();
      const data = {
        ...user,
        id: user.id ?? randomUUID(),
        walletAddress: normalizedWalletAddress,
        embeddedWalletAddress: normalizedEmbeddedWalletAddress,
        createdAt: user.createdAt || now,
        updatedAt: user.updatedAt || now,
        lastLoginAt: user.lastLoginAt || now,
      };
      // Idempotent create: on email conflict, update existing record with new data
      const [row] = await this.#db
        .insert(users)
        .values(data)
        .onConflictDoUpdate({
          target: users.email,
          set: {
            // Backfill fields if they don't exist, but preserve existing values when present
            walletAddress: sql`COALESCE(${users.walletAddress}, EXCLUDED.wallet_address)`,
            walletLastVerifiedAt: sql`COALESCE(${users.walletLastVerifiedAt}, EXCLUDED.wallet_last_verified_at )`,
            embeddedWalletAddress: sql`COALESCE(${users.embeddedWalletAddress}, EXCLUDED.embedded_wallet_address)`,
            privyId: sql`COALESCE(${users.privyId}, EXCLUDED.privy_id)`,
            name: sql`COALESCE(${users.name}, EXCLUDED.name)`,
            imageUrl: sql`COALESCE(${users.imageUrl}, EXCLUDED.image_url)`,
            metadata: sql`COALESCE(${users.metadata}, EXCLUDED.metadata)`,
            isSubscribed: sql`COALESCE(EXCLUDED.is_subscribed, ${users.isSubscribed})`,

            // Prefer new values for timestamp fields
            updatedAt: sql`GREATEST(${users.updatedAt}, EXCLUDED.updated_at)`,
            lastLoginAt: sql`GREATEST(${users.lastLoginAt}, EXCLUDED.last_login_at)`,
          },
        })
        .returning();

      if (!row) {
        throw new Error(
          "Failed to create or retrieve existing user after conflict",
        );
      }
      return row;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in create");
      throw error;
    }
  }

  /**
   * Find all users
   */
  async findAll(): Promise<SelectUser[]> {
    try {
      return await this.#db.select().from(users);
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in findAll");
      throw error;
    }
  }

  /**
   * Find a user by ID
   * @param id User ID to find
   */
  async findById(id: string): Promise<SelectUser | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(users)
        .where(eq(users.id, id));
      return result;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in findById");
      throw error;
    }
  }

  /**
   * Find a user by wallet address
   * @param walletAddress The wallet address to search for
   */
  async findByWalletAddress(
    walletAddress: string,
  ): Promise<SelectUser | undefined> {
    try {
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const [result] = await this.#db
        .select()
        .from(users)
        .where(eq(users.walletAddress, normalizedWalletAddress));

      return result;
    } catch (error) {
      this.#logger.error(
        { error },
        "[UserRepository] Error in findByWalletAddress",
      );
      throw error;
    }
  }

  async findDuplicateByWalletAddress(
    walletAddress: string,
    distinctFromUserId: string,
  ) {
    try {
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const [result] = await this.#db
        .select()
        .from(users)
        .where(
          and(
            eq(users.walletAddress, normalizedWalletAddress),
            ne(users.id, distinctFromUserId),
          ),
        );

      return result;
    } catch (error) {
      this.#logger.error(
        { error },
        "[UserRepository] Error in findDuplicateByWalletAddress",
      );
      throw error;
    }
  }

  /**
   * Find a user by email
   * @param email The email to search for
   */
  async findByEmail(email: string): Promise<SelectUser | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(users)
        .where(eq(users.email, email));

      return result;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in findByEmail");
      throw error;
    }
  }

  /**
   * Find a user by Privy ID
   * @param privyId The Privy ID to search for
   */
  async findByPrivyId(privyId: string): Promise<SelectUser | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(users)
        .where(eq(users.privyId, privyId));

      return result;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in findByPrivyId");
      throw error;
    }
  }

  /**
   * Update a user
   * @param user User data to update (must include id)
   * @param tx An optional database transaction to run the opeation in
   */
  async update(
    user: PartialExcept<InsertUser, "id">,
    tx?: Transaction,
  ): Promise<SelectUser> {
    try {
      const now = new Date();
      const normalizedWalletAddress = user.walletAddress?.toLowerCase();
      const normalizedEmbeddedWalletAddress =
        user.embeddedWalletAddress?.toLowerCase();
      const data = {
        ...user,
        walletAddress: normalizedWalletAddress,
        embeddedWalletAddress: normalizedEmbeddedWalletAddress,
        updatedAt: now,
      };
      const executor = tx || this.#db;
      const [result] = await executor
        .update(users)
        .set(data)
        .where(eq(users.id, user.id))
        .returning();

      if (!result) {
        throw new Error("Failed to update user - no result returned");
      }

      return result;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in update");
      throw error;
    }
  }

  /**
   * Delete a user by ID
   * @param id User ID to delete
   * @param tx An optional database transaction to run the operation in
   * @returns true if user was deleted, false otherwise
   */
  async deleteUser(id: string, tx?: Transaction): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .delete(users)
        .where(eq(users.id, id))
        .returning();

      return !!result;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in delete");
      throw error;
    }
  }

  /**
   * Search for users by various attributes
   * @param searchParams Object containing search parameters
   * @returns Array of users matching the search criteria
   */
  async searchUsers(searchParams: UserSearchParams): Promise<SelectUser[]> {
    try {
      const conditions = [];

      // Add filters for each provided parameter
      if (searchParams.email) {
        conditions.push(ilike(users.email, `%${searchParams.email}%`));
      }

      if (searchParams.name) {
        conditions.push(ilike(users.name, `%${searchParams.name}%`));
      }

      if (searchParams.walletAddress) {
        const normalizedWalletAddress =
          searchParams.walletAddress.toLowerCase();
        conditions.push(
          ilike(users.walletAddress, `%${normalizedWalletAddress}%`),
        );
      }

      if (searchParams.status) {
        conditions.push(eq(users.status, searchParams.status));
      }

      // If no search parameters were provided, return all users
      if (conditions.length === 0) {
        return await this.#db.select().from(users);
      }

      // Combine all conditions with AND operator
      return await this.#db
        .select()
        .from(users)
        .where(and(...conditions));
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in searchUsers");
      throw error;
    }
  }

  /**
   * Count all users
   */
  async count(): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(users);
      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error({ error }, "[UserRepository] Error in count");
      throw error;
    }
  }
}
