import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";

import { convictionClaims } from "../../schema/conviction-claims/defs.js";
import { Database } from "../../types.js";
import { ConvictionClaimsRepository } from "../conviction-claims.js";

describe("ConvictionClaimsRepository", () => {
  let repository: ConvictionClaimsRepository;
  let mockDb: DeepMockProxy<Database>;
  let mockLogger: DeepMockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mockDeep<Logger>();
    mockDb = mockDeep<Database>();

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

      // Mock the chain using vitest mocks
      const orderByMock = vi.fn().mockResolvedValue(mockClaims);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      // Override the select method
      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.getClaimsByAccount(
        "0x1234567890123456789012345678901234567890",
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.account).toBe(
        "0x1234567890123456789012345678901234567890",
      );
      expect(result[0]!.season).toBe(0);
      expect(result[1]!.season).toBe(1);
      expect(selectMock).toHaveBeenCalled();
    });

    it("should normalize account address to lowercase", async () => {
      const orderByMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      await repository.getClaimsByAccount(
        "0xABCDEF1234567890123456789012345678901234",
      );

      expect(whereMock).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Database error");

      const orderByMock = vi.fn().mockRejectedValue(error);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      await expect(
        repository.getClaimsByAccount(
          "0x1234567890123456789012345678901234567890",
        ),
      ).rejects.toThrow("Database error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        "Error fetching claims by account",
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

      const limitMock = vi.fn().mockResolvedValue([mockClaim]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.getClaimByAccountAndAirdrop(
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
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.getClaimByAccountAndAirdrop(
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

      const limitMock = vi.fn().mockResolvedValue([mockClaim]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.hasClaimedForAirdrop(
        "0x1234567890123456789012345678901234567890",
        0,
      );

      expect(result).toBe(true);
    });

    it("should return false if no claim exists", async () => {
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.hasClaimedForAirdrop(
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

      const orderByMock = vi.fn().mockResolvedValue(mockClaims);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.getTotalClaimedByAccount(
        "0x1234567890123456789012345678901234567890",
      );

      expect(result).toBe(BigInt("3000000000000000000"));
    });

    it("should return 0 if no claims exist", async () => {
      const orderByMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

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

      const returningMock = vi.fn().mockResolvedValue([mockInsertResult]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      const result = await repository.insertClaim(claimData);

      expect(result.id).toBe("new-claim-id");
      expect(insertMock).toHaveBeenCalledWith(convictionClaims);
      expect(valuesMock).toHaveBeenCalledWith({
        account: claimData.account.toLowerCase(),
        walletAddress: claimData.account.toLowerCase(),
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Successfully inserted conviction claim with id new-claim-id`,
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

      const returningMock = vi.fn().mockRejectedValue(error);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

      Object.defineProperty(mockDb, "insert", {
        value: insertMock,
        writable: true,
        configurable: true,
      });

      await expect(repository.insertClaim(claimData)).rejects.toThrow(
        "Insert failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        "Error inserting conviction claim",
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

      const orderByMock = vi.fn().mockResolvedValue(mockClaims);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });

      Object.defineProperty(mockDb, "select", {
        value: selectMock,
        writable: true,
        configurable: true,
      });

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
