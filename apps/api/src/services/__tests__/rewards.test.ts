import { Hex, hexToBytes } from "viem";
import { Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import type { Leaderboard } from "@recallnet/rewards";
import RewardsAllocator from "@recallnet/staking-contracts/rewards-allocator";

import { db } from "@/database/db.js";
// Import mocked modules
import {
  findById,
  findLeaderboardByCompetitionWithWallets,
} from "@/database/repositories/competition-repository.js";
import {
  getRewardsByCompetition,
  getRewardsTreeByCompetition,
  insertRewards,
} from "@/database/repositories/rewards-repository.js";

import { RewardsService, createLeafNode } from "../rewards.service.js";

// Mock the database repositories
vi.mock("@/database/repositories/competition-repository.js", () => ({
  findById: vi.fn(),
  findLeaderboardByCompetitionWithWallets: vi.fn(),
}));

vi.mock("@/database/repositories/rewards-repository.js", () => ({
  getRewardsByCompetition: vi.fn(),
  getRewardsTreeByCompetition: vi.fn(),
  insertRewards: vi.fn(),
}));

vi.mock("@/database/db.js", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

vi.mock("@recallnet/db-schema/voting/defs", () => ({
  rewardsRoots: {},
  rewardsTree: {},
}));

vi.mock("@recallnet/staking-contracts/rewards-allocator", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/logger.js", () => ({
  serviceLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("RewardsService", () => {
  let rewardsService: RewardsService;
  let mockBoostRepository: BoostRepository;
  let mockRewardsAllocator: RewardsAllocator;
  let mockDbTransaction: Mock;

  // Test data based on test-case.json
  const testCompetitionId = "test-competition-id";
  const testPrizePoolUsers = BigInt("500000000000000000000"); // 500 tokens
  const testPrizePoolCompetitors = BigInt("500000000000000000000"); // 500 tokens

  const testCompetition = {
    id: testCompetitionId,
    status: "ended" as const,
    votingStartDate: new Date("2024-01-01T00:00:00Z"),
    votingEndDate: new Date("2024-01-05T00:00:00Z"),
  };

  const testLeaderboard: Leaderboard = [
    {
      competitor: "Competitor A",
      wallet: "0x1111111111111111111111111111111111111111",
      rank: 1,
    },
    {
      competitor: "Competitor B",
      wallet: "0x2222222222222222222222222222222222222222",
      rank: 2,
    },
    {
      competitor: "Competitor C",
      wallet: "0x3333333333333333333333333333333333333333",
      rank: 3,
    },
  ];

  const testBoostSpendingData = [
    {
      userId: "user-1",
      wallet: new Uint8Array(20).fill(0xaa), // 0xaa...aa
      deltaAmount: BigInt(-100),
      createdAt: new Date("2024-01-01T12:00:00Z"),
      agentId: "Competitor A",
    },
    {
      userId: "user-1",
      wallet: new Uint8Array(20).fill(0xaa), // 0xaa...aa
      deltaAmount: BigInt(-50),
      createdAt: new Date("2024-01-02T18:00:00Z"),
      agentId: "Competitor B",
    },
    {
      userId: "user-2",
      wallet: new Uint8Array(20).fill(0xbb), // 0xbb...bb
      deltaAmount: BigInt(-80),
      createdAt: new Date("2024-01-01T15:00:00Z"),
      agentId: "Competitor A",
    },
    {
      userId: "user-2",
      wallet: new Uint8Array(20).fill(0xbb), // 0xbb...bb
      deltaAmount: BigInt(-120),
      createdAt: new Date("2024-01-01T20:00:00Z"),
      agentId: "Competitor B",
    },
    {
      userId: "user-3",
      wallet: new Uint8Array(20).fill(0xcc), // 0xcc...cc
      deltaAmount: BigInt(-200),
      createdAt: new Date("2024-01-01T08:00:00Z"),
      agentId: "Competitor C",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock BoostRepository
    mockBoostRepository = {
      userBoostSpending: vi.fn().mockResolvedValue(testBoostSpendingData),
    } as unknown as BoostRepository;

    // Mock RewardsAllocator
    mockRewardsAllocator = {
      allocate: vi.fn().mockResolvedValue({
        transactionHash: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    } as unknown as RewardsAllocator;

    // Mock database transaction
    mockDbTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
      });
    });

    (db.transaction as Mock).mockImplementation(mockDbTransaction);

    // Create service instance
    rewardsService = new RewardsService(
      mockBoostRepository,
      mockRewardsAllocator,
    );
  });

  describe("calculateRewards", () => {
    it("should calculate rewards successfully with valid data", async () => {
      // Arrange
      (findById as Mock).mockResolvedValue(testCompetition);
      (findLeaderboardByCompetitionWithWallets as Mock).mockResolvedValue(
        testLeaderboard.map((entry) => ({
          agentId: entry.competitor,
          userWalletAddress: entry.wallet,
          rank: entry.rank,
        })),
      );
      (insertRewards as Mock).mockResolvedValue([]);

      // Act
      await rewardsService.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      // Assert
      expect(findById).toHaveBeenCalledWith(testCompetitionId);
      expect(findLeaderboardByCompetitionWithWallets).toHaveBeenCalledWith(
        testCompetitionId,
      );
      expect(mockBoostRepository.userBoostSpending).toHaveBeenCalledWith(
        testCompetitionId,
      );
      expect(insertRewards).toHaveBeenCalled();

      // Verify the rewards were calculated and inserted
      const insertCall = (insertRewards as Mock).mock.calls[0]?.[0];
      expect(insertCall).toBeDefined();
      expect(insertCall.length).toBeGreaterThan(0);

      // Each reward should have the required fields
      insertCall.forEach(
        (reward: {
          competitionId: string;
          address: string;
          amount: bigint;
          leafHash: Uint8Array;
          id: string;
        }) => {
          expect(reward).toHaveProperty("competitionId", testCompetitionId);
          expect(reward).toHaveProperty("address");
          expect(reward).toHaveProperty("amount");
          expect(reward).toHaveProperty("leafHash");
          expect(reward).toHaveProperty("id");
          expect(typeof reward.address).toBe("string");
          expect(typeof reward.amount).toBe("bigint");
          expect(reward.amount).toBeGreaterThan(0n);
        },
      );
    });

    it("should throw error when competition is not found", async () => {
      // Arrange
      (findById as Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        rewardsService.calculateRewards(
          testCompetitionId,
          testPrizePoolUsers,
          testPrizePoolCompetitors,
        ),
      ).rejects.toThrow("Competition not found");
    });

    it("should throw error when competition is not ended", async () => {
      // Arrange
      const activeCompetition = {
        ...testCompetition,
        status: "active" as const,
      };
      (findById as Mock).mockResolvedValue(activeCompetition);

      // Act & Assert
      await expect(
        rewardsService.calculateRewards(
          testCompetitionId,
          testPrizePoolUsers,
          testPrizePoolCompetitors,
        ),
      ).rejects.toThrow("Competition is not ended");
    });

    it("should throw error when voting dates are missing", async () => {
      // Arrange
      const competitionWithoutDates = {
        ...testCompetition,
        votingStartDate: null,
        votingEndDate: null,
      };
      (findById as Mock).mockResolvedValue(competitionWithoutDates);

      // Act & Assert
      await expect(
        rewardsService.calculateRewards(
          testCompetitionId,
          testPrizePoolUsers,
          testPrizePoolCompetitors,
        ),
      ).rejects.toThrow("Voting start or end date not found");
    });

    it("should throw error when no leaderboard entries found", async () => {
      // Arrange
      (findById as Mock).mockResolvedValue(testCompetition);
      (findLeaderboardByCompetitionWithWallets as Mock).mockResolvedValue([]);

      // Act & Assert
      await expect(
        rewardsService.calculateRewards(
          testCompetitionId,
          testPrizePoolUsers,
          testPrizePoolCompetitors,
        ),
      ).rejects.toThrow("No leaderboard entries found");
    });

    it("should handle empty boost allocations", async () => {
      // Arrange
      (findById as Mock).mockResolvedValue(testCompetition);
      (findLeaderboardByCompetitionWithWallets as Mock).mockResolvedValue(
        testLeaderboard.map((entry) => ({
          agentId: entry.competitor,
          userWalletAddress: entry.wallet,
          rank: entry.rank,
        })),
      );
      (mockBoostRepository.userBoostSpending as Mock).mockResolvedValue([]);
      (insertRewards as Mock).mockResolvedValue([]);

      // Act
      await rewardsService.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      // Assert
      expect(insertRewards).toHaveBeenCalled();
      const insertCall = (insertRewards as Mock).mock.calls[0]?.[0];
      // Should still have competitor rewards even without user boosts
      expect(insertCall.length).toBeGreaterThan(0);
    });
  });

  describe("allocate", () => {
    const testTokenAddress =
      "0x1234567890123456789012345678901234567890" as Hex;
    const testStartTimestamp = 1640995200; // 2022-01-01 00:00:00 UTC

    const testRewards = [
      {
        id: "reward-1",
        competitionId: testCompetitionId,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        amount: BigInt("100000000000000000000"), // 100 tokens
        leafHash: new Uint8Array(32).fill(0x01),
      },
      {
        id: "reward-2",
        competitionId: testCompetitionId,
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        amount: BigInt("200000000000000000000"), // 200 tokens
        leafHash: new Uint8Array(32).fill(0x02),
      },
    ];

    it("should allocate rewards successfully", async () => {
      // Arrange
      (getRewardsByCompetition as Mock).mockResolvedValue(testRewards);

      // Act
      await rewardsService.allocate(
        testCompetitionId,
        testTokenAddress,
        testStartTimestamp,
      );

      // Assert
      expect(getRewardsByCompetition).toHaveBeenCalledWith(testCompetitionId);
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String), // rootHash
        testTokenAddress,
        BigInt("300000000000000000000"), // total allocation amount
        testStartTimestamp,
      );
      expect(mockDbTransaction).toHaveBeenCalled();
    });

    it("should throw error when no rewards to allocate", async () => {
      // Arrange
      (getRewardsByCompetition as Mock).mockResolvedValue([]);

      // Act & Assert
      await expect(
        rewardsService.allocate(
          testCompetitionId,
          testTokenAddress,
          testStartTimestamp,
        ),
      ).rejects.toThrow("no rewards to allocate");
    });

    it("should build Merkle tree with correct structure", async () => {
      // Arrange
      (getRewardsByCompetition as Mock).mockResolvedValue(testRewards);

      // Act
      await rewardsService.allocate(
        testCompetitionId,
        testTokenAddress,
        testStartTimestamp,
      );

      // Assert
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String), // rootHash should be a valid hex string
        testTokenAddress,
        BigInt("300000000000000000000"),
        testStartTimestamp,
      );

      // Verify the root hash is a valid hex string
      const rootHash = (mockRewardsAllocator.allocate as Mock).mock
        .calls[0]?.[0];
      expect(rootHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should handle single reward allocation", async () => {
      // Arrange
      const singleReward = [testRewards[0]];
      (getRewardsByCompetition as Mock).mockResolvedValue(singleReward);

      // Act
      await rewardsService.allocate(
        testCompetitionId,
        testTokenAddress,
        testStartTimestamp,
      );

      // Assert
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        testTokenAddress,
        BigInt("100000000000000000000"),
        testStartTimestamp,
      );
    });
  });

  describe("retrieveProof", () => {
    const testAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
    const testAmount = BigInt("100000000000000000000");

    const testTreeData = [
      { level: 0, idx: 0, hash: new Uint8Array(32).fill(0x00) }, // faux leaf
      {
        level: 0,
        idx: 1,
        hash: hexToBytes(createLeafNode(testAddress, testAmount)),
      },
      { level: 1, idx: 0, hash: new Uint8Array(32).fill(0x11) },
      { level: 1, idx: 1, hash: new Uint8Array(32).fill(0x22) },
      { level: 2, idx: 0, hash: new Uint8Array(32).fill(0x33) },
    ];

    it("should retrieve proof successfully", async () => {
      // Arrange
      (getRewardsTreeByCompetition as Mock).mockResolvedValue(testTreeData);

      // Act
      const proof = await rewardsService.retrieveProof(
        testCompetitionId,
        testAddress,
        testAmount,
      );

      // Assert
      expect(getRewardsTreeByCompetition).toHaveBeenCalledWith(
        testCompetitionId,
      );
      expect(proof).toBeDefined();
      expect(Array.isArray(proof)).toBe(true);
      expect(proof.length).toBeGreaterThan(0);

      // Each proof element should be a Uint8Array
      proof.forEach((hash) => {
        expect(hash).toBeInstanceOf(Uint8Array);
        expect(hash.length).toBe(32);
      });
    });

    it("should throw error when proof not found", async () => {
      // Arrange
      (getRewardsTreeByCompetition as Mock).mockResolvedValue(testTreeData);
      const nonExistentAddress =
        "0xffffffffffffffffffffffffffffffffffffffff" as Hex;

      // Act & Assert
      await expect(
        rewardsService.retrieveProof(
          testCompetitionId,
          nonExistentAddress,
          testAmount,
        ),
      ).rejects.toThrow(
        `No proof found for reward (address: ${nonExistentAddress}, amount: ${testAmount}) in competition ${testCompetitionId}`,
      );
    });

    it("should handle empty tree data", async () => {
      // Arrange
      (getRewardsTreeByCompetition as Mock).mockResolvedValue([]);

      // Act & Assert
      await expect(
        rewardsService.retrieveProof(
          testCompetitionId,
          testAddress,
          testAmount,
        ),
      ).rejects.toThrow(
        `No proof found for reward (address: ${testAddress}, amount: ${testAmount}) in competition ${testCompetitionId}`,
      );
    });
  });

  describe("error handling", () => {
    it("should handle database errors in calculateRewards", async () => {
      // Arrange
      (findById as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      // Act & Assert
      await expect(
        rewardsService.calculateRewards(
          testCompetitionId,
          testPrizePoolUsers,
          testPrizePoolCompetitors,
        ),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle database errors in allocate", async () => {
      // Arrange
      (getRewardsByCompetition as Mock).mockRejectedValue(
        new Error("Database query failed"),
      );

      // Act & Assert
      await expect(
        rewardsService.allocate(
          testCompetitionId,
          "0x1234567890123456789012345678901234567890" as Hex,
          1640995200,
        ),
      ).rejects.toThrow("Database query failed");
    });

    it("should handle RewardsAllocator errors", async () => {
      // Arrange
      const testRewards = [
        {
          id: "reward-1",
          competitionId: testCompetitionId,
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          amount: BigInt("100000000000000000000"),
          leafHash: new Uint8Array(32).fill(0x01),
        },
      ];
      (getRewardsByCompetition as Mock).mockResolvedValue(testRewards);
      (mockRewardsAllocator.allocate as Mock).mockRejectedValue(
        new Error("Blockchain transaction failed"),
      );

      // Act & Assert
      await expect(
        rewardsService.allocate(
          testCompetitionId,
          "0x1234567890123456789012345678901234567890" as Hex,
          1640995200,
        ),
      ).rejects.toThrow("Blockchain transaction failed");
    });
  });

  describe("integration with test-case.json data", () => {
    it("should calculate correct reward amounts for each participant based on test-case.json data", async () => {
      // Arrange - Use the exact data from test-case.json
      const testCaseData = {
        prizePool: "1000000000000000000000", // 1000 tokens
        leaderBoard: [
          { competitor: "Competitor A", rank: 1 },
          { competitor: "Competitor B", rank: 2 },
          { competitor: "Competitor C", rank: 3 },
        ],
        window: {
          start: "2024-01-01T00:00:00Z",
          end: "2024-01-05T00:00:00Z",
        },
        boostAllocations: [
          {
            user: "Alice",
            competitor: "Competitor A",
            boost: 100,
            timestamp: "2024-01-01T12:00:00Z",
          },
          {
            user: "Alice",
            competitor: "Competitor B",
            boost: 50,
            timestamp: "2024-01-02T18:00:00Z",
          },
          {
            user: "Alice",
            competitor: "Competitor C",
            boost: 75,
            timestamp: "2024-01-03T09:00:00Z",
          },
          {
            user: "Bob",
            competitor: "Competitor A",
            boost: 80,
            timestamp: "2024-01-01T15:00:00Z",
          },
          {
            user: "Bob",
            competitor: "Competitor A",
            boost: 40,
            timestamp: "2024-01-02T10:00:00Z",
          },
          {
            user: "Bob",
            competitor: "Competitor B",
            boost: 120,
            timestamp: "2024-01-01T20:00:00Z",
          },
          {
            user: "Bob",
            competitor: "Competitor C",
            boost: 60,
            timestamp: "2024-01-04T14:00:00Z",
          },
          {
            user: "Charlie",
            competitor: "Competitor B",
            boost: 90,
            timestamp: "2024-01-02T12:00:00Z",
          },
          {
            user: "Charlie",
            competitor: "Competitor C",
            boost: 200,
            timestamp: "2024-01-01T08:00:00Z",
          },
          {
            user: "Charlie",
            competitor: "Competitor C",
            boost: 30,
            timestamp: "2024-01-03T16:00:00Z",
          },
        ],
      };

      const competition = {
        id: testCompetitionId,
        status: "ended" as const,
        votingStartDate: new Date(testCaseData.window.start),
        votingEndDate: new Date(testCaseData.window.end),
      };

      const leaderboard = testCaseData.leaderBoard.map((entry, index) => ({
        competitor: entry.competitor,
        wallet: `0x${(index + 1).toString().padStart(40, "0")}`,
        rank: entry.rank,
      }));

      // Create user address mapping
      const userAddressMap = {
        Alice: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        Bob: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        Charlie: "0xcccccccccccccccccccccccccccccccccccccccc",
      };

      const boostSpendingData = testCaseData.boostAllocations.map(
        (allocation, index) => ({
          userId: `user-${index}`,
          wallet: hexToBytes(
            userAddressMap[
              allocation.user as keyof typeof userAddressMap
            ] as Hex,
          ),
          deltaAmount: BigInt(-allocation.boost), // Negative amount for spending (service will convert to positive)
          createdAt: new Date(allocation.timestamp),
          agentId: allocation.competitor,
        }),
      );

      (findById as Mock).mockResolvedValue(competition);
      (findLeaderboardByCompetitionWithWallets as Mock).mockResolvedValue(
        leaderboard.map((entry) => ({
          agentId: entry.competitor,
          userWalletAddress: entry.wallet,
          rank: entry.rank,
        })),
      );
      (mockBoostRepository.userBoostSpending as Mock).mockResolvedValue(
        boostSpendingData,
      );
      (insertRewards as Mock).mockResolvedValue([]);

      // Act
      await rewardsService.calculateRewards(
        testCompetitionId,
        BigInt(testCaseData.prizePool) / 2n, // Split between users and competitors
        BigInt(testCaseData.prizePool) / 2n,
      );

      // Assert
      expect(insertRewards).toHaveBeenCalled();
      const insertCall = (insertRewards as Mock).mock.calls[0]?.[0];

      // Should have rewards for both users and competitors
      expect(insertCall.length).toBeGreaterThan(0);

      // Verify reward structure
      insertCall.forEach(
        (reward: {
          competitionId: string;
          address: string;
          amount: bigint;
          leafHash: Uint8Array;
          id: string;
        }) => {
          expect(reward).toHaveProperty("competitionId", testCompetitionId);
          expect(reward).toHaveProperty("address");
          expect(reward).toHaveProperty("amount");
          expect(reward).toHaveProperty("leafHash");
          expect(reward).toHaveProperty("id");
          expect(typeof reward.address).toBe("string");
          expect(typeof reward.amount).toBe("bigint");
          expect(reward.amount).toBeGreaterThan(0n);
        },
      );

      // Expected values based on the rewards package tests
      // User rewards (from calculateRewardsForUsers with 500 ETH prize pool):
      const expectedUserRewards = {
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 147275669535943508546n, // Alice - Half of 294551339071887017092n
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": 197271906176015765056n, // Bob - Half of 394543812352031530113n
        "0xcccccccccccccccccccccccccccccccccccccccc": 65331928345626975763n, // Charlie - Half of 130663856691253951527n
      };

      // Competitor rewards (from calculateRewardsForCompetitors with 500 ETH prize pool):
      const expectedCompetitorRewards = {
        "0x0000000000000000000000000000000000000001": 285714285714285714285n, // Half of 571428571428571428571n
        "0x0000000000000000000000000000000000000002": 142857142857142857142n, // Half of 285714285714285714285n
        "0x0000000000000000000000000000000000000003": 71428571428571428571n, // Half of 142857142857142857142n
      };

      // Create a map of rewards by address for easier lookup
      const rewardsByAddress = new Map<string, bigint>();
      insertCall.forEach((reward: { address: string; amount: bigint }) => {
        const existing = rewardsByAddress.get(reward.address) || 0n;
        rewardsByAddress.set(reward.address, existing + reward.amount);
      });

      // Verify user rewards match expected values
      for (const [user, expectedAmount] of Object.entries(
        expectedUserRewards,
      )) {
        const actualAmount = rewardsByAddress.get(user);
        expect(actualAmount).toBeDefined();
        expect(actualAmount).toBe(expectedAmount);
      }

      // Verify competitor rewards match expected values
      for (const [wallet, expectedAmount] of Object.entries(
        expectedCompetitorRewards,
      )) {
        const actualAmount = rewardsByAddress.get(wallet);
        expect(actualAmount).toBeDefined();
        expect(actualAmount).toBe(expectedAmount);
      }

      // Verify total rewards don't exceed the prize pool
      const totalRewards = Array.from(rewardsByAddress.values()).reduce(
        (sum, amount) => sum + amount,
        0n,
      );
      expect(totalRewards).toBeLessThanOrEqual(BigInt(testCaseData.prizePool));

      // Verify we have the expected number of participants (3 users + 3 competitors = 6 total)
      expect(rewardsByAddress.size).toBe(6);
    });
  });
});
