import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { type BoostRepository } from "@recallnet/db/repositories/boost";
import { type CompetitionRepository } from "@recallnet/db/repositories/competition";
import { InsertUser, SelectCompetition } from "@recallnet/db/schema/core/types";
import { Database } from "@recallnet/db/types";

import { PreTGEInitBoostService } from "@/services/init-boost.service.js";

describe("PreTGEInitBoostService", () => {
  let mockDb: MockProxy<Database>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockBoostRepo: MockProxy<BoostRepository>;
  let service: PreTGEInitBoostService;
  let mockUser: InsertUser;

  const boostAmount = 1000000000000000000n; // 1 ETH in wei

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

    service = new PreTGEInitBoostService(
      mockDb,
      mockCompetitionRepo,
      mockBoostRepo,
      boostAmount,
    );

    mockUser = {
      id: "user-1",
      walletAddress: "0x1234567890123456789012345678901234567890",
      email: "test@example.com",
      privyId: "privy-123",
    };
  });

  afterEach(() => {
    mockReset(mockDb);
    mockReset(mockCompetitionRepo);
    mockReset(mockBoostRepo);
  });

  describe("initBoost", () => {
    it("returns empty array when no voting competitions are open", async () => {
      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([]);

      const result = await service.initBoost(mockUser);

      expect(result).toEqual([]);
      expect(mockCompetitionRepo.findVotingOpen).toHaveBeenCalledWith(
        "mock-tx",
      );
    });

    it("returns alreadyGranted when user already has boost balance", async () => {
      const existingBalance = 500000000000000000n; // 0.5 ETH
      const competition = createMockCompetition("comp-1");

      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
      mockBoostRepo.userBoostBalance.mockResolvedValue(existingBalance);

      const result = await service.initBoost(mockUser);

      expect(result).toEqual([
        {
          type: "alreadyGranted",
          competitionId: "comp-1",
          balance: existingBalance,
        },
      ]);
      expect(mockBoostRepo.userBoostBalance).toHaveBeenCalledWith(
        {
          userId: "user-1",
          competitionId: "comp-1",
        },
        "mock-tx",
      );
      expect(mockBoostRepo.increase).not.toHaveBeenCalled();
    });

    it("grants new boost when user has no existing balance", async () => {
      const competition = createMockCompetition("comp-1");
      const balanceAfter = boostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
      mockBoostRepo.userBoostBalance.mockResolvedValue(0n);
      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-123",
        balanceAfter,
        idemKey,
      });

      const result = await service.initBoost(mockUser);

      expect(result).toEqual([
        {
          type: "boostGranted",
          competitionId: "comp-1",
          balance: balanceAfter,
        },
      ]);
      expect(mockBoostRepo.increase).toHaveBeenCalledWith(
        {
          userId: "user-1",
          competitionId: "comp-1",
          amount: boostAmount,
          wallet: "0x1234567890123456789012345678901234567890",
        },
        "mock-tx",
      );
    });

    it("handles boost increase result with noop type", async () => {
      const competition = createMockCompetition("comp-1");
      const balance = 750000000000000000n;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([competition]);
      mockBoostRepo.userBoostBalance.mockResolvedValue(0n);
      mockBoostRepo.increase.mockResolvedValue({
        type: "noop",
        balance,
        idemKey,
      });

      const result = await service.initBoost(mockUser);

      expect(result).toEqual([
        {
          type: "boostGranted",
          competitionId: "comp-1",
          balance,
        },
      ]);
    });

    it("handles multiple competitions", async () => {
      const competitions = [
        createMockCompetition("comp-1", "Competition 1"),
        createMockCompetition("comp-2", "Competition 2"),
      ];
      const existingBalance = 300000000000000000n;
      const newBalance = boostAmount;
      const idemKey = new Uint8Array([1, 2, 3, 4]);

      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue(competitions);

      // First competition: user already has balance
      // Second competition: user gets new boost
      mockBoostRepo.userBoostBalance
        .mockResolvedValueOnce(existingBalance)
        .mockResolvedValueOnce(0n);

      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-456",
        balanceAfter: newBalance,
        idemKey,
      });

      const result = await service.initBoost(mockUser);

      expect(result).toEqual([
        {
          type: "alreadyGranted",
          competitionId: "comp-1",
          balance: existingBalance,
        },
        {
          type: "boostGranted",
          competitionId: "comp-2",
          balance: newBalance,
        },
      ]);

      expect(mockBoostRepo.userBoostBalance).toHaveBeenCalledTimes(2);
      expect(mockBoostRepo.increase).toHaveBeenCalledTimes(1);
    });

    it("runs within a database transaction", async () => {
      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockResolvedValue([]);

      await service.initBoost(mockUser);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(typeof mockDb.transaction.mock.calls![0]![0]).toBe("function");
    });

    it("propagates database transaction errors", async () => {
      const error = new Error("Database transaction failed");
      mockDb.transaction.mockRejectedValue(error);

      await expect(service.initBoost(mockUser)).rejects.toThrow(
        "Database transaction failed",
      );
    });

    it("propagates repository errors within transaction", async () => {
      const error = new Error("Competition repository error");
      mockDb.transaction.mockImplementation(
        vi.fn((callback) => callback("mock-tx")),
      );
      mockCompetitionRepo.findVotingOpen.mockRejectedValue(error);

      await expect(service.initBoost(mockUser)).rejects.toThrow(
        "Competition repository error",
      );
    });
  });
});
