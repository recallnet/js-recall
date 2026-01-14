import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
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
  getLatestPortfolioSnapshots = vi.fn();
  updateAgentCompetitionStatus = vi.fn();
}

class MockSpotLiveRepository {
  getSpotLiveCompetitionConfig = vi.fn();
  getAllowedProtocols = vi.fn();
  getEnabledChains = vi.fn();
  getAllowedTokenAddresses = vi.fn();
  batchSaveSpotLiveTransfers = vi.fn();
  getLatestSpotLiveTransferBlock = vi.fn();
  getAgentSyncState = vi.fn();
  upsertAgentSyncState = vi.fn();
}

class MockTradeRepository {
  batchCreateTradesWithBalances = vi.fn();
  getLatestSpotLiveTradeBlock = vi.fn();
}

class MockBalanceRepository {
  getAgentBalances = vi.fn();
  createInitialSpotLiveBalances = vi.fn();
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
  let mockBalanceRepo: MockBalanceRepository;
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
    mockBalanceRepo = new MockBalanceRepository();
    mockPortfolioSnapshotter = new MockPortfolioSnapshotterService();
    mockPriceTracker = new MockPriceTrackerService();
    mockLogger = new MockLogger();

    // Default: Return empty balances (not first sync)
    mockBalanceRepo.getAgentBalances.mockResolvedValue([
      { id: "1", agentId: "agent1", tokenAddress: "0xusdc", amount: 1000 },
    ]);

    // Default mock provider - getTradesSince returns TradesResult with trades array
    mockProvider = {
      getName: vi.fn().mockReturnValue("RPC Direct (Alchemy)"),
      getTradesSince: vi
        .fn()
        .mockResolvedValue({ trades: [sampleOnChainTrade] }),
      getTransferHistory: vi.fn().mockResolvedValue([sampleTransfer]),
      isHealthy: vi.fn().mockResolvedValue(true),
      getCurrentBlock: vi.fn().mockResolvedValue(2000000),
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
    mockSpotLiveRepo.getAgentSyncState.mockResolvedValue(null);
    mockSpotLiveRepo.upsertAgentSyncState.mockResolvedValue(undefined);

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
      mockBalanceRepo as unknown as BalanceRepository,
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

      // Sync state SHOULD be updated even when all trades filtered
      // This prevents infinite loops on blocks with only non-whitelisted trades
      expect(mockSpotLiveRepo.upsertAgentSyncState).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "base",
        1000000, // Highest block from sample trade
      );
    });

    it("should handle empty trade list gracefully", async () => {
      mockProvider.getTradesSince = vi.fn().mockResolvedValue({ trades: [] });

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

      // Sync state SHOULD be updated even when no trades (uses current block)
      expect(mockProvider.getCurrentBlock).toHaveBeenCalledWith("base");
      expect(mockSpotLiveRepo.upsertAgentSyncState).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "base",
        2000000, // Current block from mock
      );
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
            tokenSymbol: "USDC", // Enriched with price data
            amountUsd: expect.any(String), // Calculated from price
            blockNumber: 1000000, // From provider transfer data
            specificChain: "base",
            type: "deposit",
            txHash: "0xdef456",
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
            blockNumber: 1000000, // Still includes block number for sync tracking
            specificChain: "base",
            type: "deposit",
          }),
        ]),
      );
    });

    it("should sanitize address-like symbols in transfers via on-chain lookup", async () => {
      // Simulate CoinGecko returning contract address as symbol (PONKE case)
      const ponkeTokenAddress = "0x4a0c64af541439898448659aedcec8e8e819fc53";
      const ponkeTransfer: SpotTransfer = {
        type: "deposit",
        tokenAddress: ponkeTokenAddress,
        amount: 1000,
        from: "0xexternal",
        to: "0xagent",
        timestamp: new Date("2024-01-14"),
        txHash: "0xponke456",
        blockNumber: 1000001,
        chain: "base",
      };

      // Price provider returns the contract address as the symbol (this is the bug)
      const ponkePriceWithAddressSymbol: PriceReport = {
        token: ponkeTokenAddress,
        price: 0.5,
        symbol: ponkeTokenAddress, // CoinGecko returns address as symbol
        timestamp: new Date(),
        chain: BlockchainType.EVM,
        specificChain: "base",
      };

      // Mock bulk prices returning the address-like symbol
      mockPriceTracker.getBulkPrices.mockResolvedValue(
        new Map([
          [
            `${ponkeTokenAddress.toLowerCase()}:base`,
            ponkePriceWithAddressSymbol,
          ],
        ]),
      );

      // Provider with getTokenSymbol that returns the actual on-chain symbol
      const providerWithTokenSymbol = {
        ...mockProvider,
        getTransferHistory: vi.fn().mockResolvedValue([ponkeTransfer]),
        getTradesSince: vi.fn().mockResolvedValue({ trades: [] }),
        getTokenSymbol: vi.fn().mockResolvedValue("PONKE"), // On-chain symbol
      };

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0xagent123",
        providerWithTokenSymbol,
        new Map(),
        false,
        ["base"],
        new Date("2024-01-01"),
      );

      // Verify the symbol was sanitized to "PONKE" (not the 42-char address)
      expect(mockSpotLiveRepo.batchSaveSpotLiveTransfers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tokenSymbol: "PONKE", // Sanitized via on-chain lookup
            tokenAddress: ponkeTokenAddress,
            amountUsd: expect.any(String),
          }),
        ]),
      );

      // Verify getTokenSymbol was called with the correct arguments
      expect(providerWithTokenSymbol.getTokenSymbol).toHaveBeenCalledWith(
        ponkeTokenAddress,
        "base",
      );
    });

    describe("transfer whitelist filtering", () => {
      const whitelistedTokenAddress =
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC
      const spamTokenAddress = "0x158a07d7b2e76d37d9e88bf1681fc2695c32715d"; // Airdrop spam

      it("should filter out transfers of non-whitelisted tokens when whitelist is enabled", async () => {
        // Whitelist only USDC
        const allowedTokens = new Map([
          ["base", new Set([whitelistedTokenAddress])],
        ]);

        // Create spam transfer (not whitelisted)
        const spamTransfer: SpotTransfer = {
          type: "deposit",
          tokenAddress: spamTokenAddress,
          amount: 1000,
          from: "0xexternal",
          to: "0xagent",
          timestamp: new Date("2024-01-14"),
          txHash: "0xspam123",
          blockNumber: 1000001,
          chain: "base",
        };

        // Provider returns a spam token transfer
        const providerWithSpamTransfer = {
          ...mockProvider,
          getTransferHistory: vi.fn().mockResolvedValue([spamTransfer]),
          getTradesSince: vi.fn().mockResolvedValue({ trades: [] }),
        };

        await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithSpamTransfer,
          allowedTokens,
          true, // Whitelist enabled
          ["base"],
          new Date("2024-01-01"),
        );

        // Should NOT save any transfers (spam token filtered out)
        expect(
          mockSpotLiveRepo.batchSaveSpotLiveTransfers,
        ).not.toHaveBeenCalled();

        // Should log the filtering
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Transfer whitelist filtered"),
        );
      });

      it("should save whitelisted token transfers when whitelist is enabled", async () => {
        // Whitelist USDC
        const allowedTokens = new Map([
          ["base", new Set([whitelistedTokenAddress])],
        ]);

        // Create USDC transfer (whitelisted)
        const whitelistedTransfer: SpotTransfer = {
          type: "deposit",
          tokenAddress: whitelistedTokenAddress,
          amount: 100,
          from: "0xexternal",
          to: "0xagent",
          timestamp: new Date("2024-01-14"),
          txHash: "0xusdc123",
          blockNumber: 1000001,
          chain: "base",
        };

        // Provider returns a whitelisted transfer
        const providerWithWhitelistedTransfer = {
          ...mockProvider,
          getTransferHistory: vi.fn().mockResolvedValue([whitelistedTransfer]),
          getTradesSince: vi.fn().mockResolvedValue({ trades: [] }),
        };

        await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithWhitelistedTransfer,
          allowedTokens,
          true, // Whitelist enabled
          ["base"],
          new Date("2024-01-01"),
        );

        // Should save the whitelisted transfer
        expect(
          mockSpotLiveRepo.batchSaveSpotLiveTransfers,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              tokenAddress: whitelistedTokenAddress,
              type: "deposit",
            }),
          ]),
        );
      });

      it("should save all transfers when whitelist is disabled", async () => {
        // Create spam transfer
        const spamTransfer: SpotTransfer = {
          type: "deposit",
          tokenAddress: spamTokenAddress,
          amount: 1000,
          from: "0xexternal",
          to: "0xagent",
          timestamp: new Date("2024-01-14"),
          txHash: "0xspam123",
          blockNumber: 1000001,
          chain: "base",
        };

        // Provider returns a spam token transfer
        const providerWithSpamTransfer = {
          ...mockProvider,
          getTransferHistory: vi.fn().mockResolvedValue([spamTransfer]),
          getTradesSince: vi.fn().mockResolvedValue({ trades: [] }),
        };

        // Mock price for the spam token
        mockPriceTracker.getBulkPrices.mockResolvedValue(
          new Map([
            [
              `${spamTokenAddress.toLowerCase()}:base`,
              { ...samplePrice, token: spamTokenAddress },
            ],
          ]),
        );

        await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithSpamTransfer,
          new Map(), // Empty allowedTokens
          false, // Whitelist disabled
          ["base"],
          new Date("2024-01-01"),
        );

        // Should save all transfers when whitelist disabled
        expect(
          mockSpotLiveRepo.batchSaveSpotLiveTransfers,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              tokenAddress: spamTokenAddress,
              type: "deposit",
            }),
          ]),
        );
      });

      it("should filter mixed transfers keeping only whitelisted tokens", async () => {
        // Whitelist USDC
        const allowedTokens = new Map([
          ["base", new Set([whitelistedTokenAddress])],
        ]);

        // Create both whitelisted and spam transfers
        const whitelistedTransfer: SpotTransfer = {
          type: "deposit",
          tokenAddress: whitelistedTokenAddress,
          amount: 100,
          from: "0xexternal",
          to: "0xagent",
          timestamp: new Date("2024-01-14"),
          txHash: "0xusdc123",
          blockNumber: 1000001,
          chain: "base",
        };

        const spamTransfer: SpotTransfer = {
          type: "deposit",
          tokenAddress: spamTokenAddress,
          amount: 1000,
          from: "0xexternal",
          to: "0xagent",
          timestamp: new Date("2024-01-14"),
          txHash: "0xspam123",
          blockNumber: 1000002,
          chain: "base",
        };

        // Provider returns both transfers
        const providerWithMixedTransfers = {
          ...mockProvider,
          getTransferHistory: vi
            .fn()
            .mockResolvedValue([whitelistedTransfer, spamTransfer]),
          getTradesSince: vi.fn().mockResolvedValue({ trades: [] }),
        };

        await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithMixedTransfers,
          allowedTokens,
          true, // Whitelist enabled
          ["base"],
          new Date("2024-01-01"),
        );

        // Should only save the whitelisted transfer
        expect(
          mockSpotLiveRepo.batchSaveSpotLiveTransfers,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              tokenAddress: whitelistedTokenAddress,
            }),
          ]),
        );

        // Verify only one transfer was saved (not the spam)
        const savedTransfers =
          mockSpotLiveRepo.batchSaveSpotLiveTransfers.mock.calls[0]?.[0];
        expect(savedTransfers).toHaveLength(1);
        expect(savedTransfers?.[0]?.tokenAddress).toBe(whitelistedTokenAddress);
      });
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

    describe("balance initialization retry logic", () => {
      it("should return early with success when balance init creates balances", async () => {
        // First sync: no existing balances
        mockBalanceRepo.getAgentBalances.mockResolvedValueOnce([]);

        // Mock provider with getTokenBalances (triggers init flow)
        const providerWithTokenBalances = {
          ...mockProvider,
          getTokenBalances: vi
            .fn()
            .mockResolvedValue([
              { contractAddress: "0xusdc", balance: "100000000" },
            ]),
          getNativeBalance: vi.fn().mockResolvedValue("10000000000000000"),
          getTokenDecimals: vi.fn().mockResolvedValue(6),
        };

        // Mock price for balance init
        mockPriceTracker.getBulkPrices.mockResolvedValue(
          new Map([["0xusdc:base", { ...samplePrice, token: "0xusdc" }]]),
        );

        const result = await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithTokenBalances,
          new Map(),
          false,
          ["base"],
          new Date("2024-01-01"),
        );

        // Should return early with balances updated
        expect(result.balancesUpdated).toBeGreaterThan(0);
        expect(result.tradesProcessed).toBe(0);

        // Should NOT call trade processing (returned early)
        expect(mockProvider.getTradesSince).not.toHaveBeenCalled();

        // Should log success
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Completed initial balance setup"),
        );
      });

      it("should return success with 0 balances when agent has no qualified tokens (no retry)", async () => {
        // Agent has no existing balances
        mockBalanceRepo.getAgentBalances.mockResolvedValueOnce([]);

        // Provider returns empty token list (agent has no tokens)
        const providerWithTokenBalances = {
          ...mockProvider,
          getTokenBalances: vi.fn().mockResolvedValue([]),
          getNativeBalance: vi.fn().mockResolvedValue("0"),
        };

        const result = await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithTokenBalances,
          new Map(),
          false,
          ["base"],
          new Date("2024-01-01"),
        );

        // Should return success with 0 balances (no qualified tokens, but init succeeded)
        expect(result.balancesUpdated).toBe(0);
        expect(result.tradesProcessed).toBe(0);

        // Should NOT call trade processing (returned early)
        expect(mockProvider.getTradesSince).not.toHaveBeenCalled();

        // Should log success (not warning)
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Completed initial balance setup"),
        );
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining("will retry on next sync"),
        );
      });

      it("should return early with failure when RPC throws, allowing retry on next sync", async () => {
        // First sync: no existing balances
        mockBalanceRepo.getAgentBalances.mockResolvedValueOnce([]);

        // Mock provider where getTokenBalances throws an error
        const providerWithTokenBalances = {
          ...mockProvider,
          getTokenBalances: vi
            .fn()
            .mockRejectedValue(new Error("RPC connection failed")),
          getNativeBalance: vi
            .fn()
            .mockRejectedValue(new Error("RPC connection failed")),
        };

        const result = await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithTokenBalances,
          new Map(),
          false,
          ["base"],
          new Date("2024-01-01"),
        );

        // Should return early with 0 balances (failure)
        expect(result.balancesUpdated).toBe(0);
        expect(result.tradesProcessed).toBe(0);

        // Should NOT call trade processing (returned early)
        expect(mockProvider.getTradesSince).not.toHaveBeenCalled();

        // Should NOT update sync state (so next cron will retry)
        expect(mockSpotLiveRepo.upsertAgentSyncState).not.toHaveBeenCalled();

        // Should log warning about retry
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("will retry on next sync"),
        );
      });

      it("should retry balance initialization on subsequent sync after RPC failure", async () => {
        // Simulate second sync after failed first sync
        mockBalanceRepo.getAgentBalances.mockResolvedValueOnce([]);

        const providerWithTokenBalances = {
          ...mockProvider,
          getTokenBalances: vi
            .fn()
            .mockResolvedValue([
              { contractAddress: "0xusdc", balance: "100000000" },
            ]),
          getNativeBalance: vi.fn().mockResolvedValue("10000000000000000"),
          getTokenDecimals: vi.fn().mockResolvedValue(6),
        };

        mockPriceTracker.getBulkPrices.mockResolvedValue(
          new Map([["0xusdc:base", { ...samplePrice, token: "0xusdc" }]]),
        );

        const result = await processor.processAgentData(
          "agent-1",
          "comp-1",
          "0xagent123",
          providerWithTokenBalances,
          new Map(),
          false,
          ["base"],
          new Date("2024-01-01"),
        );

        // Should succeed on retry
        expect(result.balancesUpdated).toBeGreaterThan(0);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Completed initial balance setup"),
        );
      });
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

      // Should query sync state first (falls back to trade block if not available)
      expect(mockSpotLiveRepo.getAgentSyncState).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        "base",
      );

      // Should use 10-block overlap for retry window
      // 1000000 - 9 = 999991 (retries last 10 blocks)
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        999991, // 10-block overlap for transient failure retry
        ["base"],
      );

      // Should update sync state after processing
      expect(mockSpotLiveRepo.upsertAgentSyncState).toHaveBeenCalled();
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

      // Should query sync state for each chain (once for trades, once for transfers per chain)
      // With unified sync state: 2 chains × 2 (trades + transfers) = 4 calls
      expect(mockSpotLiveRepo.getAgentSyncState).toHaveBeenCalledTimes(4);

      // Should call getTradesSince separately for each chain with 10-block overlap
      expect(mockProvider.getTradesSince).toHaveBeenCalledTimes(2);
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        999991, // base: 1000000 - 9 (10-block retry window)
        ["base"],
      );
      expect(mockProvider.getTradesSince).toHaveBeenCalledWith(
        "0xagent123",
        149999991, // arbitrum: 150000000 - 9 (10-block retry window)
        ["arbitrum"],
      );

      // Should update sync state for chains that had trades
      expect(mockSpotLiveRepo.upsertAgentSyncState).toHaveBeenCalled();
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
        undefined, // mockRpcProvider (only used in test mode via ServiceRegistry)
      );
    });

    describe("late minFundingThreshold enforcement", () => {
      const configWithThreshold: SelectSpotLiveCompetitionConfig = {
        ...sampleSpotLiveConfig,
        minFundingThreshold: "250", // $250 threshold
      };

      beforeEach(() => {
        mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
          configWithThreshold,
        );
        mockCompetitionRepo.getLatestPortfolioSnapshots.mockResolvedValue([]);
        mockCompetitionRepo.updateAgentCompetitionStatus.mockResolvedValue(
          undefined,
        );
      });

      it("should skip late enforcement during initial sync (skipMonitoring=true)", async () => {
        // Initial sync at competition start
        const result = await processor.processSpotLiveCompetition(
          "comp-1",
          true, // skipMonitoring = true (initial sync)
        );

        expect(result.syncResult.successful).toHaveLength(1);

        // Should NOT call getLatestPortfolioSnapshots for late enforcement check
        // (only called for the standard snapshot taking)
        expect(
          mockCompetitionRepo.getLatestPortfolioSnapshots,
        ).not.toHaveBeenCalled();

        // Should NOT call updateAgentCompetitionStatus
        expect(
          mockCompetitionRepo.updateAgentCompetitionStatus,
        ).not.toHaveBeenCalled();
      });

      it("should run late enforcement during cron sync (skipMonitoring=false) for agents without prior snapshots", async () => {
        // Mock: agent-1 had no snapshot before this sync
        mockCompetitionRepo.getLatestPortfolioSnapshots
          .mockResolvedValueOnce([]) // Before takePortfolioSnapshots: no snapshots
          .mockResolvedValueOnce([
            // After takePortfolioSnapshots: agent-1 now has one below threshold
            {
              id: 1,
              agentId: "agent-1",
              competitionId: "comp-1",
              timestamp: new Date(),
              totalValue: 100, // Below $250 threshold
            },
          ]);

        const result = await processor.processSpotLiveCompetition(
          "comp-1",
          false, // skipMonitoring = false (cron sync)
        );

        expect(result.syncResult.successful).toHaveLength(1);

        // Should check for agents without prior snapshots
        expect(
          mockCompetitionRepo.getLatestPortfolioSnapshots,
        ).toHaveBeenCalledTimes(2);

        // Should disqualify agent-1 for being below threshold
        expect(
          mockCompetitionRepo.updateAgentCompetitionStatus,
        ).toHaveBeenCalledWith(
          "comp-1",
          "agent-1",
          "disqualified",
          expect.stringContaining("Insufficient initial funding"),
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Late threshold enforcement"),
        );
      });

      it("should pass agents who meet threshold during late enforcement", async () => {
        // Mock: agent-1 had no snapshot before this sync
        mockCompetitionRepo.getLatestPortfolioSnapshots
          .mockResolvedValueOnce([]) // Before: no snapshots
          .mockResolvedValueOnce([
            // After: agent-1 now has one ABOVE threshold
            {
              id: 1,
              agentId: "agent-1",
              competitionId: "comp-1",
              timestamp: new Date(),
              totalValue: 500, // Above $250 threshold
            },
          ]);

        await processor.processSpotLiveCompetition("comp-1", false);

        // Should NOT disqualify
        expect(
          mockCompetitionRepo.updateAgentCompetitionStatus,
        ).not.toHaveBeenCalled();

        // Should log success
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Late threshold check passed"),
        );
      });

      it("should skip late enforcement when all agents already have snapshots", async () => {
        // Mock: agent-1 already has a snapshot from previous sync
        mockCompetitionRepo.getLatestPortfolioSnapshots.mockResolvedValue([
          {
            id: 1,
            agentId: "agent-1",
            competitionId: "comp-1",
            timestamp: new Date(),
            totalValue: 100, // Below threshold, but already had snapshot
          },
        ]);

        await processor.processSpotLiveCompetition("comp-1", false);

        // Should only be called once (for checking existing snapshots)
        // Not called again for late enforcement since no agents without prior snapshots
        expect(
          mockCompetitionRepo.getLatestPortfolioSnapshots,
        ).toHaveBeenCalledTimes(1);

        // Should NOT call late enforcement (agent already had snapshot)
        expect(
          mockCompetitionRepo.updateAgentCompetitionStatus,
        ).not.toHaveBeenCalled();
      });

      it("should skip late enforcement when minFundingThreshold is not configured", async () => {
        // Config without threshold
        mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
          sampleSpotLiveConfig, // minFundingThreshold: null
        );

        await processor.processSpotLiveCompetition("comp-1", false);

        // Should NOT call getLatestPortfolioSnapshots for late enforcement
        expect(
          mockCompetitionRepo.getLatestPortfolioSnapshots,
        ).not.toHaveBeenCalled();
      });

      it("should isolate late enforcement failures - one agent failure should not affect others", async () => {
        // Setup: two agents without prior snapshots
        mockCompetitionRepo.getCompetitionAgents.mockResolvedValue([
          "agent-1",
          "agent-2",
        ]);
        mockAgentRepo.findByIds.mockResolvedValue([
          { id: "agent-1", walletAddress: "0xagent1", name: "Agent 1" },
          { id: "agent-2", walletAddress: "0xagent2", name: "Agent 2" },
        ] as SelectAgent[]);

        // Before: no snapshots for either agent
        mockCompetitionRepo.getLatestPortfolioSnapshots
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            // After: both have snapshots below threshold
            {
              id: 1,
              agentId: "agent-1",
              competitionId: "comp-1",
              timestamp: new Date(),
              totalValue: 100, // Below $250
            },
            {
              id: 2,
              agentId: "agent-2",
              competitionId: "comp-1",
              timestamp: new Date(),
              totalValue: 50, // Below $250
            },
          ]);

        // First update succeeds, second fails
        mockCompetitionRepo.updateAgentCompetitionStatus
          .mockResolvedValueOnce(undefined) // agent-1 success
          .mockRejectedValueOnce(new Error("Database error")); // agent-2 fails

        const result = await processor.processSpotLiveCompetition(
          "comp-1",
          false,
        );

        // Should have attempted to disqualify both agents
        expect(
          mockCompetitionRepo.updateAgentCompetitionStatus,
        ).toHaveBeenCalledTimes(2);

        // First agent should be disqualified
        expect(
          mockCompetitionRepo.updateAgentCompetitionStatus,
        ).toHaveBeenCalledWith(
          "comp-1",
          "agent-1",
          "disqualified",
          expect.stringContaining("Insufficient initial funding"),
        );

        // Second agent disqualification failed, but should have logged error
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to enforce late threshold"),
        );

        // Competition sync should still succeed overall
        expect(result.syncResult.successful).toHaveLength(2);
      });
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
        .mockResolvedValueOnce({ trades: [sampleOnChainTrade] })
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
        .mockResolvedValueOnce({ trades: [sampleOnChainTrade] })
        .mockRejectedValueOnce(new Error("RPC timeout"))
        .mockResolvedValueOnce({ trades: [sampleOnChainTrade] });

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
