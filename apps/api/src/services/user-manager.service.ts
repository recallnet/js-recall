import { v4 as uuidv4 } from "uuid";

import {
  count,
  create,
  deleteUser,
  findAll,
  findByEmail,
  findById,
  findByWalletAddress,
  searchUsers,
  update,
} from "@/database/repositories/user-repository.js";
import { InsertUser, SelectUser } from "@/database/schema/core/types.js";
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

  constructor() {
    this.userWalletCache = new Map();
    this.userProfileCache = new Map();
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
  ) {
    try {
      // Validate wallet address
      if (!walletAddress) {
        throw new Error("Wallet address is required");
      }

      if (!this.isValidEthereumAddress(walletAddress)) {
        throw new Error(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }

      // Convert to lowercase for consistency
      const normalizedWalletAddress = walletAddress.toLowerCase();

      // Check if user already exists with this wallet address
      const existingUser = await findByWalletAddress(normalizedWalletAddress);
      if (existingUser) {
        throw new Error(
          `User with wallet address ${normalizedWalletAddress} already exists`,
        );
      }

      // Check email uniqueness if provided
      if (email) {
        const existingUserByEmail = await findByEmail(email);
        if (existingUserByEmail) {
          throw new Error(`User with email ${email} already exists`);
        }
      }

      // Generate user ID
      const id = uuidv4();

      // Create user record
      const user: InsertUser = {
        id,
        walletAddress: normalizedWalletAddress,
        name,
        email,
        imageUrl,
        metadata,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const savedUser = await create(user);

      // Update cache
      this.userWalletCache.set(normalizedWalletAddress, id);
      this.userProfileCache.set(id, savedUser);

      console.log(
        `[UserManager] Registered user: ${name || "Unknown"} (${id}) with wallet ${normalizedWalletAddress}`,
      );

      return savedUser;
    } catch (error) {
      if (error instanceof Error) {
        console.error("[UserManager] Error registering user:", error);
        throw error;
      }

      console.error("[UserManager] Unknown error registering user:", error);
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
      console.error(`[UserManager] Error retrieving user ${userId}:`, error);
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
      console.error("[UserManager] Error retrieving all users:", error);
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
      const now = new Date();
      const updatedUser = await update({
        ...user,
        updatedAt: now,
      });

      // Update cache
      this.userProfileCache.set(user.id, updatedUser);
      if (updatedUser.walletAddress) {
        this.userWalletCache.set(updatedUser.walletAddress, user.id);
      }

      console.log(`[UserManager] Updated user: ${user.id}`);
      return updatedUser;
    } catch (error) {
      console.error(`[UserManager] Error updating user ${user.id}:`, error);
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
  async deleteUser(userId: string): Promise<boolean> {
    try {
      // Get user first to find wallet address for cache cleanup
      const user = await findById(userId);

      // Delete from database
      const deleted = await deleteUser(userId);

      if (deleted && user) {
        // Clean up cache
        this.userProfileCache.delete(userId);
        this.userWalletCache.delete(user.walletAddress);

        console.log(
          `[UserManager] Successfully deleted user: ${user.name || "Unknown"} (${userId})`,
        );
      } else {
        console.log(`[UserManager] Failed to delete user: ${userId}`);
      }

      return deleted;
    } catch (error) {
      console.error(`[UserManager] Error deleting user ${userId}:`, error);
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
      console.error(
        `[UserManager] Error retrieving user by wallet address ${walletAddress}:`,
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
      console.error(
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
      console.error("[UserManager] Error searching users:", error);
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
      console.error("[UserManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Clear all caches (useful for testing or when memory management is needed)
   */
  clearCache(): void {
    this.userWalletCache.clear();
    this.userProfileCache.clear();
    console.log("[UserManager] All caches cleared");
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
