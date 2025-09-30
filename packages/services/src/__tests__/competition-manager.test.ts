import { randomUUID } from "crypto";
import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import {
  SelectCompetition,
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db/schema/core/types";
import {
  InsertTradingConstraints,
  SelectTradingConstraints,
} from "@recallnet/db/schema/trading/types";
import type { Database, Transaction } from "@recallnet/db/types";

import { AgentService } from "../agent.service.js";
import { AgentRankService } from "../agentrank.service.js";
import { BalanceService } from "../balance.service.js";
import { CompetitionRewardService } from "../competition-reward.service.js";
import {
  CompetitionService,
  CompetitionServiceConfig,
} from "../competition.service.js";
import { ConfigurationService } from "../configuration.service.js";
import { PerpsDataProcessor } from "../perps-data-processor.service.js";
import { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import { TradeSimulatorService } from "../trade-simulator.service.js";
import { TradingConstraintsService } from "../trading-constraints.service.js";
import { VoteService } from "../vote.service.js";

describe("CompetitionService", () => {
  let competitionService: CompetitionService;
  let mockBalanceService: MockProxy<BalanceService>;
  let mockTradeSimulatorService: MockProxy<TradeSimulatorService>;
  let mockPortfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let mockAgentService: MockProxy<AgentService>;
  let mockConfigurationService: MockProxy<ConfigurationService>;
  let mockAgentRankService: MockProxy<AgentRankService>;
  let mockVoteService: MockProxy<VoteService>;
  let mockTradingConstraintsService: MockProxy<TradingConstraintsService>;
  let mockCompetitionRewardService: MockProxy<CompetitionRewardService>;
  let mockPerpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let mockAgentRepo: MockProxy<AgentRepository>;
  let mockAgentScoreRepo: MockProxy<AgentScoreRepository>;
  let mockPerpsRepo: MockProxy<PerpsRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockDb: MockProxy<Database>;
  let mockConfig: MockProxy<CompetitionServiceConfig>;
  let mockLogger: MockProxy<Logger>;

  const mockCompetition: SelectCompetition = {
    id: randomUUID(),
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
      id: randomUUID(),
      competitionId: mockCompetition.id,
      rank: 1,
      reward: 1000,
      agentId: null,
    },
    {
      id: randomUUID(),
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

    // Create all service mocks
    mockBalanceService = mock<BalanceService>();
    mockTradeSimulatorService = mock<TradeSimulatorService>();
    mockPortfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    mockAgentService = mock<AgentService>();
    mockConfigurationService = mock<ConfigurationService>();
    mockAgentRankService = mock<AgentRankService>();
    mockVoteService = mock<VoteService>();
    mockTradingConstraintsService = mock<TradingConstraintsService>();
    mockCompetitionRewardService = mock<CompetitionRewardService>();
    mockPerpsDataProcessor = mock<PerpsDataProcessor>();

    // Create repository mocks
    mockAgentRepo = mock<AgentRepository>();
    mockAgentScoreRepo = mock<AgentScoreRepository>();
    mockPerpsRepo = mock<PerpsRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();

    // Create database and config mocks
    mockDb = mock<Database>();
    mockConfig = mock<CompetitionServiceConfig>();
    mockLogger = mock<Logger>();

    // Setup specific mock implementations
    mockCompetitionRewardService.replaceRewards.mockResolvedValue(mockRewards);
    mockTradingConstraintsService.updateConstraints.mockResolvedValue(
      mockConstraints,
    );

    // Mock the repository functions
    mockCompetitionRepo.findById.mockResolvedValue(
      mockCompetitionWithCrossChain,
    );
    mockCompetitionRepo.updateOne.mockResolvedValue(mockCompetition);

    // Setup database transaction mock
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    // Create competition service instance with all mocked dependencies
    competitionService = new CompetitionService(
      mockBalanceService,
      mockTradeSimulatorService,
      mockPortfolioSnapshotterService,
      mockAgentService,
      mockConfigurationService,
      mockAgentRankService,
      mockVoteService,
      mockTradingConstraintsService,
      mockCompetitionRewardService,
      mockPerpsDataProcessor,
      mockAgentRepo,
      mockAgentScoreRepo,
      mockPerpsRepo,
      mockCompetitionRepo,
      mockDb,
      mockConfig,
      mockLogger,
    );
  });

  afterEach(() => {
    // Reset all mocks
    mockReset(mockBalanceService);
    mockReset(mockTradeSimulatorService);
    mockReset(mockPortfolioSnapshotterService);
    mockReset(mockAgentService);
    mockReset(mockConfigurationService);
    mockReset(mockAgentRankService);
    mockReset(mockVoteService);
    mockReset(mockTradingConstraintsService);
    mockReset(mockCompetitionRewardService);
    mockReset(mockPerpsDataProcessor);
    mockReset(mockAgentRepo);
    mockReset(mockAgentScoreRepo);
    mockReset(mockPerpsRepo);
    mockReset(mockCompetitionRepo);
    mockReset(mockDb);
    mockReset(mockConfig);
    mockReset(mockLogger);
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

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
        tradingConstraints,
        rewards,
      );

      // Verify transaction was called
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify all operations were called with transaction
      expect(mockCompetitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        expect.any(Object), // The transaction object
      );

      expect(
        mockTradingConstraintsService.updateConstraints,
      ).toHaveBeenCalledWith(
        competitionId,
        tradingConstraints,
        expect.any(Object), // The transaction object
      );

      expect(mockCompetitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        expect.any(Object), // The transaction object
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

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockCompetitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        expect.any(Object), // The transaction object
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

      const result = await competitionService.updateCompetition(
        competitionId,
        {},
        undefined,
        rewards,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Competition should still be updated (even with empty updates for updatedAt)
      expect(mockCompetitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        expect.any(Object), // The transaction object
      );

      expect(mockCompetitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        expect.any(Object), // The transaction object
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
      mockCompetitionRepo.updateOne.mockRejectedValue(updateError);

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

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          undefined,
          rewards,
        ),
      ).rejects.toThrow("Rewards update failed");

      // Verify all operations up to the failure were called
      expect(mockCompetitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        expect.any(Object), // The transaction object
      );

      expect(mockCompetitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        expect.any(Object), // The transaction object
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

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          tradingConstraints,
        ),
      ).rejects.toThrow("Constraints update failed");

      // Verify operations were called before failure
      expect(mockCompetitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        expect.any(Object), // The transaction object
      );

      expect(
        mockTradingConstraintsService.updateConstraints,
      ).toHaveBeenCalledWith(
        competitionId,
        tradingConstraints,
        expect.any(Object), // The transaction object
      );

      // Rewards should not be called since constraints failed first
      expect(
        mockCompetitionRewardService.replaceRewards,
      ).not.toHaveBeenCalled();
    });

    it("should handle competition not found error", async () => {
      const competitionId = "non-existent-id";
      mockCompetitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        competitionService.updateCompetition(competitionId, { name: "Test" }),
      ).rejects.toThrow(`Competition not found: ${competitionId}`);

      // Transaction should not be started if competition doesn't exist
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should handle empty updates gracefully", async () => {
      const competitionId = mockCompetition.id;

      const result = await competitionService.updateCompetition(
        competitionId,
        {}, // Empty updates
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockCompetitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        expect.any(Object), // The transaction object
      );

      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: [],
      });
    });
  });
});
