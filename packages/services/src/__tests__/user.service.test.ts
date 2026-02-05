import type { PrivyClient } from "@privy-io/server-auth";
import { Logger } from "pino";
import { MockedObject, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { UserRepository } from "@recallnet/db/repositories/user";
import { SelectUser } from "@recallnet/db/schema/core/types";
import { Database } from "@recallnet/db/types";

import { EmailService } from "../email.service.js";
import { verifyAndGetPrivyUserInfo } from "../lib/privy-verification.js";
import { WalletWatchlist } from "../lib/watchlist.js";
import { UserService } from "../user.service.js";

// Mock dependencies
vi.mock("@recallnet/db/repositories/user");
vi.mock("@recallnet/db/repositories/agent");
vi.mock("../email.service.js");
vi.mock("../lib/privy-verification.js");

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
        ).rejects.toThrow("is not permitted for use on this platform");

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

  describe("loginWithPrivyToken", () => {
    let userManager: UserService;
    let mockEmailService: MockEmailService;
    let mockUserRepo: UserRepository;
    let mockAgentRepo: AgentRepository;
    let mockBoostRepo: BoostRepository;
    let mockDb: Database;
    let mockLogger: Logger;
    let mockPrivyClient: PrivyClient;

    const testPrivyId = "did:privy:test123";
    const testEmail = "test@example.com";
    const testEmbeddedWalletAddress =
      "0x1234567890abcdef1234567890abcdef12345678";

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

      mockEmailService = {
        subscribeUser: vi.fn().mockResolvedValue({ success: true }),
        unsubscribeUser: vi.fn().mockResolvedValue({ success: true }),
        isConfigured: vi.fn().mockReturnValue(true),
      };

      // Setup repository mock methods
      mockUserRepo.findById = vi.fn();
      mockUserRepo.findByPrivyId = vi.fn();
      mockUserRepo.findByEmail = vi.fn();
      mockUserRepo.findByWalletAddress = vi.fn();
      mockUserRepo.findDuplicateByWalletAddress = vi.fn();
      mockUserRepo.create = vi.fn();
      mockUserRepo.update = vi.fn();

      // Setup database transaction mock
      mockDb.transaction = vi
        .fn()
        .mockImplementation(
          async (callback: (tx: unknown) => Promise<unknown>) => {
            return await callback({} as Database);
          },
        );

      // Setup mock Privy client
      mockPrivyClient = {} as PrivyClient;

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

    it("should return existing user and update lastLoginAt when privyId matches", async () => {
      const existingUser = {
        id: "existing-user-id",
        privyId: testPrivyId,
        email: testEmail,
        walletAddress: testEmbeddedWalletAddress,
        embeddedWalletAddress: testEmbeddedWalletAddress,
        status: "active",
        lastLoginAt: new Date("2024-01-01"),
      } as SelectUser;

      const updatedUser = {
        ...existingUser,
        lastLoginAt: new Date(),
      } as SelectUser;

      // Mock verifyAndGetPrivyUserInfo
      vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
        privyId: testPrivyId,
        email: testEmail,
        embeddedWallet: {
          address: testEmbeddedWalletAddress,
          chainType: "ethereum",
          walletClientType: "privy",
          connectorType: "embedded",
          verifiedAt: new Date(),
          firstVerifiedAt: new Date(),
          latestVerifiedAt: new Date(),
        },
        customWallets: [],
      });

      // Mock findByPrivyId to return existing user
      mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(existingUser);
      mockUserRepo.findById = vi.fn().mockResolvedValue(existingUser);
      mockUserRepo.findDuplicateByWalletAddress = vi
        .fn()
        .mockResolvedValue(undefined);
      mockUserRepo.update = vi.fn().mockResolvedValue(updatedUser);

      const result = await userManager.loginWithPrivyToken(
        "mock-identity-token",
        mockPrivyClient,
      );

      expect(result.id).toBe(existingUser.id);
      expect(mockUserRepo.findByPrivyId).toHaveBeenCalledWith(testPrivyId);
      // updateUser calls update within a transaction, passing the user data and tx
      expect(mockUserRepo.update).toHaveBeenCalled();
      const updateCall = vi.mocked(mockUserRepo.update).mock.calls[0];
      expect(updateCall?.[0]).toMatchObject({
        id: existingUser.id,
      });
      expect(updateCall?.[0]).toHaveProperty("lastLoginAt");
    });

    it("should create a new user when privyId does not exist", async () => {
      const newUser = {
        id: "new-user-id",
        privyId: testPrivyId,
        email: testEmail,
        walletAddress: testEmbeddedWalletAddress,
        embeddedWalletAddress: testEmbeddedWalletAddress,
        status: "active",
        isSubscribed: true,
        lastLoginAt: new Date(),
      } as SelectUser;

      // Mock verifyAndGetPrivyUserInfo
      vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
        privyId: testPrivyId,
        email: testEmail,
        embeddedWallet: {
          address: testEmbeddedWalletAddress,
          chainType: "ethereum",
          walletClientType: "privy",
          connectorType: "embedded",
          verifiedAt: new Date(),
          firstVerifiedAt: new Date(),
          latestVerifiedAt: new Date(),
        },
        customWallets: [],
      });

      // Mock findByPrivyId to return null (user doesn't exist)
      mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
      // Mock findByEmail to return null (no email conflict)
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(null);
      // Mock create to return new user
      mockUserRepo.create = vi.fn().mockResolvedValue(newUser);
      // Mock update for email subscription update
      mockUserRepo.update = vi.fn().mockResolvedValue(newUser);

      const result = await userManager.loginWithPrivyToken(
        "mock-identity-token",
        mockPrivyClient,
      );

      expect(result.id).toBe(newUser.id);
      expect(mockUserRepo.findByPrivyId).toHaveBeenCalledWith(testPrivyId);
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          privyId: testPrivyId,
          email: testEmail,
          walletAddress: testEmbeddedWalletAddress,
          embeddedWalletAddress: testEmbeddedWalletAddress,
        }),
      );
    });

    it("should use embedded wallet as primary wallet address for new users", async () => {
      const newUser = {
        id: "new-user-id",
        privyId: testPrivyId,
        email: testEmail,
        walletAddress: testEmbeddedWalletAddress,
        embeddedWalletAddress: testEmbeddedWalletAddress,
        status: "active",
        isSubscribed: true,
      } as SelectUser;

      // Mock verifyAndGetPrivyUserInfo with custom wallets (which should be ignored)
      vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
        privyId: testPrivyId,
        email: testEmail,
        embeddedWallet: {
          address: testEmbeddedWalletAddress,
          chainType: "ethereum",
          walletClientType: "privy",
          connectorType: "embedded",
          verifiedAt: new Date(),
          firstVerifiedAt: new Date(),
          latestVerifiedAt: new Date(),
        },
        customWallets: [
          {
            type: "wallet",
            address: "0xdifferentcustomwallet123456789012345678",
            chainType: "ethereum",
            walletClientType: "injected",
            connectorType: "injected",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
        ],
      });

      mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(null);
      mockUserRepo.create = vi.fn().mockResolvedValue(newUser);
      mockUserRepo.update = vi.fn().mockResolvedValue(newUser);

      await userManager.loginWithPrivyToken(
        "mock-identity-token",
        mockPrivyClient,
      );

      // Verify that the embedded wallet is used as primary, not custom wallets
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: testEmbeddedWalletAddress,
          embeddedWalletAddress: testEmbeddedWalletAddress,
        }),
      );
    });

    it("should throw 409 error with 'email' message on email constraint violation", async () => {
      vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
        privyId: testPrivyId,
        email: testEmail,
        embeddedWallet: {
          address: testEmbeddedWalletAddress,
          chainType: "ethereum",
          walletClientType: "privy",
          connectorType: "embedded",
          verifiedAt: new Date(),
          firstVerifiedAt: new Date(),
          latestVerifiedAt: new Date(),
        },
        customWallets: [],
      });

      mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(null);

      const uniqueConstraintError = new Error(
        "duplicate key value",
      ) as Error & {
        code: string;
        constraint: string;
      };
      uniqueConstraintError.code = "23505";
      uniqueConstraintError.constraint = "users_email_key";
      mockUserRepo.create = vi.fn().mockRejectedValue(uniqueConstraintError);

      await expect(
        userManager.loginWithPrivyToken("mock-identity-token", mockPrivyClient),
      ).rejects.toThrow("A user with this email already exists");
    });

    it("should throw 409 error on wallet constraint violation", async () => {
      vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
        privyId: testPrivyId,
        email: testEmail,
        embeddedWallet: {
          address: testEmbeddedWalletAddress,
          chainType: "ethereum",
          walletClientType: "privy",
          connectorType: "embedded",
          verifiedAt: new Date(),
          firstVerifiedAt: new Date(),
          latestVerifiedAt: new Date(),
        },
        customWallets: [],
      });

      mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(null);

      const uniqueConstraintError = new Error(
        "duplicate key value",
      ) as Error & {
        code: string;
        constraint: string;
      };
      uniqueConstraintError.code = "23505";
      uniqueConstraintError.constraint = "users_wallet_address_key";
      mockUserRepo.create = vi.fn().mockRejectedValue(uniqueConstraintError);

      await expect(
        userManager.loginWithPrivyToken("mock-identity-token", mockPrivyClient),
      ).rejects.toThrow("A user with this walletAddress already exists");
    });

    it("should throw 409 error on privyId constraint violation", async () => {
      vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
        privyId: testPrivyId,
        email: testEmail,
        embeddedWallet: {
          address: testEmbeddedWalletAddress,
          chainType: "ethereum",
          walletClientType: "privy",
          connectorType: "embedded",
          verifiedAt: new Date(),
          firstVerifiedAt: new Date(),
          latestVerifiedAt: new Date(),
        },
        customWallets: [],
      });

      mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(null);

      const uniqueConstraintError = new Error(
        "duplicate key value",
      ) as Error & {
        code: string;
        constraint: string;
      };
      uniqueConstraintError.code = "23505";
      uniqueConstraintError.constraint = "users_privy_id_key";
      mockUserRepo.create = vi.fn().mockRejectedValue(uniqueConstraintError);

      await expect(
        userManager.loginWithPrivyToken("mock-identity-token", mockPrivyClient),
      ).rejects.toThrow("A user with this privyId already exists");
    });

    describe("wallet-first login", () => {
      const testExternalWalletAddress =
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      it("should register wallet-first user with external wallet as primary", async () => {
        const newUser = {
          id: "wallet-first-user-id",
          privyId: testPrivyId,
          walletAddress: testExternalWalletAddress,
          embeddedWalletAddress: testEmbeddedWalletAddress,
          status: "active",
          isSubscribed: false,
        } as SelectUser;

        vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
          privyId: testPrivyId,
          embeddedWallet: {
            address: testEmbeddedWalletAddress,
            chainType: "ethereum",
            walletClientType: "privy",
            connectorType: "embedded",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
          customWallets: [
            {
              type: "wallet",
              address: testExternalWalletAddress,
              chainType: "ethereum",
              walletClientType: "injected",
              connectorType: "injected",
              verifiedAt: new Date(),
              firstVerifiedAt: new Date(),
              latestVerifiedAt: new Date(),
            },
          ],
          loginWallet: {
            type: "wallet",
            address: testExternalWalletAddress,
            chainType: "ethereum",
            walletClientType: "injected",
            connectorType: "injected",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
        });

        mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
        mockUserRepo.findByWalletAddress = vi.fn().mockResolvedValue(null);
        mockUserRepo.create = vi.fn().mockResolvedValue(newUser);
        mockUserRepo.findById = vi.fn().mockResolvedValue(newUser);
        mockUserRepo.findDuplicateByWalletAddress = vi
          .fn()
          .mockResolvedValue(undefined);
        mockUserRepo.update = vi.fn().mockResolvedValue({
          ...newUser,
          walletLastVerifiedAt: new Date(),
        });

        const result = await userManager.loginWithPrivyToken(
          "mock-identity-token",
          mockPrivyClient,
        );

        expect(result.id).toBe(newUser.id);
        expect(mockUserRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            walletAddress: testExternalWalletAddress,
            embeddedWalletAddress: testEmbeddedWalletAddress,
          }),
        );
        // Should update walletLastVerifiedAt after registration
        expect(mockUserRepo.update).toHaveBeenCalled();
      });

      it("should register wallet-first user without embedded wallet", async () => {
        const newUser = {
          id: "wallet-first-user-id",
          privyId: testPrivyId,
          walletAddress: testExternalWalletAddress,
          status: "active",
          isSubscribed: false,
        } as SelectUser;

        vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
          privyId: testPrivyId,
          customWallets: [
            {
              type: "wallet",
              address: testExternalWalletAddress,
              chainType: "ethereum",
              walletClientType: "injected",
              connectorType: "injected",
              verifiedAt: new Date(),
              firstVerifiedAt: new Date(),
              latestVerifiedAt: new Date(),
            },
          ],
          loginWallet: {
            type: "wallet",
            address: testExternalWalletAddress,
            chainType: "ethereum",
            walletClientType: "injected",
            connectorType: "injected",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
        });

        mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
        mockUserRepo.findByWalletAddress = vi.fn().mockResolvedValue(null);
        mockUserRepo.create = vi.fn().mockResolvedValue(newUser);
        mockUserRepo.findById = vi.fn().mockResolvedValue(newUser);
        mockUserRepo.findDuplicateByWalletAddress = vi
          .fn()
          .mockResolvedValue(undefined);
        mockUserRepo.update = vi.fn().mockResolvedValue({
          ...newUser,
          walletLastVerifiedAt: new Date(),
        });

        await userManager.loginWithPrivyToken(
          "mock-identity-token",
          mockPrivyClient,
        );

        expect(mockUserRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            walletAddress: testExternalWalletAddress,
            embeddedWalletAddress: undefined,
          }),
        );
      });
    });

    describe("wallet recovery", () => {
      const testExternalWalletAddress =
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const newPrivyId = "did:privy:newuser456";

      it("should recover account when wallet matches and privyId is null", async () => {
        const existingUser = {
          id: "existing-user-id",
          privyId: null,
          walletAddress: testExternalWalletAddress,
          status: "active",
        } as unknown as SelectUser;

        const updatedUser = {
          ...existingUser,
          privyId: newPrivyId,
          lastLoginAt: new Date(),
          walletLastVerifiedAt: new Date(),
        } as unknown as SelectUser;

        vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
          privyId: newPrivyId,
          customWallets: [
            {
              type: "wallet",
              address: testExternalWalletAddress,
              chainType: "ethereum",
              walletClientType: "injected",
              connectorType: "injected",
              verifiedAt: new Date(),
              firstVerifiedAt: new Date(),
              latestVerifiedAt: new Date(),
            },
          ],
          loginWallet: {
            type: "wallet",
            address: testExternalWalletAddress,
            chainType: "ethereum",
            walletClientType: "injected",
            connectorType: "injected",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
        });

        mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
        mockUserRepo.findByWalletAddress = vi
          .fn()
          .mockResolvedValue(existingUser);
        mockUserRepo.findById = vi.fn().mockResolvedValue(existingUser);
        mockUserRepo.findDuplicateByWalletAddress = vi
          .fn()
          .mockResolvedValue(undefined);
        mockUserRepo.update = vi.fn().mockResolvedValue(updatedUser);

        const result = await userManager.loginWithPrivyToken(
          "mock-identity-token",
          mockPrivyClient,
        );

        expect(result.id).toBe(existingUser.id);
        const updateCall = vi.mocked(mockUserRepo.update).mock.calls[0];
        expect(updateCall?.[0]).toMatchObject({
          id: existingUser.id,
          privyId: newPrivyId,
        });
        expect(updateCall?.[0]).toHaveProperty("walletLastVerifiedAt");
      });

      it("should throw 409 when wallet matches but privyId differs", async () => {
        const existingUser = {
          id: "existing-user-id",
          privyId: "did:privy:originalowner",
          walletAddress: testExternalWalletAddress,
          status: "active",
        } as SelectUser;

        vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
          privyId: newPrivyId,
          customWallets: [
            {
              type: "wallet",
              address: testExternalWalletAddress,
              chainType: "ethereum",
              walletClientType: "injected",
              connectorType: "injected",
              verifiedAt: new Date(),
              firstVerifiedAt: new Date(),
              latestVerifiedAt: new Date(),
            },
          ],
          loginWallet: {
            type: "wallet",
            address: testExternalWalletAddress,
            chainType: "ethereum",
            walletClientType: "injected",
            connectorType: "injected",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
        });

        mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
        mockUserRepo.findByWalletAddress = vi
          .fn()
          .mockResolvedValue(existingUser);

        await expect(
          userManager.loginWithPrivyToken(
            "mock-identity-token",
            mockPrivyClient,
          ),
        ).rejects.toThrow("Wallet is already linked to another account");
      });

      it("should not trigger recovery for email users with custom wallets", async () => {
        const newUser = {
          id: "new-email-user-id",
          privyId: testPrivyId,
          email: testEmail,
          walletAddress: testEmbeddedWalletAddress,
          embeddedWalletAddress: testEmbeddedWalletAddress,
          status: "active",
          isSubscribed: true,
        } as SelectUser;

        vi.mocked(verifyAndGetPrivyUserInfo).mockResolvedValue({
          privyId: testPrivyId,
          email: testEmail,
          embeddedWallet: {
            address: testEmbeddedWalletAddress,
            chainType: "ethereum",
            walletClientType: "privy",
            connectorType: "embedded",
            verifiedAt: new Date(),
            firstVerifiedAt: new Date(),
            latestVerifiedAt: new Date(),
          },
          customWallets: [
            {
              type: "wallet",
              address: testExternalWalletAddress,
              chainType: "ethereum",
              walletClientType: "injected",
              connectorType: "injected",
              verifiedAt: new Date(),
              firstVerifiedAt: new Date(),
              latestVerifiedAt: new Date(),
            },
          ],
          // loginWallet is undefined because email is present
        });

        mockUserRepo.findByPrivyId = vi.fn().mockResolvedValue(null);
        mockUserRepo.findByEmail = vi.fn().mockResolvedValue(null);
        mockUserRepo.create = vi.fn().mockResolvedValue(newUser);
        mockUserRepo.update = vi.fn().mockResolvedValue(newUser);

        await userManager.loginWithPrivyToken(
          "mock-identity-token",
          mockPrivyClient,
        );

        // Should NOT have checked wallet recovery
        expect(mockUserRepo.findByWalletAddress).not.toHaveBeenCalled();
        // Should have created a new user instead
        expect(mockUserRepo.create).toHaveBeenCalled();
      });
    });
  });
});
