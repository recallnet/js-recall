import type { PrivyClient } from "@privy-io/server-auth";
import { randomUUID } from "crypto";
import { Logger } from "pino";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { UserRepository } from "@recallnet/db/repositories/user";
import { type UserMetadata } from "@recallnet/db/schema/core/defs";
import { InsertUser, SelectUser } from "@recallnet/db/schema/core/types";
import { Database, Transaction } from "@recallnet/db/types";

import { EmailService } from "./email.service.js";
import { checkUserUniqueConstraintViolation } from "./lib/error-utils.js";
import { generateRandomUsername } from "./lib/handle-utils.js";
import { verifyAndGetPrivyUserInfo } from "./lib/privy-verification.js";
import { WalletWatchlist } from "./lib/watchlist.js";
import { ApiError } from "./types/index.js";
import { UserSearchParams } from "./types/index.js";

/**
 * User Service
 * Manages user registration and profile management
 */
export class UserService {
  // In-memory cache for user lookups by wallet address to avoid database lookups
  private userWalletCache: Map<string, string>; // walletAddress -> userId
  // Cache for user profiles by ID
  private userProfileCache: Map<string, SelectUser>; // userId -> user profile
  // Email service for sending verification emails
  private emailService: EmailService;
  private agentRepo: AgentRepository;
  private userRepo: UserRepository;
  private boostRepo: BoostRepository;
  private walletWatchlist: WalletWatchlist;
  private db: Database;
  private logger: Logger;

  constructor(
    emailService: EmailService,
    agentRepo: AgentRepository,
    userRepo: UserRepository,
    boostRepo: BoostRepository,
    walletWatchlist: WalletWatchlist,
    db: Database,
    logger: Logger,
  ) {
    this.userWalletCache = new Map();
    this.userProfileCache = new Map();
    this.emailService = emailService;
    this.agentRepo = agentRepo;
    this.userRepo = userRepo;
    this.boostRepo = boostRepo;
    this.walletWatchlist = walletWatchlist;
    this.db = db;
    this.logger = logger;
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
      // Email is no longer required - wallet-first users may not have an email

      // Convert to lowercase for consistency
      const normalizedWalletAddress = walletAddress.toLowerCase();
      const normalizedEmbeddedWalletAddress =
        embeddedWalletAddress?.toLowerCase();

      // Create user record with subscription status
      const newUserId = randomUUID();
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
      let savedUser = await this.userRepo.create(user);
      const savedUserId = savedUser.id;

      // Attempt to subscribe to the email list after persistence (only if email provided)
      if (email) {
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
            savedUser = await this.userRepo.update({
              id: savedUserId,
              isSubscribed: true,
            });
          } else if (
            emailSubscriptionResult &&
            !emailSubscriptionResult.success
          ) {
            this.logger.error(
              `[UserManager] Error subscribing user ${savedUser.id} to email list: ${emailSubscriptionResult.error}`,
            );
          }
        } catch (subErr) {
          this.logger.error(
            { error: subErr },
            `[UserManager] Unexpected error during email subscription for ${savedUser.id}:`,
          );
        }
      }

      // Update cache
      this.userWalletCache.set(normalizedWalletAddress, savedUserId);
      this.userProfileCache.set(savedUserId, savedUser);

      this.logger.debug(
        `[UserManager] Registered user: ${name || "Unknown"} (${savedUserId}) with wallet ${normalizedWalletAddress}`,
      );

      return savedUser;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error({ error }, "[UserManager] Error registering user");
        throw error;
      }

      this.logger.error(
        { error },
        "[UserManager] Unknown error registering user",
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
      const user = await this.userRepo.findById(userId);

      // Update cache if found
      if (user) {
        this.userProfileCache.set(userId, user);
        this.userWalletCache.set(user.walletAddress, userId);
        return user;
      }

      return null;
    } catch (error) {
      this.logger.error(
        { error },
        `[UserManager] Error retrieving user ${userId}:`,
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
      const users = await this.userRepo.findAll();

      // Update cache with all users
      users.forEach((user) => {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
      });

      return users;
    } catch (error) {
      this.logger.error({ error }, "[UserManager] Error retrieving all users");
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
        const isSanctioned = await this.walletWatchlist.isAddressSanctioned(
          user.walletAddress,
        );
        if (isSanctioned) {
          throw new Error(
            `Wallet address ${user.walletAddress} is not permitted for use on this platform`,
          );
        }
      }

      const updatedUser = await this.db.transaction(async (tx) => {
        return await this.userRepo.update({ ...user }, tx);
      });

      // Update cache
      this.userProfileCache.set(user.id, updatedUser);
      if (updatedUser.walletAddress !== currentUser.walletAddress) {
        this.userWalletCache.set(updatedUser.walletAddress, user.id);
      }

      this.logger.debug(`[UserManager] Updated user: ${user.id}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(
        { error },
        `[UserManager] Error updating user ${user.id}`,
      );

      const violatedField = checkUserUniqueConstraintViolation(error);
      if (violatedField) {
        throw new Error(`A user with this ${violatedField} already exists`);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update user: ${error}`);
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
      const user = await this.userRepo.findById(userId);

      // Delete from database
      const deleted = await this.userRepo.deleteUser(userId, tx);

      if (deleted && user) {
        // Clean up cache
        this.userProfileCache.delete(userId);
        this.userWalletCache.delete(user.walletAddress);

        this.logger.debug(
          `[UserManager] Successfully deleted user: ${user.name || "Unknown"} (${userId})`,
        );
      } else {
        this.logger.debug(`[UserManager] Failed to delete user: ${userId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        { error },
        `[UserManager] Error deleting user ${userId}`,
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
      const user = await this.userRepo.findByWalletAddress(
        normalizedWalletAddress,
      );

      // Update cache if found
      if (user) {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(normalizedWalletAddress, user.id);
        return user;
      }

      return null;
    } catch (error) {
      this.logger.error(
        { error },
        `[UserManager] Error retrieving user by wallet address ${walletAddress}:`,
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
      const user = await this.userRepo.findByPrivyId(privyId);

      // Update profile cache if found
      if (user) {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
        return user;
      }

      return null;
    } catch (error) {
      this.logger.error(
        { error },
        `[UserManager] Error retrieving user by Privy ID ${privyId}:`,
      );
      return null;
    }
  }

  /**
   * Authenticate user with Privy identity token and/or create a new user.
   * Supports both email/social logins and wallet-first logins.
   *
   * @param identityToken - The Privy identity token to verify
   * @param privyClient - The Privy client instance for user verification
   * @returns The authenticated or created user
   * @throws {ApiError} 409 if unique constraint is violated (duplicate email/wallet/privyId)
   */
  async loginWithPrivyToken(
    identityToken: string,
    privyClient: PrivyClient,
  ): Promise<SelectUser> {
    try {
      const { privyId, email, embeddedWallet, loginWallet } =
        await verifyAndGetPrivyUserInfo(identityToken, privyClient);
      const name = generateRandomUsername();
      const now = new Date();

      const existingUserWithPrivyId = await this.getUserByPrivyId(privyId);
      if (existingUserWithPrivyId) {
        return await this.updateUser({
          id: existingUserWithPrivyId.id,
          lastLoginAt: now,
        });
      }

      // Account recovery: wallet-first login where wallet is already linked to existing user
      // (e.g., email signup -> link wallet -> login with wallet after privyId reset)
      if (loginWallet) {
        const existingUserWithWallet = await this.getUserByWalletAddress(
          loginWallet.address,
        );
        if (existingUserWithWallet) {
          if (
            existingUserWithWallet.privyId &&
            existingUserWithWallet.privyId !== privyId
          ) {
            throw new ApiError(
              409,
              "Wallet is already linked to another account",
            );
          }
          return await this.updateUser({
            id: existingUserWithWallet.id,
            privyId,
            lastLoginAt: now,
            walletLastVerifiedAt: now,
          });
        }
      }

      // New user registration
      let walletAddress: string;
      let embeddedWalletAddress: string | undefined;
      let isWalletFirstUser = false;

      if (loginWallet) {
        // Wallet-first login: use external wallet as primary
        walletAddress = loginWallet.address;
        embeddedWalletAddress = embeddedWallet?.address;
        isWalletFirstUser = true;
      } else if (embeddedWallet) {
        // Email/social login: use embedded wallet as primary
        walletAddress = embeddedWallet.address;
        embeddedWalletAddress = embeddedWallet.address;
      } else {
        throw new Error(`No wallet found for Privy user: ${privyId}`);
      }

      const newUser = await this.registerUser(
        walletAddress,
        name,
        email,
        undefined,
        undefined,
        privyId,
        embeddedWalletAddress,
      );

      if (isWalletFirstUser) {
        return await this.updateUser({
          id: newUser.id,
          walletLastVerifiedAt: now,
        });
      }

      return newUser;
    } catch (error) {
      const violatedField = checkUserUniqueConstraintViolation(error);
      if (violatedField) {
        throw new ApiError(
          409,
          `A user with this ${violatedField} already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Get a user by email
   * @param email The email to search for
   * @returns The user or null if not found
   */
  async getUserByEmail(email: string): Promise<SelectUser | null> {
    try {
      const user = await this.userRepo.findByEmail(email);

      // Update cache if found
      if (user) {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
        return user;
      }

      return null;
    } catch (error) {
      this.logger.error(
        { error },
        `[UserManager] Error retrieving user by email ${email}:`,
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
      const users = await this.userRepo.searchUsers(searchParams);

      // Update cache with found users
      users.forEach((user) => {
        this.userProfileCache.set(user.id, user);
        this.userWalletCache.set(user.walletAddress, user.id);
      });

      return users;
    } catch (error) {
      this.logger.error({ error }, "[UserManager] Error searching users");
      return [];
    }
  }

  /**
   * Check if the system is healthy
   * @returns true if the system can count users, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.userRepo.count();
      return res >= 0;
    } catch (error) {
      this.logger.error({ error }, "[UserManager] Health check failed");
      return false;
    }
  }

  /**
   * Clear all caches (useful for testing or when memory management is needed)
   */
  clearCache(): void {
    this.userWalletCache.clear();
    this.userProfileCache.clear();
    this.logger.debug("[UserManager] All caches cleared");
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
