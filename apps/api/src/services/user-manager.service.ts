import { v4 as uuidv4 } from "uuid";

import { InsertUser, SelectUser } from "@recallnet/db-schema/core/types";
import { Transaction } from "@recallnet/db-schema/types";

import { db } from "@/database/db.js";
import { updateAgentsOwner } from "@/database/repositories/agent-repository.js";
import {
  count,
  create,
  deleteUser,
  findAll,
  findByEmail,
  findById,
  findByPrivyId,
  findByWalletAddress,
  findDuplicateByWalletAddress,
  searchUsers,
  update,
} from "@/database/repositories/user-repository.js";
import { updateVotesOwner } from "@/database/repositories/vote-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { EmailService } from "@/services/email.service.js";
import { WatchlistService } from "@/services/watchlist.service.js";
import { UserMetadata, UserSearchParams } from "@/types/index.js";

/**
 * User Manager Service
 * Manages user registration and profile management
 */
export class UserManager {
  // In-memory cache for user lookups by wallet address to avoid database lookups
  private userWalletCache: Map<string, string>; // walletAddress -> userId
  // Cache for user profiles by ID
  private userProfileCache: Map<string, SelectUser>; // userId -> user profile
  // Email service for sending verification emails
  private emailService: EmailService;
  // Watchlist service for sanctions checking
  private watchlistService: WatchlistService;

  constructor(emailService: EmailService, watchlistService: WatchlistService) {
    this.userWalletCache = new Map();
    this.userProfileCache = new Map();
    this.emailService = emailService;
    this.watchlistService = watchlistService;
  }

  /**
   * Validate an Ethereum address
   * @param address The Ethereum address to validate
   * @returns True if the address is valid
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Register a new user
   * @param walletAddress Ethereum wallet address (must start with 0x)
   * @param name Optional user name
   * @param email Optional contact email
   * @param imageUrl Optional URL to the user's image
   * @param metadata Optional user metadata
   * @returns The created user
   */
  async registerUser(
    walletAddress: string,
    name?: string,
    email?: string,
    imageUrl?: string,
    metadata?: UserMetadata,
    privyId?: string,
    embeddedWalletAddress?: string,
  ) {
    try {
      if (!walletAddress) {
        throw new Error("Wallet address is required");
      }
      if (
        !this.isValidEthereumAddress(walletAddress) ||
        (embeddedWalletAddress &&
          !this.isValidEthereumAddress(embeddedWalletAddress))
      ) {
        throw new Error(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }
      if (!email) {
        throw new Error("Email is required");
      }

      // Convert to lowercase for consistency
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const normalizedEmbeddedWalletAddress =
        embeddedWalletAddress?.toLowerCase();

      // Check wallet addresses against sanctions list
      const isWalletSanctioned =
        await this.watchlistService.isAddressSanctioned(
          normalizedWalletAddress,
        );
      if (isWalletSanctioned) {
        throw new Error(
          "This wallet address is not permitted for use on this platform",
        );
      }

      if (normalizedEmbeddedWalletAddress) {
        const isEmbeddedWalletSanctioned =
          await this.watchlistService.isAddressSanctioned(
            normalizedEmbeddedWalletAddress,
          );
        if (isEmbeddedWalletSanctioned) {
          throw new Error(
            "This wallet address is not permitted for use on this platform",
          );
        }
      }

      // Create user record with subscription status
      // Note: the `newUserId` could be different than the `savedUserId` because registering a new
      // user will update on conflict—so the `id` will be original `user.id` in the database.
      const newUserId = uuidv4();
      const user: InsertUser = {
        id: newUserId,
        walletAddress: normalizedWalletAddress,
        embeddedWalletAddress: normalizedEmbeddedWalletAddress,
        name,
        email,
        privyId,
        imageUrl,
        metadata,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      // Store in database
      let savedUser = await create(user);
      const savedUserId = savedUser.id;

      // Attempt to subscribe to the email list after persistence
      try {
        const emailSubscriptionResult = await this.emailService.subscribeUser(
          email,
          {
            userId: savedUserId,
            name: name ?? undefined,
          },
        );
        if (
          emailSubscriptionResult?.success &&
          savedUser.isSubscribed !== true
        ) {
          // Persist subscription status to DB
          savedUser = await update({ id: savedUserId, isSubscribed: true });
        } else if (
          emailSubscriptionResult &&
          !emailSubscriptionResult.success
        ) {
          serviceLogger.error(
            `[UserManager] Error subscribing user ${savedUser.id} to email list: ${emailSubscriptionResult.error}`,
          );
        }
      } catch (subErr) {
        serviceLogger.error(
          `[UserManager] Unexpected error during email subscription for ${savedUser.id}:`,
          subErr,
        );
      }

      // Update cache
      this.userWalletCache.set(normalizedWalletAddress, savedUserId);
      this.userProfileCache.set(savedUserId, savedUser);

      serviceLogger.debug(
        `[UserManager] Registered user: ${name || "Unknown"} (${savedUserId}) with wallet ${normalizedWalletAddress}`,
      );

      return savedUser;
    } catch (error) {
      if (error instanceof Error) {
        serviceLogger.error("[UserManager] Error registering user:", error);
        throw error;
      }

      serviceLogger.error(
        "[UserManager] Unknown error registering user:",
        error,
      );
      throw new Error(`Failed to register user: ${error}`);
    }
  }

  /**
   * Get a user by ID
   * @param userId The user ID
   * @returns The user or null if not found
   */
  async getUser(userId: string): Promise<SelectUser | null> {
    try {
      // Check cache first
      const cachedUser = this.userProfileCache.get(userId);
      if (cachedUser) {
        return cachedUser;
      }

      // Get from database
      const user = await findById(userId);

      // Update cache if found
      if (user) {
        this.userProfileCache.set(userId, user);
        this.userWalletCache.set(user.walletAddress, userId);
        return user;
      }

      return null;
    } catch (error) {
      serviceLogger.error(
        `[UserManager] Error retrieving user ${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get all users
   * @returns Array of users
   */
  async getAllUsers(): Promise<SelectUser[]> {
    try {
      const users = await findAll();

      // Update cache with all users
      users.forEach((user) => {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
      });

      return users;
    } catch (error) {
      serviceLogger.error("[UserManager] Error retrieving all users:", error);
      return [];
    }
  }

  /**
   * Update a user's profile
   * @param user User data to update (must include id)
   * @returns The updated user
   */
  async updateUser(
    user: Partial<InsertUser> & { id: string },
  ): Promise<SelectUser> {
    try {
      // Get the current user data to check if email is being changed
      const currentUser = await this.getUser(user.id);
      if (!currentUser) {
        throw new Error(`User with ID ${user.id} not found`);
      }

      // Check wallet address against sanctions list if being updated
      if (
        user.walletAddress &&
        user.walletAddress !== currentUser.walletAddress
      ) {
        const isSanctioned = await this.watchlistService.isAddressSanctioned(
          user.walletAddress,
        );
        if (isSanctioned) {
          throw new Error(
            "This wallet address is not permitted for use on this platform",
          );
        }
      }

      // Check if another account exists with this wallet address
      const duplicateAccount = user.walletAddress
        ? await findDuplicateByWalletAddress(user.walletAddress, user.id)
        : undefined;

      const updatedUser = await db.transaction(async (tx) => {
        if (duplicateAccount) {
          await updateAgentsOwner(duplicateAccount.id, user.id, tx);
          await updateVotesOwner(duplicateAccount.id, user.id, tx);
          await this.deleteUser(duplicateAccount.id, tx);
        }
        const updatedUser = await update({ ...user }, tx);
        return updatedUser;
      });

      // Update cache
      this.userProfileCache.set(user.id, updatedUser);
      if (updatedUser.walletAddress !== currentUser.walletAddress) {
        this.userWalletCache.set(updatedUser.walletAddress, user.id);
      }

      serviceLogger.debug(`[UserManager] Updated user: ${user.id}`);
      return updatedUser;
    } catch (error) {
      serviceLogger.error(
        `[UserManager] Error updating user ${user.id}:`,
        error,
      );
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Delete a user by ID
   * @param userId The user ID to delete
   * @returns true if user was deleted, false otherwise
   */
  async deleteUser(userId: string, tx?: Transaction): Promise<boolean> {
    try {
      // Get user first to find wallet address for cache cleanup
      const user = await findById(userId);

      // Delete from database
      const deleted = await deleteUser(userId, tx);

      if (deleted && user) {
        // Clean up cache
        this.userProfileCache.delete(userId);
        this.userWalletCache.delete(user.walletAddress);

        serviceLogger.debug(
          `[UserManager] Successfully deleted user: ${user.name || "Unknown"} (${userId})`,
        );
      } else {
        serviceLogger.debug(`[UserManager] Failed to delete user: ${userId}`);
      }

      return deleted;
    } catch (error) {
      serviceLogger.error(
        `[UserManager] Error deleting user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Get a user by wallet address
   * @param walletAddress The wallet address to search for
   * @returns The user or null if not found
   */
  async getUserByWalletAddress(
    walletAddress: string,
  ): Promise<SelectUser | null> {
    try {
      const normalizedWalletAddress = walletAddress.toLowerCase();

      // Check cache first
      const cachedUserId = this.userWalletCache.get(normalizedWalletAddress);
      if (cachedUserId) {
        const cachedUser = this.userProfileCache.get(cachedUserId);
        if (cachedUser) {
          return cachedUser;
        }
      }

      // Get from database
      const user = await findByWalletAddress(normalizedWalletAddress);

      // Update cache if found
      if (user) {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(normalizedWalletAddress, user.id);
        return user;
      }

      return null;
    } catch (error) {
      serviceLogger.error(
        `[UserManager] Error retrieving user by wallet address ${walletAddress}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get a user by Privy ID
   * @param privyId The Privy ID to search for
   * @returns The user or null if not found
   */
  async getUserByPrivyId(privyId: string): Promise<SelectUser | null> {
    try {
      // Note: We don't cache by Privy ID yet as this is a new feature
      // and we expect most lookups to be by user ID or wallet address
      const user = await findByPrivyId(privyId);

      // Update profile cache if found
      if (user) {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
        return user;
      }

      return null;
    } catch (error) {
      serviceLogger.error(
        `[UserManager] Error retrieving user by Privy ID ${privyId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get a user by email
   * @param email The email to search for
   * @returns The user or null if not found
   */
  async getUserByEmail(email: string): Promise<SelectUser | null> {
    try {
      const user = await findByEmail(email);

      // Update cache if found
      if (user) {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
        return user;
      }

      return null;
    } catch (error) {
      serviceLogger.error(
        `[UserManager] Error retrieving user by email ${email}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Search for users by various attributes
   * @param searchParams Object containing search parameters
   * @returns Array of users matching the search criteria
   */
  async searchUsers(searchParams: UserSearchParams): Promise<SelectUser[]> {
    try {
      const users = await searchUsers(searchParams);

      // Update cache with found users
      users.forEach((user) => {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
      });

      return users;
    } catch (error) {
      serviceLogger.error("[UserManager] Error searching users:", error);
      return [];
    }
  }

  /**
   * Check if the system is healthy
   * @returns true if the system can count users, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await count();
      return res >= 0;
    } catch (error) {
      serviceLogger.error("[UserManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Clear all caches (useful for testing or when memory management is needed)
   */
  clearCache(): void {
    this.userWalletCache.clear();
    this.userProfileCache.clear();
    serviceLogger.debug("[UserManager] All caches cleared");
  }

  /**
   * Get cache statistics for monitoring
   * @returns Object with cache sizes
   */
  getCacheStats() {
    return {
      walletCacheSize: this.userWalletCache.size,
      profileCacheSize: this.userProfileCache.size,
    };
  }
}
