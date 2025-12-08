import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { BlockchainAddressAsU8A } from "@recallnet/db/coders";
import { type BoostRepository } from "@recallnet/db/repositories/boost";
import { type CompetitionRepository } from "@recallnet/db/repositories/competition";
import { type UserRepository } from "@recallnet/db/repositories/user";
import { Database } from "@recallnet/db/types";

import { BoostAwardService } from "../boost-award.service.js";
import { BoostService } from "../boost.service.js";

describe("BoostService.getCompetitionBoosts", () => {
  let mockDb: MockProxy<Database>;
  let mockBoostRepo: MockProxy<BoostRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockUserRepo: MockProxy<UserRepository>;
  let mockBoostAwardService: MockProxy<BoostAwardService>;
  let service: BoostService;

  const testCompetitionId = "comp-123";
  const testUserId1 = "user-1";
  const testUserId2 = "user-2";
  const testAgentId1 = "agent-1";
  const testAgentId2 = "agent-2";
  const testWallet1 = "0x1234567890123456789012345678901234567890";
  const testWallet2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

  beforeEach(() => {
    mockDb = mock<Database>();
    mockBoostRepo = mock<BoostRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockUserRepo = mock<UserRepository>();
    mockBoostAwardService = mock<BoostAwardService>();

    service = new BoostService(
      mockBoostRepo,
      mockCompetitionRepo,
      mockUserRepo,
      mockBoostAwardService,
      mockDb,
      { boost: { noStakeBoostAmount: 1000n } },
      mock(),
    );
  });

  afterEach(() => {
    mockReset(mockDb);
    mockReset(mockBoostRepo);
    mockReset(mockCompetitionRepo);
    mockReset(mockUserRepo);
    mockReset(mockBoostAwardService);
  });

  describe("basic functionality", () => {
    it("should return empty result when no boosts exist", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(0);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toEqual([]);
        expect(result.value.pagination).toEqual({
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false,
        });
      }
    });

    it("should return boost records with wallet conversion", async () => {
      const mockBoosts = [
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 500n,
          createdAt: new Date("2024-01-15T10:00:00Z"),
        },
      ];

      mockBoostRepo.competitionBoosts.mockResolvedValue(mockBoosts);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(1);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]).toEqual({
          userId: testUserId1,
          wallet: testWallet1.toLowerCase(), // Decoded to hex string
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 500n,
          createdAt: "2024-01-15T10:00:00.000Z", // ISO string
        });
      }
    });

    it("should return multiple boost records correctly", async () => {
      const mockBoosts = [
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 500n,
          createdAt: new Date("2024-01-15T10:00:00Z"),
        },
        {
          userId: testUserId2,
          wallet: BlockchainAddressAsU8A.encode(testWallet2),
          agentId: testAgentId2,
          agentName: "Test Agent 2",
          agentHandle: "testagent2",
          amount: 300n,
          createdAt: new Date("2024-01-15T09:00:00Z"),
        },
      ];

      mockBoostRepo.competitionBoosts.mockResolvedValue(mockBoosts);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(2);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0]?.wallet).toBe(testWallet1.toLowerCase());
        expect(result.value.items[1]?.wallet).toBe(testWallet2.toLowerCase());
      }
    });
  });

  describe("pagination", () => {
    it("should calculate hasMore correctly when more pages exist", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 100n,
          createdAt: new Date(),
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(10);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 5,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.pagination).toEqual({
          total: 10,
          limit: 5,
          offset: 0,
          hasMore: true, // 0 + 5 < 10
        });
      }
    });

    it("should calculate hasMore correctly when on last page", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 100n,
          createdAt: new Date(),
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(10);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 5,
        offset: 5,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.pagination).toEqual({
          total: 10,
          limit: 5,
          offset: 5,
          hasMore: false, // 5 + 5 = 10, not < 10
        });
      }
    });

    it("should calculate hasMore correctly when exactly at end", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(10);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 5,
        offset: 10,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.pagination).toEqual({
          total: 10,
          limit: 5,
          offset: 10,
          hasMore: false, // 10 + 5 = 15, not < 10
        });
      }
    });

    it("should handle custom limit and offset", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(100);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 25,
        offset: 50,
      });

      expect(mockBoostRepo.competitionBoosts).toHaveBeenCalledWith(
        { competitionId: testCompetitionId, limit: 25, offset: 50 },
        undefined,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.pagination).toEqual({
          total: 100,
          limit: 25,
          offset: 50,
          hasMore: true, // 50 + 25 = 75 < 100
        });
      }
    });
  });

  describe("data transformation", () => {
    it("should convert wallet Uint8Array to hex string", async () => {
      const wallet1Bytes = BlockchainAddressAsU8A.encode(testWallet1);
      const wallet2Bytes = BlockchainAddressAsU8A.encode(testWallet2);

      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: wallet1Bytes,
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 200n,
          createdAt: new Date(),
        },
        {
          userId: testUserId2,
          wallet: wallet2Bytes,
          agentId: testAgentId2,
          agentName: "Test Agent 2",
          agentHandle: "testagent2",
          amount: 150n,
          createdAt: new Date(),
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(2);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items[0]?.wallet).toBe(testWallet1.toLowerCase());
        expect(result.value.items[1]?.wallet).toBe(testWallet2.toLowerCase());

        // Should be strings, not Uint8Arrays
        expect(typeof result.value.items[0]?.wallet).toBe("string");
        expect(typeof result.value.items[1]?.wallet).toBe("string");
      }
    });

    it("should convert Date to ISO string", async () => {
      const testDate = new Date("2024-01-15T12:30:45.678Z");

      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 500n,
          createdAt: testDate,
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(1);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items[0]?.createdAt).toBe(
          "2024-01-15T12:30:45.678Z",
        );
        expect(typeof result.value.items[0]?.createdAt).toBe("string");
      }
    });

    it("should preserve bigint amounts without conversion", async () => {
      const largeAmount = 999999999999999999n;

      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: largeAmount,
          createdAt: new Date(),
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(1);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items[0]?.amount).toBe(largeAmount);
        expect(typeof result.value.items[0]?.amount).toBe("bigint");
      }
    });

    it("should preserve agent information", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Alpha Trader",
          agentHandle: "alphatrader",
          amount: 500n,
          createdAt: new Date(),
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(1);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items[0]?.agentName).toBe("Alpha Trader");
        expect(result.value.items[0]?.agentHandle).toBe("alphatrader");
      }
    });
  });

  describe("error handling", () => {
    it("should return RepositoryError when competitionBoosts fails", async () => {
      mockBoostRepo.competitionBoosts.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("RepositoryError");
        expect(result.error.message).toContain("Database connection failed");
      }
    });

    it("should return RepositoryError when countCompetitionBoosts fails", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockRejectedValue(
        new Error("Count query failed"),
      );

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("RepositoryError");
        expect(result.error.message).toContain("Count query failed");
      }
    });
  });

  describe("parallel query execution", () => {
    it("should call both repository methods in parallel", async () => {
      const mockBoosts = [
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Test Agent 1",
          agentHandle: "testagent1",
          amount: 300n,
          createdAt: new Date(),
        },
      ];

      mockBoostRepo.competitionBoosts.mockResolvedValue(mockBoosts);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(5);

      await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      // Both should be called with correct parameters
      expect(mockBoostRepo.competitionBoosts).toHaveBeenCalledWith(
        { competitionId: testCompetitionId, limit: 50, offset: 0 },
        undefined,
      );
      expect(mockBoostRepo.countCompetitionBoosts).toHaveBeenCalledWith(
        testCompetitionId,
        undefined,
      );

      // Both should be called exactly once
      expect(mockBoostRepo.competitionBoosts).toHaveBeenCalledTimes(1);
      expect(mockBoostRepo.countCompetitionBoosts).toHaveBeenCalledTimes(1);
    });
  });

  describe("pagination edge cases", () => {
    it("should handle hasMore when offset + limit equals total", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(10);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 5,
        offset: 5,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.pagination.hasMore).toBe(false); // 5 + 5 = 10, not < 10
      }
    });

    it("should handle hasMore when offset + limit exceeds total", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(10);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 20,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.pagination.hasMore).toBe(false); // 0 + 20 = 20 > 10
      }
    });

    it("should handle offset beyond total records", async () => {
      mockBoostRepo.competitionBoosts.mockResolvedValue([]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(5);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 100,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toEqual([]);
        expect(result.value.pagination.hasMore).toBe(false);
      }
    });
  });

  describe("data consistency", () => {
    it("should maintain order from repository", async () => {
      const date1 = new Date("2024-01-15T10:00:00Z");
      const date2 = new Date("2024-01-15T09:00:00Z");
      const date3 = new Date("2024-01-15T08:00:00Z");

      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Agent 1",
          agentHandle: "agent1",
          amount: 300n,
          createdAt: date1,
        },
        {
          userId: testUserId2,
          wallet: BlockchainAddressAsU8A.encode(testWallet2),
          agentId: testAgentId2,
          agentName: "Agent 2",
          agentHandle: "agent2",
          amount: 200n,
          createdAt: date2,
        },
        {
          userId: testUserId1,
          wallet: BlockchainAddressAsU8A.encode(testWallet1),
          agentId: testAgentId1,
          agentName: "Agent 1",
          agentHandle: "agent1",
          amount: 100n,
          createdAt: date3,
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(3);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Order should be preserved (DESC by createdAt)
        expect(result.value.items[0]?.createdAt).toBe(date1.toISOString());
        expect(result.value.items[1]?.createdAt).toBe(date2.toISOString());
        expect(result.value.items[2]?.createdAt).toBe(date3.toISOString());
      }
    });

    it("should handle items count matching total when no pagination", async () => {
      const mockBoosts = Array.from({ length: 3 }, (_, i) => ({
        userId: testUserId1,
        wallet: BlockchainAddressAsU8A.encode(testWallet1),
        agentId: testAgentId1,
        agentName: "Test Agent",
        agentHandle: "testagent",
        amount: BigInt(100 * (i + 1)),
        createdAt: new Date(),
      }));

      mockBoostRepo.competitionBoosts.mockResolvedValue(mockBoosts);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(3);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 100,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(3);
        expect(result.value.pagination.total).toBe(3);
        expect(result.value.pagination.hasMore).toBe(false);
      }
    });
  });

  describe("wallet address normalization", () => {
    it("should convert wallet to lowercase hex", async () => {
      const mixedCaseWallet = "0xAbCdEf1234567890123456789012345678901234";
      const walletBytes = BlockchainAddressAsU8A.encode(mixedCaseWallet);

      mockBoostRepo.competitionBoosts.mockResolvedValue([
        {
          userId: testUserId1,
          wallet: walletBytes,
          agentId: testAgentId1,
          agentName: "Test Agent",
          agentHandle: "testagent",
          amount: 100n,
          createdAt: new Date(),
        },
      ]);
      mockBoostRepo.countCompetitionBoosts.mockResolvedValue(1);

      const result = await service.getCompetitionBoosts(testCompetitionId, {
        limit: 50,
        offset: 0,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items[0]?.wallet).toBe(
          mixedCaseWallet.toLowerCase(),
        );
        expect(result.value.items[0]?.wallet).toMatch(/^0x[0-9a-f]{40}$/);
      }
    });
  });
});
