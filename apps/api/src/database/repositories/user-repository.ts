import { and, count as drizzleCount, eq, ilike, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { users } from "@recallnet/db-schema/core/defs";
import { InsertUser, SelectUser } from "@recallnet/db-schema/core/types";
import { Transaction } from "@recallnet/db-schema/types";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { UserSearchParams } from "@/types/index.js";

import { PartialExcept } from "./types.js";

/**
 * User Repository
 * Handles database operations for users
 */

/**
 * Create a new user
 * @param user User to create
 */
async function createImpl(user: InsertUser): Promise<SelectUser> {
  try {
    const now = new Date();
    const normalizedWalletAddress = user.walletAddress?.toLowerCase();
    const normalizedEmbeddedWalletAddress =
      user.embeddedWalletAddress?.toLowerCase();
    const data = {
      ...user,
      id: user.id ?? uuidv4(),
      walletAddress: normalizedWalletAddress,
      embeddedWalletAddress: normalizedEmbeddedWalletAddress,
      createdAt: user.createdAt || now,
      updatedAt: user.updatedAt || now,
      lastLoginAt: user.lastLoginAt || now,
    };
    // Idempotent create: on email conflict, update existing record with new data
    const [row] = await db
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
    repositoryLogger.error("[UserRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Find all users
 */
async function findAllImpl(): Promise<SelectUser[]> {
  try {
    return await db.select().from(users);
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in findAll:", error);
    throw error;
  }
}

/**
 * Find a user by ID
 * @param id User ID to find
 */
async function findByIdImpl(id: string): Promise<SelectUser | undefined> {
  try {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in findById:", error);
    throw error;
  }
}

/**
 * Find a user by wallet address
 * @param walletAddress The wallet address to search for
 */
async function findByWalletAddressImpl(
  walletAddress: string,
): Promise<SelectUser | undefined> {
  try {
    const normalizedWalletAddress = walletAddress.toLowerCase();
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, normalizedWalletAddress));

    return result;
  } catch (error) {
    repositoryLogger.error(
      "[UserRepository] Error in findByWalletAddress:",
      error,
    );
    throw error;
  }
}

/**
 * Find a user by email
 * @param email The email to search for
 */
async function findByEmailImpl(email: string): Promise<SelectUser | undefined> {
  try {
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return result;
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in findByEmail:", error);
    throw error;
  }
}

/**
 * Find a user by Privy ID
 * @param privyId The Privy ID to search for
 */
async function findByPrivyIdImpl(
  privyId: string,
): Promise<SelectUser | undefined> {
  try {
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.privyId, privyId));

    return result;
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in findByPrivyId:", error);
    throw error;
  }
}

/**
 * Update a user
 * @param user User data to update (must include id)
 * @param tx An optional database transaction to run the opeation in
 */
async function updateImpl(
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
    const executor = tx || db;
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
    repositoryLogger.error("[UserRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Delete a user by ID
 * @param id User ID to delete
 * @param tx An optional database transaction to run the operation in
 * @returns true if user was deleted, false otherwise
 */
async function deleteUserImpl(id: string, tx?: Transaction): Promise<boolean> {
  try {
    const executor = tx || db;
    const [result] = await executor
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    return !!result;
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in delete:", error);
    throw error;
  }
}

/**
 * Search for users by various attributes
 * @param searchParams Object containing search parameters
 * @returns Array of users matching the search criteria
 */
async function searchUsersImpl(
  searchParams: UserSearchParams,
): Promise<SelectUser[]> {
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
      const normalizedWalletAddress = searchParams.walletAddress.toLowerCase();
      conditions.push(
        ilike(users.walletAddress, `%${normalizedWalletAddress}%`),
      );
    }

    if (searchParams.status) {
      conditions.push(eq(users.status, searchParams.status));
    }

    // If no search parameters were provided, return all users
    if (conditions.length === 0) {
      return await db.select().from(users);
    }

    // Combine all conditions with AND operator
    return await db
      .select()
      .from(users)
      .where(and(...conditions));
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in searchUsers:", error);
    throw error;
  }
}

/**
 * Count all users
 */
async function countImpl(): Promise<number> {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(users);
    return result?.count ?? 0;
  } catch (error) {
    repositoryLogger.error("[UserRepository] Error in count:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const create = createTimedRepositoryFunction(
  createImpl,
  "UserRepository",
  "create",
);

export const findAll = createTimedRepositoryFunction(
  findAllImpl,
  "UserRepository",
  "findAll",
);

export const findById = createTimedRepositoryFunction(
  findByIdImpl,
  "UserRepository",
  "findById",
);

export const findByWalletAddress = createTimedRepositoryFunction(
  findByWalletAddressImpl,
  "UserRepository",
  "findByWalletAddress",
);

export const findByEmail = createTimedRepositoryFunction(
  findByEmailImpl,
  "UserRepository",
  "findByEmail",
);

export const findByPrivyId = createTimedRepositoryFunction(
  findByPrivyIdImpl,
  "UserRepository",
  "findByPrivyId",
);

export const update = createTimedRepositoryFunction(
  updateImpl,
  "UserRepository",
  "update",
);

export const deleteUser = createTimedRepositoryFunction(
  deleteUserImpl,
  "UserRepository",
  "deleteUser",
);

export const searchUsers = createTimedRepositoryFunction(
  searchUsersImpl,
  "UserRepository",
  "searchUsers",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "UserRepository",
  "count",
);
