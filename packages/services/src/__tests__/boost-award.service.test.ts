import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { type BoostRepository } from "@recallnet/db/repositories/boost";
import { type CompetitionRepository } from "@recallnet/db/repositories/competition";
import { type StakesRepository } from "@recallnet/db/repositories/stakes";
import { SelectCompetition, SelectUser } from "@recallnet/db/schema/core/types";
import { Database, Transaction } from "@recallnet/db/types";

import { BoostAwardService } from "../boost-award.service.js";
import { type UserService } from "../user.service.js";

describe("BoostAwardService", () => {
  let mockDb: MockProxy<Database>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockBoostRepo: MockProxy<BoostRepository>;
  let mockStakesRepo: MockProxy<StakesRepository>;
  let mockUserService: MockProxy<UserService>;
  let service: BoostAwardService;
  let testUserId: string;
  let testWallet: string;

  const noStakeBoostAmount = 1000000000000000000n; // 1 ETH in wei

  // Helper function to create mock competition
  const createMockCompetition = (
    id: string,
    name: string = "Test Competition",
  ): SelectCompetition => ({
    id,
    name,
    description: "Test description",
    type: "trading" as const,
    externalUrl: null,
    imageUrl: null,
    startDate: new Date(),
    endDate: null,
    boostStartDate: new Date(),
    boostEndDate: null,
    joinStartDate: new Date(),
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    status: "active",
    sandboxMode: false,
    createdAt: new Date(),
    updatedAt: null,
    minimumStake: null,
    engineId: "spot_paper_trading",
    engineVersion: "1.0.0",
    engineConfig: {
      params: {
        crossChainTradingType: "disallowAll",
        tradingConstraints: {
          minimumPairAgeHours: 24,
          minimum24hVolumeUsd: 50000,
          minimumLiquidityUsd: 25000,
          minimumFdvUsd: 100000,
        },
      },
    },
  });

  beforeEach(() => {
    mockDb = mock<Database>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockBoostRepo = mock<BoostRepository>();
    mockStakesRepo = mock<StakesRepository>();
    mockUserService = mock<UserService>();

    service = new BoostAwardService(
      mockDb,
      mockCompetitionRepo,
      mockBoostRepo,
      mockStakesRepo,
      mockUserService,
      { boost: { noStakeBoostAmount } },
    );

    testUserId = "user-1";
    testWallet = "0x1234567890123456789012345678901234567890";
  });

  afterEach(() => {
    mockReset(mockDb);
    mockReset(mockCompetitionRepo);
    mockReset(mockBoostRepo);
    mockReset(mockStakesRepo);
    mockReset(mockUserService);
  });

  describe("initNoStake", () => {
    it("returns empty array when no boosting competitions are open", async () => {
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([]);

      const result = await service.initNoStake(testUserId, testWallet);

      expect(result).toEqual([]);
      expect(mockCompetitionRepo.findOpenForBoosting).toHaveBeenCalledWith(
        "mock-tx",
      );
    });

    it("awards boost for each open boosting competition", async () => {
      const competition = createMockCompetition("comp-1");
      const balanceAfter = noStakeBoostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-123",
        balanceAfter,
        idemKey,
      });

      const result = await service.initNoStake(testUserId, testWallet);

      expect(result).toEqual([
        {
          type: "applied",
          changeId: "change-123",
          balanceAfter,
          idemKey,
          competitionId: "comp-1",
        },
      ]);
      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        {
          userId: testUserId,
          wallet: testWallet,
          competitionId: "comp-1",
          amount: noStakeBoostAmount,
          meta: {
            description: `Voluntary award of ${noStakeBoostAmount}`,
          },
          idemKey: expect.any(Uint8Array),
        },
        "mock-tx",
      );
    });

    it("handles boost increase result with noop type", async () => {
      const competition = createMockCompetition("comp-1");
      const balance = 750000000000000000n;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockBoostRepo.increase.mockResolvedValue({
        type: "noop",
        balance,
        idemKey,
      });

      const result = await service.initNoStake(testUserId, testWallet);

      expect(result).toEqual([
        {
          type: "noop",
          balance,
          idemKey,
          competitionId: "comp-1",
        },
      ]);
    });

    it("handles multiple competitions", async () => {
      const competitions = [
        createMockCompetition("comp-1", "Competition 1"),
        createMockCompetition("comp-2", "Competition 2"),
      ];
      const balanceAfter = noStakeBoostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue(competitions);

      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-456",
        balanceAfter,
        idemKey,
      });

      const result = await service.initNoStake(testUserId, testWallet);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          type: "applied",
          changeId: "change-456",
          balanceAfter,
          idemKey,
          competitionId: "comp-1",
        },
        {
          type: "applied",
          changeId: "change-456",
          balanceAfter,
          idemKey,
          competitionId: "comp-2",
        },
      ]);

      expect(mockBoostRepo.increase).toHaveBeenCalledTimes(2);
    });

    it("runs within a database transaction", async () => {
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([]);

      await service.initNoStake(testUserId, testWallet);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(typeof mockDb.transaction.mock.calls![0]![0]).toBe("function");
    });

    it("propagates database transaction errors", async () => {
      const error = new Error("Database transaction failed");
      mockDb.transaction.mockRejectedValue(error);

      await expect(service.initNoStake(testUserId, testWallet)).rejects.toThrow(
        "Database transaction failed",
      );
    });

    it("propagates repository errors within transaction", async () => {
      const error = new Error("Competition repository error");
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockRejectedValue(error);

      await expect(service.initNoStake(testUserId, testWallet)).rejects.toThrow(
        "Competition repository error",
      );
    });

    it("works when passed an external transaction", async () => {
      const competition = createMockCompetition("comp-1");
      const balanceAfter = noStakeBoostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      // Mock the external transaction to have a transaction method
      const mockExternalTx = mock<Transaction>();
      mockExternalTx.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("nested-tx" as unknown as Transaction),
      );

      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-123",
        balanceAfter,
        idemKey,
      });

      const result = await service.initNoStake(
        testUserId,
        testWallet,
        mockExternalTx,
      );

      expect(result).toHaveLength(1);
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockExternalTx.transaction).toHaveBeenCalledTimes(1);
    });

    it("generates proper idempotency keys", async () => {
      const competition = createMockCompetition("comp-1");
      const balanceAfter = noStakeBoostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-123",
        balanceAfter,
        idemKey,
      });

      await service.initNoStake(testUserId, testWallet);

      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        expect.objectContaining({
          idemKey: expect.any(Uint8Array),
        }),
        "mock-tx",
      );

      const callArgs = mockBoostRepo.increase.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      const idemKeyString = new TextDecoder().decode(callArgs!.idemKey);
      expect(idemKeyString).toContain("competition=comp-1");
      expect(idemKeyString).toContain("reason=initNoStake");
    });
  });

  describe("initForStake", () => {
    // Helper function to create mock stake
    const createMockStake = (
      id: bigint,
      amount: bigint,
      stakedAt: Date = new Date("2024-01-01"),
      canUnstakeAfter: Date = new Date("2024-01-02"),
    ) => ({
      id,
      wallet: new Uint8Array(20), // 20-byte EVM address
      amount,
      stakedAt,
      canUnstakeAfter,
      unstakedAt: null,
      canWithdrawAfter: null,
      withdrawnAt: null,
      relockedAt: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    // Helper function to create mock user
    const createMockUser = (id: string = testUserId): SelectUser => ({
      id,
      name: null,
      walletAddress: testWallet,
      walletLastVerifiedAt: null,
      embeddedWalletAddress: null,
      privyId: "privy-123",
      email: "test@example.com",
      isSubscribed: false,
      imageUrl: null,
      metadata: null,
      status: "active",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      lastLoginAt: null,
    });

    it("returns empty array when no stakes exist for wallet", async () => {
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([]);

      const result = await service.initForStake(testWallet);

      expect(result).toEqual([]);
      expect(mockStakesRepo.allStakedByWallet).toHaveBeenCalledWith(
        testWallet,
        "mock-tx",
      );
      expect(mockCompetitionRepo.findOpenForBoosting).not.toHaveBeenCalled();
    });

    it("returns empty array when no boosting competitions are open", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([]);

      const result = await service.initForStake(testWallet);

      expect(result).toEqual([]);
      expect(mockStakesRepo.allStakedByWallet).toHaveBeenCalledWith(
        testWallet,
        "mock-tx",
      );
      expect(mockCompetitionRepo.findOpenForBoosting).toHaveBeenCalledWith(
        "mock-tx",
      );
    });

    it("awards boosts for each stake-competition combination", async () => {
      const stake1 = createMockStake(1n, 1000000000000000000n);
      const stake2 = createMockStake(2n, 2000000000000000000n);
      const competition1 = createMockCompetition("comp-1", "Competition 1");
      competition1.boostStartDate = new Date("2024-01-15");
      competition1.boostEndDate = new Date("2024-01-30");

      const competition2 = createMockCompetition("comp-2", "Competition 2");
      competition2.boostStartDate = new Date("2024-02-01");
      competition2.boostEndDate = new Date("2024-02-15");

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-123",
        balanceAfter: 500000000000000000n,
        idemKey: new Uint8Array([1, 2, 3, 4]),
      };

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake1, stake2]);
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([
        competition1,
        competition2,
      ]);
      // Mock user service to return a user
      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.initForStake(testWallet);

      expect(result).toHaveLength(4); // 2 stakes × 2 competitions
      expect(result).toEqual([
        {
          ...mockBoostResult,
          competitionId: "comp-1",
          stakeId: 1n,
        },
        {
          ...mockBoostResult,
          competitionId: "comp-1",
          stakeId: 2n,
        },
        {
          ...mockBoostResult,
          competitionId: "comp-2",
          stakeId: 1n,
        },
        {
          ...mockBoostResult,
          competitionId: "comp-2",
          stakeId: 2n,
        },
      ]);

      expect(mockBoostRepo.increase).toHaveBeenCalledTimes(4);
    });

    it("throws error when competition missing boosting dates", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);
      const competition = createMockCompetition("comp-1");
      competition.boostStartDate = null; // Missing boosting start date

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);

      await expect(service.initForStake(testWallet)).rejects.toThrow(
        "Competition missing boosting dates",
      );
    });

    it("calls awardForStake with correct parameters", async () => {
      const stake = createMockStake(
        1n,
        1000000000000000000n,
        new Date("2024-01-01"),
        new Date("2024-01-02"),
      );
      const competition = createMockCompetition("comp-1");
      competition.boostStartDate = new Date("2024-01-15");
      competition.boostEndDate = new Date("2024-01-30");

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-123",
        balanceAfter: 500000000000000000n,
        idemKey: new Uint8Array([1, 2, 3, 4]),
      };

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      await service.initForStake(testWallet);

      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          wallet: testWallet,
          competitionId: "comp-1",
          amount: expect.any(BigInt),
          meta: expect.objectContaining({
            description: expect.stringContaining("Award of"),
          }),
          idemKey: expect.any(Uint8Array),
        }),
        "mock-tx",
      );
    });

    it("handles noop boost results", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);
      const competition = createMockCompetition("comp-1");
      competition.boostStartDate = new Date("2024-01-15");
      competition.boostEndDate = new Date("2024-01-30");

      const mockBoostResult = {
        type: "noop" as const,
        balance: 750000000000000000n,
        idemKey: new Uint8Array([1, 2, 3, 4]),
      };

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.initForStake(testWallet);

      expect(result).toEqual([
        {
          ...mockBoostResult,
          competitionId: "comp-1",
          stakeId: 1n,
        },
      ]);
    });

    it("runs within a database transaction", async () => {
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([]);

      await service.initForStake(testWallet);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(typeof mockDb.transaction.mock.calls![0]![0]).toBe("function");
    });

    it("propagates database transaction errors", async () => {
      const error = new Error("Database transaction failed");
      mockDb.transaction.mockRejectedValue(error);

      await expect(service.initForStake(testWallet)).rejects.toThrow(
        "Database transaction failed",
      );
    });

    it("propagates repository errors within transaction", async () => {
      const error = new Error("Stakes repository error");
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockRejectedValue(error);

      await expect(service.initForStake(testWallet)).rejects.toThrow(
        "Stakes repository error",
      );
    });

    it("works with external transaction", async () => {
      const mockExternalTx = mock<Transaction>();
      mockExternalTx.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("nested-tx" as unknown as Transaction),
      );

      const stake = createMockStake(1n, 1000000000000000000n);
      const competition = createMockCompetition("comp-1");
      competition.boostStartDate = new Date("2024-01-15");
      competition.boostEndDate = new Date("2024-01-30");

      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findOpenForBoosting.mockResolvedValue([competition]);
      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue({
        type: "applied" as const,
        changeId: "change-123",
        balanceAfter: 500000000000000000n,
        idemKey: new Uint8Array([1, 2, 3, 4]),
      });

      const result = await service.initForStake(testWallet, mockExternalTx);

      expect(result).toHaveLength(1);
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockExternalTx.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
