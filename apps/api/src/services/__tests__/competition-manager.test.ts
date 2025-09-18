import { v4 as uuidv4 } from "uuid";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SelectCompetition,
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db-schema/core/types";
import {
  InsertTradingConstraints,
  SelectTradingConstraints,
} from "@recallnet/db-schema/trading/types";

import { db } from "@/database/db.js";
import * as competitionRepository from "@/database/repositories/competition-repository.js";
import type { AgentService } from "@/services/agent.service.js";
import type { AgentRankService } from "@/services/agentrank.service.js";
import type { BalanceService } from "@/services/balance.service.js";
import type { CompetitionRewardService } from "@/services/competition-reward.service.js";
import { CompetitionService } from "@/services/competition.service.js";
import type { ConfigurationService } from "@/services/configuration.service.js";
import type { PortfolioSnapshotterService } from "@/services/portfolio-snapshotter.service.js";
import type { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import type { TradingConstraintsService } from "@/services/trading-constraints.service.js";
import type { VoteService } from "@/services/vote.service.js";

// Mock logger first to prevent db initialization
vi.mock("@/lib/logger.js", () => ({
  serviceLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  dbLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock all dependencies
vi.mock("@/database/db.js", () => ({
  db: {
    transaction: vi.fn(),
  },
}));
vi.mock("@/database/repositories/competition-repository.js");
vi.mock("@/services/competition-reward.service.js");
vi.mock("@/services/trading-constraints.service.js");

describe("CompetitionService", () => {
  let competitionService: CompetitionService;
  let mockCompetitionRewardService: {
    replaceRewards: Mock;
  };
  let mockTradingConstraintsService: {
    updateConstraints: Mock;
  };
  let mockDb: {
    transaction: Mock;
  };

  const mockCompetition: SelectCompetition = {
    id: uuidv4(),
    name: "Test Competition",
    description: "Test Description",
    type: "trading",
    status: "active",
    startDate: new Date(),
    endDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    imageUrl: null,
    externalUrl: null,
    votingStartDate: null,
    votingEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    sandboxMode: false,
  };

  const mockCompetitionWithCrossChain = {
    ...mockCompetition,
    crossChainTradingType: "disallowAll" as const,
  };

  const mockRewards: SelectCompetitionReward[] = [
    {
      id: uuidv4(),
      competitionId: mockCompetition.id,
      rank: 1,
      reward: 1000,
      agentId: null,
    },
    {
      id: uuidv4(),
      competitionId: mockCompetition.id,
      rank: 2,
      reward: 500,
      agentId: null,
    },
  ];

  const mockConstraints: SelectTradingConstraints = {
    competitionId: mockCompetition.id,
    minimumPairAgeHours: 24,
    minimum24hVolumeUsd: 10000,
    minimumLiquidityUsd: 50000,
    minimumFdvUsd: 100000,
    minTradesPerDay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock services
    mockCompetitionRewardService = {
      replaceRewards: vi.fn().mockResolvedValue(mockRewards),
    };

    mockTradingConstraintsService = {
      updateConstraints: vi.fn().mockResolvedValue(mockConstraints),
    };

    // Create mock services for all dependencies
    const mockBalanceService = {} as unknown as BalanceService;
    const mockTradeSimulatorService = {} as unknown as TradeSimulatorService;
    const mockPortfolioSnapshotterService =
      {} as unknown as PortfolioSnapshotterService;
    const mockAgentService = {} as unknown as AgentService;
    const mockConfigurationService = {} as unknown as ConfigurationService;
    const mockAgentRankService = {} as unknown as AgentRankService;
    const mockVoteService = {} as unknown as VoteService;

    // Get the mocked db transaction
    mockDb = { transaction: vi.mocked(db.transaction) };

    // Mock the repository functions
    vi.mocked(competitionRepository.findById).mockResolvedValue(
      mockCompetitionWithCrossChain,
    );
    vi.mocked(competitionRepository.updateOne).mockResolvedValue({
      competition: mockCompetition,
      promotedAgents: undefined,
    });

    // Create competition manager instance with all mocked dependencies
    competitionService = new CompetitionService(
      mockBalanceService,
      mockTradeSimulatorService,
      mockPortfolioSnapshotterService,
      mockAgentService,
      mockConfigurationService,
      mockAgentRankService,
      mockVoteService,
      mockTradingConstraintsService as unknown as TradingConstraintsService,
      mockCompetitionRewardService as unknown as CompetitionRewardService,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("updateCompetition", () => {
    it("should update competition atomically with all components", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
        description: "Updated Description",
      };
      const tradingConstraints: Partial<InsertTradingConstraints> = {
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 20000,
      };
      const rewards = {
        1: 2000,
        2: 1000,
        3: 500,
      };

      // Mock transaction to execute the callback immediately
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({ transaction: "mock-tx" });
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
        tradingConstraints,
        rewards,
      );

      // Verify transaction was called
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify all operations were called with transaction
      expect(competitionRepository.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        { transaction: "mock-tx" },
      );

      expect(
        mockTradingConstraintsService.updateConstraints,
      ).toHaveBeenCalledWith(competitionId, tradingConstraints, {
        transaction: "mock-tx",
      });

      expect(mockCompetitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        { transaction: "mock-tx" },
      );

      // Verify result
      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: mockRewards,
      });
    });

    it("should update only competition details when no constraints or rewards provided", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition Only",
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({ transaction: "mock-tx" });
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(competitionRepository.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        { transaction: "mock-tx" },
      );

      // Verify constraints and rewards services were not called
      expect(
        mockTradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();
      expect(
        mockCompetitionRewardService.replaceRewards,
      ).not.toHaveBeenCalled();

      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: [],
      });
    });

    it("should update only rewards when provided", async () => {
      const competitionId = mockCompetition.id;
      const rewards = {
        1: 5000,
        2: 2500,
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({ transaction: "mock-tx" });
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        {},
        undefined,
        rewards,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Competition should still be updated (even with empty updates for updatedAt)
      expect(competitionRepository.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        { transaction: "mock-tx" },
      );

      expect(mockCompetitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        { transaction: "mock-tx" },
      );

      expect(
        mockTradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();

      expect(result.updatedRewards).toEqual(mockRewards);
    });

    it("should rollback transaction when competition update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };

      const updateError = new Error("Database update failed");
      vi.mocked(competitionRepository.updateOne).mockRejectedValue(updateError);

      mockDb.transaction.mockImplementation(async (callback) => {
        // Execute callback and let it throw
        return callback({ transaction: "mock-tx" });
      });

      await expect(
        competitionService.updateCompetition(competitionId, updates),
      ).rejects.toThrow("Database update failed");

      // Verify transaction was attempted
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify other services were not called due to early failure
      expect(
        mockTradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();
      expect(
        mockCompetitionRewardService.replaceRewards,
      ).not.toHaveBeenCalled();
    });

    it("should rollback transaction when rewards update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };
      const rewards = {
        1: 1000,
        2: 500,
      };

      const rewardsError = new Error("Rewards update failed");
      mockCompetitionRewardService.replaceRewards.mockRejectedValue(
        rewardsError,
      );

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({ transaction: "mock-tx" });
      });

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          undefined,
          rewards,
        ),
      ).rejects.toThrow("Rewards update failed");

      // Verify all operations up to the failure were called
      expect(competitionRepository.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        { transaction: "mock-tx" },
      );

      expect(mockCompetitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        { transaction: "mock-tx" },
      );
    });

    it("should rollback transaction when trading constraints update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };
      const tradingConstraints: Partial<InsertTradingConstraints> = {
        minimumPairAgeHours: 48,
      };

      const constraintsError = new Error("Constraints update failed");
      mockTradingConstraintsService.updateConstraints.mockRejectedValue(
        constraintsError,
      );

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({ transaction: "mock-tx" });
      });

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          tradingConstraints,
        ),
      ).rejects.toThrow("Constraints update failed");

      // Verify operations were called before failure
      expect(competitionRepository.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        { transaction: "mock-tx" },
      );

      expect(
        mockTradingConstraintsService.updateConstraints,
      ).toHaveBeenCalledWith(competitionId, tradingConstraints, {
        transaction: "mock-tx",
      });

      // Rewards should not be called since constraints failed first
      expect(
        mockCompetitionRewardService.replaceRewards,
      ).not.toHaveBeenCalled();
    });

    it("should handle competition not found error", async () => {
      const competitionId = "non-existent-id";
      vi.mocked(competitionRepository.findById).mockResolvedValue(undefined);

      await expect(
        competitionService.updateCompetition(competitionId, { name: "Test" }),
      ).rejects.toThrow(`Competition not found: ${competitionId}`);

      // Transaction should not be started if competition doesn't exist
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should handle empty updates gracefully", async () => {
      const competitionId = mockCompetition.id;

      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({ transaction: "mock-tx" });
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        {}, // Empty updates
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(competitionRepository.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        { transaction: "mock-tx" },
      );

      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: [],
      });
    });
  });
});
