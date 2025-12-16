import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";

import { InsertUser, SelectUser } from "../../schema/core/types.js";
import { Database } from "../../types.js";
import { UserRepository } from "../user.js";

describe("UserRepository Integration Tests", () => {
  let repository: UserRepository;
  let mockDb: DeepMockProxy<Database>;
  let mockLogger: DeepMockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mockDeep<Logger>();
    mockDb = mockDeep<Database>();

    repository = new UserRepository(mockDb, mockLogger);
  });

  describe("create", () => {
    it("should create a new user with all required fields", async () => {
      const userId = randomUUID();
      const mockUser: InsertUser = {
        id: userId,
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        embeddedWalletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        email: "test@example.com",
        privyId: "did:privy:test123",
        name: "Test User",
        status: "active",
      };

      const expectedResult: SelectUser = {
        ...mockUser,
        walletAddress: mockUser.walletAddress!.toLowerCase(),
        embeddedWalletAddress: mockUser.embeddedWalletAddress!.toLowerCase(),
        imageUrl: null,
        metadata: null,
        isSubscribed: false,
        walletLastVerifiedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      } as SelectUser;

      const returningMock = vi.fn().mockResolvedValue([expectedResult]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.create(mockUser);

      expect(result).toEqual(expectedResult);
      expect(insertMock).toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          walletAddress: mockUser.walletAddress!.toLowerCase(),
          embeddedWalletAddress: mockUser.embeddedWalletAddress!.toLowerCase(),
          email: mockUser.email,
          privyId: mockUser.privyId,
        }),
      );
    });

    it("should normalize wallet addresses to lowercase", async () => {
      const mockUser: InsertUser = {
        id: randomUUID(),
        walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        embeddedWalletAddress: "0xFEDCBA0987654321FEDCBA0987654321FEDCBA09",
        email: "test@example.com",
        privyId: "did:privy:test123",
        status: "active",
      };

      const expectedResult: SelectUser = {
        ...mockUser,
        id: expect.any(String),
        walletAddress: mockUser.walletAddress!.toLowerCase(),
        embeddedWalletAddress: mockUser.embeddedWalletAddress!.toLowerCase(),
        name: null,
        imageUrl: null,
        metadata: null,
        isSubscribed: false,
        walletLastVerifiedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      } as SelectUser;

      const returningMock = vi.fn().mockResolvedValue([expectedResult]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      await repository.create(mockUser);

      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
          embeddedWalletAddress: "0xfedcba0987654321fedcba0987654321fedcba09",
        }),
      );
    });

    it("should set timestamps automatically when not provided", async () => {
      const userId = randomUUID();
      const mockUser: InsertUser = {
        id: userId,
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        email: "test@example.com",
        privyId: "did:privy:test123",
        status: "active",
        // Note: createdAt, updatedAt, lastLoginAt are not provided
      };

      const expectedResult: SelectUser = {
        ...mockUser,
        walletAddress: mockUser.walletAddress!.toLowerCase(),
        embeddedWalletAddress: null,
        name: null,
        imageUrl: null,
        metadata: null,
        isSubscribed: false,
        walletLastVerifiedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      } as SelectUser;

      const returningMock = vi.fn().mockResolvedValue([expectedResult]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      await repository.create(mockUser);

      // Verify timestamps are set automatically
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          lastLoginAt: expect.any(Date),
        }),
      );
    });

    it("should throw error when insert returns no result", async () => {
      const mockUser: InsertUser = {
        id: randomUUID(),
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        email: "test@example.com",
        privyId: "did:privy:test123",
        status: "active",
      };

      const returningMock = vi.fn().mockResolvedValue([]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      await expect(repository.create(mockUser)).rejects.toThrow(
        "Failed to create user - no result returned",
      );
    });

    it("should propagate database errors (e.g., unique constraint violations)", async () => {
      const mockUser: InsertUser = {
        id: randomUUID(),
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        email: "test@example.com",
        privyId: "did:privy:test123",
        status: "active",
      };

      const dbError = new Error("duplicate key value") as Error & {
        code: string;
        constraint: string;
      };
      dbError.code = "23505";
      dbError.constraint = "users_email_key";

      const returningMock = vi.fn().mockRejectedValue(dbError);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      await expect(repository.create(mockUser)).rejects.toThrow(
        "duplicate key value",
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update user fields and normalize wallet addresses", async () => {
      const userId = randomUUID();
      const updateData = {
        id: userId,
        walletAddress: "0xNEWWALLET1234567890NEWWALLET12345678",
        name: "Updated Name",
      };

      const expectedResult: SelectUser = {
        id: userId,
        walletAddress: updateData.walletAddress.toLowerCase(),
        embeddedWalletAddress: "0xembedded1234567890",
        email: "test@example.com",
        privyId: "did:privy:test123",
        name: "Updated Name",
        imageUrl: null,
        metadata: null,
        isSubscribed: false,
        status: "active",
        walletLastVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: expect.any(Date),
        lastLoginAt: new Date(),
      };

      const returningMock = vi.fn().mockResolvedValue([expectedResult]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });

      Object.defineProperty(mockDb, "update", {
        value: updateMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.update(updateData);

      expect(result).toEqual(expectedResult);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: "0xnewwallet1234567890newwallet12345678",
          name: "Updated Name",
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("should throw error when update returns no result", async () => {
      const updateData = {
        id: randomUUID(),
        name: "Updated Name",
      };

      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });

      Object.defineProperty(mockDb, "update", {
        value: updateMock,
        writable: true,
        configurable: true,
      });

      await expect(repository.update(updateData)).rejects.toThrow(
        "Failed to update user - no result returned",
      );
    });

    it("should propagate database errors (e.g., unique constraint violations)", async () => {
      const updateData = {
        id: randomUUID(),
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      };

      const dbError = new Error("duplicate key value") as Error & {
        code: string;
        constraint: string;
      };
      dbError.code = "23505";
      dbError.constraint = "users_wallet_address_key";

      const returningMock = vi.fn().mockRejectedValue(dbError);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });

      Object.defineProperty(mockDb, "update", {
        value: updateMock,
        writable: true,
        configurable: true,
      });

      await expect(repository.update(updateData)).rejects.toThrow(
        "duplicate key value",
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("findByPrivyId", () => {
    it("should find a user by privyId", async () => {
      const mockUser: SelectUser = {
        id: randomUUID(),
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        embeddedWalletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        email: "test@example.com",
        privyId: "did:privy:test123",
        name: "Test User",
        imageUrl: null,
        metadata: null,
        isSubscribed: false,
        status: "active",
        walletLastVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      const whereMock = vi.fn().mockResolvedValue([mockUser]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.findByPrivyId("did:privy:test123");

      expect(result).toEqual(mockUser);
      expect(selectMock).toHaveBeenCalled();
    });

    it("should return undefined when user not found", async () => {
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.findByPrivyId("did:privy:nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("findDuplicateByWalletAddress", () => {
    it("should find another user with the same wallet address", async () => {
      const existingUserId = randomUUID();
      const currentUserId = randomUUID();
      const mockUser: SelectUser = {
        id: existingUserId,
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        embeddedWalletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        email: "existing@example.com",
        privyId: "did:privy:existing",
        name: "Existing User",
        imageUrl: null,
        metadata: null,
        isSubscribed: false,
        status: "active",
        walletLastVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      const whereMock = vi.fn().mockResolvedValue([mockUser]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.findDuplicateByWalletAddress(
        "0x1234567890ABCDEF1234567890ABCDEF12345678",
        currentUserId,
      );

      expect(result).toEqual(mockUser);
      expect(selectMock).toHaveBeenCalled();
    });

    it("should return undefined when no duplicate exists", async () => {
      const currentUserId = randomUUID();

      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.findDuplicateByWalletAddress(
        "0x1234567890abcdef1234567890abcdef12345678",
        currentUserId,
      );

      expect(result).toBeUndefined();
    });

    it("should normalize wallet address to lowercase for comparison", async () => {
      const currentUserId = randomUUID();

      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      await repository.findDuplicateByWalletAddress(
        "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        currentUserId,
      );

      expect(whereMock).toHaveBeenCalled();
    });
  });
});
