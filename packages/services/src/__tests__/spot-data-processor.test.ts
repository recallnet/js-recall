import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import type { SelectAgent } from "@recallnet/db/schema/core/types";
import type {
  SelectSpotLiveCompetitionConfig,
  SelectTrade,
} from "@recallnet/db/schema/trading/types";

import { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import { PriceTrackerService } from "../price-tracker.service.js";
import { SpotLiveProviderFactory } from "../providers/spot-live-provider.factory.js";
import { SpotDataProcessor } from "../spot-data-processor.service.js";
import { BlockchainType } from "../types/index.js";
import type { PriceReport } from "../types/index.js";
import type {
  ISpotLiveDataProvider,
  OnChainTrade,
  SpotTransfer,
} from "../types/spot-live.js";

// Mock classes
class MockAgentRepository {
  findByIds = vi.fn();
}

class MockCompetitionRepository {
  findById = vi.fn();
  getCompetitionAgents = vi.fn();
  createPortfolioSnapshot = vi.fn();
  batchCreatePortfolioSnapshots = vi.fn();
}

class MockSpotLiveRepository {
  getSpotLiveCompetitionConfig = vi.fn();
  getAllowedProtocols = vi.fn();
  getEnabledChains = vi.fn();
  getAllowedTokenAddresses = vi.fn();
  batchSaveSpotLiveTransfers = vi.fn();
  getLatestSpotLiveTransferBlock = vi.fn();
}

class MockTradeRepository {
  batchCreateTradesWithBalances = vi.fn();
  getLatestSpotLiveTradeBlock = vi.fn();
}

class MockPortfolioSnapshotterService {
  takePortfolioSnapshots = vi.fn();
}

class MockPriceTrackerService {
  getPrice = vi.fn();
  getBulkPrices = vi.fn();
}

class MockLogger {
  info = vi.fn();
  debug = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// Mock dependencies
vi.mock("@recallnet/db/repositories/agent");
vi.mock("@recallnet/db/repositories/competition");
vi.mock("@recallnet/db/repositories/spot-live");
vi.mock("@recallnet/db/repositories/trade");
vi.mock("../portfolio-snapshotter.service.js");
vi.mock("../price-tracker.service.js");
vi.mock("../providers/spot-live-provider.factory.js");

describe("SpotDataProcessor", () => {
  let processor: SpotDataProcessor;
  let mockProvider: ISpotLiveDataProvider;
  let mockAgentRepo: MockAgentRepository;
  let mockCompetitionRepo: MockCompetitionRepository;
  let mockSpotLiveRepo: MockSpotLiveRepository;
  let mockTradeRepo: MockTradeRepository;
  let mockPortfolioSnapshotter: MockPortfolioSnapshotterService;
  let mockPriceTracker: MockPriceTrackerService;
  let mockLogger: MockLogger;

  // Sample data
  const sampleCompetition = {
    id: "comp-1",
    name: "Test Spot Live Competition",
    type: "spot_live_trading" as const,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    status: "active" as const,
    sandboxMode: false,
  };

  const sampleSpotLiveConfig: SelectSpotLiveCompetitionConfig = {
    competitionId: "comp-1",
    dataSource: "rpc_direct",
    dataSourceConfig: {
      type: "rpc_direct",
      provider: "alchemy",
      chains: ["base"],
    },
    selfFundingThresholdUsd: "10",
    minFundingThreshold: null,
    inactivityHours: 24,
    syncIntervalMinutes: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleOnChainTrade: OnChainTrade = {
    txHash: "0xabc123",
    blockNumber: 1000000,
    timestamp: new Date("2024-01-15"),
    chain: "base",
    fromToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    toToken: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", // AERO
    fromAmount: 100,
    toAmount: 50,
    protocol: "aerodrome",
    gasUsed: 150000,
    gasPrice: 50000000000,
    gasCostUsd: 2.5,
  };

  const sampleTransfer: SpotTransfer = {
    type: "deposit",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: 1000,
    from: "0xexternal",
    to: "0xagent",
    timestamp: new Date("2024-01-14"),
    txHash: "0xdef456",
    blockNumber: 1000000,
    chain: "base",
  };

  const samplePrice: PriceReport = {
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    price: 1.0,
    symbol: "USDC",
    timestamp: new Date(),
    chain: BlockchainType.EVM,
    specificChain: "base",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgentRepo = new MockAgentRepository();
    mockCompetitionRepo = new MockCompetitionRepository();
    mockSpotLiveRepo = new MockSpotLiveRepository();
    mockTradeRepo = new MockTradeRepository();
    mockPortfolioSnapshotter = new MockPortfolioSnapshotterService();
    mockPriceTracker = new MockPriceTrackerService();
    mockLogger = new MockLogger();

    // Default mock provider
    mockProvider = {
      getName: vi.fn().mockReturnValue("RPC Direct (Alchemy)"),
      getTradesSince: vi.fn().mockResolvedValue([sampleOnChainTrade]),
      getTransferHistory: vi.fn().mockResolvedValue([sampleTransfer]),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    // Default mock implementations
    mockTradeRepo.batchCreateTradesWithBalances.mockResolvedValue({
      successful: [
        {
          agentId: "agent-1",
          trade: { id: "trade-1" } as SelectTrade,
          updatedBalances: { fromTokenBalance: 4900, toTokenBalance: 50 },
        },
      ],
      failed: [],
    });

    // Mock block tracking - return null by default (first sync scenario)
    mockTradeRepo.getLatestSpotLiveTradeBlock.mockResolvedValue(null);
    mockSpotLiveRepo.getLatestSpotLiveTransferBlock.mockResolvedValue(null);

    // Mock bulk price fetching - return price for all tokens
    mockPriceTracker.getBulkPrices.mockResolvedValue(
      new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:base", samplePrice],
        ["0x940181a94a35a4569e4529a3cdfb74e38fd98631:base", samplePrice],
      ]),
    );
    mockPortfolioSnapshotter.takePortfolioSnapshots.mockResolvedValue(
      undefined,
    );

    // Mock transfer saving to return saved transfers with IDs
    mockSpotLiveRepo.batchSaveSpotLiveTransfers.mockResolvedValue([
      {
        id: "transfer-1",
        agentId: "agent-1",
        competitionId: "comp-1",
        type: "deposit",
        specificChain: "base",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        tokenSymbol: "USDC",
        amount: "1000",
        amountUsd: "1000",
        fromAddress: "0xexternal",
        toAddress: "0xagent",
        txHash: "0xdef456",
        blockNumber: 0,
        transferTimestamp: new Date(),
        capturedAt: new Date(),
      },
    ]);

    processor = new SpotDataProcessor(
      mockAgentRepo as unknown as AgentRepository,
      mockCompetitionRepo as unknown as CompetitionRepository,
      mockSpotLiveRepo as unknown as SpotLiveRepository,
      mockTradeRepo as unknown as TradeRepository,
      mockPortfolioSnapshotter as unknown as PortfolioSnapshotterService,
      mockPriceTracker as unknown as PriceTrackerService,
      mockLogger as unknown as Logger,
    );
  });

  describe("processAgentData", () => {
    it("should process agent trades successfully with complete price data", async () => {
      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        new Map(), // No whitelist
        false, // Whitelist disabled
        ["base"],
        new Date("2024-01-01"),
      );

      // Now calls getLatestSpotLiveTradeBlock for block tracking
      expect(mockTradeRepo.getLatestSpotLiveTradeBlock).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "base",
      );

      // Now calls getTradesSince once per chain (with single-chain array)
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        expect.any(Date), // First sync uses Date (null latestBlock)
        ["base"], // Single chain per request
      );

      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalled();
      expect(mockTradeRepo.batchCreateTradesWithBalances).toHaveBeenCalled();

      expect(result.agentId).toBe("agent-1");
      expect(result.tradesProcessed).toBe(1);
      expect(result.balancesUpdated).toBeGreaterThan(0);
    });

    it("should filter out trades with unpriceable tokens", async () => {
      // Mock bulk prices with one token missing
      mockPriceTracker.getBulkPrices.mockResolvedValue(
        new Map([
          ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:base", samplePrice], // fromToken
          // toToken missing (unpriceable)
        ]),
      );

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(
        mockTradeRepo.batchCreateTradesWithBalances,
      ).not.toHaveBeenCalled();
      expect(result.tradesProcessed).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("CRITICAL"),
      );
    });

    it("should filter trades by token whitelist when enabled", async () => {
      const allowedTokens = new Map([
        [
          "base",
          new Set(["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"]), // Only USDC
        ],
      ]);

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        allowedTokens,
        true, // Whitelist enabled
        ["base"],
        new Date("2024-01-01"),
      );

      // Trade should be rejected (AERO not whitelisted)
      expect(
        mockTradeRepo.batchCreateTradesWithBalances,
      ).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("token whitelist"),
      );
    });

    it("should handle empty trade list gracefully", async () => {
      mockProvider.getTradesSince = vi.fn().mockResolvedValue([]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(result.tradesProcessed).toBe(0);
      expect(
        mockTradeRepo.batchCreateTradesWithBalances,
      ).not.toHaveBeenCalled();
    });

    it("should enrich transfers with price data when available", async () => {
      // Ensure provider returns transfers
      const providerWithTransfers = {
        ...mockProvider,
        getTransferHistory: vi.fn().mockResolvedValue([sampleTransfer]),
      };

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        providerWithTransfers,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(mockSpotLiveRepo.batchSaveSpotLiveTransfers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tokenSymbol: "USDC", // Enriched
            amountUsd: expect.any(String), // Calculated
          }),
        ]),
      );

      expect(result.violationsDetected).toBe(1);
    });

    it("should record transfers even when price fetch fails", async () => {
      // Mock bulk prices returning empty (all tokens unpriceable)
      mockPriceTracker.getBulkPrices.mockResolvedValue(new Map());

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(mockSpotLiveRepo.batchSaveSpotLiveTransfers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tokenSymbol: "UNKNOWN", // Failed to price
            amountUsd: null,
          }),
        ]),
      );
    });

    it("should throw error if provider is null", async () => {
      await expect(
        processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          null as unknown as ISpotLiveDataProvider,
          new Map(),
          false,
          ["base"],
          new Date(),
        ),
      ).rejects.toThrow("[SpotDataProcessor] Provider is required");
    });

    it("should use incremental block syncing when latest block exists", async () => {
      // Mock latest block as 1000000
      mockTradeRepo.getLatestSpotLiveTradeBlock.mockResolvedValue(1000000);

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      // Should query for latest block
      expect(mockTradeRepo.getLatestSpotLiveTradeBlock).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "base",
      );

      // Should use block number (with overlap) for incremental sync
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        1000000, // Uses latestBlock (not +1) for gap prevention
        ["base"],
      );
    });

    it("should scan per-chain independently for multi-chain agents", async () => {
      // Mock different latest blocks per chain
      mockTradeRepo.getLatestSpotLiveTradeBlock
        .mockResolvedValueOnce(1000000) // base
        .mockResolvedValueOnce(150000000); // arbitrum

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        mockProvider,
        new Map(),
        false,
        ["base", "arbitrum"],
        new Date("2024-01-01"),
      );

      // Should query latest block for each chain
      expect(mockTradeRepo.getLatestSpotLiveTradeBlock).toHaveBeenCalledTimes(
        2,
      );
      expect(mockTradeRepo.getLatestSpotLiveTradeBlock).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "base",
      );
      expect(mockTradeRepo.getLatestSpotLiveTradeBlock).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "arbitrum",
      );

      // Should call getTradesSince separately for each chain with its specific block
      expect(mockProvider.getTradesSince).toHaveBeenCalledTimes(2);
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        1000000, // base block
        ["base"],
      );
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        150000000, // arbitrum block
        ["arbitrum"],
      );
    });
  });

  describe("processSpotLiveCompetition", () => {
    beforeEach(() => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
        sampleSpotLiveConfig,
      );
      mockSpotLiveRepo.getAllowedProtocols.mockResolvedValue([]);
      mockSpotLiveRepo.getEnabledChains.mockResolvedValue(["base"]);
      mockSpotLiveRepo.getAllowedTokenAddresses.mockResolvedValue(new Map());
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(["agent-1"]);
      mockAgentRepo.findByIds.mockResolvedValue([
        {
          id: "agent-1",
          walletAddress: "0xagent123",
          name: "Test Agent",
        } as SelectAgent,
      ]);

      vi.mocked(SpotLiveProviderFactory.createProvider).mockReturnValue(
        mockProvider,
      );
    });

    it("should process spot live competition successfully", async () => {
      const result = await processor.processSpotLiveCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(1);
      expect(result.syncResult.failed).toHaveLength(0);
      expect(
        mockPortfolioSnapshotter.takePortfolioSnapshots,
      ).toHaveBeenCalledWith("comp-1");
    });

    it("should return error in result if competition not found", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(null);

      const result = await processor.processSpotLiveCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(0);
      // processSpotLiveCompetition catches errors and returns them, doesn't throw
    });

    it("should return error in result if config not found", async () => {
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(null);

      const result = await processor.processSpotLiveCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(0);
    });

    it("should return error in result if competition is wrong type", async () => {
      mockCompetitionRepo.findById.mockResolvedValue({
        ...sampleCompetition,
        type: "trading",
      });

      const result = await processor.processSpotLiveCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(0);
    });

    it("should skip processing if competition hasn't started", async () => {
      mockCompetitionRepo.findById.mockResolvedValue({
        ...sampleCompetition,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
      });

      const result = await processor.processSpotLiveCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(0);
      expect(mockProvider.getTradesSince).not.toHaveBeenCalled();
    });

    it("should skip agents without wallet addresses", async () => {
      mockAgentRepo.findByIds.mockResolvedValue([
        {
          id: "agent-1",
          walletAddress: null, // No wallet
          name: "Test Agent",
        } as SelectAgent,
        {
          id: "agent-2",
          walletAddress: "0xagent456",
          name: "Test Agent 2",
        } as SelectAgent,
      ]);

      await processor.processSpotLiveCompetition("comp-1");

      // Only one agent should be processed
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("1 agents have no wallet address"),
      );
    });

    it("should pass protocol filters to provider factory", async () => {
      const mockProtocols = [
        {
          id: "protocol-1",
          competitionId: "comp-1",
          protocol: "aerodrome",
          specificChain: "base",
          routerAddress: "0xrouter",
          swapEventSignature: "0xsig",
          factoryAddress: null,
          createdAt: new Date(),
        },
      ];

      mockSpotLiveRepo.getAllowedProtocols.mockResolvedValue(mockProtocols);

      await processor.processSpotLiveCompetition("comp-1");

      expect(SpotLiveProviderFactory.createProvider).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            protocol: "aerodrome",
            chain: "base",
            routerAddress: "0xrouter",
          }),
        ]),
        expect.anything(),
      );
    });

    it("should handle batch processing with failures gracefully", async () => {
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);
      mockAgentRepo.findByIds.mockResolvedValue([
        { id: "agent-1", walletAddress: "0xagent1", name: "Agent 1" },
        { id: "agent-2", walletAddress: "0xagent2", name: "Agent 2" },
      ] as SelectAgent[]);

      // First agent succeeds, second fails
      mockProvider.getTradesSince = vi
        .fn()
        .mockResolvedValueOnce([sampleOnChainTrade])
        .mockRejectedValueOnce(new Error("RPC timeout"));

      const result = await processor.processSpotLiveCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(1);
      expect(result.syncResult.failed).toHaveLength(1);
      expect(result.syncResult.failed[0]?.error).toContain("RPC timeout");
    });
  });

  describe("processBatchAgentData", () => {
    it("should process multiple agents in batches of 10", async () => {
      // Create 25 agents to test batching
      const agents = Array.from({ length: 25 }, (_, i) => ({
        agentId: `agent-${i + 1}`,
        walletAddress: `0xagent${i + 1}`,
      }));

      const result = await processor["processBatchAgentData"](
        agents,
        "comp-1",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      // All should succeed
      expect(result.successful).toHaveLength(25);
      expect(result.failed).toHaveLength(0);

      // Verify batch logging (should be 3 batches: 10, 10, 5)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("batch 1/3"),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("batch 3/3"),
      );
    });

    it("should handle mixed success and failure in batch", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0xagent1" },
        { agentId: "agent-2", walletAddress: "0xagent2" },
        { agentId: "agent-3", walletAddress: "0xagent3" },
      ];

      // First and third succeed, second fails
      mockProvider.getTradesSince = vi
        .fn()
        .mockResolvedValueOnce([sampleOnChainTrade])
        .mockRejectedValueOnce(new Error("RPC timeout"))
        .mockResolvedValueOnce([sampleOnChainTrade]);

      const result = await processor["processBatchAgentData"](
        agents,
        "comp-1",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.agentId).toBe("agent-2");
      expect(result.failed[0]?.error).toContain("RPC timeout");
    });

    it("should handle all agents failing gracefully", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0xagent1" },
        { agentId: "agent-2", walletAddress: "0xagent2" },
      ];

      mockProvider.getTradesSince = vi
        .fn()
        .mockRejectedValue(new Error("Provider down"));

      const result = await processor["processBatchAgentData"](
        agents,
        "comp-1",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle empty agent list", async () => {
      const result = await processor["processBatchAgentData"](
        [],
        "comp-1",
        mockProvider,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(mockProvider.getTradesSince).not.toHaveBeenCalled();
    });
  });

  describe("helper methods", () => {
    it("should validate competition type correctly", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);

      const isSpotLive = await processor.isSpotLiveCompetition("comp-1");

      expect(isSpotLive).toBe(true);
    });

    it("should return false for non-spot-live competitions", async () => {
      mockCompetitionRepo.findById.mockResolvedValue({
        ...sampleCompetition,
        type: "trading",
      });

      const isSpotLive = await processor.isSpotLiveCompetition("comp-1");

      expect(isSpotLive).toBe(false);
    });

    it("should get competition config", async () => {
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
        sampleSpotLiveConfig,
      );

      const config = await processor.getCompetitionConfig("comp-1");

      expect(config).toEqual(sampleSpotLiveConfig);
    });
  });
});
