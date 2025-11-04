import { randomUUID } from "crypto";
import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { UserRepository } from "@recallnet/db/repositories/user";
import {
  SelectCompetition,
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db/schema/core/types";
import {
  InsertTradingConstraints,
  SelectTradingCompetition,
  SelectTradingConstraints,
} from "@recallnet/db/schema/trading/types";
import { Database, Transaction } from "@recallnet/db/types";

import type { AgentService } from "../agent.service.js";
import type { AgentRankService } from "../agentrank.service.js";
import type { BalanceService } from "../balance.service.js";
import type { CompetitionRewardService } from "../competition-reward.service.js";
import { CompetitionService } from "../competition.service.js";
import type { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import { RewardsService } from "../rewards.service.js";
import type { TradeSimulatorService } from "../trade-simulator.service.js";
import type { TradingConstraintsService } from "../trading-constraints.service.js";

describe("CompetitionService", () => {
  let competitionService: CompetitionService;
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let rewardsService: MockProxy<RewardsService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let stakesRepo: MockProxy<StakesRepository>;
  let userRepo: MockProxy<UserRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  const mockTx = mock<Transaction>();

  const mockCompeitionId = randomUUID();
  const mockCompetition: SelectCompetition & SelectTradingCompetition = {
    id: mockCompeitionId,
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
    boostStartDate: null,
    boostEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    minimumStake: null,
    sandboxMode: false,
    competitionId: mockCompeitionId,
    crossChainTradingType: "allow",
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
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
    rewardsService = mock<RewardsService>();
    perpsDataProcessor = mock<PerpsDataProcessor>();
    agentRepo = mock<AgentRepository>();
    agentScoreRepo = mock<AgentScoreRepository>();
    perpsRepo = mock<PerpsRepository>();
    competitionRepo = mock<CompetitionRepository>();
    stakesRepo = mock<StakesRepository>();
    userRepo = mock<UserRepository>();
    mockDb = mock<Database>();
    logger = mock<Logger>();

    // Setup default mock return values
    competitionRewardService.replaceRewards.mockResolvedValue(mockRewards);
    tradingConstraintsService.updateConstraints.mockResolvedValue(
      mockConstraints,
    );
    competitionRepo.findById.mockResolvedValue(mockCompetition);
    competitionRepo.updateOne.mockResolvedValue(mockCompetition);

    // Create competition service instance with all mocked dependencies
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      agentService,
      agentRankService,
      tradingConstraintsService,
      competitionRewardService,
      rewardsService,
      perpsDataProcessor,
      agentRepo,
      agentScoreRepo,
      perpsRepo,
      competitionRepo,
      stakesRepo,
      userRepo,
      mockDb,
      {
        evmChains: [
          "eth",
          "polygon",
          "bsc",
          "arbitrum",
          "base",
          "optimism",
          "avalanche",
          "linea",
        ],
        maxTradePercentage: 25,
        rateLimiting: { windowMs: 60000, maxRequests: 100 },
        specificChainBalances: { eth: { eth: 1 } },
      },
      logger,
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
        return await callback(mockTx);
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
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      expect(tradingConstraintsService.updateConstraints).toHaveBeenCalledWith(
        competitionId,
        tradingConstraints,
        mockTx,
      );

      expect(competitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        mockTx,
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
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      // Verify constraints and rewards services were not called
      expect(
        tradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();
      expect(competitionRewardService.replaceRewards).not.toHaveBeenCalled();

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
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        {},
        undefined,
        rewards,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Competition should still be updated (even with empty updates for updatedAt)
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        mockTx,
      );

      expect(competitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        mockTx,
      );

      expect(
        tradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();

      expect(result.updatedRewards).toEqual(mockRewards);
    });

    it("should rollback transaction when competition update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };

      const updateError = new Error("Database update failed");
      competitionRepo.updateOne.mockRejectedValue(updateError);

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      await expect(
        competitionService.updateCompetition(competitionId, updates),
      ).rejects.toThrow("Database update failed");

      // Verify transaction was attempted
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify other services were not called due to early failure
      expect(
        tradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();
      expect(competitionRewardService.replaceRewards).not.toHaveBeenCalled();
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
      competitionRewardService.replaceRewards.mockRejectedValue(rewardsError);

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
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
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      expect(competitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        mockTx,
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
      tradingConstraintsService.updateConstraints.mockRejectedValue(
        constraintsError,
      );

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          tradingConstraints,
        ),
      ).rejects.toThrow("Constraints update failed");

      // Verify operations were called before failure
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      expect(tradingConstraintsService.updateConstraints).toHaveBeenCalledWith(
        competitionId,
        tradingConstraints,
        mockTx,
      );

      // Rewards should not be called since constraints failed first
      expect(competitionRewardService.replaceRewards).not.toHaveBeenCalled();
    });

    it("should handle competition not found error", async () => {
      const competitionId = "non-existent-id";
      competitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        competitionService.updateCompetition(competitionId, { name: "Test" }),
      ).rejects.toThrow(`Competition not found: ${competitionId}`);

      // Transaction should not be started if competition doesn't exist
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should handle empty updates gracefully", async () => {
      const competitionId = mockCompetition.id;

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        {}, // Empty updates
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        mockTx,
      );

      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: [],
      });
    });
  });
});
