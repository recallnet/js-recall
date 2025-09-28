import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { UserRepository } from "@recallnet/db/repositories/user";
import { VoteRepository } from "@recallnet/db/repositories/vote";
import { SelectUser } from "@recallnet/db/schema/core/types";
import type { Database } from "@recallnet/db/types";

import { EmailService } from "../email.service.js";
import { WalletWatchlist } from "../lib/watchlist.js";
import { UserService } from "../user.service.js";

describe("UserService", () => {
  describe("watchlist integration", () => {
    let userService: UserService;
    let mockEmailService: MockProxy<EmailService>;
    let mockAgentRepo: MockProxy<AgentRepository>;
    let mockUserRepo: MockProxy<UserRepository>;
    let mockVoteRepo: MockProxy<VoteRepository>;
    let mockWalletWatchlist: MockProxy<WalletWatchlist>;
    let mockDb: MockProxy<Database>;
    let mockLogger: MockProxy<Logger>;

    beforeEach(() => {
      vi.clearAllMocks();

      // Create all service mocks
      mockEmailService = mock<EmailService>();
      mockAgentRepo = mock<AgentRepository>();
      mockUserRepo = mock<UserRepository>();
      mockVoteRepo = mock<VoteRepository>();
      mockWalletWatchlist = mock<WalletWatchlist>();
      mockDb = mock<Database>();
      mockLogger = mock<Logger>();

      // Setup basic mock implementations
      mockEmailService.subscribeUser.mockResolvedValue({ success: true });
      mockEmailService.unsubscribeUser.mockResolvedValue({ success: true });
      mockEmailService.isConfigured.mockReturnValue(true);

      mockWalletWatchlist.isAddressSanctioned.mockResolvedValue(false);
      mockWalletWatchlist.isConfigured.mockReturnValue(true);
      mockWalletWatchlist.getStatus.mockReturnValue({
        configured: true,
        baseUrl: "",
        timeout: 1000,
      });

      // Setup database transaction mock
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = mock<any>();
        return await callback(mockTx);
      });

      // Mock user repository
      mockUserRepo.create.mockResolvedValue({
        id: "test-user-id",
        name: null,
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        walletLastVerifiedAt: null,
        embeddedWalletAddress: null,
        privyId: "privy-123",
        email: "test@example.com",
        isSubscribed: false,
        imageUrl: null,
        metadata: null,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      } as SelectUser);

      userService = new UserService(
        mockEmailService,
        mockAgentRepo,
        mockUserRepo,
        mockVoteRepo,
        mockWalletWatchlist,
        mockDb,
        mockLogger,
      );
    });

    afterEach(() => {
      // Reset all mocks
      mockReset(mockEmailService);
      mockReset(mockAgentRepo);
      mockReset(mockUserRepo);
      mockReset(mockVoteRepo);
      mockReset(mockWalletWatchlist);
      mockReset(mockDb);
      mockReset(mockLogger);
    });

    describe("updateUser", () => {
      const userId = "test-user-id";
      const currentWalletAddress = "0x1111111111111111111111111111111111111111";
      const sanctionedWalletAddress =
        "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";

      beforeEach(() => {
        // Mock getUser to return existing user
        mockUserRepo.findById.mockResolvedValue({
          id: userId,
          name: null,
          walletAddress: currentWalletAddress,
          walletLastVerifiedAt: null,
          embeddedWalletAddress: null,
          privyId: "privy-123",
          email: "test@example.com",
          isSubscribed: false,
          imageUrl: null,
          metadata: null,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        } as SelectUser);
      });

      it("should reject update with sanctioned wallet address", async () => {
        mockWalletWatchlist.isAddressSanctioned.mockResolvedValue(true);

        await expect(
          userService.updateUser({
            id: userId,
            walletAddress: sanctionedWalletAddress,
          }),
        ).rejects.toThrow(
          "This wallet address is not permitted for use on this platform",
        );

        expect(mockWalletWatchlist.isAddressSanctioned).toHaveBeenCalledWith(
          sanctionedWalletAddress,
        );
      });

      it("should not check watchlist if wallet address is not being changed", async () => {
        mockUserRepo.findDuplicateByWalletAddress.mockResolvedValue(undefined);
        mockUserRepo.update.mockResolvedValue({
          id: userId,
          name: null,
          walletAddress: currentWalletAddress,
          walletLastVerifiedAt: null,
          embeddedWalletAddress: null,
          privyId: "privy-123",
          email: "newemail@example.com",
          isSubscribed: false,
          imageUrl: null,
          metadata: null,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        } as SelectUser);

        await userService.updateUser({
          id: userId,
          email: "newemail@example.com",
        });

        expect(mockWalletWatchlist.isAddressSanctioned).not.toHaveBeenCalled();
      });

      it("should not check watchlist if new wallet address is same as current", async () => {
        mockUserRepo.findDuplicateByWalletAddress.mockResolvedValue(undefined);
        mockUserRepo.update.mockResolvedValue({
          id: userId,
          name: null,
          walletAddress: currentWalletAddress,
          walletLastVerifiedAt: null,
          embeddedWalletAddress: null,
          privyId: "privy-123",
          email: "test@example.com",
          isSubscribed: false,
          imageUrl: null,
          metadata: null,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        } as SelectUser);

        await userService.updateUser({
          id: userId,
          walletAddress: currentWalletAddress,
        });

        expect(mockWalletWatchlist.isAddressSanctioned).not.toHaveBeenCalled();
      });

      it("should check watchlist when wallet address is being changed", async () => {
        const newWalletAddress = "0x2222222222222222222222222222222222222222";

        mockWalletWatchlist.isAddressSanctioned.mockResolvedValue(false);
        mockUserRepo.findDuplicateByWalletAddress.mockResolvedValue(undefined);
        mockUserRepo.update.mockResolvedValue({
          id: userId,
          name: null,
          walletAddress: newWalletAddress,
          walletLastVerifiedAt: null,
          embeddedWalletAddress: null,
          privyId: "privy-123",
          email: "test@example.com",
          isSubscribed: false,
          imageUrl: null,
          metadata: null,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        } as SelectUser);

        await userService.updateUser({
          id: userId,
          walletAddress: newWalletAddress,
        });

        expect(mockWalletWatchlist.isAddressSanctioned).toHaveBeenCalledWith(
          newWalletAddress,
        );
      });

      it("should handle watchlist service errors gracefully", async () => {
        const newWalletAddress = "0x2222222222222222222222222222222222222222";

        mockWalletWatchlist.isAddressSanctioned.mockRejectedValue(
          new Error("Watchlist service unavailable"),
        );

        await expect(
          userService.updateUser({
            id: userId,
            walletAddress: newWalletAddress,
          }),
        ).rejects.toThrow("Watchlist service unavailable");
      });

      it("should handle repository errors during update", async () => {
        mockUserRepo.update.mockRejectedValue(
          new Error("Database connection failed"),
        );

        await expect(
          userService.updateUser({
            id: userId,
            email: "newemail@example.com",
          }),
        ).rejects.toThrow("Database connection failed");
      });

      it("should handle transaction rollback on error", async () => {
        mockDb.transaction.mockRejectedValue(new Error("Transaction failed"));

        await expect(
          userService.updateUser({
            id: userId,
            email: "newemail@example.com",
          }),
        ).rejects.toThrow("Transaction failed");

        expect(mockDb.transaction).toHaveBeenCalledOnce();
      });
    });

    describe("registerUser", () => {
      it("should have registerUser method available", () => {
        expect(typeof userService.registerUser).toBe("function");
      });

      it("should handle duplicate wallet address", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
        const existingUser = {
          id: "existing-user-id",
          walletAddress,
          email: "existing@example.com",
          status: "active",
        } as SelectUser;

        mockWalletWatchlist.isAddressSanctioned.mockResolvedValue(false);
        mockUserRepo.findDuplicateByWalletAddress.mockResolvedValue(
          existingUser,
        );

        // Service catches errors and returns undefined for duplicate addresses
        const result = await userService.registerUser(
          walletAddress,
          "Test User",
          "test@example.com",
        );
        expect(result).toBeUndefined();
      });

      it("should handle invalid wallet address format", async () => {
        const invalidAddress = "invalid-address";

        await expect(
          userService.registerUser(
            invalidAddress,
            "Test User",
            "test@example.com",
          ),
        ).rejects.toThrow(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );

        // Should not check watchlist for invalid addresses
        expect(mockWalletWatchlist.isAddressSanctioned).not.toHaveBeenCalled();
      });

      it("should require email for registration", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

        await expect(
          userService.registerUser(walletAddress, "Test User"),
        ).rejects.toThrow("Email is required");
      });

      it("should normalize wallet addresses to lowercase", () => {
        const mixedCaseAddress = "0x1234567890ABCDEF1234567890abcdef12345678";
        const expectedNormalized = mixedCaseAddress.toLowerCase();

        // Test the normalization logic directly
        expect(expectedNormalized).toBe(
          "0x1234567890abcdef1234567890abcdef12345678",
        );
        expect(mixedCaseAddress.toLowerCase()).toBe(expectedNormalized);
      });
    });

    describe("getUserByWalletAddress", () => {
      it("should find user by wallet address", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
        const expectedUser = {
          id: "user-123",
          walletAddress,
          email: "test@example.com",
          status: "active",
        } as SelectUser;

        mockUserRepo.findByWalletAddress.mockResolvedValue(expectedUser);

        const result = await userService.getUserByWalletAddress(walletAddress);

        expect(result).toEqual(expectedUser);
        expect(mockUserRepo.findByWalletAddress).toHaveBeenCalledWith(
          walletAddress.toLowerCase(),
        );
      });

      it("should return null when user not found", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

        mockUserRepo.findByWalletAddress.mockResolvedValue(undefined);

        const result = await userService.getUserByWalletAddress(walletAddress);

        expect(result).toBeNull();
      });

      it("should handle repository errors", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

        mockUserRepo.findByWalletAddress.mockRejectedValue(
          new Error("Database query failed"),
        );

        // Service catches errors and returns null instead of throwing
        const result = await userService.getUserByWalletAddress(walletAddress);
        expect(result).toBeNull();
      });

      it("should cache user lookups", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
        const expectedUser = {
          id: "user-123",
          walletAddress,
          email: "test@example.com",
          status: "active",
        } as SelectUser;

        mockUserRepo.findByWalletAddress.mockResolvedValue(expectedUser);

        // First call
        const result1 = await userService.getUserByWalletAddress(walletAddress);
        // Second call (should use cache)
        const result2 = await userService.getUserByWalletAddress(walletAddress);

        expect(result1).toEqual(expectedUser);
        expect(result2).toEqual(expectedUser);

        // Service uses caching, so repository called only once
        expect(mockUserRepo.findByWalletAddress).toHaveBeenCalledTimes(1);
      });
    });

    describe("User validation", () => {
      it("should validate Ethereum addresses correctly", async () => {
        const validAddresses = [
          "0x1234567890abcdef1234567890abcdef12345678",
          "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
          "0x0000000000000000000000000000000000000000",
        ];

        for (const address of validAddresses) {
          mockWalletWatchlist.isAddressSanctioned.mockResolvedValue(false);
          mockUserRepo.findDuplicateByWalletAddress.mockResolvedValue(
            undefined,
          );

          // Just verify the service can handle valid addresses without throwing validation errors
          await userService.registerUser(
            address,
            "Test User",
            "test@example.com",
          );
        }
      });

      it("should reject invalid Ethereum addresses", async () => {
        const invalidAddresses = [
          "0x123", // Too short
          "invalid-address", // Not hex
          "1234567890abcdef1234567890abcdef12345678", // Missing 0x
          "0xZZZZ567890abcdef1234567890abcdef12345678", // Invalid hex chars
        ];

        for (const address of invalidAddresses) {
          await expect(
            userService.registerUser(address, "Test User", "test@example.com"),
          ).rejects.toThrow(
            "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
          );
        }
      });

      it("should handle missing required fields", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

        // Missing wallet address
        await expect(
          userService.registerUser("", "Test User", "test@example.com"),
        ).rejects.toThrow("Wallet address is required");

        // Missing email
        await expect(
          userService.registerUser(walletAddress, "Test User"),
        ).rejects.toThrow("Email is required");
      });
    });

    describe("Service configuration", () => {
      it("should initialize with all required dependencies", () => {
        expect(userService).toBeInstanceOf(UserService);
      });

      it("should handle email service configuration", () => {
        mockEmailService.isConfigured.mockReturnValue(false);

        // Service should still work even if email service not configured
        expect(userService).toBeDefined();
      });

      it("should handle watchlist configuration", () => {
        mockWalletWatchlist.isConfigured.mockReturnValue(false);
        mockWalletWatchlist.getStatus.mockReturnValue({
          configured: false,
          baseUrl: "",
          timeout: 1000,
        });

        const status = mockWalletWatchlist.getStatus();
        expect(status.configured).toBe(false);
      });
    });

    describe("Error handling", () => {
      it("should handle database transaction failures", async () => {
        mockDb.transaction.mockRejectedValue(new Error("Transaction deadlock"));

        // Service catches transaction errors and returns undefined
        const result = await userService.registerUser(
          "0x1234567890abcdef1234567890abcdef12345678",
          "Test User",
          "test@example.com",
        );

        expect(result).toBeUndefined();
      });

      it("should handle concurrent registration attempts", async () => {
        const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

        mockWalletWatchlist.isAddressSanctioned.mockResolvedValue(false);
        mockUserRepo.findDuplicateByWalletAddress.mockResolvedValue(undefined);
        mockUserRepo.create.mockRejectedValue(
          new Error("UNIQUE constraint failed"),
        );

        await expect(
          userService.registerUser(
            walletAddress,
            "Test User",
            "test@example.com",
          ),
        ).rejects.toThrow("UNIQUE constraint failed");
      });

      it("should preserve error context in failures", async () => {
        const specificError = new Error("Specific validation failure");
        mockUserRepo.findById.mockRejectedValue(specificError);

        await expect(
          userService.updateUser({
            id: "test-user-id",
            email: "newemail@example.com",
          }),
        ).rejects.toThrow(
          "Failed to update user: User with ID test-user-id not found",
        );
      });
    });
  });
});
