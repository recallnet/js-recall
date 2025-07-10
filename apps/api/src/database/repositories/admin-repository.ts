import { and, count as drizzleCount, eq, ilike } from "drizzle-orm";

import { db } from "@/database/db.js";
import { admins } from "@/database/schema/core/defs.js";
import { InsertAdmin, SelectAdmin } from "@/database/schema/core/types.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { SearchAdminsParams } from "@/types/index.js";

import { PartialExcept } from "./types.js";

/**
 * Admin Repository
 * Handles database operations for admins
 */

/**
 * Create a new admin
 * @param admin Admin to create
 */
async function createImpl(admin: InsertAdmin): Promise<SelectAdmin> {
  try {
    const now = new Date();
    const [result] = await db
      .insert(admins)
      .values({
        ...admin,
        createdAt: admin.createdAt || now,
        updatedAt: admin.updatedAt || now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create admin - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Find all admins
 */
async function findAllImpl(): Promise<SelectAdmin[]> {
  try {
    return await db.select().from(admins);
  } catch (error) {
    console.error("[AdminRepository] Error in findAll:", error);
    throw error;
  }
}

/**
 * Find an admin by ID
 * @param id Admin ID to find
 */
async function findByIdImpl(id: string): Promise<SelectAdmin | undefined> {
  try {
    const [result] = await db.select().from(admins).where(eq(admins.id, id));
    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in findById:", error);
    throw error;
  }
}

/**
 * Find an admin by username
 * @param username The username to search for
 */
async function findByUsernameImpl(
  username: string,
): Promise<SelectAdmin | undefined> {
  try {
    const [result] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username));

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in findByUsername:", error);
    throw error;
  }
}

/**
 * Find an admin by email
 * @param email The email to search for
 */
async function findByEmailImpl(
  email: string,
): Promise<SelectAdmin | undefined> {
  try {
    const [result] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email));

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in findByEmail:", error);
    throw error;
  }
}

/**
 * Find an admin by API key
 * @param apiKey The API key to search for
 */
async function findByApiKeyImpl(
  apiKey: string,
): Promise<SelectAdmin | undefined> {
  try {
    const [result] = await db
      .select()
      .from(admins)
      .where(eq(admins.apiKey, apiKey));

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in findByApiKey:", error);
    throw error;
  }
}

/**
 * Update an admin
 * @param admin Admin data to update (must include id)
 */
async function updateImpl(
  admin: PartialExcept<InsertAdmin, "id">,
): Promise<SelectAdmin> {
  try {
    const now = new Date();
    const [result] = await db
      .update(admins)
      .set({
        ...admin,
        updatedAt: now,
      })
      .where(eq(admins.id, admin.id))
      .returning();

    if (!result) {
      throw new Error("Failed to update admin - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Delete an admin by ID
 * @param id Admin ID to delete
 * @returns true if admin was deleted, false otherwise
 */
async function deleteAdminImpl(id: string): Promise<boolean> {
  try {
    const [result] = await db
      .delete(admins)
      .where(eq(admins.id, id))
      .returning();

    return !!result;
  } catch (error) {
    console.error("[AdminRepository] Error in delete:", error);
    throw error;
  }
}

/**
 * Set API key for an admin
 * @param id Admin ID
 * @param apiKey New API key
 */
async function setApiKeyImpl(id: string, apiKey: string): Promise<SelectAdmin> {
  try {
    const now = new Date();
    const [result] = await db
      .update(admins)
      .set({
        apiKey,
        updatedAt: now,
      })
      .where(eq(admins.id, id))
      .returning();

    if (!result) {
      throw new Error("Failed to set API key - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in setApiKey:", error);
    throw error;
  }
}

/**
 * Update last login timestamp for an admin
 * @param id Admin ID
 */
async function updateLastLoginImpl(id: string): Promise<SelectAdmin> {
  try {
    const now = new Date();
    const [result] = await db
      .update(admins)
      .set({
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(admins.id, id))
      .returning();

    if (!result) {
      throw new Error("Failed to update last login - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in updateLastLogin:", error);
    throw error;
  }
}

/**
 * Update password hash for an admin
 * @param id Admin ID
 * @param passwordHash New password hash
 */
async function updatePasswordImpl(
  id: string,
  passwordHash: string,
): Promise<SelectAdmin> {
  try {
    const now = new Date();
    const [result] = await db
      .update(admins)
      .set({
        passwordHash,
        updatedAt: now,
      })
      .where(eq(admins.id, id))
      .returning();

    if (!result) {
      throw new Error("Failed to update password - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AdminRepository] Error in updatePassword:", error);
    throw error;
  }
}

/**
 * Search for admins by various attributes
 * @param searchParams Object containing search parameters
 * @returns Array of admins matching the search criteria
 */
async function searchAdminsImpl(
  searchParams: SearchAdminsParams,
): Promise<SelectAdmin[]> {
  try {
    const conditions = [];

    // Add filters for each provided parameter
    if (searchParams.username) {
      conditions.push(ilike(admins.username, `%${searchParams.username}%`));
    }

    if (searchParams.email) {
      conditions.push(ilike(admins.email, `%${searchParams.email}%`));
    }

    if (searchParams.name) {
      conditions.push(ilike(admins.name, `%${searchParams.name}%`));
    }

    if (searchParams.status) {
      conditions.push(eq(admins.status, searchParams.status));
    }

    // If no search parameters were provided, return all admins
    if (conditions.length === 0) {
      return await db.select().from(admins);
    }

    // Combine all conditions with AND operator
    return await db
      .select()
      .from(admins)
      .where(and(...conditions));
  } catch (error) {
    console.error("[AdminRepository] Error in searchAdmins:", error);
    throw error;
  }
}

/**
 * Count all admins
 */
async function countImpl(): Promise<number> {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(admins);
    return result?.count ?? 0;
  } catch (error) {
    console.error("[AdminRepository] Error in count:", error);
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
  "AdminRepository",
  "create",
);

export const findAll = createTimedRepositoryFunction(
  findAllImpl,
  "AdminRepository",
  "findAll",
);

export const findById = createTimedRepositoryFunction(
  findByIdImpl,
  "AdminRepository",
  "findById",
);

export const findByUsername = createTimedRepositoryFunction(
  findByUsernameImpl,
  "AdminRepository",
  "findByUsername",
);

export const findByEmail = createTimedRepositoryFunction(
  findByEmailImpl,
  "AdminRepository",
  "findByEmail",
);

export const findByApiKey = createTimedRepositoryFunction(
  findByApiKeyImpl,
  "AdminRepository",
  "findByApiKey",
);

export const update = createTimedRepositoryFunction(
  updateImpl,
  "AdminRepository",
  "update",
);

export const deleteAdmin = createTimedRepositoryFunction(
  deleteAdminImpl,
  "AdminRepository",
  "deleteAdmin",
);

export const setApiKey = createTimedRepositoryFunction(
  setApiKeyImpl,
  "AdminRepository",
  "setApiKey",
);

export const updateLastLogin = createTimedRepositoryFunction(
  updateLastLoginImpl,
  "AdminRepository",
  "updateLastLogin",
);

export const updatePassword = createTimedRepositoryFunction(
  updatePasswordImpl,
  "AdminRepository",
  "updatePassword",
);

export const searchAdmins = createTimedRepositoryFunction(
  searchAdminsImpl,
  "AdminRepository",
  "searchAdmins",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "AdminRepository",
  "count",
);
