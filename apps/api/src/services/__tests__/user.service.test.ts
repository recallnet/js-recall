import { MockedObject, beforeEach, describe, expect, it, vi } from "vitest";

import { SelectUser } from "@recallnet/db/schema/core/types";

import { EmailService } from "@/services/email.service.js";
import { UserService } from "@/services/user.service.js";

// Dependency mocks
vi.mock("@/database/repositories/user-repository.js", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  findDuplicateByWalletAddress: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/database/repositories/agent-repository.js");
vi.mock("@/database/repositories/vote-repository.js");
vi.mock("@/database/db.js", () => ({
  db: {
    transaction: vi.fn(),
  },
}));
vi.mock("@/lib/logger.js", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    logger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
    dbLogger: mockLogger,
    authLogger: mockLogger,
    apiLogger: mockLogger,
    tradeLogger: mockLogger,
    competitionLogger: mockLogger,
    competitionRewardsLogger: mockLogger,
    adminLogger: mockLogger,
    userLogger: mockLogger,
    agentLogger: mockLogger,
    priceLogger: mockLogger,
    balanceLogger: mockLogger,
    repositoryLogger: mockLogger,
    middlewareLogger: mockLogger,
    serviceLogger: mockLogger,
    configLogger: mockLogger,
    indexingLogger: mockLogger,
  };
});
// Create a mock instance that we can control
const mockWatchlistInstance = {
  isAddressSanctioned: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  getStatus: vi
    .fn()
    .mockReturnValue({ configured: true, baseUrl: "", timeout: 1000 }),
};

vi.mock("@/lib/watchlist.js", () => ({
  WatchlistService: vi.fn().mockImplementation(() => mockWatchlistInstance),
}));

// Mock services
type MockEmailService = Partial<MockedObject<EmailService>>;

describe("UserManager", () => {
  describe("watchlist integration", () => {
    let userManager: UserService;
    let mockEmailService: MockEmailService;

    beforeEach(async () => {
      vi.clearAllMocks();

      // Reset the shared watchlist mock
      mockWatchlistInstance.isAddressSanctioned.mockReset();

      // Now we get full TypeScript intellisense and type checking
      mockEmailService = {
        subscribeUser: vi.fn().mockResolvedValue({ success: true }),
        unsubscribeUser: vi.fn().mockResolvedValue({ success: true }),
        isConfigured: vi.fn().mockReturnValue(true),
      };

      // Mock the repository functions
      const userRepo = await import(
        "@/database/repositories/user-repository.js"
      );
      vi.mocked(userRepo.create).mockResolvedValue({
        id: "test-user-id",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        email: "test@example.com",
        status: "active",
        isSubscribed: false,
      } as SelectUser);

      // @ts-expect-error - mockEmailService is a subset of the original services
      userManager = new UserService(mockEmailService);
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
        } as SelectUser);
      });

      it("should reject update with sanctioned wallet address", async () => {
        mockWatchlistInstance.isAddressSanctioned.mockResolvedValue(true);

        await expect(
          userManager.updateUser({
            id: userId,
            walletAddress: sanctionedWalletAddress,
          }),
        ).rejects.toThrow(
          "This wallet address is not permitted for use on this platform",
        );

        expect(mockWatchlistInstance.isAddressSanctioned).toHaveBeenCalledWith(
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
        } as SelectUser);

        // Mock db.transaction
        const { db } = await import("@/database/db.js");
        vi.mocked(db.transaction).mockImplementation(async (callback) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is fine, we don't care about that type
          return await callback({} as any);
        });

        await userManager.updateUser({
          id: userId,
          email: "newemail@example.com",
        });

        expect(
          mockWatchlistInstance.isAddressSanctioned,
        ).not.toHaveBeenCalled();
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
        } as SelectUser);

        // Mock db.transaction
        const { db } = await import("@/database/db.js");
        vi.mocked(db.transaction).mockImplementation(async (callback) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is fine, we don't care about that type
          return await callback({} as any);
        });

        await userManager.updateUser({
          id: userId,
          walletAddress: currentWalletAddress,
        });

        expect(
          mockWatchlistInstance.isAddressSanctioned,
        ).not.toHaveBeenCalled();
      });
    });
  });
});
