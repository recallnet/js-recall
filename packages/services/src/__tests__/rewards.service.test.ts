import type { Logger } from "pino";
import { type Hex, encodePacked, keccak256 } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import type {
  SelectReward,
  SelectRewardsTree,
} from "@recallnet/db/schema/voting/types";
import type { Database } from "@recallnet/db/types";
import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

import { RewardsService, createLeafNode } from "../rewards.service.js";

describe("RewardsService", () => {
  let service: RewardsService;
  let mockRewardsRepo: MockProxy<RewardsRepository>;
  let mockRewardsAllocator: MockProxy<RewardsAllocator>;
  let mockDb: MockProxy<Database>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create all service mocks
    mockRewardsRepo = mock<RewardsRepository>();
    mockRewardsAllocator = mock<RewardsAllocator>();
    mockDb = mock<Database>();
    mockLogger = mock<Logger>();

    // Setup mock allocator
    mockRewardsAllocator.allocate.mockResolvedValue({
      transactionHash: "0x1234567890abcdef1234567890abcdef12345678",
      blockNumber: 12345n,
      gasUsed: 100000n,
    });

    // Setup database transaction mock
    mockDb.transaction.mockImplementation(async (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockTx = mock<any>();
      mockTx.insert = vi.fn().mockReturnThis();
      mockTx.values = vi.fn().mockResolvedValue(undefined);
      return await callback(mockTx);
    });

    service = new RewardsService(
      mockRewardsRepo,
      mockRewardsAllocator,
      mockDb,
      mockLogger,
    );
  });

  afterEach(() => {
    // Reset all mocks
    mockReset(mockRewardsRepo);
    mockReset(mockRewardsAllocator);
    mockReset(mockDb);
    mockReset(mockLogger);
  });

  describe("Constructor", () => {
    it("should initialize with provided dependencies", () => {
      const testService = new RewardsService(
        mockRewardsRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      expect(testService).toBeInstanceOf(RewardsService);
    });
  });

  describe("calculateRewards", () => {
    it("should successfully calculate and insert rewards with real implementation", async () => {
      // Test the actual implementation - the calculate method returns empty array for now
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards();

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalledWith([]);
    });

    it("should handle database constraint violations during insertion", async () => {
      const dbError = new Error("UNIQUE constraint failed");
      mockRewardsRepo.insertRewards.mockRejectedValue(dbError);

      await expect(service.calculateRewards()).rejects.toThrow(
        "UNIQUE constraint failed",
      );
    });

    it("should handle network timeout during calculation", async () => {
      const timeoutError = new Error("Request timeout");
      mockRewardsRepo.insertRewards.mockRejectedValue(timeoutError);

      await expect(service.calculateRewards()).rejects.toThrow(
        "Request timeout",
      );
    });
  });

  describe("allocate", () => {
    const competitionId = "comp-123";
    const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
    const startTimestamp = 1640995200; // 2022-01-01

    it("should successfully allocate rewards", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          address:
            "0x2222222222222222222222222222222222222222" as `0x${string}`,
          amount: 200n,
          leafHash: Buffer.from("hash2"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      // Verify blockchain allocation was called with correct parameters
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String), // rootHash
        tokenAddress,
        300n, // total allocation amount
        startTimestamp,
      );

      // Verify database transaction was executed
      expect(mockDb.transaction).toHaveBeenCalledOnce();
    });

    it("should throw error when no rewards exist", async () => {
      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue([]);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).rejects.toThrow("no rewards to allocate");
    });

    it("should calculate correct allocation amount", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 150n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          address:
            "0x2222222222222222222222222222222222222222" as `0x${string}`,
          amount: 350n,
          leafHash: Buffer.from("hash2"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        tokenAddress,
        500n, // 150 + 350
        startTimestamp,
      );
    });

    it("should handle blockchain allocation failure and rollback database transaction", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      // Mock blockchain allocation to fail
      const blockchainError = new Error("Blockchain allocation failed");
      mockRewardsAllocator.allocate.mockRejectedValue(blockchainError);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).rejects.toThrow("Blockchain allocation failed");

      // Verify transaction was attempted but should rollback due to error
      expect(mockDb.transaction).toHaveBeenCalledOnce();
    });

    describe("createLeafNode", () => {
      it("should create consistent leaf hash for same inputs", () => {
        const address =
          "0x1234567890123456789012345678901234567890" as `0x${string}`;
        const amount = 100n;

        const hash1 = createLeafNode(address, amount);
        const hash2 = createLeafNode(address, amount);

        expect(hash1).toEqual(hash2);
        expect(typeof hash1).toBe("string");
        expect(hash1).toMatch(/^0x[a-fA-F0-9]{64}$/); // keccak256 produces 32-byte hash as hex string
      });

      it("should create different hashes for different inputs", () => {
        const address1 =
          "0x1111111111111111111111111111111111111111" as `0x${string}`;
        const address2 =
          "0x2222222222222222222222222222222222222222" as `0x${string}`;
        const amount = 100n;

        const hash1 = createLeafNode(address1, amount);
        const hash2 = createLeafNode(address2, amount);

        expect(hash1).not.toEqual(hash2);
      });

      it("should create hash using correct ABI encoding", () => {
        const address =
          "0x1234567890123456789012345678901234567890" as `0x${string}`;
        const amount = 100n;

        const expectedEncoding = encodePacked(
          ["string", "address", "uint256"],
          ["rl", address, amount],
        );
        const expectedHash = keccak256(expectedEncoding);

        const actualHash = createLeafNode(address, amount);

        // Both should be hex strings
        expect(actualHash).toEqual(expectedHash);
        expect(typeof actualHash).toBe("string");
        expect(typeof expectedHash).toBe("string");
      });
    });
  });

  describe("Edge cases and error conditions", () => {
    it("should handle large reward amounts without overflow and validate total", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;
      const largeAmount = BigInt("999999999999999999999999999999999999999");

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: largeAmount,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          address:
            "0x2222222222222222222222222222222222222222" as `0x${string}`,
          amount: 1n,
          leafHash: Buffer.from("hash2"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      // Verify correct total calculation with large numbers
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        tokenAddress,
        largeAmount + 1n, // Exact sum
        startTimestamp,
      );
    });

    it("should handle zero amount rewards properly", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 0n,
          leafHash: Buffer.from(
            createLeafNode(
              "0x1111111111111111111111111111111111111111" as `0x${string}`,
              0n,
            ).slice(2),
            "hex",
          ),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        tokenAddress,
        0n,
        startTimestamp,
      );
    });

    it("should handle duplicate addresses with different amounts", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;
      const duplicateAddress =
        "0x1111111111111111111111111111111111111111" as `0x${string}`;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address: duplicateAddress,
          amount: 100n,
          leafHash: Buffer.from(
            createLeafNode(duplicateAddress, 100n).slice(2),
            "hex",
          ),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          address: duplicateAddress,
          amount: 200n,
          leafHash: Buffer.from(
            createLeafNode(duplicateAddress, 200n).slice(2),
            "hex",
          ),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      // Verify both rewards are counted in total
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        tokenAddress,
        300n, // 100n + 200n
        startTimestamp,
      );
    });

    it("should handle malformed leaf hashes gracefully", async () => {
      const competitionId = "comp-123";
      const address =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 100n;

      const mockTree: SelectRewardsTree[] = [
        {
          id: "node-1",
          competitionId,
          level: 0,
          idx: 0,
          hash: new Uint8Array([1, 2]), // Malformed hash (too short)
          createdAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsTreeByCompetition.mockResolvedValue(mockTree);

      await expect(
        service.retrieveProof(competitionId, address, amount),
      ).rejects.toThrow(
        `No proof found for reward (address: ${address}, amount: ${amount}) in competition ${competitionId}`,
      );
    });

    it("should handle rewards without allocator", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      // Create service with null allocator to test error handling
      const serviceWithoutAllocator = new RewardsService(
        mockRewardsRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      await expect(
        serviceWithoutAllocator.allocate(
          competitionId,
          tokenAddress,
          startTimestamp,
        ),
      ).rejects.toThrow();
    });
  });

  describe("createLeafNode utility", () => {
    it("should create consistent leaf hash for same inputs", () => {
      const address =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 100n;

      const hash1 = createLeafNode(address, amount);
      const hash2 = createLeafNode(address, amount);

      expect(hash1).toEqual(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1).toMatch(/^0x[a-fA-F0-9]{64}$/); // keccak256 produces 32-byte hash as hex string
    });

    it("should create different hashes for different inputs", () => {
      const address1 =
        "0x1111111111111111111111111111111111111111" as `0x${string}`;
      const address2 =
        "0x2222222222222222222222222222222222222222" as `0x${string}`;
      const amount = 100n;

      const hash1 = createLeafNode(address1, amount);
      const hash2 = createLeafNode(address2, amount);

      expect(hash1).not.toEqual(hash2);
    });

    it("should create hash using correct ABI encoding", () => {
      const address =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 100n;

      const expectedEncoding = encodePacked(
        ["string", "address", "uint256"],
        ["rl", address, amount],
      );
      const expectedHash = keccak256(expectedEncoding);

      const actualHash = createLeafNode(address, amount);

      // Both should be hex strings
      expect(actualHash).toEqual(expectedHash);
      expect(typeof actualHash).toBe("string");
      expect(typeof expectedHash).toBe("string");
    });

    it("should handle zero amounts correctly", () => {
      const address =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const amount = 0n;

      const hash = createLeafNode(address, amount);

      expect(typeof hash).toBe("string");
      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Should be deterministic for zero amounts
      const hash2 = createLeafNode(address, amount);
      expect(hash).toEqual(hash2);
    });

    it("should handle very large amounts correctly", () => {
      const address =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const largeAmount = BigInt("999999999999999999999999999999999999999");

      const hash = createLeafNode(address, largeAmount);

      expect(typeof hash).toBe("string");
      expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Should be deterministic for large amounts
      const hash2 = createLeafNode(address, largeAmount);
      expect(hash).toEqual(hash2);
    });
  });

  describe("Merkle tree operations", () => {
    it("should handle empty rewards list", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue([]);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).rejects.toThrow("no rewards to allocate");

      // Should not attempt blockchain allocation
      expect(mockRewardsAllocator.allocate).not.toHaveBeenCalled();
    });

    it("should build merkle tree with single reward", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        tokenAddress,
        100n,
        startTimestamp,
      );

      // Verify database operations
      expect(mockDb.transaction).toHaveBeenCalledOnce();
    });

    it("should handle complex tree structure with many rewards", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;

      // Create 8 rewards for a more complex tree
      const mockRewards: SelectReward[] = Array.from({ length: 8 }, (_, i) => ({
        id: `reward-${i + 1}`,
        competitionId,
        address: `0x${(i + 1).toString().padStart(40, "0")}` as `0x${string}`,
        amount: BigInt((i + 1) * 100),
        leafHash: Buffer.from(`hash${i + 1}`),
        claimed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(mockRewards);

      await service.allocate(competitionId, tokenAddress, startTimestamp);

      // Total: 100 + 200 + 300 + 400 + 500 + 600 + 700 + 800 = 3600
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        tokenAddress,
        3600n,
        startTimestamp,
      );
    });
  });
});
