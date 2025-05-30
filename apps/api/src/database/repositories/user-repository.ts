import { and, count as drizzleCount, eq, ilike } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { users } from "@/database/schema/core/defs.js";
import { InsertUser, SelectUser } from "@/database/schema/core/types.js";
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
export async function create(user: InsertUser): Promise<SelectUser> {
  try {
    const now = new Date();
    const normalizedWalletAddress = user.walletAddress.toLowerCase();
    const data = {
      ...user,
      walletAddress: normalizedWalletAddress,
      createdAt: user.createdAt || now,
      updatedAt: user.updatedAt || now,
    };
    const [result] = await db.insert(users).values(data).returning();

    if (!result) {
      throw new Error("Failed to create user - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[UserRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Create a new user from a wallet address
 * This is typically used during the SIWE login process if a user record
 * doesn't exist yet for a successfully authenticated wallet.
 * @param walletAddress The wallet address of the user to create
 * @returns The newly created user object
 */
export async function createUserFromWallet(
  walletAddress: string,
): Promise<SelectUser> {
  try {
    const now = new Date();
    const normalizedWalletAddress = walletAddress.toLowerCase();
    const newUser: InsertUser = {
      id: uuidv4(),
      walletAddress: normalizedWalletAddress,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const [result] = await db.insert(users).values(newUser).returning();

    if (!result) {
      throw new Error(
        `[UserRepository] Failed to create user from wallet ${normalizedWalletAddress} - no result returned`,
      );
    }
    console.log(
      `[UserRepository] Created new user ${result.id} for wallet ${normalizedWalletAddress}`,
    );
    return result;
  } catch (error) {
    console.error(
      `[UserRepository] Error in createUserFromWallet for wallet ${walletAddress}:`,
      error,
    );
    throw error;
  }
}

/**
 * Find all users
 */
export async function findAll(): Promise<SelectUser[]> {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error("[UserRepository] Error in findAll:", error);
    throw error;
  }
}

/**
 * Find a user by ID
 * @param id User ID to find
 */
export async function findById(id: string): Promise<SelectUser | undefined> {
  try {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  } catch (error) {
    console.error("[UserRepository] Error in findById:", error);
    throw error;
  }
}

/**
 * Find a user by wallet address
 * @param walletAddress The wallet address to search for
 */
export async function findByWalletAddress(
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
    console.error("[UserRepository] Error in findByWalletAddress:", error);
    throw error;
  }
}

/**
 * Find a user by email
 * @param email The email to search for
 */
export async function findByEmail(
  email: string,
): Promise<SelectUser | undefined> {
  try {
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return result;
  } catch (error) {
    console.error("[UserRepository] Error in findByEmail:", error);
    throw error;
  }
}

/**
 * Update a user
 * @param user User data to update (must include id)
 */
export async function update(
  user: PartialExcept<InsertUser, "id">,
): Promise<SelectUser> {
  try {
    const now = new Date();
    const normalizedWalletAddress = user.walletAddress?.toLowerCase();
    const data = {
      ...user,
      walletAddress: normalizedWalletAddress,
      updatedAt: now,
    };
    const [result] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, user.id))
      .returning();

    if (!result) {
      throw new Error("Failed to update user - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[UserRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Delete a user by ID
 * @param id User ID to delete
 * @returns true if user was deleted, false otherwise
 */
export async function deleteUser(id: string): Promise<boolean> {
  try {
    const [result] = await db.delete(users).where(eq(users.id, id)).returning();

    return !!result;
  } catch (error) {
    console.error("[UserRepository] Error in delete:", error);
    throw error;
  }
}

/**
 * Search for users by various attributes
 * @param searchParams Object containing search parameters
 * @returns Array of users matching the search criteria
 */
export async function searchUsers(
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
    console.error("[UserRepository] Error in searchUsers:", error);
    throw error;
  }
}

/**
 * Count all users
 */
export async function count(): Promise<number> {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(users);
    return result?.count ?? 0;
  } catch (error) {
    console.error("[UserRepository] Error in count:", error);
    throw error;
  }
}
