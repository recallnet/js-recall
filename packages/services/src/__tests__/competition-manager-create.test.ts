import { randomUUID } from "crypto";
import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { UserRepository } from "@recallnet/db/repositories/user";
import { Database, Transaction } from "@recallnet/db/types";

import type { AgentService } from "../agent.service.js";
import type { AgentRankService } from "../agentrank.service.js";
import type { BalanceService } from "../balance.service.js";
import type { CompetitionRewardService } from "../competition-reward.service.js";
import { CompetitionService } from "../competition.service.js";
import type { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import type { TradeSimulatorService } from "../trade-simulator.service.js";
import type { TradingConstraintsService } from "../trading-constraints.service.js";
import type { VoteService } from "../vote.service.js";

describe("CompetitionService - createCompetition", () => {
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let voteService: MockProxy<VoteService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let stakesRepo: MockProxy<StakesRepository>;
  let userRepo: MockProxy<UserRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  let competitionService: CompetitionService;

  beforeEach(() => {
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    voteService = mock<VoteService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
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
    competitionRewardService.createRewards.mockResolvedValue([
      {
        id: "reward1",
        competitionId: "comp-123",
        agentId: null,
        rank: 1,
        reward: 5000,
      },
      {
        id: "reward2",
        competitionId: "comp-123",
        agentId: null,
        rank: 2,
        reward: 2500,
      },
      {
        id: "reward3",
        competitionId: "comp-123",
        agentId: null,
        rank: 3,
        reward: 1000,
      },
    ]);

    tradingConstraintsService.createConstraints.mockResolvedValue({
      createdAt: new Date(),
      updatedAt: new Date(),
      competitionId: "comp-123",
      minimumPairAgeHours: 48,
      minimum24hVolumeUsd: 20000,
      minimumLiquidityUsd: 100000,
      minimumFdvUsd: 200000,
      minTradesPerDay: null,
    });

    // Create competition manager instance with all mocked dependencies
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      agentService,
      agentRankService,
      voteService,
      tradingConstraintsService,
      competitionRewardService,
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
        rateLimiting: {
          windowMs: 60000,
          maxRequests: 100,
        },
        specificChainBalances: {
          eth: {
            eth: 1,
          },
        },
      },
      logger,
    );
    // Mock the repository functions
    competitionRepo.create.mockImplementation(async () => ({
      competitionId: randomUUID(),
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
      minimumStake: null,
      registeredParticipants: 0,
      sandboxMode: false,
      crossChainTradingType: "disallowAll",
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should create competition atomically with all components", async () => {
    // Setup the transaction mock to execute the callback
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

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
    expect(competitionRepo.create).toHaveBeenCalledWith(
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
    expect(competitionRewardService.createRewards).toHaveBeenCalledWith(
      expect.any(String), // Competition ID
      {
        1: 5000,
        2: 2500,
        3: 1000,
      },
      expect.any(Object), // The transaction object
    );

    // Verify constraints were created with transaction
    expect(tradingConstraintsService.createConstraints).toHaveBeenCalledWith(
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
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "No Rewards Competition",
      description: "Test without rewards",
      tradingType: "disallowAll",
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(competitionRepo.create).toHaveBeenCalled();
    expect(competitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(tradingConstraintsService.createConstraints).toHaveBeenCalled();

    expect(result.rewards).toEqual([]);
  });

  test("should rollback transaction when competition creation fails", async () => {
    // Setup the transaction mock to execute the callback
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    // Make competition creation fail
    competitionRepo.create.mockRejectedValue(new Error("Database error"));

    await expect(
      competitionService.createCompetition({
        name: "Failing Competition",
        description: "This should fail",
      }),
    ).rejects.toThrow("Database error");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify that rewards and constraints were not created
    expect(competitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(tradingConstraintsService.createConstraints).not.toHaveBeenCalled();
  });

  test("should rollback transaction when rewards creation fails", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    // Make rewards creation fail
    competitionRewardService.createRewards!.mockRejectedValue(
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
    expect(competitionRepo.create).toHaveBeenCalled();
    expect(competitionRewardService.createRewards).toHaveBeenCalled();
  });

  test("should rollback transaction when constraints creation fails", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    // Make constraints creation fail
    tradingConstraintsService.createConstraints!.mockRejectedValue(
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
    expect(competitionRepo.create).toHaveBeenCalled();
    expect(tradingConstraintsService.createConstraints).toHaveBeenCalled();
  });

  test("should create competition with minimum stake requirement", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "Staked Competition",
      description: "Competition with minimum stake",
      minimumStake: 1000,
      tradingType: "disallowAll",
      sandboxMode: false,
      type: "trading",
    });

    // Verify transaction was called
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition was created with minimum stake
    expect(competitionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Staked Competition",
        description: "Competition with minimum stake",
        minimumStake: 1000,
        crossChainTradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
        status: "pending",
      }),
      expect.any(Object), // The transaction object
    );

    // Verify result structure includes minimum stake
    expect(result).toMatchObject({
      name: "Staked Competition",
      minimumStake: 1000,
      rewards: expect.any(Array),
      tradingConstraints: expect.any(Object),
    });
  });

  test("should create competition without minimum stake (null)", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "No Stake Competition",
      description: "Competition without minimum stake",
      tradingType: "disallowAll",
    });

    // Verify competition was created with null minimum stake
    expect(competitionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "No Stake Competition",
        description: "Competition without minimum stake",
        minimumStake: null,
        crossChainTradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
        status: "pending",
      }),
      expect.any(Object), // The transaction object
    );

    // Verify result structure
    expect(result).toMatchObject({
      name: "No Stake Competition",
      minimumStake: null,
      rewards: expect.any(Array),
      tradingConstraints: expect.any(Object),
    });
  });
});
