import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompetitionRepository } from "@recallnet/db/repositories/competition";
import type { SelectBalance } from "@recallnet/db/schema/trading/types";

import type { BalanceService } from "../balance.service.js";
import { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import type { PriceTrackerService } from "../price-tracker.service.js";
import { BlockchainType, type PriceReport } from "../types/index.js";

describe("PortfolioSnapshotterService", () => {
  let portfolioSnapshotter: PortfolioSnapshotterService;
  let mockBalanceService: BalanceService;
  let mockPriceTrackerService: PriceTrackerService;
  let mockCompetitionRepo: CompetitionRepository;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockCompetitionId = "test-competition-id";
  const mockAgentId = "test-agent-id";

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create mock services
    mockBalanceService = {
      getAllBalances: vi.fn(),
    } as unknown as BalanceService;

    mockPriceTrackerService = {
      getBulkPrices: vi.fn(),
    } as unknown as PriceTrackerService;

    mockCompetitionRepo = {
      findById: vi.fn(),
      getCompetitionAgents: vi.fn(),
      createPortfolioSnapshot: vi.fn(),
    } as unknown as CompetitionRepository;

    // Create service instance
    portfolioSnapshotter = new PortfolioSnapshotterService(
      mockBalanceService,
      mockPriceTrackerService,
      mockCompetitionRepo,
      mockLogger as never,
    );
  });

  describe("Multi-chain token price collision bug fix", () => {
    it("should correctly calculate portfolio value when same token address exists on multiple chains with different prices", async () => {
      const mockCompetition = {
        id: mockCompetitionId,
        status: "active",
        endDate: null,
      };

      // Same token address on TWO different chains with DIFFERENT prices
      const orderTokenAddress = "0x4E200fE2f3eFb977d5fd9c430A41531FB04d97B8";

      const mockBalances: SelectBalance[] = [
        {
          id: 1,
          agentId: mockAgentId,
          competitionId: mockCompetitionId,
          tokenAddress: orderTokenAddress,
          amount: 84647.58, // Large position on Arbitrum
          symbol: "ORDER",
          specificChain: "arbitrum",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          agentId: mockAgentId,
          competitionId: mockCompetitionId,
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          amount: 10000,
          symbol: "USDC",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock prices: ORDER has different prices on different chains
      const mockPrices = new Map<string, PriceReport | null>([
        [
          orderTokenAddress,
          {
            price: 0.129, // Arbitrum ORDER price
            symbol: "ORDER",
            token: orderTokenAddress,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "arbitrum",
            pairCreatedAt: undefined,
            volume: undefined,
            liquidity: undefined,
            fdv: undefined,
          },
        ],
        [
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          {
            price: 1.0, // USDC
            symbol: "USDC",
            token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth",
            pairCreatedAt: undefined,
            volume: undefined,
            liquidity: undefined,
            fdv: undefined,
          },
        ],
      ]);

      // Setup mocks
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        mockCompetition as never,
      );
      vi.mocked(mockBalanceService.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockPriceTrackerService.getBulkPrices).mockResolvedValue(
        mockPrices,
      );
      vi.mocked(mockCompetitionRepo.createPortfolioSnapshot).mockResolvedValue(
        undefined as never,
      );

      // Execute
      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        mockCompetitionId,
        mockAgentId,
      );

      // Verify portfolio snapshot was created with correct value
      expect(mockCompetitionRepo.createPortfolioSnapshot).toHaveBeenCalledTimes(
        1,
      );

      const snapshotCall = vi.mocked(
        mockCompetitionRepo.createPortfolioSnapshot,
      ).mock.calls[0];

      expect(snapshotCall).toBeDefined();
      const snapshotData = snapshotCall![0];

      // Expected calculation:
      // ORDER (arbitrum): 84647.58 × $0.129 = $10,919.54
      // USDC (eth): 10000 × $1.0 = $10,000
      // Total: $20,919.54
      const expectedValue = 84647.58 * 0.129 + 10000 * 1.0;

      expect(snapshotData?.totalValue).toBeCloseTo(expectedValue, 2);
      expect(snapshotData?.agentId).toBe(mockAgentId);
      expect(snapshotData?.competitionId).toBe(mockCompetitionId);
    });

    it("should handle the bug case: same address on multiple chains with map collision", async () => {
      const mockCompetition = {
        id: mockCompetitionId,
        status: "active",
        endDate: null,
      };

      // Reproduce the exact bug: ORDER on both Arbitrum and Polygon
      const orderTokenAddress = "0x4E200fE2f3eFb977d5fd9c430A41531FB04d97B8";

      const mockBalances: SelectBalance[] = [
        {
          id: 1,
          agentId: mockAgentId,
          competitionId: mockCompetitionId,
          tokenAddress: orderTokenAddress,
          amount: 84647.58,
          symbol: "ORDER",
          specificChain: "arbitrum", // ORDER on Arbitrum @ $0.129
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          agentId: mockAgentId,
          competitionId: mockCompetitionId,
          tokenAddress: orderTokenAddress, // Same address!
          amount: 100,
          symbol: "ORDER",
          specificChain: "polygon", // Different ORDER on Polygon @ $0.039
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Simulate getBulkPrices being called and returning prices for both chains
      // First call returns Polygon price, second call returns Arbitrum price
      vi.mocked(mockPriceTrackerService.getBulkPrices)
        .mockResolvedValueOnce(
          new Map([
            [
              orderTokenAddress,
              {
                price: 0.039, // Polygon price
                symbol: "ORDER",
                token: orderTokenAddress,
                timestamp: new Date(),
                chain: BlockchainType.EVM,
                specificChain: "polygon",
                pairCreatedAt: undefined,
                volume: undefined,
                liquidity: undefined,
                fdv: undefined,
              },
            ],
          ]),
        )
        .mockResolvedValueOnce(
          new Map([
            [
              orderTokenAddress,
              {
                price: 0.129, // Arbitrum price
                symbol: "ORDER",
                token: orderTokenAddress,
                timestamp: new Date(),
                chain: BlockchainType.EVM,
                specificChain: "arbitrum",
                pairCreatedAt: undefined,
                volume: undefined,
                liquidity: undefined,
                fdv: undefined,
              },
            ],
          ]),
        );

      // Setup mocks
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        mockCompetition as never,
      );
      vi.mocked(mockBalanceService.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockCompetitionRepo.createPortfolioSnapshot).mockResolvedValue(
        undefined as never,
      );

      // Execute
      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        mockCompetitionId,
        mockAgentId,
      );

      // Verify portfolio snapshot was created
      expect(mockCompetitionRepo.createPortfolioSnapshot).toHaveBeenCalledTimes(
        1,
      );

      const snapshotCall = vi.mocked(
        mockCompetitionRepo.createPortfolioSnapshot,
      ).mock.calls[0];

      expect(snapshotCall).toBeDefined();
      const snapshotData = snapshotCall![0];

      // Expected calculation with chain-specific prices:
      // ORDER (arbitrum): 84647.58 × $0.129 = $10,919.54
      // ORDER (polygon): 100 × $0.039 = $3.90
      // Total: $10,923.44
      const expectedValue = 84647.58 * 0.129 + 100 * 0.039;

      expect(snapshotData?.totalValue).toBeCloseTo(expectedValue, 2);
      expect(snapshotData?.agentId).toBe(mockAgentId);
      expect(snapshotData?.competitionId).toBe(mockCompetitionId);

      // Verify getBulkPrices was called twice (once per retry for missing chain)
      expect(mockPriceTrackerService.getBulkPrices).toHaveBeenCalledTimes(2);
    });

    it("should mark unavailable chains as null when price found on only one chain", async () => {
      const mockCompetition = {
        id: mockCompetitionId,
        status: "active",
        endDate: null,
      };

      const orderTokenAddress = "0x4E200fE2f3eFb977d5fd9c430A41531FB04d97B8";

      // Agent has ORDER on Arbitrum only, but system might check Polygon too
      const mockBalances: SelectBalance[] = [
        {
          id: 1,
          agentId: mockAgentId,
          competitionId: mockCompetitionId,
          tokenAddress: orderTokenAddress,
          amount: 84647.58,
          symbol: "ORDER",
          specificChain: "arbitrum",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock: getBulkPrices returns Arbitrum price
      vi.mocked(mockPriceTrackerService.getBulkPrices).mockResolvedValue(
        new Map([
          [
            orderTokenAddress,
            {
              price: 0.129,
              symbol: "ORDER",
              token: orderTokenAddress,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain: "arbitrum",
              pairCreatedAt: undefined,
              volume: undefined,
              liquidity: undefined,
              fdv: undefined,
            },
          ],
        ]),
      );

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        mockCompetition as never,
      );
      vi.mocked(mockBalanceService.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockCompetitionRepo.createPortfolioSnapshot).mockResolvedValue(
        undefined as never,
      );

      // Execute
      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        mockCompetitionId,
        mockAgentId,
      );

      // Verify snapshot created with correct value
      expect(mockCompetitionRepo.createPortfolioSnapshot).toHaveBeenCalledTimes(
        1,
      );

      const snapshotCall = vi.mocked(
        mockCompetitionRepo.createPortfolioSnapshot,
      ).mock.calls[0];

      const snapshotData = snapshotCall![0];
      const expectedValue = 84647.58 * 0.129;

      expect(snapshotData?.totalValue).toBeCloseTo(expectedValue, 2);

      // Verify no errors logged (price was found successfully)
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
