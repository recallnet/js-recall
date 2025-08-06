import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import { config } from "@/config/index.js";
import {
  count,
  create,
  deleteAdmin,
  findAll,
  findByEmail,
  findById,
  findByUsername,
  searchAdmins,
  setApiKey,
  update,
  updateLastLogin,
  updatePassword,
} from "@/database/repositories/admin-repository.js";
import { InsertAdmin, SelectAdmin } from "@/database/schema/core/types.js";
import { serviceLogger } from "@/lib/logger.js";
import { AdminMetadata, SearchAdminsParams } from "@/types/index.js";

/**
 * Admin Manager Service
 * Manages admin accounts, authentication, and session management
 */
export class AdminManager {
  // In-memory cache for API keys to avoid database lookups on every request
  private apiKeyCache: Map<string, string>; // apiKey -> adminId
  // Cache for admin profiles by ID
  private adminProfileCache: Map<string, SelectAdmin>; // adminId -> admin profile

  constructor() {
    this.apiKeyCache = new Map();
    this.adminProfileCache = new Map();
  }

  /**
   * Set up the initial admin account (only allowed if no admins exist)
   * @param username Admin username
   * @param password Admin password
   * @param email Admin email
   * @param name Optional admin display name
   * @returns The created admin with API key
   */
  async setupInitialAdmin(
    username: string,
    password: string,
    email: string,
    name?: string,
  ) {
    try {
      // Check if any admin already exists
      const existingAdmins = await findAll();
      if (existingAdmins.length > 0) {
        throw new Error("Admin setup not allowed - admin already exists");
      }

      // Validate inputs
      if (!username || !password || !email) {
        throw new Error("Username, password, and email are required");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      // Generate admin ID
      const id = uuidv4();

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Generate API key
      const apiKey = this.generateApiKey();
      const encryptedApiKey = this.encryptApiKey(apiKey);

      // Create admin record
      const admin: InsertAdmin = {
        id,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash,
        apiKey: encryptedApiKey,
        name,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const savedAdmin = await create(admin);

      // Update cache
      this.apiKeyCache.set(apiKey, id);
      this.adminProfileCache.set(id, savedAdmin);

      serviceLogger.debug(
        `[AdminManager] Setup initial admin: ${username} (${id})`,
      );

      // Return admin with unencrypted API key
      return {
        ...savedAdmin,
        apiKey, // Return unencrypted key for initial setup
      };
    } catch (error) {
      if (error instanceof Error) {
        serviceLogger.error(
          "[AdminManager] Error setting up initial admin:",
          error,
        );
        throw error;
      }

      serviceLogger.error(
        "[AdminManager] Unknown error setting up admin:",
        error,
      );
      throw new Error(`Failed to setup admin: ${error}`);
    }
  }

  /**
   * Create a new admin account
   * @param adminData Admin data including username, email, password
   * @returns The created admin
   */
  async createAdmin(adminData: {
    username: string;
    email: string;
    password: string;
    name?: string;
    metadata?: AdminMetadata;
  }) {
    try {
      const { username, email, password, name, metadata } = adminData;

      // Validate inputs
      if (!username || !email || !password) {
        throw new Error("Username, email, and password are required");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      // Check for existing username
      const existingByUsername = await findByUsername(username.toLowerCase());
      if (existingByUsername) {
        throw new Error(`Admin with username ${username} already exists`);
      }

      // Check for existing email
      const existingByEmail = await findByEmail(email.toLowerCase());
      if (existingByEmail) {
        throw new Error(`Admin with email ${email} already exists`);
      }

      // Generate admin ID
      const id = uuidv4();

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create admin record
      const admin: InsertAdmin = {
        id,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash,
        name,
        metadata,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const savedAdmin = await create(admin);

      // Update cache
      this.adminProfileCache.set(id, savedAdmin);

      serviceLogger.debug(`[AdminManager] Created admin: ${username} (${id})`);

      return savedAdmin;
    } catch (error) {
      if (error instanceof Error) {
        serviceLogger.error("[AdminManager] Error creating admin:", error);
        throw error;
      }

      serviceLogger.error(
        "[AdminManager] Unknown error creating admin:",
        error,
      );
      throw new Error(`Failed to create admin: ${error}`);
    }
  }

  /**
   * Get an admin by ID
   * @param adminId The admin ID
   * @returns The admin or null if not found
   */
  async getAdmin(adminId: string): Promise<SelectAdmin | null> {
    try {
      // Check cache first
      const cachedAdmin = this.adminProfileCache.get(adminId);
      if (cachedAdmin) {
        return cachedAdmin;
      }

      // Get from database
      const admin = await findById(adminId);

      // Update cache if found
      if (admin) {
        this.adminProfileCache.set(adminId, admin);
        return admin;
      }

      return null;
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error retrieving admin ${adminId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get all admins
   * @returns Array of admins
   */
  async getAllAdmins(): Promise<SelectAdmin[]> {
    try {
      const admins = await findAll();

      // Update cache with all admins
      admins.forEach((admin) => {
        this.adminProfileCache.set(admin.id, admin);
      });

      return admins;
    } catch (error) {
      serviceLogger.error("[AdminManager] Error retrieving all admins:", error);
      return [];
    }
  }

  /**
   * Update an admin's profile
   * @param admin Admin data to update (must include id)
   * @returns The updated admin
   */
  async updateAdmin(
    admin: Partial<InsertAdmin> & { id: string },
  ): Promise<SelectAdmin> {
    try {
      const now = new Date();
      const updatedAdmin = await update({
        ...admin,
        updatedAt: now,
      });

      // Update cache
      this.adminProfileCache.set(admin.id, updatedAdmin);

      serviceLogger.debug(`[AdminManager] Updated admin: ${admin.id}`);
      return updatedAdmin;
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error updating admin ${admin.id}:`,
        error,
      );
      throw new Error(
        `Failed to update admin: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Delete an admin by ID
   * @param adminId The admin ID to delete
   * @returns true if admin was deleted, false otherwise
   */
  async deleteAdmin(adminId: string) {
    try {
      // Get admin first for cache cleanup
      const admin = await findById(adminId);

      // Delete from database
      const deleted = await deleteAdmin(adminId);

      if (deleted && admin) {
        // Clean up cache
        this.adminProfileCache.delete(adminId);

        // Remove from API key cache if present
        if (admin.apiKey) {
          for (const [key, cachedAdminId] of this.apiKeyCache.entries()) {
            if (cachedAdminId === adminId) {
              this.apiKeyCache.delete(key);
              break;
            }
          }
        }

        serviceLogger.debug(
          `[AdminManager] Successfully deleted admin: ${admin.username} (${adminId})`,
        );
      } else {
        serviceLogger.debug(
          `[AdminManager] Failed to delete admin: ${adminId}`,
        );
      }

      return deleted;
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error deleting admin ${adminId}:`,
        error,
      );
      throw new Error(
        `Failed to delete admin: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Authenticate admin with password
   * @param username The username
   * @param password The password
   * @returns The admin ID if valid, null otherwise
   */
  async authenticatePassword(
    username: string,
    password: string,
  ): Promise<string | null> {
    try {
      const admin = await findByUsername(username.toLowerCase());
      if (!admin || admin.status !== "active") {
        return null;
      }

      const isValid = await this.validatePassword(admin.id, password);
      if (!isValid) {
        return null;
      }

      // Update last login
      await this.updateLastLogin(admin.id);

      // Update cache
      this.adminProfileCache.set(admin.id, admin);

      return admin.id;
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error authenticating admin ${username}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Validate an API key
   * @param apiKey The API key to validate
   * @returns The admin ID if valid, null otherwise
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    try {
      // Check cache first
      const cachedAdminId = this.apiKeyCache.get(apiKey);
      if (cachedAdminId) {
        const admin = await this.getAdmin(cachedAdminId);
        if (admin && admin.status === "active") {
          await this.updateLastLogin(cachedAdminId);
          return cachedAdminId;
        }
      }

      // If not in cache, search all admins
      const admins = await findAll();

      for (const admin of admins) {
        if (admin.apiKey && admin.status === "active") {
          try {
            const decryptedKey = this.decryptApiKey(admin.apiKey);
            if (decryptedKey === apiKey) {
              // Update cache
              this.apiKeyCache.set(apiKey, admin.id);
              this.adminProfileCache.set(admin.id, admin);

              // Update last login
              await this.updateLastLogin(admin.id);

              return admin.id;
            }
          } catch (decryptError) {
            serviceLogger.error(
              `[AdminManager] Error decrypting API key for admin ${admin.id}:`,
              decryptError,
            );
            // Skip this admin if decryption fails
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      serviceLogger.error("[AdminManager] Error validating API key:", error);
      return null;
    }
  }

  /**
   * Generate a new API key for an admin
   * @param adminId The admin ID
   * @returns The new API key
   */
  async generateApiKeyForAdmin(adminId: string): Promise<string> {
    try {
      const apiKey = this.generateApiKey();
      const encryptedApiKey = this.encryptApiKey(apiKey);

      // Update admin with new API key
      await setApiKey(adminId, encryptedApiKey);

      // Update cache
      this.apiKeyCache.set(apiKey, adminId);

      serviceLogger.debug(
        `[AdminManager] Generated new API key for admin: ${adminId}`,
      );
      return apiKey;
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error generating API key for admin ${adminId}:`,
        error,
      );
      throw new Error(
        `Failed to generate API key: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Reset an admin's API key
   * @param adminId The admin ID
   * @returns The new API key
   */
  async resetApiKey(adminId: string): Promise<string> {
    try {
      // Remove old API key from cache first
      for (const [key, cachedAdminId] of this.apiKeyCache.entries()) {
        if (cachedAdminId === adminId) {
          this.apiKeyCache.delete(key);
          break;
        }
      }

      // Generate new API key
      return await this.generateApiKeyForAdmin(adminId);
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error resetting API key for admin ${adminId}:`,
        error,
      );
      throw new Error(
        `Failed to reset API key: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Hash a password using bcrypt-like approach with crypto
   * @param password The password to hash
   * @returns The hashed password
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha256")
        .toString("hex");
      return `${salt}:${hash}`;
    } catch (error) {
      serviceLogger.error("[AdminManager] Error hashing password:", error);
      throw new Error("Failed to hash password");
    }
  }

  /**
   * Update an admin's password
   * @param adminId The admin ID
   * @param newPassword The new password
   */
  async updatePassword(adminId: string, newPassword: string): Promise<void> {
    try {
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      const passwordHash = await this.hashPassword(newPassword);
      await updatePassword(adminId, passwordHash);

      serviceLogger.debug(
        `[AdminManager] Updated password for admin: ${adminId}`,
      );
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error updating password for admin ${adminId}:`,
        error,
      );
      throw new Error(
        `Failed to update password: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Validate a password against the stored hash
   * @param adminId The admin ID
   * @param password The password to validate
   * @returns true if password is valid, false otherwise
   */
  async validatePassword(adminId: string, password: string): Promise<boolean> {
    try {
      const admin = await findById(adminId);
      if (!admin || !admin.passwordHash) {
        return false;
      }

      const [salt, hash] = admin.passwordHash.split(":");
      if (!salt || !hash) {
        return false;
      }

      const testHash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha256")
        .toString("hex");
      return testHash === hash;
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error validating password for admin ${adminId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Update last login timestamp for an admin
   * @param adminId The admin ID
   */
  async updateLastLogin(adminId: string): Promise<void> {
    try {
      await updateLastLogin(adminId);
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error updating last login for admin ${adminId}:`,
        error,
      );
      // Don't throw here as this is not critical
    }
  }

  /**
   * Check if an admin is active
   * @param adminId The admin ID
   * @returns true if admin is active, false otherwise
   */
  async isAdminActive(adminId: string): Promise<boolean> {
    try {
      const admin = await this.getAdmin(adminId);
      return admin?.status === "active";
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error checking admin status ${adminId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Suspend an admin account
   * @param adminId The admin ID
   * @param reason Reason for suspension
   */
  async suspendAdmin(adminId: string, reason: string): Promise<void> {
    try {
      await update({
        id: adminId,
        status: "suspended",
        metadata: { suspensionReason: reason, suspensionDate: new Date() },
        updatedAt: new Date(),
      });

      // Remove from cache
      this.adminProfileCache.delete(adminId);

      serviceLogger.debug(
        `[AdminManager] Suspended admin: ${adminId}, reason: ${reason}`,
      );
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error suspending admin ${adminId}:`,
        error,
      );
      throw new Error(
        `Failed to suspend admin: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Reactivate a suspended admin account
   * @param adminId The admin ID
   */
  async reactivateAdmin(adminId: string): Promise<void> {
    try {
      await update({
        id: adminId,
        status: "active",
        metadata: { reactivationDate: new Date() },
        updatedAt: new Date(),
      });

      // Remove from cache to force refresh
      this.adminProfileCache.delete(adminId);

      serviceLogger.debug(`[AdminManager] Reactivated admin: ${adminId}`);
    } catch (error) {
      serviceLogger.error(
        `[AdminManager] Error reactivating admin ${adminId}:`,
        error,
      );
      throw new Error(
        `Failed to reactivate admin: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Search for admins by various attributes
   * @param searchParams Object containing search parameters
   * @returns Array of admins matching the search criteria
   */
  async searchAdmins(searchParams: SearchAdminsParams) {
    try {
      return await searchAdmins(searchParams);
    } catch (error) {
      serviceLogger.error("[AdminManager] Error searching admins:", error);
      return [];
    }
  }

  /**
   * Generate a new API key (same format as agent keys for consistency)
   * @returns A new API key
   */
  private generateApiKey(): string {
    // Generate just 2 segments for a shorter key (consistent with agent keys)
    const segment1 = crypto.randomBytes(8).toString("hex"); // 16 chars
    const segment2 = crypto.randomBytes(8).toString("hex"); // 16 chars

    // Combine with a prefix and separator underscore for readability
    const key = `${segment1}_${segment2}`;
    serviceLogger.debug(
      `[AdminManager] Generated API key with length: ${key.length}`,
    );
    return key;
  }

  /**
   * Encrypt an API key for database storage (same as agent encryption)
   * @param key The API key to encrypt
   * @returns The encrypted key
   */
  private encryptApiKey(key: string): string {
    try {
      serviceLogger.debug(
        `[AdminManager] Encrypting API key with length: ${key.length}`,
      );
      const algorithm = "aes-256-cbc";
      const iv = crypto.randomBytes(16);

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash("sha256")
        .update(String(config.security.rootEncryptionKey))
        .digest();

      const cipher = crypto.createCipheriv(algorithm, cryptoKey, iv);
      let encrypted = cipher.update(key, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return the IV and encrypted data together, clearly separated
      const result = `${iv.toString("hex")}:${encrypted}`;
      serviceLogger.debug(
        `[AdminManager] Encrypted key length: ${result.length}`,
      );
      return result;
    } catch (error) {
      serviceLogger.error("[AdminManager] Error encrypting API key:", error);
      throw new Error("Failed to encrypt API key");
    }
  }

  /**
   * Decrypt an encrypted API key
   * @param encryptedKey The encrypted API key
   * @returns The original API key
   */
  private decryptApiKey(encryptedKey: string): string {
    try {
      const algorithm = "aes-256-cbc";
      const parts = encryptedKey.split(":");

      if (parts.length !== 2) {
        throw new Error("Invalid encrypted key format");
      }

      const iv = Buffer.from(parts[0]!, "hex");
      const encrypted = parts[1]!;

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash("sha256")
        .update(String(config.security.rootEncryptionKey))
        .digest();

      const decipher = crypto.createDecipheriv(algorithm, cryptoKey, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      serviceLogger.error("[AdminManager] Error decrypting API key:", error);
      throw error;
    }
  }

  /**
   * Check if the system is healthy
   * @returns true if the system can count admins, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await count();
      return res >= 0;
    } catch (error) {
      serviceLogger.error("[AdminManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Clear all caches (useful for testing or when memory management is needed)
   */
  clearCache(): void {
    this.apiKeyCache.clear();
    this.adminProfileCache.clear();
    serviceLogger.debug("[AdminManager] All caches cleared");
  }

  /**
   * Get cache statistics for monitoring
   * @returns Object with cache sizes
   */
  getCacheStats() {
    return {
      apiKeyCacheSize: this.apiKeyCache.size,
      profileCacheSize: this.adminProfileCache.size,
    };
  }
}
