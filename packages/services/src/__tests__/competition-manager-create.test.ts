import { randomUUID } from "crypto";
import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type {
  SelectCompetition,
  SelectCompetitionReward,
} from "@recallnet/db/schema/core/types";
import type { SelectTradingConstraints } from "@recallnet/db/schema/trading/types";
import type { Database } from "@recallnet/db/types";

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
import type { SpecificChain } from "../types/index.js";
import { VoteService } from "../vote.service.js";

describe("CompetitionService - createCompetition", () => {
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
    mockCompetitionRewardService.createRewards.mockResolvedValue([
      {
        id: randomUUID(),
        competitionId: "",
        rank: 1,
        reward: 1000,
        agentId: null,
      } as SelectCompetitionReward,
    ]);

    mockTradingConstraintsService.createConstraints.mockResolvedValue({
      competitionId: "",
      minimumPairAgeHours: 24,
      minimum24hVolumeUsd: 10000,
      minimumLiquidityUsd: 50000,
      minimumFdvUsd: 100000,
      minTradesPerDay: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SelectTradingConstraints);

    // The create method returns the created competition combined with trading competition data
    mockCompetitionRepo.create.mockResolvedValue({
      id: randomUUID(),
      name: "Test Competition",
      description: "Test Description",
      type: "trading",
      status: "pending",
      startDate: null,
      endDate: null,
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
      // Trading competition fields
      competitionId: randomUUID(),
      crossChainTradingType: "disallowAll",
    });

    // Setup database transaction mock
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<any>();
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

  test("should create competition atomically with all components", async () => {
    const result = await competitionService.createCompetition({
      name: "New Competition",
      description: "Test Description",
      tradingType: "disallowAll",
      sandboxMode: false,
      type: "trading",
      tradingConstraints: {
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 200000,
      },
      rewards: {
        1: 5000,
        2: 2500,
        3: 1000,
      },
    });

    // Verify transaction was called
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition was created with transaction
    expect(mockCompetitionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Competition",
        description: "Test Description",
        crossChainTradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
        status: "pending",
      }),
      expect.any(Object), // The transaction object
    );

    // Verify rewards were created with transaction
    expect(mockCompetitionRewardService.createRewards).toHaveBeenCalledWith(
      expect.any(String), // Competition ID
      {
        1: 5000,
        2: 2500,
        3: 1000,
      },
      expect.any(Object), // The transaction object
    );

    // Verify constraints were created with transaction
    expect(
      mockTradingConstraintsService.createConstraints,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: expect.any(String),
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 200000,
      }),
      expect.any(Object), // The transaction object
    );

    // Verify result structure
    expect(result).toMatchObject({
      name: "New Competition",
      rewards: expect.any(Array),
      tradingConstraints: expect.any(Object),
    });
  });

  test("should create competition without rewards", async () => {
    const result = await competitionService.createCompetition({
      name: "No Rewards Competition",
      description: "Test without rewards",
      tradingType: "disallowAll",
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockCompetitionRepo.create).toHaveBeenCalled();
    expect(mockCompetitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(mockTradingConstraintsService.createConstraints).toHaveBeenCalled();

    expect(result.rewards).toEqual([]);
  });

  test("should rollback transaction when competition creation fails", async () => {
    // Make competition creation fail
    mockCompetitionRepo.create.mockRejectedValue(new Error("Database error"));

    await expect(
      competitionService.createCompetition({
        name: "Failing Competition",
        description: "This should fail",
      }),
    ).rejects.toThrow("Database error");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify that rewards and constraints were not created
    expect(mockCompetitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(
      mockTradingConstraintsService.createConstraints,
    ).not.toHaveBeenCalled();
  });

  test("should rollback transaction when rewards creation fails", async () => {
    // Make rewards creation fail
    mockCompetitionRewardService.createRewards.mockRejectedValue(
      new Error("Invalid reward rank"),
    );

    await expect(
      competitionService.createCompetition({
        name: "Competition with Bad Rewards",
        description: "Rewards will fail",
        rewards: {
          1: 1000,
          "-1": 500, // Invalid rank
        },
      }),
    ).rejects.toThrow("Invalid reward rank");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition was created but the whole transaction should roll back
    expect(mockCompetitionRepo.create).toHaveBeenCalled();
    expect(mockCompetitionRewardService.createRewards).toHaveBeenCalled();
  });

  test("should rollback transaction when constraints creation fails", async () => {
    // Make constraints creation fail
    mockTradingConstraintsService.createConstraints.mockRejectedValue(
      new Error("Invalid constraints"),
    );

    await expect(
      competitionService.createCompetition({
        name: "Competition with Bad Constraints",
        description: "Constraints will fail",
        tradingConstraints: {
          minimumPairAgeHours: -1, // Invalid value
        },
      }),
    ).rejects.toThrow("Invalid constraints");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition and rewards were created but the whole transaction should roll back
    expect(mockCompetitionRepo.create).toHaveBeenCalled();
    expect(mockTradingConstraintsService.createConstraints).toHaveBeenCalled();
  });
});
