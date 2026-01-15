import { SQL } from "drizzle-orm";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";

import { Database } from "../../types.js";
import { UserRepository } from "../user.js";

describe("UserRepository", () => {
  let repository: UserRepository;
  let mockDb: DeepMockProxy<Database>;
  let mockLogger: DeepMockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mockDeep<Logger>();
    mockDb = mockDeep<Database>();

    repository = new UserRepository(mockDb, mockLogger);
  });

  describe("findByEmail", () => {
    it("should normalize email to lowercase before querying", async () => {
      let capturedWhereClause: SQL | undefined;
      const whereMock = vi.fn().mockImplementation((clause: SQL) => {
        capturedWhereClause = clause;
        return Promise.resolve([]);
      });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      await repository.findByEmail("User@Example.COM");

      expect(whereMock).toHaveBeenCalled();
      // Verify the SQL query contains the lowercase email
      // The queryChunks array contains the parameterized values
      const queryChunks = capturedWhereClause?.queryChunks;
      expect(queryChunks).toBeDefined();
      // Find the email value in the query chunks (it's a bound parameter)
      const hasLowercaseEmail = queryChunks?.some(
        (chunk) =>
          typeof chunk === "object" &&
          "value" in chunk &&
          chunk.value === "user@example.com",
      );
      expect(hasLowercaseEmail).toBe(true);
    });

    it("should return user when found", async () => {
      const mockUser = {
        id: "user-123",
        walletAddress: "0x1234567890123456789012345678901234567890",
        email: "test@example.com",
        name: "Test User",
        privyId: null,
        embeddedWalletAddress: null,
        walletLastVerifiedAt: null,
        imageUrl: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        isSubscribed: false,
      };

      const whereMock = vi.fn().mockResolvedValue([mockUser]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
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

      const result = await repository.findByEmail("nonexistent@example.com");

      expect(result).toBeUndefined();
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Database error");

      const whereMock = vi.fn().mockRejectedValue(error);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      await expect(repository.findByEmail("test@example.com")).rejects.toThrow(
        "Database error",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        "[UserRepository] Error in findByEmail",
      );
    });
  });
});
