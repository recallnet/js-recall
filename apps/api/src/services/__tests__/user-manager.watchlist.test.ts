import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserManager } from "@/services/user-manager.service.js";

// Mock all dependencies
vi.mock("@/database/repositories/user-repository.js");
vi.mock("@/database/repositories/agent-repository.js");
vi.mock("@/database/repositories/vote-repository.js");
vi.mock("@/database/db.js");
vi.mock("@/lib/logger.js");

describe("UserManager - Watchlist Integration", () => {
  let userManager: UserManager;
  let mockEmailService: any;
  let mockWatchlistService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEmailService = {
      sendVerificationEmail: vi.fn(),
    };

    mockWatchlistService = {
      isAddressSanctioned: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
      getStatus: vi.fn().mockReturnValue({ configured: true }),
    };

    userManager = new UserManager(mockEmailService, mockWatchlistService);
  });

  describe("registerUser", () => {
    const validWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";
    const sanctionedWalletAddress =
      "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";
    const validEmail = "test@example.com";

    it("should reject registration with sanctioned wallet address", async () => {
      mockWatchlistService.isAddressSanctioned.mockResolvedValue(true);

      await expect(
        userManager.registerUser(
          sanctionedWalletAddress,
          "Test User",
          validEmail,
        ),
      ).rejects.toThrow(
        "This wallet address is not permitted for use on this platform",
      );

      expect(mockWatchlistService.isAddressSanctioned).toHaveBeenCalledWith(
        sanctionedWalletAddress.toLowerCase(),
      );
    });

    it("should check both wallet and embedded wallet addresses", async () => {
      const cleanWallet = validWalletAddress;
      const sanctionedEmbeddedWallet = sanctionedWalletAddress;

      // First call for main wallet returns clean, second for embedded returns sanctioned
      mockWatchlistService.isAddressSanctioned
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        userManager.registerUser(
          cleanWallet,
          "Test User",
          validEmail,
          undefined,
          undefined,
          "privy-id",
          sanctionedEmbeddedWallet,
        ),
      ).rejects.toThrow(
        "This wallet address is not permitted for use on this platform",
      );

      expect(mockWatchlistService.isAddressSanctioned).toHaveBeenCalledTimes(2);
    });

    it("should normalize addresses to lowercase before checking", async () => {
      const mixedCaseAddress = "0x1DA5821544E25C636C1417BA96ADE4CF6D2F9B5A";
      const expectedLowercase = "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";

      mockWatchlistService.isAddressSanctioned.mockResolvedValue(true);

      await expect(
        userManager.registerUser(mixedCaseAddress, "Test User", validEmail),
      ).rejects.toThrow(
        "This wallet address is not permitted for use on this platform",
      );

      expect(mockWatchlistService.isAddressSanctioned).toHaveBeenCalledWith(
        expectedLowercase,
      );
    });
  });

  describe("updateUser", () => {
    const userId = "test-user-id";
    const currentWalletAddress = "0x1111111111111111111111111111111111111111";

    const sanctionedWalletAddress =
      "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";

    beforeEach(async () => {
      // Mock getUser to return existing user
      const userRepo = await import(
        "@/database/repositories/user-repository.js"
      );
      vi.mocked(userRepo.findById).mockResolvedValue({
        id: userId,
        walletAddress: currentWalletAddress,
        email: "test@example.com",
        status: "active",
      } as any);
    });

    it("should reject update with sanctioned wallet address", async () => {
      mockWatchlistService.isAddressSanctioned.mockResolvedValue(true);

      await expect(
        userManager.updateUser({
          id: userId,
          walletAddress: sanctionedWalletAddress,
        }),
      ).rejects.toThrow(
        "This wallet address is not permitted for use on this platform",
      );

      expect(mockWatchlistService.isAddressSanctioned).toHaveBeenCalledWith(
        sanctionedWalletAddress,
      );
    });

    it("should not check watchlist if wallet address is not being changed", async () => {
      const userRepo = await import(
        "@/database/repositories/user-repository.js"
      );
      vi.mocked(userRepo.findDuplicateByWalletAddress).mockResolvedValue(
        undefined,
      );
      vi.mocked(userRepo.update).mockResolvedValue({
        id: userId,
        walletAddress: currentWalletAddress,
        email: "newemail@example.com",
        status: "active",
      } as any);

      // Mock db.transaction
      const { db } = await import("@/database/db.js");
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return await callback({} as any);
      });

      await userManager.updateUser({
        id: userId,
        email: "newemail@example.com",
      });

      expect(mockWatchlistService.isAddressSanctioned).not.toHaveBeenCalled();
    });

    it("should not check watchlist if new wallet address is same as current", async () => {
      const userRepo = await import(
        "@/database/repositories/user-repository.js"
      );
      vi.mocked(userRepo.findDuplicateByWalletAddress).mockResolvedValue(
        undefined,
      );
      vi.mocked(userRepo.update).mockResolvedValue({
        id: userId,
        walletAddress: currentWalletAddress,
        email: "test@example.com",
        status: "active",
      } as any);

      // Mock db.transaction
      const { db } = await import("@/database/db.js");
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return await callback({} as any);
      });

      await userManager.updateUser({
        id: userId,
        walletAddress: currentWalletAddress,
      });

      expect(mockWatchlistService.isAddressSanctioned).not.toHaveBeenCalled();
    });
  });
});
