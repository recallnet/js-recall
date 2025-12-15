import { Logger } from "pino";
import { encodePacked, keccak256 } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DeepMockProxy } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import type {
  SelectReward,
  SelectRewardsTree,
} from "@recallnet/db/schema/rewards/types";
import { Database } from "@recallnet/db/types";
import type { Leaderboard } from "@recallnet/rewards";
import {
  ExternallyOwnedAccountAllocator,
  NoopRewardsAllocator,
} from "@recallnet/staking-contracts";

import { RewardsService, createLeafNode } from "../rewards.service.js";

// Mock external dependencies
vi.mock("@recallnet/db/repositories/rewards");
vi.mock("@recallnet/db/repositories/boost");
vi.mock("@recallnet/db/repositories/competition");
vi.mock("@recallnet/db/repositories/agent");
// Note: The test provides its own in-memory RewardsAllocator mock instance,
// so there is no need to mock the staking-contracts module here.

describe("RewardsService", () => {
  let mockRewardsAllocator: DeepMockProxy<ExternallyOwnedAccountAllocator>;
  let mockRewardsRepo: DeepMockProxy<RewardsRepository>;
  let mockCompetitionRepository: DeepMockProxy<CompetitionRepository>;
  let mockBoostRepository: DeepMockProxy<BoostRepository>;
  let mockAgentRepo: DeepMockProxy<AgentRepository>;
  let mockDb: Database;
  let mockLogger: Logger;
  let mockTransaction: DeepMockProxy<{
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
  }>;

  // Helper function to create a mock competition object
  const createMockCompetition = (
    id: string,
    status: "ended" | "active" = "ended",
  ) => ({
    id,
    name: "Test Competition",
    description: "Test Description",
    type: "trading" as const,
    externalUrl: null,
    imageUrl: null,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-31"),
    boostStartDate: new Date("2024-01-01"),
    boostEndDate: new Date("2024-01-31"),
    joinStartDate: new Date("2024-01-01"),
    joinEndDate: new Date("2024-01-31"),
    maxParticipants: 100,
    registeredParticipants: 10,
    minimumStake: null,
    vips: null,
    allowlist: null,
    blocklist: null,
    minRecallRank: null,
    allowlistOnly: false,
    agentAllocation: null,
    agentAllocationUnit: null,
    boosterAllocation: null,
    boosterAllocationUnit: null,
    rewardRules: null,
    rewardDetails: null,
    status,
    sandboxMode: false,
    displayState: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    crossChainTradingType: "disallowAll" as const,
    evaluationMetric: "calmar_ratio" as const,
    arenaId: "default-paper-arena",
    engineId: "spot_paper_trading" as const,
    engineVersion: "1.0.0",
    rewardsIneligible: null,
    boostTimeDecayRate: null,
  });

  // Helper function to create a mock leaderboard entry
  const createMockLeaderboardEntry = (
    agentId: string,
    wallet: string,
    rank: number,
  ) => ({
    id: `leaderboard-${agentId}`,
    competitionId: "comp-123",
    createdAt: new Date("2024-01-01"),
    agentId,
    rank,
    totalAgents: 10,
    score: 1000 - rank * 100,
    userWalletAddress: wallet,
    ownerId: `owner-${agentId}`,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockRewardsRepo = {
      insertRewards: vi.fn().mockResolvedValue([]),
      getRewardsByCompetition: vi.fn().mockResolvedValue([]),
      getRewardsTreeByCompetition: vi.fn().mockResolvedValue([]),
    } as unknown as DeepMockProxy<RewardsRepository>;

    mockCompetitionRepository = {
      findById: vi.fn(),
      findLeaderboardByCompetitionWithWallets: vi.fn(),
      getCompetitionPrizePools: vi.fn(),
    } as unknown as DeepMockProxy<CompetitionRepository>;

    mockBoostRepository = {
      userBoostSpending: vi.fn().mockResolvedValue([]),
    } as unknown as DeepMockProxy<BoostRepository>;

    mockAgentRepo = {
      findByIds: vi.fn().mockResolvedValue([]),
      findByIdsWithLock: vi.fn().mockResolvedValue([]),
    } as unknown as DeepMockProxy<AgentRepository>;

    mockDb = {
      transaction: vi.fn(),
    } as unknown as Database;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;

    // Mock RewardsAllocator
    mockRewardsAllocator = {
      allocate: vi.fn().mockResolvedValue({
        transactionHash: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    } as unknown as DeepMockProxy<ExternallyOwnedAccountAllocator>;

    // Mock database transaction
    mockTransaction = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeepMockProxy<{
      insert: ReturnType<typeof vi.fn>;
      values: ReturnType<typeof vi.fn>;
    }>;

    mockDb.transaction = vi
      .fn()
      .mockImplementation(
        (callback: (tx: typeof mockTransaction) => Promise<void>) =>
          callback(mockTransaction),
      );
  });

  describe("Constructor", () => {
    it("should initialize with provided RewardsAllocator", () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      expect(service).toBeInstanceOf(RewardsService);
    });

    it("should initialize with allocator successfully", () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      expect(service).toBeInstanceOf(RewardsService);
    });
  });

  describe("calculateRewards", () => {
    const competitionId = "comp-123";
    const prizePoolUsers = 1000n;
    const prizePoolCompetitors = 2000n;

    it("should successfully calculate and insert rewards with real implementation", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      mockCompetitionRepository.findById.mockResolvedValue(
        createMockCompetition(competitionId),
      );
      mockCompetitionRepository.findLeaderboardByCompetitionWithWallets.mockResolvedValue(
        [
          createMockLeaderboardEntry(
            "agent-1",
            "0x1111111111111111111111111111111111111111",
            1,
          ),
        ],
      );

      await service.calculateRewards(
        competitionId,
        prizePoolUsers,
        prizePoolCompetitors,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
    });

    it("should handle database constraint violations during insertion", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      const dbError = new Error("UNIQUE constraint failed");
      mockRewardsRepo.insertRewards.mockRejectedValue(dbError);

      mockCompetitionRepository.findById.mockResolvedValue(
        createMockCompetition(competitionId),
      );
      mockCompetitionRepository.findLeaderboardByCompetitionWithWallets.mockResolvedValue(
        [
          createMockLeaderboardEntry(
            "agent-1",
            "0x1111111111111111111111111111111111111111",
            1,
          ),
        ],
      );

      await expect(
        service.calculateRewards(
          competitionId,
          prizePoolUsers,
          prizePoolCompetitors,
        ),
      ).rejects.toThrow("UNIQUE constraint failed");
    });

    it("should handle network timeout during calculation", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      const timeoutError = new Error("Request timeout");
      mockRewardsRepo.insertRewards.mockRejectedValue(timeoutError);

      mockCompetitionRepository.findById.mockResolvedValue(
        createMockCompetition(competitionId),
      );
      mockCompetitionRepository.findLeaderboardByCompetitionWithWallets.mockResolvedValue(
        [
          createMockLeaderboardEntry(
            "agent-1",
            "0x1111111111111111111111111111111111111111",
            1,
          ),
        ],
      );

      await expect(
        service.calculateRewards(
          competitionId,
          prizePoolUsers,
          prizePoolCompetitors,
        ),
      ).rejects.toThrow("Request timeout");
    });
  });

  describe("calculateAndAllocate", () => {
    const competitionId = "comp-123";
    const startTimestamp = 1640995200; // 2022-01-01

    it("should successfully calculate and allocate rewards with valid prize pool", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      // Mock prize pool data
      const mockPrizePool = {
        id: "prize-pool-123",
        competitionId: "comp-123",
        userPool: 1000n, // $1000 USD
        agentPool: 2000n, // $2000 USD
      };

      // Mock the required dependencies
      vi.mocked(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).mockResolvedValue(mockPrizePool);
      vi.mocked(mockRewardsRepo.insertRewards).mockResolvedValue([]);
      vi.mocked(mockCompetitionRepository.findById).mockResolvedValue(
        createMockCompetition(competitionId),
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue([
        createMockLeaderboardEntry(
          "agent-1",
          "0x1111111111111111111111111111111111111111",
          1,
        ),
      ]);

      // Mock rewards for allocation
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      await service.calculateAndAllocate(competitionId, startTimestamp);

      // Verify prize pool calculation and conversion
      expect(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).toHaveBeenCalledWith(competitionId);

      // Verify calculateRewards was called with converted amounts
      // userPool: $1000 / $0.50 = 2000 tokens * 10^18 = 2000000000000000000000n
      // agentPool: $2000 / $0.50 = 4000 tokens * 10^18 = 4000000000000000000000n
      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        100n, // total allocation amount
        startTimestamp,
      );
    });

    it("should throw error when no prize pool found", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      vi.mocked(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).mockResolvedValue(null);

      await expect(
        service.calculateAndAllocate(competitionId, startTimestamp),
      ).rejects.toThrow(`No prize pool found for competition ${competitionId}`);
    });

    it("should propagate errors from calculateRewards", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const mockPrizePool = {
        id: "prize-pool-123",
        competitionId: "comp-123",
        userPool: 1000n,
        agentPool: 2000n,
      };

      vi.mocked(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).mockResolvedValue(mockPrizePool);
      vi.mocked(mockCompetitionRepository.findById).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        service.calculateAndAllocate(competitionId, startTimestamp),
      ).rejects.toThrow("Database connection failed");
    });

    it("should propagate errors from allocate", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const mockPrizePool = {
        id: "prize-pool-123",
        competitionId: "comp-123",
        userPool: 1000n,
        agentPool: 2000n,
      };

      vi.mocked(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).mockResolvedValue(mockPrizePool);
      vi.mocked(mockRewardsRepo.insertRewards).mockResolvedValue([]);
      vi.mocked(mockCompetitionRepository.findById).mockResolvedValue(
        createMockCompetition(competitionId),
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue([
        createMockLeaderboardEntry(
          "agent-1",
          "0x1111111111111111111111111111111111111111",
          1,
        ),
      ]);

      // Mock allocate to fail
      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue([]);

      await expect(
        service.calculateAndAllocate(competitionId, startTimestamp),
      ).rejects.toThrow("no rewards to allocate");
    });

    it("should handle large prize pool amounts correctly", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const mockPrizePool = {
        id: "prize-pool-123",
        competitionId: "comp-123",
        userPool: 1000000n, // $1M USD
        agentPool: 2000000n, // $2M USD
      };

      vi.mocked(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).mockResolvedValue(mockPrizePool);
      vi.mocked(mockRewardsRepo.insertRewards).mockResolvedValue([]);
      vi.mocked(mockCompetitionRepository.findById).mockResolvedValue(
        createMockCompetition(competitionId),
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue([
        createMockLeaderboardEntry(
          "agent-1",
          "0x1111111111111111111111111111111111111111",
          1,
        ),
      ]);

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: BigInt("1000000000000000000000000"), // 1M tokens
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      await service.calculateAndAllocate(competitionId, startTimestamp);

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        BigInt("1000000000000000000000000"),
        startTimestamp,
      );
    });

    it("should handle decimal precision correctly in prize pool conversion", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const mockPrizePool = {
        id: "prize-pool-123",
        competitionId: "comp-123",
        userPool: 1000n, // $1000 USD (rounded down)
        agentPool: 2000n, // $2000 USD (rounded down)
      };

      vi.mocked(
        mockCompetitionRepository.getCompetitionPrizePools,
      ).mockResolvedValue(mockPrizePool);
      vi.mocked(mockRewardsRepo.insertRewards).mockResolvedValue([]);
      vi.mocked(mockCompetitionRepository.findById).mockResolvedValue(
        createMockCompetition(competitionId),
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue([
        createMockLeaderboardEntry(
          "agent-1",
          "0x1111111111111111111111111111111111111111",
          1,
        ),
      ]);

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      await service.calculateAndAllocate(competitionId, startTimestamp);

      // Should handle decimal precision and round down as specified in the code
      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      expect(mockRewardsAllocator.allocate).toHaveBeenCalled();
    });
  });

  describe("allocate", () => {
    const competitionId = "comp-123";
    const startTimestamp = 1640995200; // 2022-01-01

    it("should successfully allocate rewards", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          userId: "user-2",
          agentId: "agent-2",
          walletAddress: "0x2222222222222222222222222222222222222222",
          amount: 200n,
          leafHash: Buffer.from("hash2"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      await service.allocate(competitionId, startTimestamp);

      // Verify blockchain allocation was called with correct parameters
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String), // rootHash
        300n, // total allocation amount
        startTimestamp,
      );

      // Verify database transaction was executed
      expect(mockDb.transaction).toHaveBeenCalledOnce();
      expect(mockTransaction.insert).toHaveBeenCalledTimes(2); // tree nodes and root
    });

    it("should throw error when no rewards exist", async () => {
      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue([]);

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      await expect(
        service.allocate(competitionId, startTimestamp),
      ).rejects.toThrow("no rewards to allocate");
    });

    it("should calculate correct allocation amount", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 150n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          userId: "user-2",
          agentId: "agent-2",
          walletAddress: "0x2222222222222222222222222222222222222222",
          amount: 350n,
          leafHash: Buffer.from("hash2"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      await service.allocate(competitionId, startTimestamp);

      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        500n, // 150 + 350
        startTimestamp,
      );
    });

    it("should handle blockchain allocation failure and rollback database transaction", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const blockchainError = new Error("Blockchain transaction failed");
      mockRewardsAllocator.allocate.mockRejectedValue(blockchainError);

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      await expect(
        service.allocate(competitionId, startTimestamp),
      ).rejects.toThrow("Blockchain transaction failed");

      // Verify transaction rollback - database operations should not have been called
      expect(mockTransaction.insert).not.toHaveBeenCalled();
    });

    it("should maintain transaction integrity when database operations fail", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      // Mock database transaction to fail after blockchain success
      const dbError = new Error("Database constraint violation");
      mockTransaction.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(dbError),
      });

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      await expect(
        service.allocate(competitionId, startTimestamp),
      ).rejects.toThrow("Database constraint violation");

      // Blockchain call should have been made but the transaction should rollback
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledOnce();
    });

    it("should verify merkle tree construction with correct faux leaf", async () => {
      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from(
            createLeafNode(
              "0x1111111111111111111111111111111111111111" as `0x${string}`,
              100n,
            ).slice(2),
            "hex",
          ),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      await service.allocate(competitionId, startTimestamp);

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

      // Convert hex string to Uint8Array for proper comparison
      const leafHashBytes = new Uint8Array(
        Buffer.from(leafHash.slice(2), "hex"),
      );

      // Calculate parent hash using proper byte arrays
      const parentHashBytes = keccak256(
        Buffer.concat(
          [Buffer.from(siblingHash), Buffer.from(leafHashBytes)].sort(
            Buffer.compare,
          ),
        ),
      );

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
          hash: leafHashBytes, // our target leaf at position 1
          createdAt: new Date(),
        },
        {
          id: "node-3",
          competitionId,
          level: 1,
          idx: 0,
          hash: new Uint8Array(Buffer.from(parentHashBytes.slice(2), "hex")),
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsTreeByCompetition).mockResolvedValue(
        mockTree,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      const proof = await service.retrieveProof(competitionId, address, amount);

      expect(proof).toBeInstanceOf(Array);
      expect(proof.length).toBe(1); // Should have one sibling proof
      expect(proof[0]).toEqual(siblingHash); // Should contain the sibling hash

      // Verify proof can reconstruct to the parent node
      const reconstructedParent = keccak256(
        Buffer.concat(
          [Buffer.from(siblingHash), Buffer.from(leafHashBytes)].sort(
            Buffer.compare,
          ),
        ),
      );
      expect(
        new Uint8Array(Buffer.from(reconstructedParent.slice(2), "hex")),
      ).toEqual(mockTree[2]?.hash);
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

      vi.mocked(mockRewardsRepo.getRewardsTreeByCompetition).mockResolvedValue(
        mockTree,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      await expect(
        service.retrieveProof(competitionId, address, amount),
      ).rejects.toThrow(
        `No proof found for reward (address: ${address}, amount: ${amount}) in competition ${competitionId}`,
      );
    });

    it("should handle database errors during proof retrieval", async () => {
      const error = new Error("Database connection failed");
      vi.mocked(mockRewardsRepo.getRewardsTreeByCompetition).mockRejectedValue(
        error,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

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
      const startTimestamp = 1640995200;
      const largeAmount = BigInt("999999999999999999999999999999999999999");

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: largeAmount,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "reward-2",
          competitionId,
          userId: "user-2",
          agentId: "agent-2",
          walletAddress: "0x2222222222222222222222222222222222222222",
          amount: 1n,
          leafHash: Buffer.from("hash2"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      await service.allocate(competitionId, startTimestamp);

      // Verify correct total calculation with large numbers
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        largeAmount + 1n, // Exact sum
        startTimestamp,
      );
    });

    it("should handle zero amount rewards properly", async () => {
      const competitionId = "comp-123";
      const startTimestamp = 1640995200;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
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

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      await service.allocate(competitionId, startTimestamp);

      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
        0n,
        startTimestamp,
      );
    });

    it("should handle duplicate addresses with different amounts", async () => {
      const competitionId = "comp-123";
      const startTimestamp = 1640995200;
      const duplicateAddress =
        "0x1111111111111111111111111111111111111111" as `0x${string}`;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: duplicateAddress.toLowerCase(),
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
          userId: "user-2",
          agentId: "agent-2",
          walletAddress: duplicateAddress.toLowerCase(),
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

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      await service.allocate(competitionId, startTimestamp);

      // Verify both rewards are counted in total
      expect(mockRewardsAllocator.allocate).toHaveBeenCalledWith(
        expect.any(String),
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

      vi.mocked(mockRewardsRepo.getRewardsTreeByCompetition).mockResolvedValue(
        mockTree,
      );

      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      await expect(
        service.retrieveProof(competitionId, address, amount),
      ).rejects.toThrow(
        `No proof found for reward (address: ${address}, amount: ${amount}) in competition ${competitionId}`,
      );
    });

    it("should proceed with off-chain allocation when allocator is noop", async () => {
      const competitionId = "comp-123";
      const startTimestamp = 1640995200;

      const mockRewards: SelectReward[] = [
        {
          id: "reward-1",
          competitionId,
          userId: "user-1",
          agentId: "agent-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          amount: 100n,
          leafHash: Buffer.from("hash1"),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRewardsRepo.getRewardsByCompetition).mockResolvedValue(
        mockRewards,
      );

      // Create service with null allocator
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        new NoopRewardsAllocator(),
        mockDb,
        mockLogger,
      );

      await service.allocate(competitionId, startTimestamp);

      // Should not call blockchain allocator
      expect(mockRewardsAllocator.allocate).not.toHaveBeenCalled();

      // Verify database inserts occurred
      expect(mockDb.transaction).toHaveBeenCalledOnce();

      // Second values() call should insert root with tx set to '0x0000000000000000000000000000000000000000'
      const valuesCalls = mockTransaction.values.mock.calls;
      expect(valuesCalls.length).toBeGreaterThanOrEqual(2);
      const rootInsertArgs = valuesCalls[valuesCalls.length - 1]?.[0];
      expect(rootInsertArgs).toBeDefined();
      expect(rootInsertArgs.tx).toBeNull();
    });
  });

  describe("Integration tests with comprehensive test data", () => {
    // Test data based on test-case.json
    const testCompetitionId = "test-competition-id";
    const testPrizePoolUsers = BigInt("500000000000000000000"); // 500 tokens
    const testPrizePoolCompetitors = BigInt("500000000000000000000"); // 500 tokens

    const testCompetition = createMockCompetition(testCompetitionId);

    const testLeaderboard: Leaderboard = [
      {
        owner: "owner-1",
        competitor: "Competitor A",
        wallet: "0x1111111111111111111111111111111111111111",
        rank: 1,
      },
      {
        owner: "owner-2",
        competitor: "Competitor B",
        wallet: "0x2222222222222222222222222222222222222222",
        rank: 2,
      },
      {
        owner: "owner-3",
        competitor: "Competitor C",
        wallet: "0x3333333333333333333333333333333333333333",
        rank: 3,
      },
    ];

    const testBoostSpendingData = [
      {
        userId: "user-1",
        wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        deltaAmount: BigInt(-100),
        createdAt: new Date("2024-01-01T12:00:00Z"),
        agentId: "Competitor A",
      },
      {
        userId: "user-1",
        wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        deltaAmount: BigInt(-50),
        createdAt: new Date("2024-01-02T18:00:00Z"),
        agentId: "Competitor B",
      },
      {
        userId: "user-2",
        wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        deltaAmount: BigInt(-80),
        createdAt: new Date("2024-01-01T15:00:00Z"),
        agentId: "Competitor A",
      },
      {
        userId: "user-2",
        wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        deltaAmount: BigInt(-120),
        createdAt: new Date("2024-01-01T20:00:00Z"),
        agentId: "Competitor B",
      },
      {
        userId: "user-3",
        wallet: "0xcccccccccccccccccccccccccccccccccccccccc",
        deltaAmount: BigInt(-200),
        createdAt: new Date("2024-01-01T08:00:00Z"),
        agentId: "Competitor C",
      },
    ];

    it("should calculate rewards successfully with comprehensive test data", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      // Mock the required dependencies
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      mockCompetitionRepository.findById.mockResolvedValue(testCompetition);
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue(
        testLeaderboard.map((entry: Leaderboard[0]) =>
          createMockLeaderboardEntry(
            entry.competitor,
            entry.wallet,
            entry.rank,
          ),
        ),
      );
      mockBoostRepository.userBoostSpending.mockResolvedValue(
        testBoostSpendingData,
      );

      await service.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];
      expect(insertCall).toBeDefined();
      expect(insertCall?.length).toBeGreaterThan(0);

      // Each reward should have the required fields
      insertCall?.forEach((reward) => {
        expect(reward).toHaveProperty("competitionId", testCompetitionId);
        expect(reward).toHaveProperty("address");
        expect(reward).toHaveProperty("amount");
        expect(reward).toHaveProperty("leafHash");
        expect(reward).toHaveProperty("id");
        expect(typeof reward.amount).toBe("bigint");
        expect(reward.amount).toBeGreaterThan(0n);
      });
    });

    it("should handle comprehensive test-case.json data correctly", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      // Test data from test-case.json
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

      const competition = createMockCompetition(testCompetitionId);

      const leaderboard = testCaseData.leaderBoard.map((entry, index) => ({
        owner: `owner-${index + 1}`,
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
          wallet:
            userAddressMap[
              allocation.user as keyof typeof userAddressMap
            ]?.toLowerCase() ?? null,
          deltaAmount: BigInt(-allocation.boost), // Negative amount for spending
          createdAt: new Date(allocation.timestamp),
          agentId: allocation.competitor,
        }),
      );

      mockCompetitionRepository.findById.mockResolvedValue(competition);
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue(
        leaderboard.map((entry) =>
          createMockLeaderboardEntry(
            entry.competitor,
            entry.wallet,
            entry.rank,
          ),
        ),
      );
      mockBoostRepository.userBoostSpending.mockResolvedValue(
        boostSpendingData,
      );
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards(
        testCompetitionId,
        BigInt(testCaseData.prizePool) / 2n, // Split between users and competitors
        BigInt(testCaseData.prizePool) / 2n,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];

      // Should have rewards for both users and competitors
      expect(insertCall?.length).toBeGreaterThan(0);

      // Verify reward structure
      insertCall?.forEach((reward) => {
        expect(reward).toHaveProperty("competitionId", testCompetitionId);
        expect(reward).toHaveProperty("address");
        expect(reward).toHaveProperty("amount");
        expect(reward).toHaveProperty("leafHash");
        expect(reward).toHaveProperty("id");
        expect(typeof reward.amount).toBe("bigint");
        expect(reward.amount).toBeGreaterThan(0n);
      });

      // Verify total rewards don't exceed the prize pool
      const totalRewards =
        insertCall?.reduce((sum: bigint, reward) => sum + reward.amount, 0n) ||
        0n;
      expect(totalRewards).toBeLessThanOrEqual(BigInt(testCaseData.prizePool));
    });

    it("should exclude ineligible agents from competitor rewards", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      // Create competition with excluded agents
      const competitionWithExclusions = {
        ...createMockCompetition(testCompetitionId),
        rewardsIneligible: ["Competitor B"], // Exclude agent B
      };

      const leaderboardWithExcluded: Leaderboard = [
        {
          owner: "owner-1",
          competitor: "Competitor A",
          wallet: "0x1111111111111111111111111111111111111111",
          rank: 1,
        },
        {
          owner: "owner-2",
          competitor: "Competitor B", // This one is excluded
          wallet: "0x2222222222222222222222222222222222222222",
          rank: 2,
        },
        {
          owner: "owner-3",
          competitor: "Competitor C",
          wallet: "0x3333333333333333333333333333333333333333",
          rank: 3,
        },
      ];

      mockCompetitionRepository.findById.mockResolvedValue(
        competitionWithExclusions,
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue(
        leaderboardWithExcluded.map((entry) =>
          createMockLeaderboardEntry(
            entry.competitor,
            entry.wallet,
            entry.rank,
          ),
        ),
      );
      mockBoostRepository.userBoostSpending.mockResolvedValue([]);
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];

      // Verify Competitor B (excluded) does not receive rewards
      const competitorBReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor B",
      );
      expect(competitorBReward).toBeUndefined();

      // Verify Competitor A and C still receive rewards
      const competitorAReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor A",
      );
      const competitorCReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor C",
      );
      expect(competitorAReward).toBeDefined();
      expect(competitorCReward).toBeDefined();
    });

    it("should handle empty exclusion list (backward compatible)", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const competitionNoExclusions = {
        ...createMockCompetition(testCompetitionId),
        rewardsIneligible: [], // Empty array
      };

      mockCompetitionRepository.findById.mockResolvedValue(
        competitionNoExclusions,
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue([
        createMockLeaderboardEntry(
          "agent-1",
          "0x1111111111111111111111111111111111111111",
          1,
        ),
      ]);
      mockBoostRepository.userBoostSpending.mockResolvedValue([]);
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      // Should insert rewards normally (no exclusions)
      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];
      expect(insertCall?.length).toBeGreaterThan(0);
    });

    it("should exclude globally ineligible agents from rewards", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const competitionNoExclusions = {
        ...createMockCompetition(testCompetitionId),
        rewardsIneligible: null, // No competition-specific exclusions
      };

      const leaderboard: Leaderboard = [
        {
          owner: "owner-1",
          competitor: "Competitor A",
          wallet: "0x1111111111111111111111111111111111111111",
          rank: 1,
        },
        {
          owner: "owner-2",
          competitor: "Competitor B", // This one is globally ineligible
          wallet: "0x2222222222222222222222222222222222222222",
          rank: 2,
        },
        {
          owner: "owner-3",
          competitor: "Competitor C",
          wallet: "0x3333333333333333333333333333333333333333",
          rank: 3,
        },
      ];

      // Mock agents with Competitor B marked as globally ineligible
      mockAgentRepo.findByIdsWithLock.mockResolvedValue([
        {
          id: "Competitor A",
          ownerId: "owner-1",
          name: "Agent A",
          handle: "agent-a",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-a",
          apiKeyHash: "hash-a",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: false, // Eligible
          rewardsIneligibilityReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "Competitor B",
          ownerId: "owner-2",
          name: "Agent B",
          handle: "agent-b",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-b",
          apiKeyHash: "hash-b",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: true, // Globally ineligible
          rewardsIneligibilityReason: "Test agent",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "Competitor C",
          ownerId: "owner-3",
          name: "Agent C",
          handle: "agent-c",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-c",
          apiKeyHash: "hash-c",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: false, // Eligible
          rewardsIneligibilityReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockCompetitionRepository.findById.mockResolvedValue(
        competitionNoExclusions,
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue(
        leaderboard.map((entry) =>
          createMockLeaderboardEntry(
            entry.competitor,
            entry.wallet,
            entry.rank,
          ),
        ),
      );
      mockBoostRepository.userBoostSpending.mockResolvedValue([]);
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];

      // Verify Competitor B (globally ineligible) does not receive rewards
      const competitorBReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor B",
      );
      expect(competitorBReward).toBeUndefined();

      // Verify Competitor A and C still receive rewards
      const competitorAReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor A",
      );
      const competitorCReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor C",
      );
      expect(competitorAReward).toBeDefined();
      expect(competitorCReward).toBeDefined();
    });

    it("should combine competition-specific and global exclusions", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const competitionWithExclusions = {
        ...createMockCompetition(testCompetitionId),
        rewardsIneligible: ["Competitor B"], // Competition-specific exclusion
      };

      const leaderboard: Leaderboard = [
        {
          owner: "owner-1",
          competitor: "Competitor A",
          wallet: "0x1111111111111111111111111111111111111111",
          rank: 1,
        },
        {
          owner: "owner-2",
          competitor: "Competitor B", // Competition-specific exclusion
          wallet: "0x2222222222222222222222222222222222222222",
          rank: 2,
        },
        {
          owner: "owner-3",
          competitor: "Competitor C", // Globally ineligible
          wallet: "0x3333333333333333333333333333333333333333",
          rank: 3,
        },
        {
          owner: "owner-4",
          competitor: "Competitor D",
          wallet: "0x4444444444444444444444444444444444444444",
          rank: 4,
        },
      ];

      // Mock agents with Competitor C marked as globally ineligible
      mockAgentRepo.findByIdsWithLock.mockResolvedValue([
        {
          id: "Competitor A",
          ownerId: "owner-1",
          name: "Agent A",
          handle: "agent-a",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-a",
          apiKeyHash: "hash-a",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: false,
          rewardsIneligibilityReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "Competitor B",
          ownerId: "owner-2",
          name: "Agent B",
          handle: "agent-b",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-b",
          apiKeyHash: "hash-b",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: false,
          rewardsIneligibilityReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "Competitor C",
          ownerId: "owner-3",
          name: "Agent C",
          handle: "agent-c",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-c",
          apiKeyHash: "hash-c",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: true, // Globally ineligible
          rewardsIneligibilityReason: "Test agent",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "Competitor D",
          ownerId: "owner-4",
          name: "Agent D",
          handle: "agent-d",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-d",
          apiKeyHash: "hash-d",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: false,
          rewardsIneligibilityReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockCompetitionRepository.findById.mockResolvedValue(
        competitionWithExclusions,
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue(
        leaderboard.map((entry) =>
          createMockLeaderboardEntry(
            entry.competitor,
            entry.wallet,
            entry.rank,
          ),
        ),
      );
      mockBoostRepository.userBoostSpending.mockResolvedValue([]);
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];

      // Verify both Competitor B (competition exclusion) and C (global) are excluded
      const competitorBReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor B",
      );
      const competitorCReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor C",
      );
      expect(competitorBReward).toBeUndefined();
      expect(competitorCReward).toBeUndefined();

      // Verify Competitor A and D still receive rewards
      const competitorAReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor A",
      );
      const competitorDReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor D",
      );
      expect(competitorAReward).toBeDefined();
      expect(competitorDReward).toBeDefined();
    });

    it("should handle agent in both exclusion lists (deduplication)", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );

      const competitionWithExclusions = {
        ...createMockCompetition(testCompetitionId),
        rewardsIneligible: ["Competitor B"], // Also in competition list
      };

      const leaderboard: Leaderboard = [
        {
          owner: "owner-1",
          competitor: "Competitor A",
          wallet: "0x1111111111111111111111111111111111111111",
          rank: 1,
        },
        {
          owner: "owner-2",
          competitor: "Competitor B", // In BOTH lists
          wallet: "0x2222222222222222222222222222222222222222",
          rank: 2,
        },
      ];

      // Mock Competitor B as globally ineligible (also in competition list)
      mockAgentRepo.findByIds.mockResolvedValue([
        {
          id: "Competitor A",
          ownerId: "owner-1",
          name: "Agent A",
          handle: "agent-a",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-a",
          apiKeyHash: "hash-a",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: false,
          rewardsIneligibilityReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "Competitor B",
          ownerId: "owner-2",
          name: "Agent B",
          handle: "agent-b",
          email: null,
          description: null,
          imageUrl: null,
          apiKey: "key-b",
          apiKeyHash: "hash-b",
          metadata: null,
          status: "active",
          walletAddress: null,
          deactivationReason: null,
          deactivationDate: null,
          isRewardsIneligible: true, // Globally ineligible
          rewardsIneligibilityReason: "Test agent",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockCompetitionRepository.findById.mockResolvedValue(
        competitionWithExclusions,
      );
      vi.mocked(
        mockCompetitionRepository.findLeaderboardByCompetitionWithWallets,
      ).mockResolvedValue(
        leaderboard.map((entry) =>
          createMockLeaderboardEntry(
            entry.competitor,
            entry.wallet,
            entry.rank,
          ),
        ),
      );
      mockBoostRepository.userBoostSpending.mockResolvedValue([]);
      mockRewardsRepo.insertRewards.mockResolvedValue([]);

      await service.calculateRewards(
        testCompetitionId,
        testPrizePoolUsers,
        testPrizePoolCompetitors,
      );

      expect(mockRewardsRepo.insertRewards).toHaveBeenCalled();
      const insertCall = mockRewardsRepo.insertRewards.mock.calls[0]?.[0];

      // Verify Competitor B is excluded (appears in both lists, but should only be filtered once)
      const competitorBReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor B",
      );
      expect(competitorBReward).toBeUndefined();

      // Verify Competitor A still receives rewards
      const competitorAReward = insertCall?.find(
        (reward) => reward.agentId === "Competitor A",
      );
      expect(competitorAReward).toBeDefined();
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle database errors in calculateRewards", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      mockCompetitionRepository.findById.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        service.calculateRewards("test-id", 1000n, 2000n),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle database errors in allocate", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      mockRewardsRepo.getRewardsByCompetition.mockRejectedValue(
        new Error("Database query failed"),
      );

      await expect(service.allocate("test-id", 1640995200)).rejects.toThrow(
        "Database query failed",
      );
    });

    it("should handle RewardsAllocator errors", async () => {
      const service = new RewardsService(
        mockRewardsRepo,
        mockCompetitionRepository,
        mockBoostRepository,
        mockAgentRepo,
        mockRewardsAllocator,
        mockDb,
        mockLogger,
      );
      const testRewards = [
        {
          id: "reward-1",
          competitionId: "test-id",
          userId: "user-1",
          agentId: "agent-1",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          amount: BigInt("100000000000000000000"),
          leafHash: new Uint8Array(32).fill(0x01),
          claimed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRewardsRepo.getRewardsByCompetition.mockResolvedValue(testRewards);
      mockRewardsAllocator.allocate.mockRejectedValue(
        new Error("Blockchain transaction failed"),
      );

      await expect(service.allocate("test-id", 1640995200)).rejects.toThrow(
        "Blockchain transaction failed",
      );
    });
  });
});
