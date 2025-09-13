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
import keccak256 from "keccak256";
import { type Hex, encodeAbiParameters } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  InsertReward,
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
    it("should successfully calculate and insert rewards", async () => {
      const mockRewards: InsertReward[] = [
        {
          id: "reward-1",
          competitionId: "comp-1",
          address:
            "0x1234567890123456789012345678901234567890" as `0x${string}`,
          amount: 100n,
          leafHash: new Uint8Array([1, 2, 3, 4]),
          claimed: false,
        },
      ];

      const service = new RewardsService();
      // Mock the private calculate method via accessing it
      (
        service as unknown as { calculate: ReturnType<typeof vi.fn> }
      ).calculate = vi.fn().mockResolvedValue(mockRewards);

      vi.mocked(rewardsRepository.insertRewards).mockResolvedValue(
        mockRewards as SelectReward[],
      );

      await service.calculateRewards();

      expect(
        (service as unknown as { calculate: ReturnType<typeof vi.fn> })
          .calculate,
      ).toHaveBeenCalledOnce();
      expect(rewardsRepository.insertRewards).toHaveBeenCalledWith(mockRewards);
    });

    it("should handle errors during calculation", async () => {
      const service = new RewardsService();
      const error = new Error("Calculation failed");

      (
        service as unknown as { calculate: ReturnType<typeof vi.fn> }
      ).calculate = vi.fn().mockRejectedValue(error);

      await expect(service.calculateRewards()).rejects.toThrow(
        "Calculation failed",
      );
    });

    it("should handle errors during insertion", async () => {
      const service = new RewardsService();
      (
        service as unknown as { calculate: ReturnType<typeof vi.fn> }
      ).calculate = vi.fn().mockResolvedValue([]);

      const error = new Error("Database insertion failed");
      vi.mocked(rewardsRepository.insertRewards).mockRejectedValue(error);

      await expect(service.calculateRewards()).rejects.toThrow(
        "Database insertion failed",
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

    it("should handle blockchain allocation failure", async () => {
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
    });
  });

  describe("retrieveProof", () => {
    const competitionId = "comp-123";
    const address =
      "0x1234567890123456789012345678901234567890" as `0x${string}`;
    const amount = 100n;

    it("should successfully retrieve proof for valid reward", async () => {
      const leafHash = createLeafNode(address, amount);

      const mockTree: SelectRewardsTree[] = [
        {
          id: "node-1",
          competitionId,
          level: 0,
          idx: 0,
          hash: new Uint8Array([1, 2, 3]),
          createdAt: new Date(),
        },
        {
          id: "node-2",
          competitionId,
          level: 0,
          idx: 1,
          hash: leafHash,
          createdAt: new Date(),
        },
        {
          id: "node-3",
          competitionId,
          level: 1,
          idx: 0,
          hash: new Uint8Array([4, 5, 6]),
          createdAt: new Date(),
        },
        {
          id: "node-4",
          competitionId,
          level: 1,
          idx: 1,
          hash: new Uint8Array([7, 8, 9]),
          createdAt: new Date(),
        },
        {
          id: "node-5",
          competitionId,
          level: 2,
          idx: 0,
          hash: new Uint8Array([10, 11, 12]),
          createdAt: new Date(),
        },
      ];

      vi.mocked(
        rewardsRepository.getRewardsTreeByCompetition,
      ).mockResolvedValue(mockTree);

      const service = new RewardsService();
      const proof = await service.retrieveProof(competitionId, address, amount);

      expect(proof).toBeInstanceOf(Array);
      expect(proof.length).toBeGreaterThan(0);
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
    it("should handle large reward amounts without overflow", async () => {
      const competitionId = "comp-123";
      const tokenAddress = "0x1234567890123456789012345678901234567890" as Hex;
      const startTimestamp = 1640995200;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          address:
            "0x1111111111111111111111111111111111111111" as `0x${string}`,
          amount: BigInt("999999999999999999999999999999999999999"),
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(rewardsRepository.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(mockRewardsAllocator);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).resolves.not.toThrow();
    });

    it("should handle special characters in competition ID for faux leaf", async () => {
      const competitionId = "comp-with-special-chars-!@#$%^&*()";
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

      const service = new RewardsService(mockRewardsAllocator);

      await expect(
        service.allocate(competitionId, tokenAddress, startTimestamp),
      ).resolves.not.toThrow();
    });
  });
});
