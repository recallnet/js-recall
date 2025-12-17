import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Logger } from "pino";

import { AdminRepository } from "@recallnet/db/repositories/admin";
import {
  InsertAdmin,
  SelectAdmin,
  SelectAgent,
  SelectUser,
} from "@recallnet/db/schema/core/types";

import { AgentService } from "./agent.service.js";
import { checkUserUniqueConstraintViolation } from "./lib/error-utils.js";
import { generateHandleFromName } from "./lib/handle-utils.js";
import { ApiError } from "./types/index.js";
import { AdminMetadata, SearchAdminsParams } from "./types/index.js";
import { UserService } from "./user.service.js";

export interface AdminServiceConfig {
  security: {
    rootEncryptionKey: string;
  };
}

/**
 * Admin Service
 * Manages admin accounts, authentication, and session management
 */
export class AdminService {
  // In-memory cache for API keys to avoid database lookups on every request
  private apiKeyCache: Map<string, string>; // apiKey -> adminId
  // Cache for admin profiles by ID
  private adminProfileCache: Map<string, SelectAdmin>; // adminId -> admin profile

  private adminRepository: AdminRepository;

  // Service dependencies
  private userService: UserService;
  private agentService: AgentService;

  private rootEncryptionKey: string;

  private logger: Logger;

  constructor(
    adminRepository: AdminRepository,
    userService: UserService,
    agentService: AgentService,
    config: AdminServiceConfig,
    logger: Logger,
  ) {
    this.apiKeyCache = new Map();
    this.adminProfileCache = new Map();
    this.adminRepository = adminRepository;
    this.userService = userService;
    this.agentService = agentService;
    this.rootEncryptionKey = config.security.rootEncryptionKey;
    this.logger = logger;
  }

  /**
   * Validates if an encryption key meets security requirements
   */
  private isValidEncryptionKey(key: string): boolean {
    return (
      key.length >= 32 &&
      !key.includes("default_encryption_key") &&
      !key.includes("your_") &&
      !key.includes("dev_") &&
      !key.includes("test_") &&
      !key.includes("replace_in_production")
    );
  }

  /**
   * Generates a new secure encryption key
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Updates the encryption key in memory
   */
  private updateEncryptionKeyInMemory(newKey: string): void {
    process.env.ROOT_ENCRYPTION_KEY = newKey;
    this.rootEncryptionKey = newKey;
  }

  /**
   * Ensures ROOT_ENCRYPTION_KEY exists in test mode (memory only)
   */
  private ensureEncryptionKeyInTestMode(): void {
    try {
      const existingKey = process.env.ROOT_ENCRYPTION_KEY;

      if (!existingKey || !this.isValidEncryptionKey(existingKey)) {
        const newKey = this.generateEncryptionKey();
        this.updateEncryptionKeyInMemory(newKey);
        this.logger.debug(
          "Generated ROOT_ENCRYPTION_KEY in memory (test mode - file not modified)",
        );
      } else {
        this.updateEncryptionKeyInMemory(existingKey);
        this.logger.debug(
          "Using existing ROOT_ENCRYPTION_KEY from environment (test mode)",
        );
      }
    } catch (error) {
      this.logger.error(
        { error },
        "Error ensuring ROOT_ENCRYPTION_KEY in test mode",
      );
    }
  }

  /**
   * Ensures ROOT_ENCRYPTION_KEY exists in .env file for non-test mode
   */
  private ensureEncryptionKeyInEnvFile(): void {
    try {
      const envFile = ".env";
      const envPath = path.resolve(process.cwd(), envFile);
      this.logger.info(`Checking for ${envFile} file at: ${envPath}`);

      if (!fs.existsSync(envPath)) {
        this.logger.error(`${envFile} file not found at expected location`);
        return;
      }

      const envContent = fs.readFileSync(envPath, "utf8");
      // Match ROOT_ENCRYPTION_KEY=... only on non-commented lines
      // ^(?!\s*#) - negative lookahead: line doesn't start with optional whitespace + #
      const rootKeyPattern = /^(?!\s*#)\s*ROOT_ENCRYPTION_KEY=.*$/m;
      const keyMatch = rootKeyPattern.exec(envContent);

      // Check if key exists and is valid
      if (keyMatch) {
        // Extract the value after the = sign, handling optional whitespace
        const matchedLine = keyMatch[0];
        const currentValue = matchedLine.split("=")[1]?.trim();

        if (currentValue && this.isValidEncryptionKey(currentValue)) {
          this.updateEncryptionKeyInMemory(currentValue);
          this.logger.info("ROOT_ENCRYPTION_KEY already exists in .env");
          return;
        }
      }

      // Generate and persist new key
      const newEncryptionKey = this.generateEncryptionKey();
      this.logger.info("Generated new ROOT_ENCRYPTION_KEY");

      // Update the .env file content
      const updatedEnvContent = keyMatch
        ? envContent.replace(
            rootKeyPattern,
            `ROOT_ENCRYPTION_KEY=${newEncryptionKey}`,
          )
        : envContent.trim() + `\n\nROOT_ENCRYPTION_KEY=${newEncryptionKey}\n`;

      fs.writeFileSync(envPath, updatedEnvContent);
      this.logger.info(`Updated ROOT_ENCRYPTION_KEY in ${envFile} file`);

      // Update in memory
      this.updateEncryptionKeyInMemory(newEncryptionKey);

      this.logger.info("✅ Configuration reloaded with new encryption key");
    } catch (envError) {
      this.logger.error(
        { error: envError },
        "Error updating ROOT_ENCRYPTION_KEY",
      );
      // Continue with admin setup even if the env update fails
    }
  }

  /**
   * Ensures ROOT_ENCRYPTION_KEY exists, generating one if needed.
   * In test mode, the key is generated in memory only without modifying files.
   * In non-test mode, the key is persisted to the .env file.
   */
  private async ensureRootEncryptionKey(): Promise<void> {
    const isTestMode =
      process.env.NODE_ENV === "test" || process.env.TEST_MODE === "true";

    if (isTestMode) {
      this.ensureEncryptionKeyInTestMode();
    } else {
      this.ensureEncryptionKeyInEnvFile();
    }
  }

  /**
   * Creates admin record and stores it in database with cache updates
   */
  private async createAndStoreAdmin(
    username: string,
    password: string,
    email: string,
    name?: string,
  ): Promise<{ admin: SelectAdmin; apiKey: string }> {
    // Generate admin ID
    const id = crypto.randomUUID();

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
    const savedAdmin = await this.adminRepository.create(admin);

    // Update cache
    this.apiKeyCache.set(apiKey, id);
    this.adminProfileCache.set(id, savedAdmin);

    this.logger.debug(
      `[AdminManager] Setup initial admin: ${username} (${id})`,
    );

    return { admin: savedAdmin, apiKey };
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
      const existingAdmins = await this.getAllAdmins();
      if (existingAdmins.length > 0) {
        throw new ApiError(
          403,
          "Admin setup is not allowed - an admin account already exists",
        );
      }

      // Ensure ROOT_ENCRYPTION_KEY exists in .env file
      await this.ensureRootEncryptionKey();

      // Create and store the admin
      const { admin: savedAdmin, apiKey } = await this.createAndStoreAdmin(
        username,
        password,
        email,
        name,
      );

      // Return admin with unencrypted API key
      return {
        ...savedAdmin,
        apiKey, // Return unencrypted key for initial setup
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          { error },
          "[AdminManager] Error setting up initial admin",
        );
        throw error;
      }

      this.logger.error(
        { error },
        "[AdminManager] Unknown error setting up admin",
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
      const existingByUsername = await this.adminRepository.findByUsername(
        username.toLowerCase(),
      );
      if (existingByUsername) {
        throw new Error(`Admin with username ${username} already exists`);
      }

      // Check for existing email
      const existingByEmail = await this.adminRepository.findByEmail(
        email.toLowerCase(),
      );
      if (existingByEmail) {
        throw new Error(`Admin with email ${email} already exists`);
      }

      // Generate admin ID
      const id = crypto.randomUUID();

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
      const savedAdmin = await this.adminRepository.create(admin);

      // Update cache
      this.adminProfileCache.set(id, savedAdmin);

      this.logger.debug(`[AdminManager] Created admin: ${username} (${id})`);

      return savedAdmin;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error({ error }, "[AdminManager] Error creating admin");
        throw error;
      }

      this.logger.error(
        { error },
        "[AdminManager] Unknown error creating admin",
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
      const admin = await this.adminRepository.findById(adminId);

      // Update cache if found
      if (admin) {
        this.adminProfileCache.set(adminId, admin);
        return admin;
      }

      return null;
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error retrieving admin ${adminId}`,
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
      const admins = await this.adminRepository.findAll();

      // Update cache with all admins
      admins.forEach((admin) => {
        this.adminProfileCache.set(admin.id, admin);
      });

      return admins;
    } catch (error) {
      this.logger.error(
        { error },
        "[AdminManager] Error retrieving all admins",
      );
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
      const updatedAdmin = await this.adminRepository.update({
        ...admin,
        updatedAt: now,
      });

      // Update cache
      this.adminProfileCache.set(admin.id, updatedAdmin);

      this.logger.debug(`[AdminManager] Updated admin: ${admin.id}`);
      return updatedAdmin;
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error updating admin ${admin.id}`,
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
      const admin = await this.adminRepository.findById(adminId);

      // Delete from database
      const deleted = await this.adminRepository.deleteAdmin(adminId);

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

        this.logger.debug(
          `[AdminManager] Successfully deleted admin: ${admin.username} (${adminId})`,
        );
      } else {
        this.logger.debug(`[AdminManager] Failed to delete admin: ${adminId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error deleting admin ${adminId}`,
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
      const admin = await this.adminRepository.findByUsername(
        username.toLowerCase(),
      );
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
      this.logger.error(
        { error },
        `[AdminManager] Error authenticating admin ${username}`,
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
      const admins = await this.adminRepository.findAll();

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
            this.logger.error(
              { error: decryptError },
              `[AdminManager] Error decrypting API key for admin ${admin.id}`,
            );
            // Skip this admin if decryption fails
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error({ error }, "[AdminManager] Error validating API key");
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
      await this.adminRepository.setApiKey(adminId, encryptedApiKey);

      // Update cache
      this.apiKeyCache.set(apiKey, adminId);

      this.logger.debug(
        `[AdminManager] Generated new API key for admin: ${adminId}`,
      );
      return apiKey;
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error generating API key for admin ${adminId}`,
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
      this.logger.error(
        { error },
        `[AdminManager] Error resetting API key for admin ${adminId}`,
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
      this.logger.error({ error }, "[AdminManager] Error hashing password");
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
      await this.adminRepository.updatePassword(adminId, passwordHash);

      this.logger.debug(
        `[AdminManager] Updated password for admin: ${adminId}`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error updating password for admin ${adminId}`,
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
      const admin = await this.adminRepository.findById(adminId);
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
      this.logger.error(
        { error },
        `[AdminManager] Error validating password for admin ${adminId}`,
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
      await this.adminRepository.updateLastLogin(adminId);
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error updating last login for admin ${adminId}`,
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
      this.logger.error(
        { error },
        `[AdminManager] Error checking admin status ${adminId}`,
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
      await this.adminRepository.update({
        id: adminId,
        status: "suspended",
        metadata: { suspensionReason: reason, suspensionDate: new Date() },
        updatedAt: new Date(),
      });

      // Remove from cache
      this.adminProfileCache.delete(adminId);

      this.logger.debug(
        `[AdminManager] Suspended admin: ${adminId}, reason: ${reason}`,
      );
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error suspending admin ${adminId}`,
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
      await this.adminRepository.update({
        id: adminId,
        status: "active",
        metadata: { reactivationDate: new Date() },
        updatedAt: new Date(),
      });

      // Remove from cache to force refresh
      this.adminProfileCache.delete(adminId);

      this.logger.debug(`[AdminManager] Reactivated admin: ${adminId}`);
    } catch (error) {
      this.logger.error(
        { error },
        `[AdminManager] Error reactivating admin ${adminId}`,
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
      return await this.adminRepository.searchAdmins(searchParams);
    } catch (error) {
      this.logger.error({ error }, "[AdminManager] Error searching admins");
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
    this.logger.debug(
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
      this.logger.debug(
        `[AdminManager] Encrypting API key with length: ${key.length}`,
      );
      const algorithm = "aes-256-cbc";
      const iv = crypto.randomBytes(16);

      // Create a consistently-sized key from the root encryption key
      const cryptoKey = crypto
        .createHash("sha256")
        .update(String(this.rootEncryptionKey))
        .digest();

      const cipher = crypto.createCipheriv(algorithm, cryptoKey, iv);
      let encrypted = cipher.update(key, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return the IV and encrypted data together, clearly separated
      const result = `${iv.toString("hex")}:${encrypted}`;
      this.logger.debug(
        `[AdminManager] Encrypted key length: ${result.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error({ error }, "[AdminManager] Error encrypting API key");
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
        .update(String(this.rootEncryptionKey))
        .digest();

      const decipher = crypto.createDecipheriv(algorithm, cryptoKey, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      this.logger.error({ error }, "[AdminManager] Error decrypting API key");
      throw error;
    }
  }

  /**
   * Check if the system is healthy
   * @returns true if the system can count admins, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.adminRepository.count();
      return res >= 0;
    } catch (error) {
      this.logger.error({ error }, "[AdminManager] Health check failed");
      return false;
    }
  }

  /**
   * Register a new user and optionally create their first agent
   * @param userData User registration data
   * @returns Result object with user and optionally agent data
   * @throws {ApiError} With appropriate HTTP status code and message
   */
  async registerUserAndAgent(userData: {
    walletAddress: string;
    embeddedWalletAddress?: string;
    privyId?: string;
    name?: string;
    email?: string;
    userImageUrl?: string;
    userMetadata?: Record<string, unknown>;
    agentName?: string;
    agentHandle?: string;
    agentDescription?: string;
    agentImageUrl?: string;
    agentMetadata?: Record<string, unknown>;
    agentWalletAddress?: string;
  }): Promise<{
    user: SelectUser;
    agent?: SelectAgent;
    agentError?: string;
  }> {
    try {
      const {
        walletAddress,
        embeddedWalletAddress,
        privyId,
        name,
        email,
        userImageUrl,
        userMetadata,
        agentName,
        agentHandle,
        agentDescription,
        agentImageUrl,
        agentMetadata,
        agentWalletAddress,
      } = userData;

      // Create the user
      const user = await this.userService.registerUser(
        walletAddress,
        name,
        email,
        userImageUrl,
        userMetadata,
        privyId,
        embeddedWalletAddress,
      );

      let agent: SelectAgent | undefined = undefined;
      let agentError: string | undefined;

      // If agent details are provided, create an agent for this user
      if (agentName) {
        try {
          agent = await this.agentService.createAgent({
            ownerId: user.id,
            name: agentName,
            handle: agentHandle ?? generateHandleFromName(agentName), // Auto-generate from name
            description: agentDescription,
            imageUrl: agentImageUrl,
            metadata: agentMetadata,
            walletAddress: agentWalletAddress,
          });
        } catch (error) {
          this.logger.error({ error }, "Error creating agent for user");
          // If agent creation fails, we still return the user but note the agent error
          agentError =
            error instanceof Error ? error.message : "Failed to create agent";
        }
      }

      return {
        user,
        agent,
        agentError,
      };
    } catch (error) {
      this.logger.error({ error }, "[AdminManager] Error registering user");

      if (error instanceof Error) {
        // Check for invalid wallet address errors
        if (
          error.message.includes("Wallet address is required") ||
          error.message.includes("Invalid Ethereum address")
        ) {
          throw new ApiError(400, error.message);
        }

        // Check for unique constraint violations
        const constraintError = checkUserUniqueConstraintViolation(error);
        if (constraintError) {
          throw new ApiError(
            409,
            `A user with this ${constraintError} already exists`,
          );
        }
      }

      // For any other errors, wrap them as internal server errors
      throw new ApiError(
        500,
        error instanceof Error
          ? error.message
          : "Unknown error registering user",
      );
    }
  }

  /**
   * Clear all caches (useful for testing or when memory management is needed)
   */
  clearCache(): void {
    this.apiKeyCache.clear();
    this.adminProfileCache.clear();
    this.logger.debug("[AdminManager] All caches cleared");
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
