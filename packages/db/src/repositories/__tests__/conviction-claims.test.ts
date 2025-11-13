import { beforeEach, describe, expect, it, vi } from "vitest";

import { convictionClaims } from "../../schema/conviction-claims/defs.js";
import { ConvictionClaimsRepository } from "../conviction-claims.js";

describe("ConvictionClaimsRepository", () => {
  let repository: ConvictionClaimsRepository;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    repository = new ConvictionClaimsRepository(mockDb, mockLogger);
  });

  describe("getClaimsByAccount", () => {
    it("should return claims for a given account", async () => {
      const mockClaims = [
        {
          id: "claim-1",
          account: "0x1234567890123456789012345678901234567890",
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: BigInt(86400), // 1 day in seconds
          blockNumber: BigInt(1000000),
          blockTimestamp: new Date("2024-01-01"),
          transactionHash: Buffer.from("tx-hash-1"),
        },
        {
          id: "claim-2",
          account: "0x1234567890123456789012345678901234567890",
          eligibleAmount: BigInt("2000000000000000000"),
          claimedAmount: BigInt("2000000000000000000"),
          season: 1,
          duration: BigInt(172800), // 2 days in seconds
          blockNumber: BigInt(2000000),
          blockTimestamp: new Date("2024-02-01"),
          transactionHash: Buffer.from("tx-hash-2"),
        },
      ];

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockClaims),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.getClaimsByAccount(
        "0x1234567890123456789012345678901234567890",
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.account).toBe(
        "0x1234567890123456789012345678901234567890",
      );
      expect(result[0]!.season).toBe(0);
      expect(result[1]!.season).toBe(1);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should normalize account address to lowercase", async () => {
      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      await repository.getClaimsByAccount(
        "0xABCDEF1234567890123456789012345678901234",
      );

      expect(selectMock.where).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Database error");
      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(error),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      await expect(
        repository.getClaimsByAccount(
          "0x1234567890123456789012345678901234567890",
        ),
      ).rejects.toThrow("Database error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error fetching claims by account:",
        error,
      );
    });
  });

  describe("getClaimByAccountAndSeason", () => {
    it("should return a single claim for account and season", async () => {
      const mockClaim = {
        id: "claim-1",
        account: "0x1234567890123456789012345678901234567890",
        eligibleAmount: BigInt("1000000000000000000"),
        claimedAmount: BigInt("1000000000000000000"),
        season: 0,
        duration: BigInt(86400),
        blockNumber: BigInt(1000000),
        blockTimestamp: new Date("2024-01-01"),
        transactionHash: Buffer.from("tx-hash-1"),
      };

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockClaim]),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.getClaimByAccountAndSeason(
        "0x1234567890123456789012345678901234567890",
        0,
      );

      expect(result).not.toBeNull();
      expect(result?.account).toBe(
        "0x1234567890123456789012345678901234567890",
      );
      expect(result?.season).toBe(0);
    });

    it("should return null when no claim exists", async () => {
      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.getClaimByAccountAndSeason(
        "0x1234567890123456789012345678901234567890",
        0,
      );

      expect(result).toBeNull();
    });
  });

  describe("hasClaimedForSeason", () => {
    it("should return true if claim exists", async () => {
      const mockClaim = {
        id: "claim-1",
        account: "0x1234567890123456789012345678901234567890",
        eligibleAmount: BigInt("1000000000000000000"),
        claimedAmount: BigInt("1000000000000000000"),
        season: 0,
        duration: BigInt(86400),
        blockNumber: BigInt(1000000),
        blockTimestamp: new Date("2024-01-01"),
        transactionHash: Buffer.from("tx-hash-1"),
      };

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockClaim]),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.hasClaimedForSeason(
        "0x1234567890123456789012345678901234567890",
        0,
      );

      expect(result).toBe(true);
    });

    it("should return false if no claim exists", async () => {
      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.hasClaimedForSeason(
        "0x1234567890123456789012345678901234567890",
        0,
      );

      expect(result).toBe(false);
    });
  });

  describe("getTotalClaimedByAccount", () => {
    it("should calculate total claimed amount across all seasons", async () => {
      const mockClaims = [
        {
          id: "claim-1",
          account: "0x1234567890123456789012345678901234567890",
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: BigInt(86400),
          blockNumber: BigInt(1000000),
          blockTimestamp: new Date("2024-01-01"),
          transactionHash: Buffer.from("tx-hash-1"),
        },
        {
          id: "claim-2",
          account: "0x1234567890123456789012345678901234567890",
          eligibleAmount: BigInt("2000000000000000000"),
          claimedAmount: BigInt("2000000000000000000"),
          season: 1,
          duration: BigInt(172800),
          blockNumber: BigInt(2000000),
          blockTimestamp: new Date("2024-02-01"),
          transactionHash: Buffer.from("tx-hash-2"),
        },
      ];

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockClaims),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.getTotalClaimedByAccount(
        "0x1234567890123456789012345678901234567890",
      );

      expect(result).toBe(BigInt("3000000000000000000"));
    });

    it("should return 0 if no claims exist", async () => {
      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.getTotalClaimedByAccount(
        "0x1234567890123456789012345678901234567890",
      );

      expect(result).toBe(BigInt(0));
    });
  });

  describe("insertClaim", () => {
    it("should insert a new conviction claim", async () => {
      const claimData = {
        account: "0x1234567890123456789012345678901234567890",
        eligibleAmount: BigInt("1000000000000000000"),
        claimedAmount: BigInt("1000000000000000000"),
        season: 0,
        duration: BigInt(86400),
        blockNumber: BigInt(1000000),
        blockTimestamp: new Date("2024-01-01"),
        transactionHash: Buffer.from("tx-hash-1"),
      };

      const mockInsertResult = {
        id: "new-claim-id",
        ...claimData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockInsertResult]),
      };

      mockDb.insert = vi.fn().mockReturnValue(insertMock);

      const result = await repository.insertClaim(claimData);

      expect(result.id).toBe("new-claim-id");
      expect(mockDb.insert).toHaveBeenCalledWith(convictionClaims);
      expect(insertMock.values).toHaveBeenCalledWith({
        account: claimData.account.toLowerCase(),
        eligibleAmount: claimData.eligibleAmount,
        claimedAmount: claimData.claimedAmount,
        season: claimData.season,
        duration: claimData.duration,
        blockNumber: claimData.blockNumber,
        blockTimestamp: claimData.blockTimestamp,
        transactionHash: claimData.transactionHash,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Inserting conviction claim for account ${claimData.account}, season ${claimData.season}`,
      );
    });

    it("should handle insert errors gracefully", async () => {
      const claimData = {
        account: "0x1234567890123456789012345678901234567890",
        eligibleAmount: BigInt("1000000000000000000"),
        claimedAmount: BigInt("1000000000000000000"),
        season: 0,
        duration: BigInt(86400),
        blockNumber: BigInt(1000000),
        blockTimestamp: new Date("2024-01-01"),
        transactionHash: Buffer.from("tx-hash-1"),
      };

      const error = new Error("Insert failed");
      const insertMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(error),
      };

      mockDb.insert = vi.fn().mockReturnValue(insertMock);

      await expect(repository.insertClaim(claimData)).rejects.toThrow(
        "Insert failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error inserting conviction claim:",
        error,
      );
    });
  });

  describe("getClaimsByAccounts", () => {
    it("should return claims for multiple accounts", async () => {
      const mockClaims = [
        {
          id: "claim-1",
          account: "0x1234567890123456789012345678901234567890",
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: BigInt(86400),
          blockNumber: BigInt(1000000),
          blockTimestamp: new Date("2024-01-01"),
          transactionHash: Buffer.from("tx-hash-1"),
        },
        {
          id: "claim-2",
          account: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          eligibleAmount: BigInt("2000000000000000000"),
          claimedAmount: BigInt("2000000000000000000"),
          season: 0,
          duration: BigInt(172800),
          blockNumber: BigInt(2000000),
          blockTimestamp: new Date("2024-02-01"),
          transactionHash: Buffer.from("tx-hash-2"),
        },
      ];

      const selectMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockClaims),
      };

      mockDb.select = vi.fn().mockReturnValue(selectMock);

      const result = await repository.getClaimsByAccounts([
        "0x1234567890123456789012345678901234567890",
        "0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD",
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]!.account).toBe(
        "0x1234567890123456789012345678901234567890",
      );
      expect(result[1]!.account).toBe(
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      );
    });

    it("should return empty array for empty input", async () => {
      const result = await repository.getClaimsByAccounts([]);
      expect(result).toEqual([]);
    });
  });
});
