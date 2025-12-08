import { and, count as drizzleCount, eq, ilike } from "drizzle-orm";
import { Logger } from "pino";

import { admins } from "../schema/core/defs.js";
import { InsertAdmin, SelectAdmin } from "../schema/core/types.js";
import { Database } from "../types.js";
import { SearchAdminsParams } from "./types/index.js";
import { PartialExcept } from "./util/types.js";

/**
 * Admin Repository
 * Handles database operations for admins
 */
export class AdminRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Create a new admin
   * @param admin Admin to create
   */
  async create(admin: InsertAdmin): Promise<SelectAdmin> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error({ error }, "Error in create");
      throw error;
    }
  }

  /**
   * Find all admins
   */
  async findAll(): Promise<SelectAdmin[]> {
    try {
      return await this.#db.select().from(admins);
    } catch (error) {
      this.#logger.error({ error }, "Error in findAll");
      throw error;
    }
  }

  /**
   * Find an admin by ID
   * @param id Admin ID to find
   */
  async findById(id: string): Promise<SelectAdmin | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(admins)
        .where(eq(admins.id, id));
      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findById");
      throw error;
    }
  }

  /**
   * Find an admin by username
   * @param username The username to search for
   */
  async findByUsername(username: string): Promise<SelectAdmin | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(admins)
        .where(eq(admins.username, username));

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByUsername");
      throw error;
    }
  }

  /**
   * Find an admin by email
   * @param email The email to search for
   */
  async findByEmail(email: string): Promise<SelectAdmin | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(admins)
        .where(eq(admins.email, email));

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in findByEmail");
      throw error;
    }
  }

  /**
   * Update an admin
   * @param admin Admin data to update (must include id)
   */
  async update(admin: PartialExcept<InsertAdmin, "id">): Promise<SelectAdmin> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error({ error }, "Error in update");
      throw error;
    }
  }

  /**
   * Delete an admin by ID
   * @param id Admin ID to delete
   * @returns true if admin was deleted, false otherwise
   */
  async deleteAdmin(id: string): Promise<boolean> {
    try {
      const [result] = await this.#db
        .delete(admins)
        .where(eq(admins.id, id))
        .returning();

      return !!result;
    } catch (error) {
      this.#logger.error({ error }, "Error in delete");
      throw error;
    }
  }

  /**
   * Set API key for an admin
   * @param id Admin ID
   * @param apiKey New API key
   */
  async setApiKey(id: string, apiKey: string): Promise<SelectAdmin> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error({ error }, "Error in setApiKey");
      throw error;
    }
  }

  /**
   * Update last login timestamp for an admin
   * @param id Admin ID
   */
  async updateLastLogin(id: string): Promise<SelectAdmin> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error({ error }, "Error in updateLastLogin");
      throw error;
    }
  }

  /**
   * Update password hash for an admin
   * @param id Admin ID
   * @param passwordHash New password hash
   */
  async updatePassword(id: string, passwordHash: string): Promise<SelectAdmin> {
    try {
      const now = new Date();
      const [result] = await this.#db
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
      this.#logger.error({ error }, "Error in updatePassword");
      throw error;
    }
  }

  /**
   * Search for admins by various attributes
   * @param searchParams Object containing search parameters
   * @returns Array of admins matching the search criteria
   */
  async searchAdmins(searchParams: SearchAdminsParams): Promise<SelectAdmin[]> {
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
        return await this.#db.select().from(admins);
      }

      // Combine all conditions with AND operator
      return await this.#db
        .select()
        .from(admins)
        .where(and(...conditions));
    } catch (error) {
      this.#logger.error({ error }, "Error in searchAdmins");
      throw error;
    }
  }

  /**
   * Count all admins
   */
  async count(): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(admins);
      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in count");
      throw error;
    }
  }
}
