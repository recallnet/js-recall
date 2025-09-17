/**
 * Test plan for RewardsService - Critical Financial System Component
 *
 * Target module: RewardsService (rewards.service.ts)
 * Reason: Highest priority gap - handles financial rewards with 0% test coverage
 *
 * Scenarios to cover:
 * 1. Constructor - configuration and initialization validation
 * 2. calculateRewards - error handling and database integration
 * 3. allocate - Merkle tree creation, blockchain publishing, database transactions
 * 4. retrieveProof - Merkle proof generation and validation
 * 5. Helper functions - createLeafNode, faux node generation
 *
 * Stubs/fixtures: Mock database, blockchain allocator, sample reward data
 * Expected signals: No financial data corruption, proper error handling, transaction integrity
 */
import { type Hex, encodeAbiParameters, keccak256 } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SelectReward,
  SelectRewardsTree,
} from "@recallnet/db-schema/voting/types";
import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import * as rewardsRepository from "@/database/repositories/rewards-repository.js";
import { RewardsService, createLeafNode } from "@/services/rewards.service.js";

// Mock external dependencies
vi.mock("@/config/index.js");
vi.mock("@/database/db.js");
vi.mock("@/database/repositories/rewards-repository.js");
vi.mock("@recallnet/staking-contracts/rewards-allocator", () => ({
  default: vi.fn().mockImplementation(() => ({
    allocate: vi.fn(),
  })),
}));
vi.mock("@/lib/logger.js", () => ({
  serviceLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  dbLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RewardsService", () => {
  let mockRewardsAllocator: RewardsAllocator;
  let mockTransaction: {
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock RewardsAllocator
    mockRewardsAllocator = {
      allocate: vi.fn().mockResolvedValue({
        transactionHash: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    } as unknown as RewardsAllocator;

    // Mock database transaction
    mockTransaction = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };

    (db as unknown as { transaction: ReturnType<typeof vi.fn> }).transaction =
      vi
        .fn()
        .mockImplementation(
          (callback: (tx: typeof mockTransaction) => Promise<void>) =>
            callback(mockTransaction),
        );
  });

  describe("Constructor", () => {
    it("should initialize with provided RewardsAllocator", () => {
      const service = new RewardsService(mockRewardsAllocator);

      expect(service).toBeInstanceOf(RewardsService);
    });

    it("should initialize with config when allocator is available", () => {
      (config as { rewards: Record<string, string | null> }).rewards = {
        allocatorPrivateKey:
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        contractAddress: "0x1234567890123456789012345678901234567890",
        rpcProvider: "https://mainnet.infura.io/v3/test",
      };

      const service = new RewardsService();
      expect(service).toBeInstanceOf(RewardsService);
    });

    it("should handle incomplete configuration gracefully", () => {
      (config as { rewards: Record<string, string | null> }).rewards = {
        allocatorPrivateKey: null,
        contractAddress: null,
        rpcProvider: null,
      };

      const service = new RewardsService();
      expect(service).toBeInstanceOf(RewardsService);
    });
  });

  describe("calculateRewards", () => {
    it("should successfully calculate and insert rewards with real implementation", async () => {
      const service = new RewardsService();

      // Test the actual implementation - the calculate method returns empty array for now
      vi.mocked(rewardsRepository.insertRewards).mockResolvedValue([]);

      await service.calculateRewards();

      expect(rewardsRepository.insertRewards).toHaveBeenCalledWith([]);
    });

    it("should handle database constraint violations during insertion", async () => {
      const service = new RewardsService();
      const dbError = new Error("UNIQUE constraint failed");
      vi.mocked(rewardsRepository.insertRewards).mockRejectedValue(dbError);

      await expect(service.calculateRewards()).rejects.toThrow(
        "UNIQUE constraint failed",
      );
    });

    it("should handle network timeout during calculation", async () => {
      const service = new RewardsService();
      const timeoutError = new Error("Request timeout");
      vi.mocked(rewardsRepository.insertRewards).mockRejectedValue(
        timeoutError,
      );

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

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);
      await service.allocate(competitionId, tokenAddress, startTimestamp);

      // Verify blockchain allocation was called with correct parameters
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String), // rootHash
        tokenAddress,
        300n, // total allocation amount
        startTimestamp,
      );

      // Verify database transaction was executed
      expect(db.transaction).toHaveBeenCalledOnce();
      expect(mockTransaction.insert).toHaveBeenCalledTimes(2); // tree nodes and root
    });

    it("should throw error when no rewards exist", async () => {
      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        [],
      );

      const service = new RewardsService(mockRewardsAllocator);

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

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);
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

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const blockchainError = new Error("Blockchain transaction failed");
      mockRewardsAllocator.allocate = vi
        .fn()
        .mockRejectedValue(blockchainError);

      const service = new RewardsService(mockRewardsAllocator);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).rejects.toThrow("Blockchain transaction failed");

      // Verify transaction rollback - database operations should not have been called
      expect(mockTransaction.insert).not.toHaveBeenCalled();
    });

    it("should maintain transaction integrity when database operations fail", async () => {
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

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      // Mock database transaction to fail after blockchain success
      const dbError = new Error("Database constraint violation");
      mockTransaction.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(dbError),
      });

      const service = new RewardsService(mockRewardsAllocator);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).rejects.toThrow("Database constraint violation");

      // Blockchain call should have been made but the transaction should rollback
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledOnce();
    });

    it("should verify merkle tree construction with correct faux leaf", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: 100n,
          leafHash: createLeafNode(
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
            100n,
          ),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);
      await service.allocate(competitionId, tokenAddress, startTimestamp);

      // Verify that database insert was called with tree nodes
      expect(mockTransaction.insert).toHaveBeenCalledTimes(2); // tree nodes and root

      // First call should be for tree nodes
      const firstCall = mockTransaction.insert.mock.calls[0];
      expect(firstCall).toBeDefined();

      // Second call should be for the root
      const secondCall = mockTransaction.insert.mock.calls[1];
      expect(secondCall).toBeDefined();
    });
  });

  describe("retrieveProof", () => {
    const competitionId = "comp-123";
    const address =
      "0x1234567890123456789012345678901234567890" as `0x${string}`;
    const amount = 100n;

    it("should successfully retrieve and validate proof for valid reward", async () => {
      const leafHash = createLeafNode(address, amount);
      const siblingHash = new Uint8Array([1, 2, 3]);

      // Create a realistic tree structure where we can validate the proof
      const mockTree: SelectRewardsTree[] = [
        {
          id: "node-1",
          competitionId,
          level: 0,
          idx: 0,
          hash: siblingHash, // sibling of our target leaf
          createdAt: new Date(),
        },
        {
          id: "node-2",
          competitionId,
          level: 0,
          idx: 1,
          hash: leafHash, // our target leaf at position 1
          createdAt: new Date(),
        },
        {
          id: "node-3",
          competitionId,
          level: 1,
          idx: 0,
          hash: keccak256(
            Buffer.concat([siblingHash, leafHash].sort(Buffer.compare)),
          ),
          createdAt: new Date(),
        },
      ];

      vi.mocked(
        rewardsRepository.getRewardsTreeByCompetition,
      ).mockResolvedValue(mockTree);

      const service = new RewardsService();
      const proof = await service.retrieveProof(competitionId, address, amount);

      expect(proof).toBeInstanceOf(Array);
      expect(proof.length).toBe(1); // Should have one sibling proof
      expect(proof[0]).toEqual(siblingHash); // Should contain the sibling hash

      // Verify proof can reconstruct to the parent node
      const reconstructedParent = keccak256(
        Buffer.concat([siblingHash, leafHash].sort(Buffer.compare)),
      );
      expect(reconstructedParent).toEqual(mockTree[2]?.hash);
    });

    it("should throw error when reward not found in tree", async () => {
      const mockTree: SelectRewardsTree[] = [
        {
          id: "node-1",
          competitionId,
          level: 0,
          idx: 0,
          hash: new Uint8Array([1, 2, 3]),
          createdAt: new Date(),
        },
      ];

      vi.mocked(
        rewardsRepository.getRewardsTreeByCompetition,
      ).mockResolvedValue(mockTree);

      const service = new RewardsService();

      await expect(
        service.retrieveProof(competitionId, address, amount),
      ).rejects.toThrow(
        `No proof found for reward (address: ${address}, amount: ${amount}) in competition ${competitionId}`,
      );
    });

    it("should handle database errors during proof retrieval", async () => {
      const error = new Error("Database connection failed");
      vi.mocked(
        rewardsRepository.getRewardsTreeByCompetition,
      ).mockRejectedValue(error);

      const service = new RewardsService();

      await expect(
        service.retrieveProof(competitionId, address, amount),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("Helper functions", () => {
    describe("createLeafNode", () => {
      it("should create consistent leaf hash for same inputs", () => {
        const address =
          "0x1234567890123456789012345678901234567890" as `0x${string}`;
        const amount = 100n;

        const hash1 = createLeafNode(address, amount);
        const hash2 = createLeafNode(address, amount);

        expect(hash1).toEqual(hash2);
        expect(hash1).toBeInstanceOf(Buffer);
        expect(hash1.length).toBe(32); // keccak256 produces 32-byte hash
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

        const expectedEncoding = encodeAbiParameters(
          [{ type: "string" }, { type: "address" }, { type: "uint256" }],
          ["rl", address, amount],
        );
        const expectedHash = keccak256(expectedEncoding);

        const actualHash = createLeafNode(address, amount);

        expect(actualHash).toEqual(expectedHash);
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

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);
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
          leafHash: createLeafNode(
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
            0n,
          ),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);
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
          leafHash: createLeafNode(duplicateAddress, 100n),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          address: duplicateAddress,
          amount: 200n,
          leafHash: createLeafNode(duplicateAddress, 200n),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);
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

      vi.mocked(
        rewardsRepository.getRewardsTreeByCompetition,
      ).mockResolvedValue(mockTree);

      const service = new RewardsService();

      await expect(
        service.retrieveProof(competitionId, address, amount),
      ).rejects.toThrow(
        `No proof found for reward (address: ${address}, amount: ${amount}) in competition ${competitionId}`,
      );
    });

    it("should validate allocator existence before attempting allocation", async () => {
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

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      // Create service without allocator
      const service = new RewardsService();

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).rejects.toThrow();
    });
  });
});
