import { Logger } from "pino";
import { MockedObject, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { UserRepository } from "@recallnet/db/repositories/user";
import { SelectUser } from "@recallnet/db/schema/core/types";
import { Database } from "@recallnet/db/types";

import { EmailService } from "../email.service.js";
import { WalletWatchlist } from "../lib/watchlist.js";
import { UserService } from "../user.service.js";

// Mock dependencies
vi.mock("@recallnet/db/repositories/user");
vi.mock("@recallnet/db/repositories/agent");
vi.mock("../email.service.js");

// Create a mock instance that we can control
const mockWatchlistInstance = {
  isAddressSanctioned: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  getStatus: vi
    .fn()
    .mockReturnValue({ configured: true, baseUrl: "", timeout: 1000 }),
};

// Mock services
type MockEmailService = Partial<MockedObject<EmailService>>;

describe("UserManager", () => {
  describe("watchlist integration", () => {
    let userManager: UserService;
    let mockEmailService: MockEmailService;
    let mockUserRepo: UserRepository;
    let mockAgentRepo: AgentRepository;
    let mockBoostRepo: BoostRepository;
    let mockDb: Database;
    let mockLogger: Logger;

    beforeEach(async () => {
      vi.clearAllMocks();

      // Reset the shared watchlist mock
      mockWatchlistInstance.isAddressSanctioned.mockReset();

      // Create mock instances
      mockUserRepo = {} as UserRepository;
      mockAgentRepo = {} as AgentRepository;
      mockBoostRepo = {} as BoostRepository;
      mockDb = {} as Database;
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as unknown as Logger;

      // Now we get full TypeScript intellisense and type checking
      mockEmailService = {
        subscribeUser: vi.fn().mockResolvedValue({ success: true }),
        unsubscribeUser: vi.fn().mockResolvedValue({ success: true }),
        isConfigured: vi.fn().mockReturnValue(true),
      };

      // Setup repository mock methods
      mockUserRepo.create = vi.fn().mockResolvedValue({
        id: "test-user-id",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        email: "test@example.com",
        status: "active",
        isSubscribed: false,
      } as SelectUser);

      mockUserRepo.findById = vi.fn();
      mockUserRepo.findDuplicateByWalletAddress = vi.fn();
      mockUserRepo.update = vi.fn();

      // Setup database transaction mock
      mockDb.transaction = vi
        .fn()
        .mockImplementation(
          async (callback: (tx: unknown) => Promise<unknown>) => {
            return await callback({} as Database);
          },
        );

      userManager = new UserService(
        mockEmailService as unknown as EmailService,
        mockAgentRepo,
        mockUserRepo,
        mockBoostRepo,
        mockWatchlistInstance as unknown as WalletWatchlist,
        mockDb,
        mockLogger,
      );
    });

    describe("updateUser", () => {
      const userId = "test-user-id";
      const currentWalletAddress = "0x1111111111111111111111111111111111111111";

      const sanctionedWalletAddress =
        "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";

      beforeEach(async () => {
        // Mock getUser to return existing user
        mockUserRepo.findById = vi.fn().mockResolvedValue({
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
        mockUserRepo.findDuplicateByWalletAddress = vi
          .fn()
          .mockResolvedValue(undefined);
        mockUserRepo.update = vi.fn().mockResolvedValue({
          id: userId,
          walletAddress: currentWalletAddress,
          email: "newemail@example.com",
          status: "active",
        } as SelectUser);

        await userManager.updateUser({
          id: userId,
          email: "newemail@example.com",
        });

        expect(
          mockWatchlistInstance.isAddressSanctioned,
        ).not.toHaveBeenCalled();
      });

      it("should not check watchlist if new wallet address is same as current", async () => {
        mockUserRepo.findDuplicateByWalletAddress = vi
          .fn()
          .mockResolvedValue(undefined);
        mockUserRepo.update = vi.fn().mockResolvedValue({
          id: userId,
          walletAddress: currentWalletAddress,
          email: "test@example.com",
          status: "active",
        } as SelectUser);

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
