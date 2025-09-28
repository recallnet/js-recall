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
    votingStartDate: new Date(),
    votingEndDate: null,
    joinStartDate: new Date(),
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    status: "active",
    sandboxMode: false,
    createdAt: new Date(),
    updatedAt: null,
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
      noStakeBoostAmount,
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

  describe("awardForStake", () => {
    // Helper function to create mock stake
    const createMockStake = (
      id: bigint,
      amount: bigint,
      stakedAt: Date = new Date("2024-01-01"),
      canUnstakeAfter: Date = new Date("2024-01-02"),
    ) => ({
      id,
      wallet: testWallet,
      amount,
      stakedAt,
      canUnstakeAfter,
    });

    // Helper function to create mock competition
    const createMockCompetitionPosition = (
      id: string,
      votingStartDate: Date,
      votingEndDate: Date,
    ) => ({
      id,
      votingStartDate,
      votingEndDate,
    });

    // Helper function to create mock user
    const createMockUser = (id: string = testUserId) => ({
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
      status: "active" as const,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      lastLoginAt: null,
    });

    it("returns noop when user not found", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);
      const competition = createMockCompetitionPosition(
        "comp-1",
        new Date("2024-01-15"),
        new Date("2024-01-30"),
      );

      mockUserService.getUserByWalletAddress.mockResolvedValue(null);

      const result = await service.awardForStake(stake, competition);

      expect(result).toEqual({
        type: "noop",
        balance: 0n,
        idemKey: expect.any(Uint8Array),
      });
      expect(mockBoostRepo.increase).not.toHaveBeenCalled();
    });

    it("applies 2x multiplier when staked before voting and locked through voting end", async () => {
      const stake = createMockStake(
        1n,
        1000000000000000000n, // 1 ETH
        new Date("2024-01-01"), // Before voting starts
        new Date("2024-02-01"), // After voting ends
      );
      const competition = createMockCompetitionPosition(
        "comp-1",
        new Date("2024-01-15"), // Voting starts
        new Date("2024-01-30"), // Voting ends
      );

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-123",
        balanceAfter: 2000000000000000000n,
        idemKey: new Uint8Array([1, 2, 3, 4]),
      };

      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.awardForStake(stake, competition);

      expect(result).toBe(mockBoostResult);
      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        {
          userId: testUserId,
          wallet: testWallet,
          competitionId: "comp-1",
          amount: 2000000000000000000n, // 2x multiplier applied
          meta: {
            description: "Award of 2000000000000000000 based on stake 1",
          },
          idemKey: expect.any(Uint8Array),
        },
        undefined,
      );
    });

    it("applies 1x multiplier when staked before voting but can unstake during voting", async () => {
      const stake = createMockStake(
        2n,
        500000000000000000n, // 0.5 ETH
        new Date("2024-01-01"), // Before voting starts
        new Date("2024-01-20"), // Can unstake during voting period
      );
      const competition = createMockCompetitionPosition(
        "comp-1",
        new Date("2024-01-15"), // Voting starts
        new Date("2024-01-30"), // Voting ends
      );

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-456",
        balanceAfter: 500000000000000000n,
        idemKey: new Uint8Array([5, 6, 7, 8]),
      };

      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.awardForStake(stake, competition);

      expect(result).toBe(mockBoostResult);
      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        {
          userId: testUserId,
          wallet: testWallet,
          competitionId: "comp-1",
          amount: 500000000000000000n, // 1x multiplier applied
          meta: {
            description: "Award of 500000000000000000 based on stake 2",
          },
          idemKey: expect.any(Uint8Array),
        },
        undefined,
      );
    });

    it("applies 1x multiplier when staked after voting starts", async () => {
      const stake = createMockStake(
        3n,
        2000000000000000000n, // 2 ETH
        new Date("2024-01-20"), // After voting starts
        new Date("2024-02-01"), // After voting ends
      );
      const competition = createMockCompetitionPosition(
        "comp-1",
        new Date("2024-01-15"), // Voting starts
        new Date("2024-01-30"), // Voting ends
      );

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-789",
        balanceAfter: 2000000000000000000n,
        idemKey: new Uint8Array([9, 10, 11, 12]),
      };

      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.awardForStake(stake, competition);

      expect(result).toBe(mockBoostResult);
      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        {
          userId: testUserId,
          wallet: testWallet,
          competitionId: "comp-1",
          amount: 2000000000000000000n, // 1x multiplier applied
          meta: {
            description: "Award of 2000000000000000000 based on stake 3",
          },
          idemKey: expect.any(Uint8Array),
        },
        undefined,
      );
    });

    it("generates proper idempotency key", async () => {
      const stake = createMockStake(123n, 1000000000000000000n);
      const competition = createMockCompetitionPosition(
        "comp-xyz",
        new Date("2024-01-15"),
        new Date("2024-01-30"),
      );

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-idem",
        balanceAfter: 1000000000000000000n,
        idemKey: new Uint8Array([13, 14, 15, 16]),
      };

      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      await service.awardForStake(stake, competition);

      const callArgs = mockBoostRepo.increase.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      const idemKeyString = new TextDecoder().decode(callArgs!.idemKey);
      expect(idemKeyString).toContain("competition=comp-xyz");
      expect(idemKeyString).toContain("stake=123");
    });

    it("passes transaction parameter to boost repository", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);
      const competition = createMockCompetitionPosition(
        "comp-1",
        new Date("2024-01-15"),
        new Date("2024-01-30"),
      );
      const mockTx = "mock-transaction" as unknown as Transaction;

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-tx",
        balanceAfter: 1000000000000000000n,
        idemKey: new Uint8Array([17, 18, 19, 20]),
      };

      mockUserService.getUserByWalletAddress.mockResolvedValue(
        createMockUser(),
      );
      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      await service.awardForStake(stake, competition, mockTx);

      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        expect.any(Object),
        mockTx,
      );
    });
  });

  describe("awardNoStake", () => {
    it("awards boost with correct parameters", async () => {
      const competitionId = "comp-1";
      const userId = "user-123";
      const wallet = "0xabcd...1234";
      const boostAmount = 1500000000000000000n; // 1.5 ETH
      const idemReason = "test-reason";

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-no-stake",
        balanceAfter: 1500000000000000000n,
        idemKey: new Uint8Array([21, 22, 23, 24]),
      };

      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.awardNoStake(
        competitionId,
        userId,
        wallet,
        boostAmount,
        idemReason,
      );

      expect(result).toBe(mockBoostResult);
      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        {
          userId,
          wallet,
          competitionId,
          amount: boostAmount,
          meta: {
            description: `Voluntary award of ${boostAmount}`,
          },
          idemKey: expect.any(Uint8Array),
        },
        undefined,
      );
    });

    it("generates proper idempotency key", async () => {
      const competitionId = "comp-xyz";
      const userId = "user-456";
      const wallet = "0x1234...abcd";
      const boostAmount = 500000000000000000n;
      const idemReason = "special-award";

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-idem-no-stake",
        balanceAfter: 500000000000000000n,
        idemKey: new Uint8Array([25, 26, 27, 28]),
      };

      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      await service.awardNoStake(
        competitionId,
        userId,
        wallet,
        boostAmount,
        idemReason,
      );

      const callArgs = mockBoostRepo.increase.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      const idemKeyString = new TextDecoder().decode(callArgs!.idemKey);
      expect(idemKeyString).toContain("competition=comp-xyz");
      expect(idemKeyString).toContain("reason=special-award");
    });

    it("passes transaction parameter to boost repository", async () => {
      const competitionId = "comp-1";
      const userId = "user-123";
      const wallet = "0xabcd...1234";
      const boostAmount = 1000000000000000000n;
      const idemReason = "tx-test";
      const mockTx = "mock-transaction-no-stake" as unknown as Transaction;

      const mockBoostResult = {
        type: "applied" as const,
        changeId: "change-tx-no-stake",
        balanceAfter: 1000000000000000000n,
        idemKey: new Uint8Array([29, 30, 31, 32]),
      };

      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      await service.awardNoStake(
        competitionId,
        userId,
        wallet,
        boostAmount,
        idemReason,
        mockTx,
      );

      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        expect.any(Object),
        mockTx,
      );
    });

    it("handles noop result type", async () => {
      const competitionId = "comp-1";
      const userId = "user-123";
      const wallet = "0xabcd...1234";
      const boostAmount = 1000000000000000000n;
      const idemReason = "noop-test";

      const mockBoostResult = {
        type: "noop" as const,
        balance: 2500000000000000000n,
        idemKey: new Uint8Array([33, 34, 35, 36]),
      };

      mockBoostRepo.increase.mockResolvedValue(mockBoostResult);

      const result = await service.awardNoStake(
        competitionId,
        userId,
        wallet,
        boostAmount,
        idemReason,
      );

      expect(result).toBe(mockBoostResult);
      expect(result.type).toBe("noop");
      if (result.type === "noop") {
        expect(result.balance).toBe(2500000000000000000n);
      }
    });
  });

  describe("initNoStake", () => {
    it("returns empty array when no voting competitions are open", async () => {
      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([]);

      const result = await service.initNoStake(testUserId, testWallet);

      expect(result).toEqual([]);
      expect(mockCompetitionRepo.findVotingOpen).toHaveBeenCalledWith(
        "mock-tx",
      );
    });

    it("awards boost for each open voting competition", async () => {
      const competition = createMockCompetition("comp-1");
      const balanceAfter = noStakeBoostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue(competitions);

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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([]);

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
      mockCompetitionRepo.findVotingOpen.mockRejectedValue(error);

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

      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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

    it("throws error when no-stake boost amount not configured", async () => {
      // Create service without noStakeBoostAmount
      const serviceWithoutAmount = new BoostAwardService(
        mockDb,
        mockCompetitionRepo,
        mockBoostRepo,
        mockStakesRepo,
        mockUserService,
        undefined, // No boost amount configured
      );

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );

      await expect(
        serviceWithoutAmount.initNoStake(testUserId, testWallet),
      ).rejects.toThrow("No-stake boost amount not configured");
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
      expect(mockCompetitionRepo.findVotingOpen).not.toHaveBeenCalled();
    });

    it("returns empty array when no voting competitions are open", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([]);

      const result = await service.initForStake(testWallet);

      expect(result).toEqual([]);
      expect(mockStakesRepo.allStakedByWallet).toHaveBeenCalledWith(
        testWallet,
        "mock-tx",
      );
      expect(mockCompetitionRepo.findVotingOpen).toHaveBeenCalledWith(
        "mock-tx",
      );
    });

    it("awards boosts for each stake-competition combination", async () => {
      const stake1 = createMockStake(1n, 1000000000000000000n);
      const stake2 = createMockStake(2n, 2000000000000000000n);
      const competition1 = createMockCompetition("comp-1", "Competition 1");
      competition1.votingStartDate = new Date("2024-01-15");
      competition1.votingEndDate = new Date("2024-01-30");

      const competition2 = createMockCompetition("comp-2", "Competition 2");
      competition2.votingStartDate = new Date("2024-02-01");
      competition2.votingEndDate = new Date("2024-02-15");

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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([
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

    it("throws error when competition missing voting dates", async () => {
      const stake = createMockStake(1n, 1000000000000000000n);
      const competition = createMockCompetition("comp-1");
      competition.votingStartDate = null; // Missing voting start date

      mockDb.transaction.mockImplementation(
        async (callback: (tx: Transaction) => Promise<unknown>) =>
          callback("mock-tx" as unknown as Transaction),
      );
      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);

      await expect(service.initForStake(testWallet)).rejects.toThrow(
        "Competition missing voting dates",
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
      competition.votingStartDate = new Date("2024-01-15");
      competition.votingEndDate = new Date("2024-01-30");

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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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
      competition.votingStartDate = new Date("2024-01-15");
      competition.votingEndDate = new Date("2024-01-30");

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
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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
      competition.votingStartDate = new Date("2024-01-15");
      competition.votingEndDate = new Date("2024-01-30");

      mockStakesRepo.allStakedByWallet.mockResolvedValue([stake]);
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
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
