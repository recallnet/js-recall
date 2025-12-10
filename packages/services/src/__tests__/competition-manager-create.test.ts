import { randomUUID } from "crypto";
import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { ArenaRepository } from "@recallnet/db/repositories/arena";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PaperTradingConfigRepository } from "@recallnet/db/repositories/paper-trading-config";
import { PaperTradingInitialBalancesRepository } from "@recallnet/db/repositories/paper-trading-initial-balances";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { UserRepository } from "@recallnet/db/repositories/user";
import { Database, Transaction } from "@recallnet/db/types";

import type { AgentService } from "../agent.service.js";
import type { AgentRankService } from "../agentrank.service.js";
import type { BalanceService } from "../balance.service.js";
import type { BoostBonusService } from "../boost-bonus.service.js";
import type { CompetitionRewardService } from "../competition-reward.service.js";
import { CompetitionService } from "../competition.service.js";
import type { EigenaiService } from "../eigenai.service.js";
import { specificChainTokens } from "../lib/config-utils.js";
import type { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import type { PriceTrackerService } from "../price-tracker.service.js";
import { RewardsService } from "../rewards.service.js";
import type { SportsService } from "../sports.service.js";
import type { SpotDataProcessor } from "../spot-data-processor.service.js";
import type { TradeSimulatorService } from "../trade-simulator.service.js";
import type { TradingConstraintsService } from "../trading-constraints.service.js";
import { BlockchainType } from "../types/index.js";

describe("CompetitionService - createCompetition", () => {
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let priceTrackerService: MockProxy<PriceTrackerService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let rewardsService: MockProxy<RewardsService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let spotDataProcessor: MockProxy<SpotDataProcessor>;
  let spotLiveRepo: MockProxy<SpotLiveRepository>;
  let boostBonusService: MockProxy<BoostBonusService>;
  let eigenaiService: MockProxy<EigenaiService>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let arenaRepo: MockProxy<ArenaRepository>;
  let sportsService: MockProxy<SportsService>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let paperTradingConfigRepo: MockProxy<PaperTradingConfigRepository>;
  let paperTradingInitialBalancesRepo: MockProxy<PaperTradingInitialBalancesRepository>;
  let stakesRepo: MockProxy<StakesRepository>;
  let tradeRepo: MockProxy<TradeRepository>;
  let userRepo: MockProxy<UserRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  const mockTx = mock<Transaction>();

  let competitionService: CompetitionService;

  beforeEach(() => {
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    priceTrackerService = mock<PriceTrackerService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
    rewardsService = mock<RewardsService>();
    perpsDataProcessor = mock<PerpsDataProcessor>();
    spotDataProcessor = mock<SpotDataProcessor>();
    spotLiveRepo = mock<SpotLiveRepository>();
    boostBonusService = mock<BoostBonusService>();
    eigenaiService = mock<EigenaiService>();
    agentRepo = mock<AgentRepository>();
    agentScoreRepo = mock<AgentScoreRepository>();
    arenaRepo = mock<ArenaRepository>();
    sportsService = mock<SportsService>();
    perpsRepo = mock<PerpsRepository>();
    competitionRepo = mock<CompetitionRepository>();
    paperTradingConfigRepo = mock<PaperTradingConfigRepository>();
    paperTradingInitialBalancesRepo =
      mock<PaperTradingInitialBalancesRepository>();
    stakesRepo = mock<StakesRepository>();
    tradeRepo = mock<TradeRepository>();
    userRepo = mock<UserRepository>();
    mockDb = mock<Database>();
    // Mock database transaction method
    mockDb.transaction.mockImplementation(async (callback) => {
      return await callback(mockTx);
    });
    logger = mock<Logger>();

    // Setup default mock return values
    arenaRepo.findById.mockImplementation(async (id) => {
      if (id === "default-paper-arena" || id === "test-arena") {
        return {
          id,
          name: id === "test-arena" ? "Test Arena" : "Default Paper Arena",
          kind: "default",
          createdBy: null,
          skill: "spot_paper_trading",
          category: "crypto_trading",
          venues: null,
          chains: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === "default-perps-arena") {
        return {
          id,
          name: "Default Perps Arena",
          kind: "default",
          createdBy: null,
          skill: "perpetual_futures",
          category: "crypto_trading",
          venues: null,
          chains: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return undefined;
    });

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

    // Mock paperTradingInitialBalancesRepo.findByCompetitionId to return empty array by default
    vi.mocked(
      paperTradingInitialBalancesRepo.findByCompetitionId,
    ).mockResolvedValue([]);

    // Create competition manager instance with all mocked dependencies
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      priceTrackerService,
      agentService,
      agentRankService,
      tradingConstraintsService,
      competitionRewardService,
      rewardsService,
      perpsDataProcessor,
      spotDataProcessor,
      boostBonusService,
      eigenaiService,
      agentRepo,
      agentScoreRepo,
      arenaRepo,
      sportsService,
      perpsRepo,
      spotLiveRepo,
      competitionRepo,
      paperTradingConfigRepo,
      paperTradingInitialBalancesRepo,
      stakesRepo,
      tradeRepo,
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
        specificChainTokens,
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
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      minimumStake: null,
      registeredParticipants: 0,
      sandboxMode: false,
      crossChainTradingType: "disallowAll",
      evaluationMetric: "calmar_ratio",
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
      displayState: null,
      arenaId: "default-paper-arena",
      engineId: "spot_paper_trading" as const,
      engineVersion: "1.0.0",
      rewardsIneligible: null,
      boostTimeDecayRate: null,
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
      arenaId: "default-paper-arena",
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
      paperTradingInitialBalances: [
        {
          specificChain: "eth",
          tokenSymbol: "usdc",
          amount: 10000,
        },
      ],
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
      arenaId: "default-paper-arena",
      tradingType: "disallowAll",
      paperTradingInitialBalances: [
        {
          specificChain: "eth",
          tokenSymbol: "usdc",
          amount: 10000,
        },
      ],
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(competitionRepo.create).toHaveBeenCalled();
    expect(competitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(tradingConstraintsService.createConstraints).toHaveBeenCalled();

    expect(result.rewards).toEqual([]);
  });

  test("should create competition with arena routing and participation rules", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "Competition with Arena Link",
      description: "Test arena routing and participation rules",
      tradingType: "disallowAll",
      type: "trading",
      arenaId: "test-arena",
      engineId: "spot_paper_trading",
      engineVersion: "1.0.0",
      vips: ["agent-1", "agent-2"],
      allowlist: ["agent-3", "agent-4"],
      blocklist: ["agent-5"],
      minRecallRank: 100,
      allowlistOnly: true,
      agentAllocation: 5000,
      agentAllocationUnit: "RECALL",
      boosterAllocation: 2000,
      boosterAllocationUnit: "USDC",
      rewardRules: "Top 10 get rewards",
      rewardDetails: "Distributed weekly",
      displayState: "active",
      paperTradingInitialBalances: [
        {
          specificChain: "eth",
          tokenSymbol: "usdc",
          amount: 10000,
        },
      ],
    });

    // Verify transaction was called
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition was created with all fields
    expect(competitionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Competition with Arena Link",
        description: "Test arena routing and participation rules",
        arenaId: "test-arena",
        engineId: "spot_paper_trading",
        engineVersion: "1.0.0",
        vips: ["agent-1", "agent-2"],
        allowlist: ["agent-3", "agent-4"],
        blocklist: ["agent-5"],
        minRecallRank: 100,
        allowlistOnly: true,
        agentAllocation: 5000,
        agentAllocationUnit: "RECALL",
        boosterAllocation: 2000,
        boosterAllocationUnit: "USDC",
        rewardRules: "Top 10 get rewards",
        rewardDetails: "Distributed weekly",
        displayState: "active",
      }),
      expect.any(Object), // The transaction object
    );

    // Verify result structure
    expect(result).toMatchObject({
      name: "Competition with Arena Link",
    });
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
        arenaId: "default-paper-arena",
        paperTradingInitialBalances: [
          {
            specificChain: "eth",
            tokenSymbol: "usdc",
            amount: 10000,
          },
        ],
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
        arenaId: "default-paper-arena",
        rewards: {
          1: 1000,
          "-1": 500, // Invalid rank
        },
        paperTradingInitialBalances: [
          {
            specificChain: "eth",
            tokenSymbol: "usdc",
            amount: 10000,
          },
        ],
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
        arenaId: "default-paper-arena",
        tradingConstraints: {
          minimumPairAgeHours: -1, // Invalid value
        },
        paperTradingInitialBalances: [
          {
            specificChain: "eth",
            tokenSymbol: "usdc",
            amount: 10000,
          },
        ],
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
      arenaId: "default-paper-arena",
      minimumStake: 1000,
      tradingType: "disallowAll",
      sandboxMode: false,
      type: "trading",
      paperTradingInitialBalances: [
        {
          specificChain: "eth",
          tokenSymbol: "usdc",
          amount: 10000,
        },
      ],
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
      arenaId: "default-paper-arena",
      tradingType: "disallowAll",
      paperTradingInitialBalances: [
        {
          specificChain: "eth",
          tokenSymbol: "usdc",
          amount: 10000,
        },
      ],
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

  test("should create perps competition with minFundingThreshold", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "Perps Competition",
      description: "Test perps competition with min funding",
      arenaId: "default-perps-arena",
      type: "perpetual_futures",
      sandboxMode: false,
      perpsProvider: {
        provider: "symphony",
        initialCapital: 500,
        selfFundingThreshold: 0,
        minFundingThreshold: 100, // NEW: Test the field
      },
    });

    // Verify perps config was created with minFundingThreshold
    expect(perpsRepo.createPerpsCompetitionConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: expect.any(String),
        initialCapital: "500",
        selfFundingThresholdUsd: "0",
        minFundingThreshold: "100", // NEW: Verify it's passed
      }),
      expect.any(Object), // The transaction object
    );

    expect(result.name).toBe("Perps Competition");
  });

  test("should create perps competition without minFundingThreshold", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "Perps Competition No Min",
      description: "Test perps competition without min funding",
      arenaId: "default-perps-arena",
      type: "perpetual_futures",
      sandboxMode: false,
      perpsProvider: {
        provider: "hyperliquid",
        initialCapital: 1000,
        selfFundingThreshold: 0,
        // minFundingThreshold not provided - should default to null, meaning no threshold enforcement
      },
    });

    // Verify perps config was created with null minFundingThreshold
    expect(perpsRepo.createPerpsCompetitionConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: expect.any(String),
        initialCapital: "1000",
        selfFundingThresholdUsd: "0",
        minFundingThreshold: null, // Should be null when not provided
      }),
      expect.any(Object),
    );

    expect(result.name).toBe("Perps Competition No Min");
  });

  test("should reject when arena does not exist", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    await expect(
      competitionService.createCompetition({
        name: "Competition with Invalid Arena",
        description: "Arena does not exist",
        arenaId: "nonexistent-arena",
        tradingType: "disallowAll",
        paperTradingInitialBalances: [
          {
            specificChain: "eth",
            tokenSymbol: "usdc",
            amount: 10000,
          },
        ],
      }),
    ).rejects.toThrow("Arena with ID nonexistent-arena not found");

    // Verify transaction was never called
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  test("should reject when competition type is incompatible with arena skill", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    // Trying to create a perpetual_futures competition in a spot_paper_trading arena
    await expect(
      competitionService.createCompetition({
        name: "Mismatched Competition",
        description: "Wrong type for arena",
        arenaId: "default-paper-arena", // spot_paper_trading arena
        type: "perpetual_futures", // incompatible type
        sandboxMode: false,
        perpsProvider: {
          provider: "hyperliquid",
          initialCapital: 1000,
          selfFundingThreshold: 0,
        },
      }),
    ).rejects.toThrow(
      'Competition type "perpetual_futures" incompatible with arena skill "spot_paper_trading"',
    );

    // Verify transaction was never called
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  test("should allow trading type in spot_paper_trading arena", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = mock<Transaction>();
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "Correct Trading Competition",
      description: "Trading type matches spot_paper_trading arena",
      arenaId: "default-paper-arena",
      type: "trading", // compatible with spot_paper_trading
      tradingType: "disallowAll",
      paperTradingInitialBalances: [
        {
          specificChain: "eth",
          tokenSymbol: "usdc",
          amount: 10000,
        },
      ],
    });

    expect(result.name).toBe("Correct Trading Competition");
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("CompetitionService - startCompetition with minFundingThreshold", () => {
  let competitionService: CompetitionService;
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let priceTrackerService: MockProxy<PriceTrackerService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let rewardsService: MockProxy<RewardsService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let spotDataProcessor: MockProxy<SpotDataProcessor>;
  let spotLiveRepo: MockProxy<SpotLiveRepository>;
  let boostBonusService: MockProxy<BoostBonusService>;
  let eigenaiService: MockProxy<EigenaiService>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let arenaRepo: MockProxy<ArenaRepository>;
  let sportsService: MockProxy<SportsService>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let paperTradingConfigRepo: MockProxy<PaperTradingConfigRepository>;
  let paperTradingInitialBalancesRepo: MockProxy<PaperTradingInitialBalancesRepository>;
  let stakesRepo: MockProxy<StakesRepository>;
  let tradeRepo: MockProxy<TradeRepository>;
  let userRepo: MockProxy<UserRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  const mockTx = mock<Transaction>();
  const mockCompetitionId = randomUUID();

  beforeEach(() => {
    // Create all mocks
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    priceTrackerService = mock<PriceTrackerService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
    rewardsService = mock<RewardsService>();
    perpsDataProcessor = mock<PerpsDataProcessor>();
    spotDataProcessor = mock<SpotDataProcessor>();
    spotLiveRepo = mock<SpotLiveRepository>();
    boostBonusService = mock<BoostBonusService>();
    eigenaiService = mock<EigenaiService>();
    agentRepo = mock<AgentRepository>();
    agentScoreRepo = mock<AgentScoreRepository>();
    arenaRepo = mock<ArenaRepository>();
    sportsService = mock<SportsService>();
    perpsRepo = mock<PerpsRepository>();
    competitionRepo = mock<CompetitionRepository>();
    paperTradingConfigRepo = mock<PaperTradingConfigRepository>();
    paperTradingInitialBalancesRepo =
      mock<PaperTradingInitialBalancesRepository>();
    stakesRepo = mock<StakesRepository>();
    tradeRepo = mock<TradeRepository>();
    userRepo = mock<UserRepository>();
    mockDb = mock<Database>();
    // Mock database transaction method
    mockDb.transaction.mockImplementation(async (callback) => {
      return await callback(mockTx);
    });
    logger = mock<Logger>();

    // Mock paperTradingInitialBalancesRepo.findByCompetitionId to return empty array by default
    vi.mocked(
      paperTradingInitialBalancesRepo.findByCompetitionId,
    ).mockResolvedValue([]);

    // Create service instance
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      priceTrackerService,
      agentService,
      agentRankService,
      tradingConstraintsService,
      competitionRewardService,
      rewardsService,
      perpsDataProcessor,
      spotDataProcessor,
      boostBonusService,
      eigenaiService,
      agentRepo,
      agentScoreRepo,
      arenaRepo,
      sportsService,
      perpsRepo,
      spotLiveRepo,
      competitionRepo,
      paperTradingConfigRepo,
      paperTradingInitialBalancesRepo,
      stakesRepo,
      tradeRepo,
      userRepo,
      mockDb,
      {
        evmChains: ["eth", "polygon", "base", "arbitrum", "optimism"],
        maxTradePercentage: 25,
        rateLimiting: {
          windowMs: 60000,
          maxRequests: 100,
        },
        specificChainBalances: {},
        specificChainTokens,
      },
      logger,
    );
  });

  test("should remove agents below minFundingThreshold during perps competition start", async () => {
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();
    const agent3Id = randomUUID();

    // Mock competition
    const mockCompetition = {
      id: mockCompetitionId,
      name: "Test Perps Competition",
      description: null,
      type: "perpetual_futures" as const,
      status: "pending" as const,
      externalUrl: null,
      imageUrl: null,
      startDate: null,
      endDate: null,
      joinStartDate: null,
      joinEndDate: null,
      boostStartDate: null,
      boostEndDate: null,
      requiresAgoraId: false,
      maxParticipants: null,
      registeredParticipants: 3,
      minimumStake: null,
      sandboxMode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      competitionId: mockCompetitionId,
      crossChainTradingType: "allow" as const,
      evaluationMetric: "calmar_ratio" as const,
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
      rewardsIneligible: null,
      displayState: null,
      arenaId: "default-perps-arena",
      engineId: "perpetual_futures" as const,
      engineVersion: "1.0.0",
      boostTimeDecayRate: null,
    };

    // Mock perps config with minFundingThreshold
    const mockPerpsConfig = {
      competitionId: mockCompetitionId,
      minFundingThreshold: "250", // $250 threshold
      initialCapital: "500",
      selfFundingThresholdUsd: "0",
      dataSource: "external_api" as const,
      dataSourceConfig: {
        type: "external_api" as const,
        provider: "symphony" as const,
      },
      evaluationMetric: "calmar_ratio" as const,
      inactivityHours: null,
      createdAt: null,
      updatedAt: null,
    };

    // Mock portfolio snapshots - agent2 below threshold, agent3 has no snapshot
    const mockSnapshots = [
      {
        agentId: agent1Id,
        totalValue: 500,
        competitionId: mockCompetitionId,
        timestamp: new Date(),
        id: 1,
      }, // Above threshold
      {
        agentId: agent2Id,
        totalValue: 100,
        competitionId: mockCompetitionId,
        timestamp: new Date(),
        id: 2,
      }, // Below threshold
      // agent3 has no snapshot (sync failed)
    ];

    // Setup mocks
    competitionRepo.findById.mockResolvedValue(mockCompetition);
    competitionRepo.getCompetitionAgents.mockResolvedValue([
      agent1Id,
      agent2Id,
      agent3Id,
    ]);
    competitionRepo.getLatestPortfolioSnapshots.mockResolvedValue(
      mockSnapshots,
    );
    agentService.getAgentsForCompetition.mockResolvedValue({
      agents: [],
      total: 0,
    });

    // Mock agent service for agent validation
    agentService.getAgentsByIds.mockResolvedValue([
      {
        id: agent1Id,
        name: "Agent 1",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent1Id.replace(/-/g, "").substring(0, 40),
        handle: "agent1",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-1",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
      {
        id: agent2Id,
        name: "Agent 2",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent2Id.replace(/-/g, "").substring(0, 40),
        handle: "agent2",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-2",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
      {
        id: agent3Id,
        name: "Agent 3",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent3Id.replace(/-/g, "").substring(0, 40),
        handle: "agent3",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-3",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
    ]);
    competitionRepo.getAgentCompetitionRecord.mockResolvedValue({
      status: "active",
      deactivationReason: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }); // Agent is IN the competition
    competitionRepo.updateAgentCompetitionStatus.mockResolvedValue(true); // For removeAgentFromCompetition
    competitionRepo.update.mockResolvedValue({
      ...mockCompetition,
      status: "active",
    });

    perpsRepo.getPerpsCompetitionConfig.mockResolvedValue(mockPerpsConfig);

    // Mock successful perps sync
    perpsDataProcessor.processPerpsCompetition.mockResolvedValue({
      syncResult: {
        successful: [
          {
            agentId: agent1Id,
            positions: [],
            summary: {
              id: "1",
              agentId: agent1Id,
              competitionId: mockCompetitionId,
              totalEquity: "500",
              initialCapital: "500",
              availableBalance: "500",
              marginUsed: "0",
              totalPnl: "0",
              totalRealizedPnl: "0",
              totalUnrealizedPnl: "0",
              totalVolume: "0",
              totalFeesPaid: "0",
              totalTrades: 0,
              averageTradeSize: "0",
              openPositionsCount: 0,
              closedPositionsCount: 0,
              liquidatedPositionsCount: 0,
              roi: "0",
              roiPercent: "0",
              accountStatus: "active",
              timestamp: new Date(),
              rawData: null,
            },
          },
          {
            agentId: agent2Id,
            positions: [],
            summary: {
              id: "2",
              agentId: agent2Id,
              competitionId: mockCompetitionId,
              totalEquity: "100",
              initialCapital: "100",
              availableBalance: "100",
              marginUsed: "0",
              totalPnl: "0",
              totalRealizedPnl: "0",
              totalUnrealizedPnl: "0",
              totalVolume: "0",
              totalFeesPaid: "0",
              totalTrades: 0,
              averageTradeSize: "0",
              openPositionsCount: 0,
              closedPositionsCount: 0,
              liquidatedPositionsCount: 0,
              roi: "0",
              roiPercent: "0",
              accountStatus: "active",
              timestamp: new Date(),
              rawData: null,
            },
          },
        ],
        failed: [{ agentId: agent3Id, error: new Error("API timeout") }], // agent3 failed to sync
      },
    });

    // Call startCompetition
    const result = await competitionService.startCompetition(
      mockCompetitionId,
      [agent1Id, agent2Id, agent3Id],
    );

    // Verify agent2 was removed for being below threshold
    expect(competitionRepo.updateAgentCompetitionStatus).toHaveBeenCalledWith(
      mockCompetitionId,
      agent2Id,
      "disqualified",
      expect.stringContaining("Insufficient initial funding"),
    );

    // Verify agent3 was NOT removed (no snapshot due to sync failure)
    expect(
      competitionRepo.updateAgentCompetitionStatus,
    ).not.toHaveBeenCalledWith(
      mockCompetitionId,
      agent3Id,
      expect.any(String),
      expect.any(String),
    );

    // Verify final agent list only has agent1 and agent3
    expect(result.agentIds).toEqual([agent1Id, agent3Id]);

    // Verify logs
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Enforcing minimum funding threshold of $250"),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `Agent ${agent2Id} has portfolio value $100.00, below threshold $250`,
      ),
    );
  });

  test("should not enforce threshold when minFundingThreshold is not set", async () => {
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();

    // Mock competition
    const mockCompetition = {
      id: mockCompetitionId,
      name: "Test Perps Competition",
      description: null,
      type: "perpetual_futures" as const,
      status: "pending" as const,
      externalUrl: null,
      imageUrl: null,
      startDate: null,
      endDate: null,
      joinStartDate: null,
      joinEndDate: null,
      boostStartDate: null,
      boostEndDate: null,
      requiresAgoraId: false,
      maxParticipants: null,
      registeredParticipants: 2,
      minimumStake: null,
      sandboxMode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      competitionId: mockCompetitionId,
      crossChainTradingType: "allow" as const,
      evaluationMetric: "calmar_ratio" as const,
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
      rewardsIneligible: null,
      displayState: null,
      arenaId: "default-perps-arena",
      engineId: "perpetual_futures" as const,
      engineVersion: "1.0.0",
      boostTimeDecayRate: null,
    };

    // Mock perps config WITHOUT minFundingThreshold
    const mockPerpsConfig = {
      competitionId: mockCompetitionId,
      minFundingThreshold: null, // No threshold
      initialCapital: "500",
      selfFundingThresholdUsd: "0",
      dataSource: "external_api" as const,
      dataSourceConfig: {
        type: "external_api" as const,
        provider: "symphony" as const,
      },
      evaluationMetric: "calmar_ratio" as const,
      inactivityHours: null,
      createdAt: null,
      updatedAt: null,
    };

    // Setup mocks
    competitionRepo.findById.mockResolvedValue(mockCompetition);
    competitionRepo.getCompetitionAgents.mockResolvedValue([
      agent1Id,
      agent2Id,
    ]);
    competitionRepo.update.mockResolvedValue({
      ...mockCompetition,
      status: "active",
    });

    // Mock agent service - return empty pre-registered agents
    agentService.getAgentsForCompetition.mockResolvedValue({
      agents: [],
      total: 0,
    });

    // Mock agent service for agent validation
    agentService.getAgentsByIds.mockResolvedValue([
      {
        id: agent1Id,
        name: "Agent 1",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent1Id.replace(/-/g, "").substring(0, 40),
        handle: "agent1",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-1",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
      {
        id: agent2Id,
        name: "Agent 2",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent2Id.replace(/-/g, "").substring(0, 40),
        handle: "agent2",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-2",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
    ]);

    perpsRepo.getPerpsCompetitionConfig.mockResolvedValue(mockPerpsConfig);

    // Mock successful perps sync
    perpsDataProcessor.processPerpsCompetition.mockResolvedValue({
      syncResult: {
        successful: [
          {
            agentId: agent1Id,
            positions: [],
            summary: {
              id: "1",
              agentId: agent1Id,
              competitionId: mockCompetitionId,
              totalEquity: "500",
              initialCapital: "500",
              availableBalance: "500",
              marginUsed: "0",
              totalPnl: "0",
              totalRealizedPnl: "0",
              totalUnrealizedPnl: "0",
              totalVolume: "0",
              totalFeesPaid: "0",
              totalTrades: 0,
              averageTradeSize: "0",
              openPositionsCount: 0,
              closedPositionsCount: 0,
              liquidatedPositionsCount: 0,
              roi: "0",
              roiPercent: "0",
              accountStatus: "active",
              timestamp: new Date(),
              rawData: null,
            },
          },
          {
            agentId: agent2Id,
            positions: [],
            summary: {
              id: "2",
              agentId: agent2Id,
              competitionId: mockCompetitionId,
              totalEquity: "300",
              initialCapital: "300",
              availableBalance: "300",
              marginUsed: "0",
              totalPnl: "0",
              totalRealizedPnl: "0",
              totalUnrealizedPnl: "0",
              totalVolume: "0",
              totalFeesPaid: "0",
              totalTrades: 0,
              averageTradeSize: "0",
              openPositionsCount: 0,
              closedPositionsCount: 0,
              liquidatedPositionsCount: 0,
              roi: "0",
              roiPercent: "0",
              accountStatus: "active",
              timestamp: new Date(),
              rawData: null,
            },
          },
        ],
        failed: [],
      },
    });

    // Call startCompetition
    const result = await competitionService.startCompetition(
      mockCompetitionId,
      [agent1Id, agent2Id],
    );

    // Verify no agents were removed
    expect(competitionRepo.updateAgentCompetitionStatus).not.toHaveBeenCalled();

    // Verify getLatestPortfolioSnapshots was not called (no threshold to check)
    expect(competitionRepo.getLatestPortfolioSnapshots).not.toHaveBeenCalled();

    // Verify all agents remain
    expect(result.agentIds).toEqual([agent1Id, agent2Id]);
  });

  test("should handle agent exactly at threshold (boundary test)", async () => {
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();

    // Mock competition
    const mockCompetition = {
      id: mockCompetitionId,
      name: "Test Perps Competition",
      description: null,
      type: "perpetual_futures" as const,
      status: "pending" as const,
      externalUrl: null,
      imageUrl: null,
      startDate: null,
      endDate: null,
      joinStartDate: null,
      joinEndDate: null,
      boostStartDate: null,
      boostEndDate: null,
      requiresAgoraId: false,
      maxParticipants: null,
      registeredParticipants: 2,
      minimumStake: null,
      sandboxMode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      competitionId: mockCompetitionId,
      crossChainTradingType: "allow" as const,
      evaluationMetric: "calmar_ratio" as const,
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
      rewardsIneligible: null,
      displayState: null,
      arenaId: "default-perps-arena",
      engineId: "perpetual_futures" as const,
      engineVersion: "1.0.0",
      boostTimeDecayRate: null,
    };

    // Mock perps config with minFundingThreshold
    const mockPerpsConfig = {
      competitionId: mockCompetitionId,
      minFundingThreshold: "250", // $250 threshold
      initialCapital: "500",
      selfFundingThresholdUsd: "0",
      dataSource: "external_api" as const,
      dataSourceConfig: {
        type: "external_api" as const,
        provider: "symphony" as const,
      },
      evaluationMetric: "calmar_ratio" as const,
      inactivityHours: null,
      createdAt: null,
      updatedAt: null,
    };

    // Mock portfolio snapshots - one exactly at threshold, one slightly below
    const mockSnapshots = [
      {
        agentId: agent1Id,
        totalValue: 250,
        competitionId: mockCompetitionId,
        timestamp: new Date(),
        id: 1,
      }, // Exactly at threshold
      {
        agentId: agent2Id,
        totalValue: 249.99,
        competitionId: mockCompetitionId,
        timestamp: new Date(),
        id: 2,
      }, // Just below
    ];

    // Setup mocks
    competitionRepo.findById.mockResolvedValue(mockCompetition);
    competitionRepo.getCompetitionAgents.mockResolvedValue([
      agent1Id,
      agent2Id,
    ]);
    competitionRepo.getLatestPortfolioSnapshots.mockResolvedValue(
      mockSnapshots,
    );

    // Mock agent service - return empty pre-registered agents
    agentService.getAgentsForCompetition.mockResolvedValue({
      agents: [],
      total: 0,
    });

    // Mock agent service for agent validation
    agentService.getAgentsByIds.mockResolvedValue([
      {
        id: agent1Id,
        name: "Agent 1",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent1Id.replace(/-/g, "").substring(0, 40),
        handle: "agent1",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-1",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
      {
        id: agent2Id,
        name: "Agent 2",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
        walletAddress: "0x" + agent2Id.replace(/-/g, "").substring(0, 40),
        handle: "agent2",
        email: null,
        ownerId: randomUUID(),
        imageUrl: null,
        apiKey: "test-key-2",
        apiKeyHash: null,
        metadata: null,
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
      },
    ]);

    competitionRepo.getAgentCompetitionRecord.mockResolvedValue({
      status: "active",
      deactivationReason: null,
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }); // Agent is IN the competition
    competitionRepo.updateAgentCompetitionStatus.mockResolvedValue(true);
    competitionRepo.update.mockResolvedValue({
      ...mockCompetition,
      status: "active",
    });

    perpsRepo.getPerpsCompetitionConfig.mockResolvedValue(mockPerpsConfig);

    perpsDataProcessor.processPerpsCompetition.mockResolvedValue({
      syncResult: {
        successful: [
          {
            agentId: agent1Id,
            positions: [],
            summary: {
              id: "1",
              agentId: agent1Id,
              competitionId: mockCompetitionId,
              totalEquity: "250",
              initialCapital: "250",
              availableBalance: "250",
              marginUsed: "0",
              totalPnl: "0",
              totalRealizedPnl: "0",
              totalUnrealizedPnl: "0",
              totalVolume: "0",
              totalFeesPaid: "0",
              totalTrades: 0,
              averageTradeSize: "0",
              openPositionsCount: 0,
              closedPositionsCount: 0,
              liquidatedPositionsCount: 0,
              roi: "0",
              roiPercent: "0",
              accountStatus: "active",
              timestamp: new Date(),
              rawData: null,
            },
          },
          {
            agentId: agent2Id,
            positions: [],
            summary: {
              id: "2",
              agentId: agent2Id,
              competitionId: mockCompetitionId,
              totalEquity: "249.99",
              initialCapital: "249.99",
              availableBalance: "249.99",
              marginUsed: "0",
              totalPnl: "0",
              totalRealizedPnl: "0",
              totalUnrealizedPnl: "0",
              totalVolume: "0",
              totalFeesPaid: "0",
              totalTrades: 0,
              averageTradeSize: "0",
              openPositionsCount: 0,
              closedPositionsCount: 0,
              liquidatedPositionsCount: 0,
              roi: "0",
              roiPercent: "0",
              accountStatus: "active",
              timestamp: new Date(),
              rawData: null,
            },
          },
        ],
        failed: [],
      },
    });

    // Call startCompetition
    const result = await competitionService.startCompetition(
      mockCompetitionId,
      [agent1Id, agent2Id],
    );

    // Verify only agent2 was removed (below threshold)
    expect(competitionRepo.updateAgentCompetitionStatus).toHaveBeenCalledWith(
      mockCompetitionId,
      agent2Id,
      "disqualified",
      expect.stringContaining("Insufficient initial funding: $249.99 < $250"),
    );

    // Verify agent1 was NOT removed (at threshold)
    expect(
      competitionRepo.updateAgentCompetitionStatus,
    ).not.toHaveBeenCalledWith(
      mockCompetitionId,
      agent1Id,
      expect.any(String),
      expect.any(String),
    );

    // Verify final agent list only has agent1
    expect(result.agentIds).toEqual([agent1Id]);
  });

  describe("spot_live_trading competition creation", () => {
    beforeEach(() => {
      // Setup arena for spot live
      arenaRepo.findById.mockImplementation(async (id) => {
        if (id === "spot-live-arena" || id === "test-arena") {
          return {
            id,
            name: "Spot Live Arena",
            kind: "default",
            createdBy: null,
            skill: "spot_live_trading",
            category: "crypto_trading",
            venues: null,
            chains: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return undefined;
      });

      // Setup spot live repo mocks
      spotLiveRepo.createSpotLiveCompetitionConfig.mockImplementation(
        async () => ({
          competitionId: randomUUID(),
          dataSource: "rpc_direct",
          dataSourceConfig: {},
          selfFundingThresholdUsd: "10.00",
          minFundingThreshold: null,
          inactivityHours: 24,
          syncIntervalMinutes: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      spotLiveRepo.batchCreateCompetitionChains.mockResolvedValue([]);
      spotLiveRepo.batchCreateAllowedProtocols.mockResolvedValue([]);
      spotLiveRepo.batchCreateAllowedTokens.mockResolvedValue([]);

      // Mock transaction to pass through callback and return result
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {} as Transaction;
        return await callback(mockTx);
      });
    });

    test("should reject if spotLiveConfig is missing", async () => {
      await expect(
        competitionService.createCompetition({
          name: "Spot Live Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
        }),
      ).rejects.toThrow(
        "Spot live configuration is required for spot_live_trading competitions",
      );
    });

    test("should reject protocol on non-enabled chain", async () => {
      await expect(
        competitionService.createCompetition({
          name: "Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
          spotLiveConfig: {
            dataSource: "rpc_direct",
            dataSourceConfig: {
              type: "rpc_direct",
              provider: "alchemy",
              chains: ["base"],
            },
            chains: ["base"], // Base only
            allowedProtocols: [
              { protocol: "aerodrome", chain: "arbitrum" }, // Wrong chain!
            ],
          },
        }),
      ).rejects.toThrow("not in enabled chains");

      expect(competitionRepo.create).not.toHaveBeenCalled();
    });

    test("should reject token on non-enabled chain", async () => {
      await expect(
        competitionService.createCompetition({
          name: "Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
          spotLiveConfig: {
            dataSource: "rpc_direct",
            dataSourceConfig: {
              type: "rpc_direct",
              provider: "alchemy",
              chains: ["base"],
            },
            chains: ["base"], // Base only
            allowedTokens: [
              {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                specificChain: "arbitrum", // Wrong chain!
              },
              {
                address: "0x4200000000000000000000000000000000000006",
                specificChain: "arbitrum", // Wrong chain!
              },
            ],
          },
        }),
      ).rejects.toThrow("not in enabled chains");

      expect(competitionRepo.create).not.toHaveBeenCalled();
      expect(priceTrackerService.getPrice).not.toHaveBeenCalled();
    });

    test("should reject protocol filter with 0 tokens on that chain", async () => {
      priceTrackerService.getPrice
        .mockResolvedValueOnce({
          token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          price: 1.0,
          symbol: "USDC",
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "arbitrum",
        })
        .mockResolvedValueOnce({
          token: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          price: 1.0,
          symbol: "USDC",
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "arbitrum",
        });

      await expect(
        competitionService.createCompetition({
          name: "Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
          spotLiveConfig: {
            dataSource: "rpc_direct",
            dataSourceConfig: {
              type: "rpc_direct",
              provider: "alchemy",
              chains: ["base", "arbitrum"],
            },
            chains: ["base", "arbitrum"],
            allowedProtocols: [
              { protocol: "aerodrome", chain: "base" }, // Base has protocol filter
            ],
            allowedTokens: [
              // But only Arbitrum has tokens!
              {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                specificChain: "arbitrum",
              },
              {
                address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
                specificChain: "arbitrum",
              },
            ],
          },
        }),
      ).rejects.toThrow(
        "Chain 'base' has protocol filter but only 0 whitelisted token(s)",
      );

      expect(competitionRepo.create).not.toHaveBeenCalled();
    });

    test("should reject unknown protocol", async () => {
      await expect(
        competitionService.createCompetition({
          name: "Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
          spotLiveConfig: {
            dataSource: "rpc_direct",
            dataSourceConfig: {
              type: "rpc_direct",
              provider: "alchemy",
              chains: ["base"],
            },
            chains: ["base"],
            allowedProtocols: [{ protocol: "unknown-dex", chain: "base" }],
          },
        }),
      ).rejects.toThrow("Unknown protocol");

      expect(competitionRepo.create).not.toHaveBeenCalled();
    });

    test("should reject if only 1 token per chain", async () => {
      priceTrackerService.getPrice.mockResolvedValue({
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        price: 1.0,
        symbol: "USDC",
        timestamp: new Date(),
        chain: BlockchainType.EVM,
        specificChain: "base",
      });

      await expect(
        competitionService.createCompetition({
          name: "Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
          spotLiveConfig: {
            dataSource: "rpc_direct",
            dataSourceConfig: {
              type: "rpc_direct",
              provider: "alchemy",
              chains: ["base"],
            },
            chains: ["base"],
            allowedTokens: [
              {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                specificChain: "base",
              },
            ],
          },
        }),
      ).rejects.toThrow("At least 2 tokens required per chain");

      expect(competitionRepo.create).not.toHaveBeenCalled();
    });

    test("should reject unpriceable token", async () => {
      priceTrackerService.getPrice
        .mockResolvedValueOnce({
          token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          price: 1.0,
          symbol: "USDC",
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "base",
        })
        .mockResolvedValueOnce(null);

      await expect(
        competitionService.createCompetition({
          name: "Test",
          arenaId: "spot-live-arena",
          type: "spot_live_trading",
          spotLiveConfig: {
            dataSource: "rpc_direct",
            dataSourceConfig: {
              type: "rpc_direct",
              provider: "alchemy",
              chains: ["base"],
            },
            chains: ["base"],
            allowedTokens: [
              {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                specificChain: "base",
              },
              {
                address: "0xBAD0000000000000000000000000000000000000",
                specificChain: "base",
              },
            ],
          },
        }),
      ).rejects.toThrow("not supported or cannot be priced");

      expect(competitionRepo.create).not.toHaveBeenCalled();
    });

    test("should create with valid protocols and tokens", async () => {
      priceTrackerService.getPrice
        .mockResolvedValueOnce({
          token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          price: 1.0,
          symbol: "USDC",
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "base",
        })
        .mockResolvedValueOnce({
          token: "0x4200000000000000000000000000000000000006",
          price: 2500,
          symbol: "ETH",
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "base",
        });

      const result = await competitionService.createCompetition({
        name: "Aerodrome Blue Chip",
        arenaId: "test-arena",
        type: "spot_live_trading",
        spotLiveConfig: {
          dataSource: "rpc_direct",
          dataSourceConfig: {
            type: "rpc_direct",
            provider: "alchemy",
            chains: ["base"],
          },
          chains: ["base"],
          allowedProtocols: [{ protocol: "aerodrome", chain: "base" }],
          allowedTokens: [
            {
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              specificChain: "base",
            },
            {
              address: "0x4200000000000000000000000000000000000006",
              specificChain: "base",
            },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(priceTrackerService.getPrice).toHaveBeenCalledTimes(2);
      expect(spotLiveRepo.batchCreateAllowedProtocols).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            protocol: "aerodrome",
            specificChain: "base",
            routerAddress: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
          }),
        ],
        expect.anything(),
      );
      expect(spotLiveRepo.batchCreateAllowedTokens).toHaveBeenCalledWith(
        expect.any(String),
        [
          expect.objectContaining({
            tokenSymbol: "USDC",
            specificChain: "base",
          }),
          expect.objectContaining({
            tokenSymbol: "ETH",
            specificChain: "base",
          }),
        ],
        expect.anything(),
      );
    });

    test("should work with protocols but no tokens", async () => {
      const result = await competitionService.createCompetition({
        name: "Aerodrome Only",
        arenaId: "spot-live-arena",
        type: "spot_live_trading",
        spotLiveConfig: {
          dataSource: "rpc_direct",
          dataSourceConfig: {
            type: "rpc_direct",
            provider: "alchemy",
            chains: ["base"],
          },
          chains: ["base"],
          allowedProtocols: [{ protocol: "aerodrome", chain: "base" }],
        },
      });

      expect(result).toBeDefined();
      expect(priceTrackerService.getPrice).not.toHaveBeenCalled();
      expect(spotLiveRepo.batchCreateAllowedProtocols).toHaveBeenCalled();
      expect(spotLiveRepo.batchCreateAllowedTokens).not.toHaveBeenCalled();
    });
  });
});
